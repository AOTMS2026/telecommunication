const axios = require('axios');

// Runs a Call-IQ agent over a call transcript and returns a structured object
// keyed by the agent's configured outputFields. Works with OpenAI or OpenRouter.
async function runCallAudit(agent, transcript) {
  const provider = agent.provider || 'openai';
  const apiKey = agent.apiKey
    || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY);
  if (!apiKey) throw new Error(`No API key configured for provider "${provider}"`);

  const fieldSpec = (agent.outputFields || [])
    .map(f => `  "${f.key}": ${f.type === 'number' || f.type === 'score' ? 'a number' : f.type === 'boolean' ? 'true or false' : 'a short string'}  // ${f.label}`)
    .join('\n');

  const systemPrompt = `${agent.prompt}

You are auditing a sales/support phone call. Read the transcript and respond with ONLY a raw JSON object (no markdown, no code fences) using exactly these keys:
{
${fieldSpec || '  "summary": "a short string"'}
}`;

  const url = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  const res = await axios.post(
    url,
    {
      model: agent.model || (provider === 'openrouter' ? 'openai/gpt-4o' : 'gpt-4o'),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Call transcript:\n\n${transcript}` },
      ],
      temperature: 0.2,
      max_tokens: 500,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    }
  );

  const raw = res.data?.choices?.[0]?.message?.content?.trim() || '{}';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return { _raw: cleaned };
  }
}

module.exports = { runCallAudit };