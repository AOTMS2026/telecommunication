"""
runpod/orchestrator/server.py

Main entrypoint. One WebSocket connection per Exotel call (AgentStream
Voicebot Applet, configured in the Exotel call flow / Legs API to point at
this pod's public WSS URL — see backend/src/services/aiCaller/dialer.js and
backend/src/routes/aiCaller.js's /stream-url resolver). This process owns
the entire conversation state for the lifetime of one call — no cross-process
session store is needed (see migration plan §8): the orchestrator talks to
AOTMS exactly twice per call (fetch context at start, post outcome at end).

EXOTEL MIGRATION: event names/fields and audio codec changed from Twilio
Media Streams to Exotel AgentStream. Exotel message types handled:
"connected", "start", "media", "dtmf", "stop". (Exotel also has "mark" and
"clear", which we now SEND to Exotel for barge-in handling — see
send_tts()/handle_media() below — but do not need to receive, since this
orchestrator currently doesn't echo Exotel's own mark acks back into any
session state.) Field names are snake_case per Exotel's payload shape
(stream_sid, call_sid, custom_parameters), not Twilio's camelCase.
Audio is raw Linear PCM16 8kHz mono, NOT mu-law.
Reference: https://developer.exotel.com/docs/agentstream/developer-guide
"""

import asyncio
import audioop
import base64
import json
import os
import time

import websockets

from stt import transcribe_segment
from tts import synthesize_to_pcm16
from gpt_client import get_agent_reply, get_call_outcome
from memory_client import fetch_call_context
from outcome_client import post_call_outcome

PORT = int(os.environ.get("PORT", 8080))

# Simple energy-based VAD gate: treat a run of near-silence frames as the end
# of the student's speech segment. Exotel sends 20ms PCM16 frames; ~600ms of
# silence is a reasonable "they've finished talking" threshold for phone calls.
SILENCE_FRAME_THRESHOLD = 30
SILENCE_RMS_CUTOFF = 400

# EXOTEL: outbound media payloads must be chunked into multiples of 320 bytes
# per Exotel's docs ("chunk size should always be in multiple of 320 bytes... if
# greater than 100k, it might result in timeouts"). At 8kHz mono PCM16,
# 320 bytes = 160 samples = 20ms of audio. We send ~100ms frames (5 * 320 = 1600
# bytes), which matches Exotel's own guidance of "100ms PCM chunks with 3200
# bytes of raw audio" elsewhere in their docs for the typical 16kHz case; at our
# 8kHz output rate 1600 bytes is the equivalent 100ms chunk.
EXOTEL_FRAME_BYTES = 1600


class CallSession:
    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.stream_sid = ""          # Exotel stream_sid (snake_case), captured from "start"
        self.lead_id = None
        self.campaign_id = None
        self.conversation: list[dict] = []
        self.outcome_extraction_prompt: dict | None = None
        self.language: str | None = None
        self.started_at = time.time()
        self.audio_buffer = bytearray()
        self.silence_run = 0
        self.agent_speaking = False   # EXOTEL: tracks barge-in state — see handle_media()


async def handle_connection(ws):
    session = CallSession(call_sid="")

    async for raw in ws:
        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            continue

        event = message.get("event")
        if event == "connected":
            # EXOTEL: new event Twilio doesn't send — fired once on WebSocket
            # handshake, before "start". No session data is available yet
            # (no stream_sid/call_sid/custom_parameters), so there's nothing
            # to initialize here; real setup happens in handle_start() below.
            print("[server] exotel handshake: connected")
        elif event == "start":
            await handle_start(ws, session, message)
        elif event == "media":
            should_end = await handle_media(ws, session, message)
            if should_end:
                # EXOTEL: per their docs, "there is no explicit Stop event sent
                # from the bot to Exotel" — closing the WebSocket ourselves is
                # what tells Exotel the bot is done and to advance to the next
                # applet (e.g. a Passthru → escalation/hangup). We still run
                # handle_stop() now (not in the "stop" branch below) since
                # Exotel won't send its own "stop" event back to us first.
                await handle_stop(session)
                await ws.close()
                break
        elif event == "dtmf":
            # EXOTEL: caller pressed a key. Not currently wired into any
            # IVR/escalation branch — logged so it's visible, not silently
            # dropped as it was before this migration.
            digit = message.get("dtmf", {}).get("digit", "")
            print(f"[server] dtmf received: {digit} call={session.call_sid}")
        elif event == "stop":
            await handle_stop(session)
            break
        else:
            print(f"[server] unhandled event type: {event}")


