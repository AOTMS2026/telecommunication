"""
runpod/orchestrator/tts.py

UPDATED — Telugu-first, fully free/open-source TTS.

Uses `ai4bharat/indic-parler-tts` (free, open weights on Hugging Face, built
by AI4Bharat / IIT Madras specifically for Indian languages, Telugu included)
instead of Piper — Piper has NO official Telugu voice at all (confirmed
against Piper's own voice catalog), so it could never have spoken Telugu to
your students.

Indic Parler-TTS takes plain text + a short English "description" of the
desired voice style (tone/pace), and auto-detects which of its 21 supported
languages to speak based on the *script* of the input text — so Telugu text
comes out as Telugu speech with no extra language flag needed. This is
simpler to integrate than AI4Bharat's other option (IndicF5), which requires
a reference voice-clone audio clip; Indic Parler-TTS does not.

Trade-off vs. a paid API (e.g. Sarvam AI): this open model is heavier
(runs on the GPU, not a fast hosted endpoint) and a notch behind a
commercial, telephony-tuned voice in raw naturalness — but it costs nothing
beyond the GPU time you're already paying RunPod for.
"""

import audioop
import io
import os
import wave

import numpy as np

LOCAL_DEV = os.environ.get("LOCAL_DEV") == "1"

# A consistent, friendly voice description used for every utterance. Indic
# Parler-TTS reads this as a style instruction, not literal text-to-speak.
_VOICE_DESCRIPTION = (
    "A warm, friendly female speaker delivers the speech in a clear, "
    "natural, moderately paced voice, suitable for a phone conversation."
)

if not LOCAL_DEV:
    import torch
    from transformers import AutoTokenizer
    from parler_tts import ParlerTTSForConditionalGeneration

    _DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
    _MODEL_ID = "ai4bharat/indic-parler-tts"

    _model = ParlerTTSForConditionalGeneration.from_pretrained(_MODEL_ID).to(_DEVICE)
    _tokenizer = AutoTokenizer.from_pretrained(_MODEL_ID)
    _description_tokenizer = AutoTokenizer.from_pretrained(_model.config.text_encoder._name_or_path)
    _MODEL_SAMPLE_RATE = _model.config.sampling_rate
else:
    # LOCAL_DEV=1 — skip loading the (multi-GB) Parler-TTS weights entirely.
    # synthesize_to_mulaw() below returns a tiny chunk of silence instead, so
    # you can exercise server.py's send_tts()/WebSocket framing without a GPU
    # or a multi-gigabyte download. Real synthesis only runs on the RunPod pod.
    _model = None
    _MODEL_SAMPLE_RATE = 24000  # placeholder, unused in LOCAL_DEV


def _resample_to_8k_mulaw(pcm_bytes: bytes, src_rate: int) -> bytes:
    pcm16, _ = audioop.ratecv(pcm_bytes, 2, 1, src_rate, 8000, None)
    return audioop.lin2ulaw(pcm16, 2)


def synthesize_to_mulaw(text: str, language: str | None = None) -> bytes:
    """
    `language` is accepted for compatibility with server.py's call site but
    is NOT used to pick a different model/voice — Indic Parler-TTS infers the
    spoken language directly from the Telugu/English script in `text` itself,
    so a Telugu reply is simply spoken in Telugu without any extra flag.
    """
    if LOCAL_DEV:
        # ~200ms of mu-law silence (0xFF) — enough to round-trip through
        # server.py's base64/WebSocket framing without a real voice model.
        return bytes([0xFF]) * 1600

    if not text.strip():
        return b""

    description_ids = _description_tokenizer(_VOICE_DESCRIPTION, return_tensors="pt").to(_model.device)
    prompt_ids = _tokenizer(text, return_tensors="pt").to(_model.device)

    import torch
    with torch.no_grad():
        generation = _model.generate(
            input_ids=description_ids.input_ids,
            attention_mask=description_ids.attention_mask,
            prompt_input_ids=prompt_ids.input_ids,
            prompt_attention_mask=prompt_ids.attention_mask,
        )

    audio_array = generation.cpu().numpy().squeeze()
    pcm16 = (np.clip(audio_array, -1.0, 1.0) * 32767).astype(np.int16).tobytes()

    return _resample_to_8k_mulaw(pcm16, _MODEL_SAMPLE_RATE)
