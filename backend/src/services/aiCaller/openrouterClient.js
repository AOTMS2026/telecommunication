const axios = require('axios');

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Free model good for fast conversational replies during the live call
const CHAT_MODEL = process.env.AI_CALLER_CHAT_MODEL || 'mistralai/mistral-7b-instruct:free';

// Used after the call ends to extract structured outcome (can be same or different model)
const OUTCOME_MODEL = process.env.AI_CALLER_OUTCOME_MODEL || 'mistralai/mistral-7b-instruct:free';

async function callOpenRouter(messages, model, opts = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not set');

  const res = await axios.post(
    OPENROUTER_URL,
    {
      model,
      messages,
      temperature: opts.temperature ?? 0.6,
      max_tokens: opts.maxTokens ?? 200,
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Optional but recommended by OpenRouter
        'HTTP-Referer': process.env.PUBLIC_BASE_URL || 'https://loyola-lms.onrender.com',
        'X-Title': 'AOTMS AI Telecaller',
      },
      timeout: 20000,
    }
  );

  return res.data?.choices?.[0]?.message?.content?.trim() || '';
}

/**
 * During a live call: get the AI agent's next spoken reply.
 * `messages` is the full conversation so far (system + user/assistant turns).
 */
async function getAgentReply(messages) {
  try {
    const text = await callOpenRouter(messages, CHAT_MODEL, { temperature: 0.6, maxTokens: 120 });
    return text || "Sorry, could you say that again?";
  } catch (err) {
    console.error('[openrouter] getAgentReply error:', err.response?.data || err.message);
    return "Sorry, I'm having a little trouble. Could you repeat that?";
  }
}

/**
 * After the call ends: extract a structured outcome from the full transcript.
 * Returns a JS object: { status, callStatus, summary, nextFollowupDate }
 */
async function getCallOutcome(transcriptMessages) {
  const instruction = {
    role: 'system',
    content: `You just finished a phone call as an AOTMS course counselor. Based on the conversation transcript below, output ONLY a raw JSON object (no markdown, no code fences, no extra text) with these exact keys:
{
  "status": one of ["Connected","Call Back Later","Not interested","Demo Scheduled","Demo Done","Won","Lost"],
  "callStatus": "connected",
  "summary": "1-2 sentence summary of what the student said and the outcome",
  "nextFollowupDate": an ISO 8601 date string for the next follow-up if one was agreed (e.g. "2026-06-15T10:00:00.000Z"), or null if none
}
Pick "status" based on what actually happened. If unsure, use "Connected".`,
  };

  try {
    const raw = await callOpenRouter([instruction, ...transcriptMessages], OUTCOME_MODEL, {
      temperature: 0.2,
      maxTokens: 250,
    });

    // Strip accidental code fences just in case
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return parsed;
  } catch (err) {
    console.error('[openrouter] getCallOutcome error:', err.response?.data || err.message);
    // Safe fallback so the lead is still updated even if AI parsing fails
    return {
      status: 'Connected',
      callStatus: 'connected',
      summary: 'AI call completed. Automatic summary unavailable.',
      nextFollowupDate: null,
    };
  }
}

module.exports = { getAgentReply, getCallOutcome };
