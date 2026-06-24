"""
runpod/orchestrator/stt.py

Thin wrapper around faster-whisper for turning buffered call audio (mu-law,
8kHz, as sent by Twilio Media Streams) into text. Runs on speech-segment
boundaries detected by a simple energy-based VAD gate in server.py, not on
every raw audio frame, to keep latency and GPU load reasonable.
"""

import audioop
import numpy as np
from faster_whisper import WhisperModel

# "small" balances latency vs. accuracy well for short conversational turns on
# a single RTX 4090; bump to "medium" if Telugu/Hinglish accuracy needs improving.
_MODEL_SIZE = "small"
_model = WhisperModel(_MODEL_SIZE, device="cuda", compute_type="float16")


def _mulaw_to_pcm16(mulaw_bytes: bytes) -> np.ndarray:
    pcm16 = audioop.ulaw2lin(mulaw_bytes, 2)
    return np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0


def transcribe_segment(mulaw_bytes: bytes, language_hint: str | None = None) -> str:
    """
    `language_hint` maps AOTMS's lead.language ('Telugu'/'English'/'Hinglish') to
    a Whisper language code where possible; Whisper handles code-mixed
    Telugu-English reasonably well even without a hint, so this is best-effort.
    """
    audio = _mulaw_to_pcm16(mulaw_bytes)
    if audio.size == 0:
        return ""

    whisper_lang = {"Telugu": "te", "English": "en"}.get(language_hint)

    segments, _ = _model.transcribe(
        audio,
        language=whisper_lang,  # None lets Whisper auto-detect (fine for Hinglish/mixed)
        beam_size=1,
        vad_filter=True,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()
