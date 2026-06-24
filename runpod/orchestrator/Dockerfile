# runpod/orchestrator/Dockerfile
# Base image with CUDA + PyTorch for faster-whisper GPU inference.
FROM runpod/pytorch:2.2.0-py3.10-cuda12.1.1-devel-ubuntu22.04

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recursive \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Piper TTS binary + voice models (English + Telugu) — fetched at build time
# from Piper's released voice packs. Replace URLs with your chosen voice packs.
RUN mkdir -p /app/voices
# Example (adjust to actual Piper release URLs you select):
# RUN curl -L -o /app/voices/en_IN.onnx <piper-en-IN-voice-url>
# RUN curl -L -o /app/voices/te_IN.onnx <piper-te-IN-voice-url-if-available>

COPY . .

EXPOSE 8080

CMD ["python3", "server.py"]
