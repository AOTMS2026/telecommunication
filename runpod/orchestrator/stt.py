"""
runpod/orchestrator/stt.py
ElevenLabs Speech-to-Text (Scribe). No GPU, no local model.
"""

import io
import os
import wave

import aiohttp

LOCAL_DEV = os.environ.get("LOCAL_DEV") == "1"

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_STT_URL = "https://api.elevenlabs.io/v1/speech-to-text"
ELEVENLABS_STT_MODEL = os.environ.get("ELEVENLABS_STT_MODEL", "scribe_v1")

_LANGUAGE_CODES = {
    "Telugu": "tel",
    "English": "eng",
    "Hinglish": "hin",
}
_DEFAULT_LANGUAGE_CODE = os.environ.get("ELEVENLABS_STT_LANGUAGE_CODE", "tel")


def _pcm16_to_wav(pcm16_bytes: bytes, sample_rate: int = 8000) -> bytes:
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        wf.writeframes(pcm16_bytes)
    return buf.getvalue()


async def transcribe_segment(pcm16_bytes: bytes, language_hint: str | None = None) -> str:
    if LOCAL_DEV:
        return "అవును, నాకు ఇంట్రెస్ట్ ఉంది, మరింత వివరాలు చెప్పండి." if pcm16_bytes else ""

    if not pcm16_bytes:
        return ""

    wav_bytes = _pcm16_to_wav(pcm16_bytes)
    language_code = _LANGUAGE_CODES.get(language_hint, _DEFAULT_LANGUAGE_CODE)

    form = aiohttp.FormData()
    form.add_field("model_id", ELEVENLABS_STT_MODEL)
    form.add_field("language_code", language_code)
    form.add_field("file", wav_bytes, filename="segment.wav", content_type="audio/wav")

    headers = {"xi-api-key": ELEVENLABS_API_KEY}

    async with aiohttp.ClientSession() as session:
        async with session.post(ELEVENLABS_STT_URL, headers=headers, data=form) as resp:
            if resp.status != 200:
                body = await resp.text()
                print(f"[stt] elevenlabs error {resp.status}: {body}")
                return ""
            data = await resp.json()
            return (data.get("text") or "").strip()