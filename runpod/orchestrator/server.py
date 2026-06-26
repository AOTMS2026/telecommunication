"""
runpod/orchestrator/server.py

Main entrypoint. One WebSocket connection per Twilio call (Media Streams,
opened from the TwiML <Connect><Stream url="wss://.../media"> in
backend/src/routes/aiCaller.js). This process owns the entire conversation
state for the lifetime of one call — no cross-process session store is
needed (see migration plan §8): the orchestrator talks to AOTMS exactly twice
per call (fetch context at start, post outcome at end).

Twilio Media Streams message types handled: "start", "media", "stop".
Reference: https://www.twilio.com/docs/voice/media-streams/websocket-messages
"""

import asyncio
import base64
import json
import os
import time

import websockets

from stt import transcribe_segment
from tts import synthesize_to_mulaw
from gpt_client import get_agent_reply, get_call_outcome
from memory_client import fetch_call_context
from outcome_client import post_call_outcome

PORT = int(os.environ.get("PORT", 8080))

# Simple energy-based VAD gate: treat a run of near-silence frames as the end
# of the student's speech segment. Twilio sends 20ms mu-law frames; ~600ms of
# silence is a reasonable "they've finished talking" threshold for phone calls.
SILENCE_FRAME_THRESHOLD = 30
SILENCE_RMS_CUTOFF = 400


class CallSession:
    def __init__(self, call_sid: str):
        self.call_sid = call_sid
        self.stream_sid = ""          # FIX: Twilio streamSid is separate from callSid
        self.lead_id = None
        self.campaign_id = None
        self.conversation: list[dict] = []
        self.outcome_extraction_prompt: dict | None = None
        self.language: str | None = None
        self.started_at = time.time()
        self.audio_buffer = bytearray()
        self.silence_run = 0


async def handle_connection(ws):
    session = CallSession(call_sid="")

    async for raw in ws:
        try:
            message = json.loads(raw)
        except json.JSONDecodeError:
            continue

        event = message.get("event")
        if event == "start":
            await handle_start(ws, session, message)
        elif event == "media":
            await handle_media(ws, session, message)
        elif event == "stop":
            await handle_stop(session)
            break


async def handle_start(ws, session: CallSession, message: dict):
    start = message.get("start", {})
    session.call_sid = start.get("callSid", "")
    session.stream_sid = start.get("streamSid", "")   # FIX: capture streamSid from start event

    custom_params = start.get("customParameters", {})
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


async def handle_media(ws, session: CallSession, message: dict):
    payload = message.get("media", {}).get("payload")
    if not payload:
        return

    chunk = base64.b64decode(payload)
    session.audio_buffer.extend(chunk)

    # FIX: Twilio mu-law encodes silence as 0xFF only — removed incorrect 0x7F check
    is_silent = all(abs(b - 0xFF) < 4 for b in chunk[:20])
    session.silence_run = session.silence_run + 1 if is_silent else 0

    if session.silence_run >= SILENCE_FRAME_THRESHOLD and len(session.audio_buffer) > 0:
        segment = bytes(session.audio_buffer)
        session.audio_buffer.clear()
        session.silence_run = 0
        # FIX: timeout guard so a hung STT/GPT call doesn't stall the WebSocket forever
        try:
            await asyncio.wait_for(process_speech_segment(ws, session, segment), timeout=10.0)
        except asyncio.TimeoutError:
            print(f"[server] process_speech_segment timed out for call {session.call_sid}")


async def process_speech_segment(ws, session: CallSession, mulaw_bytes: bytes):
    text = transcribe_segment(mulaw_bytes, language_hint=session.language)
    if not text:
        return

    session.conversation.append({"role": "user", "content": text})
    reply = await get_agent_reply(session.conversation)
    session.conversation.append({"role": "assistant", "content": reply})

    await send_tts(ws, session, reply)


async def send_tts(ws, session: CallSession, text: str):
    mulaw_audio = synthesize_to_mulaw(text, language=session.language)
    payload = base64.b64encode(mulaw_audio).decode("ascii")
    await ws.send(json.dumps({
        "event": "media",
        "streamSid": session.stream_sid,   # FIX: use streamSid, not callSid
        "media": {"payload": payload},
    }))


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