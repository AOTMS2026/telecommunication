// backend/src/services/aiCaller/sarvamChatClient.js
//
// Sarvam AI Chat Completions client — replaces OpenAI/GPT as the "AI brain".
// Sarvam's /v1/chat/completions endpoint is OpenAI-compatible, so we reuse
// the official `openai` SDK, just pointed at Sarvam's baseURL and using
// Sarvam's `api-subscription-key` auth header instead of Authorization.
//
// Uses the same SARVAM_API_KEY already configured for STT/TTS (sarvamClient.js).

const OpenAI = require('openai');

const SARVAM_CHAT_BASE_URL = 'https://api.sarvam.ai/v1';

// sarvam-30b: recommended default (64K context, strong Indic + latency balance).
// sarvam-105b: higher quality, higher latency — set AI_CALLER_CHAT_MODEL=sarvam-105b if needed.
const AI_CALLER_CHAT_MODEL = process.env.AI_CALLER_CHAT_MODEL || 'sarvam-30b';

function getSarvamClient() {
  const apiKey = process.env.SARVAM_API_KEY;
  if (!apiKey) throw new Error('SARVAM_API_KEY is not configured');

  return new OpenAI({
    apiKey: 'unused', // Sarvam does not use Bearer auth; real key goes in defaultHeaders below
    baseURL: SARVAM_CHAT_BASE_URL,
    defaultHeaders: { 'api-subscription-key': apiKey },
  });
}

module.exports = { getSarvamClient, AI_CALLER_CHAT_MODEL };
