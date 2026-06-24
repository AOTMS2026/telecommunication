"""
runpod/orchestrator/tts.py

Thin wrapper around Piper TTS. Synthesizes the agent's reply text to PCM audio,
resamples/encodes to mu-law 8kHz so it can be streamed straight back to Twilio
Media Streams as base64 `media` event payloads.
"""

import audioop
import io
import wave
from piper import PiperVoice

_VOICES = {
    "English": PiperVoice.load("/app/voices/en_IN.onnx"),
    "Telugu": PiperVoice.load("/app/voices/te_IN.onnx"),
}
_DEFAULT_VOICE_KEY = "English"


def _resample_to_8k_mulaw(pcm_bytes: bytes, src_rate: int) -> bytes:
    pcm16, _ = audioop.ratecv(pcm_bytes, 2, 1, src_rate, 8000, None)
    return audioop.lin2ulaw(pcm16, 2)


def synthesize_to_mulaw(text: str, language: str | None = None) -> bytes:
    voice = _VOICES.get(language, _VOICES[_DEFAULT_VOICE_KEY])

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wav_file:
        voice.synthesize(text, wav_file)

    buf.seek(0)
    with wave.open(buf, "rb") as wav_file:
        src_rate = wav_file.getframerate()
        pcm_bytes = wav_file.readframes(wav_file.getnframes())

    return _resample_to_8k_mulaw(pcm_bytes, src_rate)
