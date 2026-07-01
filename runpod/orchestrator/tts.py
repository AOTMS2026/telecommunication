"""
runpod/orchestrator/tts.py
ElevenLabs Text-to-Speech. No GPU, no local model.
"""

import audioop
import io
import os

import aiohttp

LOCAL_DEV = os.environ.get("LOCAL_DEV") == "1"

ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
ELEVENLABS_TTS_MODEL = os.environ.get("ELEVENLABS_TTS_MODEL", "eleven_flash_v2_5")
ELEVENLABS_VOICE_ID = os.environ.get("ELEVENLABS_VOICE_ID", "")

_VOICE_OVERRIDES = {
    "Telugu": os.environ.get("ELEVENLABS_VOICE_ID_TELUGU", ELEVENLABS_VOICE_ID),
    "English": os.environ.get("ELEVENLABS_VOICE_ID_ENGLISH", ELEVENLABS_VOICE_ID),
    "Hinglish": os.environ.get("ELEVENLABS_VOICE_ID_HINGLISH", ELEVENLABS_VOICE_ID),
}

if not LOCAL_DEV:
    from pydub import AudioSegment


def _resample_to_8k_pcm16(pcm_bytes: bytes, src_rate: int, channels: int = 1) -> bytes:
    if channels == 2:
        pcm_bytes = audioop.tomono(pcm_bytes, 2, 0.5, 0.5)
    pcm16, _ = audioop.ratecv(pcm_bytes, 2, 1, src_rate, 8000, None)
    return pcm16


async def _synthesize_mp3(text: str, voice_id: str) -> bytes:
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}"
    headers = {"xi-api-key": ELEVENLABS_API_KEY, "Content-Type": "application/json"}
    payload = {"text": text, "model_id": ELEVENLABS_TTS_MODEL}

    async with aiohttp.ClientSession() as session:
        async with session.post(url, headers=headers, json=payload) as resp:
            if resp.status != 200:
                body = await resp.text()
                print(f"[tts] elevenlabs error {resp.status}: {body}")
                return b""
            return await resp.read()


async def synthesize_to_pcm16(text: str, language: str | None = None) -> bytes:
    if LOCAL_DEV:
        return bytes(3200)

    if not text.strip():
        return b""

    voice_id = _VOICE_OVERRIDES.get(language, ELEVENLABS_VOICE_ID)
    if not voice_id:
        print("[tts] no ELEVENLABS_VOICE_ID configured")
        return b""

    mp3_bytes = await _synthesize_mp3(text, voice_id)
    if not mp3_bytes:
        return b""

    audio = AudioSegment.from_file(io.BytesIO(mp3_bytes), format="mp3")
    pcm_bytes = audio.raw_data

    return _resample_to_8k_pcm16(pcm_bytes, audio.frame_rate, channels=audio.channels)