async def handle_start(ws, session: CallSession, message: dict):
    start = message.get("start", {})
    session.call_sid = start.get("call_sid", "")
    session.stream_sid = start.get("stream_sid", "")   # EXOTEL: snake_case field name

    custom_params = start.get("custom_parameters", {})  # EXOTEL: snake_case field name
    session.lead_id = custom_params.get("leadId")
    session.campaign_id = custom_params.get("campaignId")

    print(f"[server] call started: {session.call_sid} stream={session.stream_sid} lead={session.lead_id}")

    if session.lead_id:
        try:
            context = await fetch_call_context(session.lead_id)
            session.outcome_extraction_prompt = context["outcomeExtractionPrompt"]
            session.language = context.get("language") or None
            session.conversation = [{"role": "system", "content": context["systemPrompt"]}]

            # Speak the welcome greeting immediately, before waiting on the student.
            greeting = context["welcomeGreeting"]
            session.conversation.append({"role": "assistant", "content": greeting})
            await send_tts(ws, session, greeting)
        except Exception as err:
            print(f"[server] fetch_call_context failed: {err}")
            session.conversation = [{
                "role": "system",
                "content": "You are Priya, a friendly course counselor from AOTMS. Keep replies short.",
            }]


async def handle_media(ws, session: CallSession, message: dict) -> bool:
    """Returns True if the bot has decided the call is over and the caller
    (handle_connection) should now close the WebSocket gracefully."""
    payload = message.get("media", {}).get("payload")
    if not payload:
        return False

    chunk = base64.b64decode(payload)
    session.audio_buffer.extend(chunk)

    # EXOTEL: real RMS-based silence detection on PCM16 audio. The old
    # mu-law byte-value check (`abs(b - 0xFF) < 4`) is gone — that only made
    # sense for mu-law's silence byte (0xFF) and Exotel sends linear PCM16,
    # whose silence value is ~0x0000, not 0xFF. SILENCE_RMS_CUTOFF was
    # already declared above but never actually used — now it is.
    # BUGFIX: audioop.rms() requires an even number of bytes (whole PCM16
    # samples) and raises audioop.error on a malformed/truncated chunk —
    # guard against that instead of letting it crash the whole connection.
    if chunk and len(chunk) % 2 == 0:
        chunk_rms = audioop.rms(chunk, 2)
    else:
        chunk_rms = 0
    is_silent = chunk_rms < SILENCE_RMS_CUTOFF

    # EXOTEL BARGE-IN: if the caller starts talking while our TTS audio is
    # still playing out, tell Exotel to clear any queued/playing audio so
    # the agent stops talking over them, instead of finishing its line.
    # Exotel's "clear" event wipes audio sent-but-not-yet-played; Twilio's
    # raw Media Streams (the old transport) had no equivalent primitive, so
    # this is new behavior enabled by the migration, not a port of old code.
    if not is_silent and session.agent_speaking:
        await ws.send(json.dumps({
            "event": "clear",
            "stream_sid": session.stream_sid,
        }))
        session.agent_speaking = False

    session.silence_run = session.silence_run + 1 if is_silent else 0

    if session.silence_run >= SILENCE_FRAME_THRESHOLD and len(session.audio_buffer) > 0:
        segment = bytes(session.audio_buffer)
        session.audio_buffer.clear()
        session.silence_run = 0
        # FIX: timeout guard so a hung STT/GPT call doesn't stall the WebSocket forever
        try:
            return await asyncio.wait_for(process_speech_segment(ws, session, segment), timeout=10.0)
        except asyncio.TimeoutError:
            print(f"[server] process_speech_segment timed out for call {session.call_sid}")
            return False

    return False


END_CALL_MARKER = "[[END_CALL]]"


