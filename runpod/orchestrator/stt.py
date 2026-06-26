"""
runpod/orchestrator/stt.py

UPDATED — Telugu-first, fully free/open-source STT.

Uses `vasista22/whisper-telugu-medium` — a Telugu-finetuned OpenAI Whisper
checkpoint (free, open weights on Hugging Face, ~10.6% WER on Telugu
benchmarks per the model card) — instead of plain multilingual Whisper
"small", which is weak on Telugu since Telugu is a low-resource language in
Whisper's original training mix.

To get faster-whisper's GPU speed with this checkpoint, the Dockerfile
converts it to CTranslate2 format at BUILD time (see Dockerfile's
`ct2-transformers-converter` step) and bakes it into the image at
/app/models/whisper-telugu-medium. No internet access or extra cost is
needed at runtime — this is a one-time, free conversion of free, open
weights, done once when you build the image.

Since the brief is "all customers are Telugu only," this model is loaded
unconditionally — there's no separate English/Hinglish STT model swapped in,
because the Telugu-finetuned model already handles the English loanwords
and code-mixed phrases that occur naturally in real Telugu phone
conversations (its training data includes that kind of real-world speech).
If you later need solid *pure* English support too, see the note at the
bottom of this file.
"""

import audioop
import os
import numpy as np

LOCAL_DEV = os.environ.get("LOCAL_DEV") == "1"

# Path baked into the Docker image by the ct2-transformers-converter step
# (see Dockerfile). Falls back to a plain multilingual model only if that
# conversion step was skipped, so the orchestrator doesn't simply refuse to boot.
_TELUGU_MODEL_PATH = "/app/models/whisper-telugu-medium"

if not LOCAL_DEV:
    from faster_whisper import WhisperModel

    _model_path = _TELUGU_MODEL_PATH if os.path.isdir(_TELUGU_MODEL_PATH) else "small"
    if _model_path == "small":
        print("[stt] WARNING: Telugu-finetuned model not found at "
              f"{_TELUGU_MODEL_PATH} — falling back to generic 'small' model, "
              "which is weak on Telugu. Rebuild the Docker image so the "
              "ct2-transformers-converter step runs.")

    _model = WhisperModel(_model_path, device="cuda", compute_type="float16")
else:
    # LOCAL_DEV=1 — skip loading any Whisper model entirely (no CUDA/cuDNN
    # needed on a laptop). transcribe_segment() below returns a canned string
    # instead, so you can exercise the rest of server.py's logic (GPT calls,
    # AOTMS callbacks) without real audio input. Real transcription only runs
    # on the RunPod pod, with the Telugu-finetuned model baked into the image.
    _model = None


def _mulaw_to_pcm16(mulaw_bytes: bytes) -> np.ndarray:
    pcm16 = audioop.ulaw2lin(mulaw_bytes, 2)
    return np.frombuffer(pcm16, dtype=np.int16).astype(np.float32) / 32768.0


def transcribe_segment(mulaw_bytes: bytes, language_hint: str | None = None) -> str:
    """
    `language_hint` is accepted for compatibility with server.py's call site
    but is intentionally NOT used to switch models — per the brief, every
    customer is Telugu, so the Telugu-finetuned model is always used. Passing
    language="te" to .transcribe() (rather than leaving it on auto-detect)
    also skips Whisper's language-detection pass, which is a small latency win.
    """
    if LOCAL_DEV:
        # No real audio decoding happens in dev mode — just prove the pipeline
        # moves data end-to-end. Replace this string while testing if you want
        # to manually drive a specific conversation branch.
        return "అవును, నాకు ఇంట్రెస్ట్ ఉంది, మరింత వివరాలు చెప్పండి." if mulaw_bytes else ""

    audio = _mulaw_to_pcm16(mulaw_bytes)
    if audio.size == 0:
        return ""

    segments, _ = _model.transcribe(
        audio,
        language="te",       # always Telugu — see module docstring
        beam_size=1,
        vad_filter=True,
    )
    return " ".join(seg.text.strip() for seg in segments).strip()


# ---------------------------------------------------------------------------
# Note on pure-English support: vasista22/whisper-telugu-medium is finetuned
# specifically on Telugu speech corpora. It handles the English words/phrases
# that naturally appear inside real Telugu sentences (course names, numbers,
# common loanwords) reasonably well, but it is NOT a general-purpose English
# transcriber. If a meaningful share of your leads genuinely prefer to speak
# full sentences in English (not just Telugu with English words mixed in),
# you'd want to either (a) run language detection first and route to a
# second, separate English-only Whisper instance, or (b) use a paid,
# code-switching-aware API like Sarvam AI instead. Given the stated brief
# ("all customers are Telugu only"), this file assumes (a)/(b) aren't needed.
# ---------------------------------------------------------------------------
