// backend/src/services/aiCaller/sarvamClient.js
//
// Per Sarvam+Exotel integration PDF:
// - STT: saaras:v3 model, sample_rate=8000, high_vad_sensitivity=true
// - TTS: bulbul:v1 model, output_audio_codec=pcm, sample_rate=8000
// - Exotel sends raw PCM16 8kHz 16-bit (per PDF spec — NOT mulaw)

const axios = require('axios');
const FormData = require('form-data');

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

function getSarvamKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not configured');
  return key;
}

// ─── WAV builder — wraps raw PCM16 8kHz from Exotel into WAV container ───────
function buildWavBuffer(pcm16Bytes, sampleRate = 8000, channels = 1, bitsPerSample = 16) {
  const dataSize = pcm16Bytes.length;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const buf = Buffer.alloc(44 + dataSize);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(channels, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(bitsPerSample, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(dataSize, 40);
  Buffer.from(pcm16Bytes).copy(buf, 44);
  return buf;
}

function stripWavHeader(wavBuf) {
  let offset = 12;
  while (offset + 8 <= wavBuf.length) {
    const id = wavBuf.toString('ascii', offset, offset + 4);
    const size = wavBuf.readUInt32LE(offset + 4);
    if (id === 'data') return wavBuf.slice(offset + 8, offset + 8 + size);
    offset += 8 + size;
    if (size % 2 !== 0) offset++;
  }
  return wavBuf.slice(44);
}

// ─── STT ─────────────────────────────────────────────────────────────────────
// Per PDF: model=saaras:v3, sample_rate=8000, high_vad_sensitivity=true
async function transcribeAudio(pcm16Bytes) {
  if (!pcm16Bytes || pcm16Bytes.length < 320) return '';

  const key = getSarvamKey();
  const wavBuf = buildWavBuffer(pcm16Bytes, 8000, 1, 16);

  const form = new FormData();
  form.append('file', wavBuf, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('language_code', 'te-IN');
  form.append('model', 'saaras:v3');         // per PDF: saaras:v3
  form.append('sample_rate', '8000');         // per PDF: must match Exotel 8kHz
  form.append('high_vad_sensitivity', 'true'); // per PDF: 0.5s silence boundary

  const response = await axios.post(SARVAM_STT_URL, form, {
    headers: { ...form.getHeaders(), 'api-subscription-key': key },
    timeout: 12000,
  });

  const transcript = (response.data.transcript || '').trim();
  if (transcript) console.log(`[sarvam-stt] "${transcript.slice(0, 80)}"`);
  return transcript;
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
// Per PDF: bulbul:v1, output_audio_codec=pcm, sample_rate=8000
async function synthesizeSpeech(text, languageCode = 'te-IN') {
  if (!text || !text.trim()) return Buffer.alloc(0);

  const key = getSarvamKey();

  const response = await axios.post(SARVAM_TTS_URL, {
    inputs: [text],
    target_language_code: languageCode,
    speaker: 'meera',
    model: 'bulbul:v1',
    pitch: 0,
    pace: 1.0,
    loudness: 1.5,
    speech_sample_rate: 8000,   // per PDF: matches Exotel audio engine
    enable_preprocessing: true,
    enc_format: 'wav',
  }, {
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
    timeout: 15000,
  });

  const base64Audio = response.data?.audios?.[0];
  if (!base64Audio) throw new Error('Sarvam TTS returned no audio');

  console.log(`[sarvam-tts] synthesized "${text.slice(0, 50)}"`);
  return stripWavHeader(Buffer.from(base64Audio, 'base64'));
}

module.exports = { transcribeAudio, synthesizeSpeech };