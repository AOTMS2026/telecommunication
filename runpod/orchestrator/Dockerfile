# runpod/orchestrator/Dockerfile
#
# Free Telugu STT/TTS stack:
#  - Converts vasista22/whisper-telugu-medium (free, open Telugu-finetuned
#    Whisper) to CTranslate2 format at BUILD time, so faster-whisper can load
#    it at GPU speed with zero runtime conversion cost.
#  - Pre-downloads ai4bharat/indic-parler-tts (free, open Telugu TTS) into the
#    image so the pod doesn't re-download multi-GB weights on every cold start.
#
# Base image with CUDA + PyTorch for GPU inference.
FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Convert the free Telugu-finetuned Whisper checkpoint to CTranslate2 ---
# This is a ONE-TIME, free conversion of free, open weights — no API cost,
# no license fee. Runs once at image build time, not per-call.
RUN pip install --no-cache-dir "transformers[sentencepiece]" ctranslate2 && \
    ct2-transformers-converter \
      --model vasista22/whisper-telugu-medium \
      --output_dir /app/models/whisper-telugu-medium \
      --quantization float16 \
      --force

# --- Pre-download the free AI4Bharat Indic Parler-TTS weights into the image ---
# (Bakes the ~GB-scale model into the image layer so cold-starts don't pay a
# multi-minute download penalty; comment out if you'd rather download at
# first run and keep the image smaller.)
RUN python3 -c "\
from transformers import AutoTokenizer; \
from parler_tts import ParlerTTSForConditionalGeneration; \
m = ParlerTTSForConditionalGeneration.from_pretrained('ai4bharat/indic-parler-tts'); \
AutoTokenizer.from_pretrained('ai4bharat/indic-parler-tts'); \
AutoTokenizer.from_pretrained(m.config.text_encoder._name_or_path) \
"

COPY . .

EXPOSE 8080

CMD ["python3", "server.py"]
