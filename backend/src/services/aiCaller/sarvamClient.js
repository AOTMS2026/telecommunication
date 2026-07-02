// backend/src/services/aiCaller/sarvamClient.js
//
// Sarvam AI STT + TTS client — replaces the Python faster-whisper/edge-tts
// stack that previously ran on RunPod. Both are simple HTTP API calls, so
// the orchestrator can now run inside the existing Node.js backend on Render
// with no GPU pod required.
//
// API docs: https://docs.sarvam.ai/api-reference-docs
// Sign up at sarvam.ai → get API key → set SARVAM_API_KEY in Render env vars.
//
// STT: POST https://api.sarvam.ai/speech-to-text
//   Accepts a WAV file (multipart), returns { transcript: "..." }
//   Telugu model: saaras:v2, language_code: te-IN
//
// TTS: POST https://api.sarvam.ai/text-to-speech
//   Accepts JSON with text, returns { audios: ["base64_wav_data"] }
//   Telugu voice: meera (female), bulbul:v1 model
//   We request 8kHz output directly, matching what Exotel AgentStream expects.

const axios = require('axios');
const FormData = require('form-data');

const SARVAM_STT_URL = 'https://api.sarvam.ai/speech-to-text';
const SARVAM_TTS_URL = 'https://api.sarvam.ai/text-to-speech';

function getSarvamKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) throw new Error('SARVAM_API_KEY is not configured on the server');
  return key;
}

// ─── WAV helpers (pure Node.js, no npm package needed) ─────────────────────

/**
 * Wraps raw PCM16 bytes in a WAV header so Sarvam STT can accept it.
 * Exotel sends 8kHz mono PCM16 little-endian — those parameters are baked in.
 */
function buildWavBuffer(pcm16Bytes, sampleRate = 8000, channels = 1, bitsPerSample = 16) {
  const dataSize = pcm16Bytes.length;
  const byteRate = sampleRate * channels * (bitsPerSample / 8);
  const blockAlign = channels * (bitsPerSample / 8);
  const buf = Buffer.alloc(44 + dataSize);

  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);           // PCM chunk size
  buf.writeUInt16LE(1, 20);            // PCM = 1
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

/**
 * Strips the WAV header from a WAV Buffer returned by Sarvam TTS.
 * Looks for the 'data' chunk rather than assuming a fixed 44-byte header,
 * since some encoders emit extra chunks (e.g. 'LIST') before 'data'.
 * Returns the raw PCM16 payload only.
 */
function stripWavHeader(wavBuf) {
  let offset = 12; // skip 'RIFF' + size + 'WAVE'
  while (offset + 8 <= wavBuf.length) {
    const id = wavBuf.toString('ascii', offset, offset + 4);
    const size = wavBuf.readUInt32LE(offset + 4);
    if (id === 'data') return wavBuf.slice(offset + 8, offset + 8 + size);
    offset += 8 + size;
    if (size % 2 !== 0) offset++; // WAV chunks are word-aligned
  }
  // Fallback: assume standard 44-byte header
  return wavBuf.slice(44);
}

// ─── STT ────────────────────────────────────────────────────────────────────

/**
 * Transcribes a buffer of raw 8kHz mono PCM16 audio (as received from
 * Exotel's AgentStream) using Sarvam's Saaras v2 Telugu model.
 *
 * Returns a transcript string, or '' if the audio was silent/empty.
 */
async function transcribeAudio(pcm16Bytes) {
  if (!pcm16Bytes || pcm16Bytes.length < 320) return ''; // too short to transcribe

  const key = getSarvamKey();
  const wavBuf = buildWavBuffer(pcm16Bytes, 8000, 1);

  const form = new FormData();
  form.append('file', wavBuf, { filename: 'audio.wav', contentType: 'audio/wav' });
  form.append('language_code', 'te-IN');
  form.append('model', 'saaras:v2');

  const response = await axios.post(SARVAM_STT_URL, form, {
    headers: { ...form.getHeaders(), 'api-subscription-key': key },
    timeout: 12000,
  });

  return (response.data.transcript || '').trim();
}

// ─── TTS ────────────────────────────────────────────────────────────────────

/**
 * Synthesizes `text` to speech using Sarvam's Bulbul v1 Telugu voice.
 * Returns raw 8kHz mono PCM16 bytes (no WAV header) ready to be chunked
 * into 320-byte Exotel frames by orchestrator.js.
 *
 * `languageCode` defaults to 'te-IN'; pass 'en-IN' if needed for English.
 */
async function synthesizeSpeech(text, languageCode = 'te-IN') {
  if (!text || !text.trim()) return Buffer.alloc(0);

  const key = getSarvamKey();

  const body = {
    inputs: [text],
    target_language_code: languageCode,
    speaker: 'meera',          // best Telugu female voice in Bulbul v1
    model: 'bulbul:v1',
    pitch: 0,
    pace: 1.0,
    loudness: 1.5,
    speech_sample_rate: 8000,  // 8kHz — directly matches Exotel AgentStream's expected rate
    enable_preprocessing: true, // handles numbers, abbreviations, mixed script
    enc_format: 'wav',
  };

  const response = await axios.post(SARVAM_TTS_URL, body, {
    headers: { 'Content-Type': 'application/json', 'api-subscription-key': key },
    timeout: 15000,
  });

  const base64Audio = response.data?.audios?.[0];
  if (!base64Audio) throw new Error('Sarvam TTS returned no audio data');

  const wavBuf = Buffer.from(base64Audio, 'base64');
  return stripWavHeader(wavBuf); // raw PCM16 bytes at 8kHz
}

module.exports = { transcribeAudio, synthesizeSpeech };