async def process_speech_segment(ws, session: CallSession, pcm16_bytes: bytes) -> bool:
    """
    Returns True if the call should now be ended by the bot (Exotel requires
    US to close the WebSocket when the conversation is over — there is no
    bot-to-Exotel "Stop" event; closing the socket is what tells Exotel to
    advance to the next applet in the call flow).
    """
    text = transcribe_segment(pcm16_bytes, language_hint=session.language)
    if not text:
        return False

    session.conversation.append({"role": "user", "content": text})
    reply = await get_agent_reply(session.conversation)

    should_end = END_CALL_MARKER in reply
    spoken_reply = reply.replace(END_CALL_MARKER, "").strip()

    session.conversation.append({"role": "assistant", "content": spoken_reply})

    try:
        await send_tts(ws, session, spoken_reply)
    except Exception as err:
        # BUGFIX: a transient ws.send() failure here (e.g. Exotel's socket
        # closing mid-call) previously propagated up through handle_media()
        # uncaught, killing handle_connection's read loop and ending the call
        # with no "stop" event ever processed, so no outcome would be posted.
        # Log and continue — if the socket is truly dead, the next iteration
        # of handle_connection's `async for raw in ws` loop will end naturally.
        print(f"[server] send_tts failed for call {session.call_sid}: {err}")
        return False

    return should_end


async def send_tts(ws, session: CallSession, text: str):
    pcm16_audio = await synthesize_to_pcm16(text, language=session.language)
    if not pcm16_audio:
        return

    session.agent_speaking = True
    try:
        # EXOTEL: chunk size must be a multiple of 320 bytes, and large single
        # payloads risk timeouts (Exotel's docs: "if the size is greater than
        # 100k, it might result in timeouts"). We previously sent the entire
        # synthesized utterance as one base64 payload in a single WS message —
        # for any multi-sentence reply that could be well over 100KB. Now we
        # split into EXOTEL_FRAME_BYTES (1600-byte, ~100ms) chunks, each already
        # a multiple of 320, and pad only the final partial chunk with silence
        # so every frame sent is a clean multiple of 320 bytes.
        for offset in range(0, len(pcm16_audio), EXOTEL_FRAME_BYTES):
            frame = pcm16_audio[offset:offset + EXOTEL_FRAME_BYTES]
            remainder = len(frame) % 320
            if remainder:
                frame = frame + bytes(320 - remainder)  # pad final frame to a 320-byte multiple

            payload = base64.b64encode(frame).decode("ascii")
            await ws.send(json.dumps({
                "event": "media",
                "stream_sid": session.stream_sid,   # EXOTEL: snake_case field name
                "media": {"payload": payload},
            }))

        # EXOTEL: mark lets us know (via a returned "mark" event from Exotel)
        # when this utterance has actually finished playing out to the caller.
        # We don't currently listen for the echoed-back mark event (see the
        # "unhandled event type" log in handle_connection for visibility into
        # that), but agent_speaking is cleared optimistically once all frames
        # are sent so barge-in detection in handle_media() re-arms promptly.
        await ws.send(json.dumps({
            "event": "mark",
            "stream_sid": session.stream_sid,
            "mark": {"name": f"reply-{int(time.time() * 1000)}"},
        }))
    finally:
        # BUGFIX: guarantee agent_speaking is reset even if a ws.send() above
        # raises partway through (closed socket, network blip) — otherwise
        # barge-in detection in handle_media() would stay permanently
        # disarmed for the rest of the call. The exception itself still
        # propagates to the caller after this finally block runs.
        session.agent_speaking = False


async def handle_stop(session: CallSession):
    duration_seconds = int(time.time() - session.started_at)
    had_conversation = any(m["role"] == "user" for m in session.conversation)

    print(f"[server] call stopped: {session.call_sid} duration={duration_seconds}s")

    if not session.lead_id or not had_conversation:
        return

    transcript_messages = [m for m in session.conversation if m["role"] != "system"]
    transcript_text = "\n".join(
        f"{'Student' if m['role'] == 'user' else 'Agent'}: {m['content']}"
        for m in transcript_messages
    )

    outcome = await get_call_outcome(
        session.outcome_extraction_prompt
        or {"role": "system", "content": "Summarize this call as JSON with key conversationSummary."},
        transcript_messages,
    )

    try:
        await post_call_outcome(
            lead_id=session.lead_id,
            outcome=outcome,
            transcript=transcript_text,
            duration_seconds=duration_seconds,
            call_sid=session.call_sid,
            campaign_id=session.campaign_id,
        )
    except Exception as err:
        print(f"[server] post_call_outcome failed: {err}")


async def main():
    async with websockets.serve(handle_connection, "0.0.0.0", PORT):
        print(f"[server] RunPod orchestrator listening on :{PORT}")
        await asyncio.Future()  # run forever


if __name__ == "__main__":
    asyncio.run(main())