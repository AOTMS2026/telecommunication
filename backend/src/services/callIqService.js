const axios = require('axios');

// Runs a Call-IQ agent over a call transcript and returns a structured object
// keyed by the agent's configured outputFields. Works with OpenAI or OpenRouter.
async function runCallAudit(agent, transcript) {
  const provider = agent.provider || 'openai';
  const apiKey = (agent.apiKey || (provider === 'openrouter' ? process.env.OPENROUTER_API_KEY : process.env.OPENAI_API_KEY) || '').trim();
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
  let model = (agent.model || (provider === 'openrouter' ? 'openai/gpt-4o' : 'gpt-4o')).trim();
  if (provider === 'openrouter' && !model.includes('/')) {
    model = `openai/${model}`;
  }
  // OpenAI rejects namespaced ids outright ("invalid model ID"). If the
  // agent was previously configured for OpenRouter and switched back to
  // OpenAI, strip any leftover "namespace/" prefix.
  if (provider === 'openai' && model.includes('/')) {
    model = model.split('/').pop();
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

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' };

  let res;
  try {
    res = await axios.post(url, body, { headers, timeout: 30000 });
  } catch (err) {
    const providerMsg = err.response?.data?.error?.message || err.response?.data?.message || '';
    const status = err.response?.status;

    // If the configured model id itself is the problem (typo'd/stale value
    // saved on the agent), retry once with a known-good default instead of
    // just failing — this is what most "invalid model" agents actually need.
    const isBadModel = /model/i.test(providerMsg) && /(invalid|not found|does not exist|unknown)/i.test(providerMsg);
    const fallbackModel = provider === 'openrouter' ? 'openai/gpt-4o-mini' : 'gpt-4o-mini';
    if (isBadModel && model !== fallbackModel) {
      try {
        const retryRes = await axios.post(url, { ...body, model: fallbackModel }, { headers, timeout: 30000 });
        const raw = retryRes.data?.choices?.[0]?.message?.content?.trim() || '{}';
        return parseAuditJson(raw);
      } catch (retryErr) {
        const retryMsg = retryErr.response?.data?.error?.message || retryErr.response?.data?.message;
        throw new Error(`${provider} error: model "${model}" is invalid, and fallback model also failed${retryMsg ? `: ${retryMsg}` : ''}. Fix the Model field on this agent (try "gpt-4o" for OpenAI or "openai/gpt-4o" for OpenRouter).`);
      }
    }

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