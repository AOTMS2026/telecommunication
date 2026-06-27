# runpod/orchestrator/Dockerfile
#
# Telugu STT/TTS stack:
#  - STT: faster-whisper with vasista22/whisper-telugu-medium (converted to
#         CTranslate2 at BUILD time — baked into the image, zero runtime download)
#  - TTS: edge-tts (Microsoft Edge neural voices — no GPU, no model download)
#  - LLM: GPT-4.1-mini via openai SDK
#
FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# --- Set HuggingFace cache dir so model is baked into the image layer ---
ENV HF_HOME=/app/models
ENV TRANSFORMERS_CACHE=/app/models
ENV HF_DATASETS_CACHE=/app/models

# --- Convert Telugu-finetuned Whisper to CTranslate2 at BUILD TIME ---
# Downloads once during docker build, baked into image — zero runtime download.
# This is the step that was hanging at runtime before because HF_HOME wasn't set.
RUN ct2-transformers-converter \
      --model vasista22/whisper-telugu-medium \
      --output_dir /app/models/whisper-telugu-medium \
      --quantization float16 \
      --force

COPY . .

EXPOSE 8080

CMD ["python3", "server.py"]