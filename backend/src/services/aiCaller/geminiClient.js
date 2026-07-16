// backend/src/services/aiCaller/geminiClient.js
//
// Single-vendor replacement for sarvamClient.js (STT+TTS) AND the OpenAI
// calls that lived inline in orchestrator.js (LLM brain + outcome
// extraction). Flow stays turn-based, exactly like today:
//   Exotel -> STT(Gemini) -> LLM(Gemini) -> TTS(Gemini) -> Exotel
//
// All four calls hit the same Gemini REST endpoint:
//   https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=API_KEY
//
// Required env var: GEMINI_API_KEY  (see setup notes at bottom of this file)

const axios = require('axios');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

// Separate model per step so you can tune cost/quality independently.
// NOTE: gemini-2.5-flash (and older) is no longer issued to new API keys as
// of mid-2026 — new keys only get current-generation models. Defaults below
// are the current-generation equivalents; override via env var any time
// Google ships a newer one without needing a code change.
const GEMINI_STT_MODEL = process.env.GEMINI_STT_MODEL || 'gemini-3.5-flash';
const GEMINI_LLM_MODEL = process.env.GEMINI_LLM_MODEL || 'gemini-3.5-flash';
const GEMINI_TTS_MODEL = process.env.GEMINI_TTS_MODEL || 'gemini-3.1-flash-tts-preview';
const GEMINI_TTS_VOICE = process.env.GEMINI_TTS_VOICE || 'Kore'; // prebuilt Gemini TTS voice

function getGeminiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('GEMINI_API_KEY is not configured');
  return key;
}

function endpoint(model) {
  return `${GEMINI_BASE_URL}/${model}:generateContent?key=${getGeminiKey()}`;
}

// ─── WAV builder — wraps raw PCM16 8kHz from Exotel into WAV container ───────
// (identical to the old sarvamClient helper — Gemini also wants a real
// container, not headerless raw PCM, for inlineData audio input)
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

// ─── Downsample 24kHz PCM16 (Gemini TTS output) -> 8kHz PCM16 (Exotel) ───────
// Gemini's TTS always returns 24000Hz/16-bit/mono PCM. Exotel needs 8000Hz.
// Simple 3:1 averaging decimation — good enough for phone-quality voice.
function downsample24kTo8k(pcm16Buf) {
  const inSamples = Math.floor(pcm16Buf.length / 2);
  const outSamples = Math.floor(inSamples / 3);
  const out = Buffer.alloc(outSamples * 2);
  for (let i = 0; i < outSamples; i++) {
    const a = pcm16Buf.readInt16LE(i * 6);
    const b = pcm16Buf.readInt16LE(i * 6 + 2);
    const c = pcm16Buf.readInt16LE(i * 6 + 4);
    const avg = Math.round((a + b + c) / 3);
    out.writeInt16LE(Math.max(-32768, Math.min(32767, avg)), i * 2);
  }
  return out;
}

// ─── STT ─────────────────────────────────────────────────────────────────────
// Gemini has no dedicated low-latency streaming STT product — we send the
// buffered utterance as inline WAV data on a normal generateContent call and
// ask it to transcribe verbatim. Works for our turn-based (buffer-on-silence)
// architecture since we already wait for a pause before calling this.
async function transcribeAudio(pcm16Bytes) {
  if (!pcm16Bytes || pcm16Bytes.length < 320) return '';

  const wavBuf = buildWavBuffer(pcm16Bytes, 8000, 1, 16);

  const response = await axios.post(
    endpoint(GEMINI_STT_MODEL),
    {
      contents: [{
        role: 'user',
        parts: [
          { inline_data: { mime_type: 'audio/wav', data: wavBuf.toString('base64') } },
          { text: 'Transcribe the speech in this audio exactly as spoken (Telugu/Hindi/English mix as applicable). Reply with ONLY the transcript text, no labels, no quotes, no translation.' },
        ],
      }],
      generationConfig: { temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } },
    },
    { timeout: 12000 }
  );

  const transcript = (response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
  if (transcript) console.log(`[gemini-stt] "${transcript.slice(0, 80)}"`);
  return transcript;
}

