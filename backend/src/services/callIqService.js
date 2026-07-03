const axios = require('axios');

// Runs a Call-IQ agent over a call transcript and returns a structured object
// keyed by the agent's configured outputFields. Works with OpenAI or OpenRouter.
async function runCallAudit(agent, transcript) {
  const provider = agent.provider || 'openai';
  const apiKey = agent.apiKey
    || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY);
  if (!apiKey) throw new Error(`No API key configured for provider "${provider}". Add one on the agent or set ${provider === 'openrouter' ? 'OPENROUTER_API_KEY' : 'OPENAI_API_KEY'} in the backend .env.`);

  const fieldSpec = (agent.outputFields || [])
    .map(f => `  "${f.key}": ${f.type === 'number' || f.type === 'score' ? 'a number' : f.type === 'boolean' ? 'true or false' : 'a short string'}  // ${f.label}`)
    .join('\n');

  const systemPrompt = `${agent.prompt}

You are auditing a sales/support phone call. Read the transcript and respond with ONLY a raw JSON object (no markdown, no code fences, no commentary before or after) using exactly these keys:
{
${fieldSpec || '  "summary": "a short string"'}
}`;

  const url = provider === 'openrouter'
    ? 'https://openrouter.ai/api/v1/chat/completions'
    : 'https://api.openai.com/v1/chat/completions';

  // OpenRouter needs a namespaced model id (e.g. "openai/gpt-4o"). If the
  // agent's model field was left as a bare model name (e.g. "gpt-4o"),
  // auto-namespace it so the request doesn't get rejected with a 400.
  let model = agent.model || (provider === 'openrouter' ? 'openai/gpt-4o' : 'gpt-4o');
  if (provider === 'openrouter' && !model.includes('/')) {
    model = `openai/${model}`;
  }

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Call transcript:\n\n${transcript}` },
    ],
    temperature: 0.2,
    max_tokens: 1000,
  };

  // Force valid JSON output where the provider supports it. Safe no-op for
  // most OpenAI-compatible chat completion models.
  if (provider === 'openai' || (provider === 'openrouter' && model.startsWith('openai/'))) {
    body.response_format = { type: 'json_object' };
  }

  let res;
  try {
    res = await axios.post(url, body, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 30000,
    });
  } catch (err) {
    // Surface the real reason (bad model, bad key, quota, etc.) instead of
    // the generic axios "Request failed with status code 400".
    const providerMsg = err.response?.data?.error?.message || err.response?.data?.message;
    const status = err.response?.status;
    if (providerMsg) {
      throw new Error(`${provider} error${status ? ` (${status})` : ''}: ${providerMsg}`);
    }
    throw err;
  }

  const raw = res.data?.choices?.[0]?.message?.content?.trim() || '{}';
  return parseAuditJson(raw);
}

// Cleans and parses the model's JSON response. Handles markdown code fences
// and any stray text the model may add before/after the JSON object.
function parseAuditJson(raw) {
  let cleaned = raw.replace(/```json|```/gi, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to extracting the outermost { ... } block
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      const slice = cleaned.slice(start, end + 1);
      try {
        return JSON.parse(slice);
      } catch {
        return { _raw: cleaned };
      }
    }
    return { _raw: cleaned };
  }
}

module.exports = { runCallAudit };