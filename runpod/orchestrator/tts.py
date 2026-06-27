"""
runpod/orchestrator/tts.py

UPDATED — switched from ai4bharat/indic-parler-tts to Microsoft Edge TTS
(`edge-tts` package). Reasoning, for the record:

  - indic-parler-tts is a GATED Hugging Face model (needs login + accepted
    terms + a baked-in access token) — adds setup friction with no benefit.
  - There's a reported issue on that model's own HF discussion page describing
    the downloaded checkpoint as missing its audio decoder (works for
    research/training inspection, not reliably for real inference). Not
    something to gamble a production telecaller on.
  - Edge TTS is free, non-gated, ships real Telugu neural voices
    (te-IN-ShrutiNeural / te-IN-MohanNeural), and is a lightweight cloud call
    rather than a multi-GB local model — much faster to set up and more
    predictable to operate than self-hosting a TTS model.

Trade-off: this depends on Microsoft's Edge TTS service being reachable from
the RunPod pod (just needs outbound internet, which pods have) — it is not
running on your own GPU, so there is no GPU cost for this layer at all,
unlike the original plan.
"""

import audioop
import io
import os

LOCAL_DEV = os.environ.get("LOCAL_DEV") == "1"

# Real Telugu neural voices from Edge TTS. Indexed by AOTMS's lead.language values.
_VOICES = {
    "Telugu": "te-IN-ShrutiNeural",
    "English": "en-IN-NeerjaNeural",
    "Hinglish": "en-IN-NeerjaNeural",  # closest available — Edge TTS has no dedicated Hinglish voice
}
_DEFAULT_VOICE = _VOICES["Telugu"]  # matches the Telugu-only customer base

if not LOCAL_DEV:
    import edge_tts
    import asyncio
    from pydub import AudioSegment


def _resample_to_8k_mulaw(pcm_bytes: bytes, src_rate: int, channels: int = 1) -> bytes:
    if channels == 2:
        pcm_bytes = audioop.tomono(pcm_bytes, 2, 0.5, 0.5)
    pcm16, _ = audioop.ratecv(pcm_bytes, 2, 1, src_rate, 8000, None)
    return audioop.lin2ulaw(pcm16, 2)


async def _synthesize_async(text: str, voice: str) -> bytes:
    communicate = edge_tts.Communicate(text, voice)
    mp3_bytes = bytearray()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            mp3_bytes.extend(chunk["data"])
    return bytes(mp3_bytes)


def synthesize_to_mulaw(text: str, language: str | None = None) -> bytes:
    """
    `language` selects which Telugu/English Edge TTS voice to use. Defaults
    to Telugu, matching the current customer base (see promptBuilder.js /
    Lead.js, which now default every lead's language to 'Telugu').
    """
    if LOCAL_DEV:
        # ~200ms of mu-law silence (0xFF) — enough to round-trip through
        # server.py's base64/WebSocket framing without a network call.
        return bytes([0xFF]) * 1600

    if not text.strip():
        return b""

    voice = _VOICES.get(language, _DEFAULT_VOICE)

    mp3_bytes = asyncio.run(_synthesize_async(text, voice))

    # Edge TTS returns MP3 — decode to raw PCM via pydub (uses ffmpeg, already
    # installed in the Dockerfile), then resample/encode to mu-law 8kHz for Twilio.
    audio = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
    pcm_bytes = audio.raw_data

    return _resample_to_8k_mulaw(pcm_bytes, audio.frame_rate, channels=audio.channels)