// ─── TTS ─────────────────────────────────────────────────────────────────────
// Gemini TTS via generateContent with responseModalities: ["AUDIO"]. Not a
// streaming websocket like Sarvam was, so we get the full utterance back in
// one response, then hand it to onChunk once — orchestrator.js's existing
// drain loop already paces playback out in 100ms Exotel frames regardless of
// whether it arrived as one chunk or many, so no orchestrator changes needed.
async function synthesizeSpeech(text, languageCode = 'te-IN', onChunk = null) {
  if (!text || !text.trim()) return Buffer.alloc(0);

  const response = await axios.post(
    endpoint(GEMINI_TTS_MODEL),
    {
      contents: [{ role: 'user', parts: [{ text }] }],
      generationConfig: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: GEMINI_TTS_VOICE } },
        },
      },
    },
    { timeout: 20000 }
  );

  const part = response.data?.candidates?.[0]?.content?.parts?.[0];
  const b64 = part?.inlineData?.data || part?.inline_data?.data;
  if (!b64) throw new Error('Gemini TTS returned no audio');

  const pcm24k = Buffer.from(b64, 'base64'); // Gemini TTS output: 24kHz, 16-bit, mono PCM
  const pcm8k = downsample24kTo8k(pcm24k);    // -> 8kHz for Exotel

  console.log(`[gemini-tts] synthesized "${text.slice(0, 50)}"`);
  if (onChunk) onChunk(pcm8k);
  return pcm8k;
}

// ─── LLM (brain) ─────────────────────────────────────────────────────────────
// messages come in as OpenAI-shape [{role: 'system'|'user'|'assistant', content}].
// Convert to Gemini's shape: system messages -> systemInstruction, the rest
// -> contents with role 'user' | 'model'.
function toGeminiContents(messages) {
  const systemParts = [];
  const contents = [];
  for (const m of messages) {
    if (m.role === 'system') {
      systemParts.push({ text: m.content });
    } else {
      contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] });
    }
  }
  return { systemParts, contents };
}

async function getAgentReply(messages) {
  const { systemParts, contents } = toGeminiContents(messages);

  const response = await axios.post(
    endpoint(GEMINI_LLM_MODEL),
    {
      ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
      contents,
      generationConfig: { temperature: 0.6, maxOutputTokens: 80, thinkingConfig: { thinkingBudget: 0 } },
    },
    { timeout: 12000 }
  );

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text.trim() || 'Sorry, could you say that again?';
}

async function getCallOutcome(outcomeExtractionPrompt, transcriptMessages) {
  try {
    const { systemParts, contents } = toGeminiContents([outcomeExtractionPrompt, ...transcriptMessages]);

    const response = await axios.post(
      endpoint(GEMINI_LLM_MODEL),
      {
        ...(systemParts.length ? { systemInstruction: { parts: systemParts } } : {}),
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 300,
          responseMimeType: 'application/json', // Gemini JSON mode — no markdown fences to strip
        },
      },
      { timeout: 20000 }
    );

    const raw = (response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
    return JSON.parse(raw);
  } catch {
    return {
      leadStatus: 'Connected',
      interestLevel: 'Unknown',
      studentIntent: 'general_interest',
      followUpRequired: false,
      followUpDate: null,
      demoRequired: false,
      callbackReason: '',
      conversationSummary: 'AI call completed. Summary unavailable.',
      nextRecommendedAction: 'no_action',
      confidenceScore: 0.0,
    };
  }
}

module.exports = { transcribeAudio, synthesizeSpeech, getAgentReply, getCallOutcome };

// ─── SETUP: how to get GEMINI_API_KEY ───────────────────────────────────────
// 1. Go to https://aistudio.google.com/apikey
// 2. Click "Create API key" -> choose/create a Google Cloud project -> copy the key
// 3. Add to backend/.env:  GEMINI_API_KEY=your_key_here
// 4. (Billing) TTS + higher-volume STT/LLM need a billed GCP project linked
//    to that API key — Google AI Studio's free tier alone will rate-limit
//    fast on a live-call volume. Enable billing at
//    https://console.cloud.google.com/billing for the linked project.
// 5. Restart the backend after adding/changing the key.