const axios = require('axios');
const ApiTemplate = require('../models/ApiTemplate');
const Webhook = require('../models/Webhook');
const crypto = require('crypto');

// Resolve {{lead.name}} / {{lead.phone}} style tokens against the runtime context.
function resolveToken(token, context) {
  const path = token.replace(/[{}]/g, '').trim().split('.');
  let value = context;
  for (const key of path) {
    if (value == null) return '';
    value = value[key];
  }
  return value == null ? '' : value;
}

function interpolate(input, context) {
  if (typeof input === 'string') {
    return input.replace(/\{\{[^}]+\}\}/g, (m) => resolveToken(m, context));
  }
  if (Array.isArray(input)) return input.map((v) => interpolate(v, context));
  if (input && typeof input === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(input)) out[k] = interpolate(v, context);
    return out;
  }
  return input;
}

// Reads a dot/array-index path like 'message.content' or 'files.0.status' out of a
// parsed JSON value. Returns undefined if any segment along the way is missing.
function getByPath(obj, path) {
  if (!path) return undefined;
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function buildAuthHeaders(auth) {
  if (!auth || auth.type === 'none') return {};
  if (auth.type === 'bearer') return auth.token ? { Authorization: `Bearer ${auth.token}` } : {};
  if (auth.type === 'api_key') return auth.headerName ? { [auth.headerName]: auth.headerValue || '' } : {};
  if (auth.type === 'basic') {
    if (!auth.username) return {};
    const encoded = Buffer.from(`${auth.username}:${auth.password || ''}`).toString('base64');
    return { Authorization: `Basic ${encoded}` };
  }
  return {};
}

/**
 * Execute a saved API Template. `context` typically contains { lead, user }.
 * Used by the "Call API" workflow action and the API Templates "Test Template" button.
 *
 * If the template has a responseMapping configured and context.lead is present, the
 * mapped fields (plus the always-available Status Code / Status Text) are written to
 * the lead's Activity History as a structured 'api_call' entry.
 */
async function runApiTemplate(apiTemplateId, context) {
  const tpl = await ApiTemplate.findById(apiTemplateId);
  if (!tpl) throw new Error('API template not found');

  const tokenContext = {
    lead: context.lead?.toObject ? context.lead.toObject() : context.lead,
    user: context.user?.toObject ? context.user.toObject() : context.user,
  };

  const url = interpolate(tpl.endpointUrl, tokenContext);
  const headers = { ...interpolate(tpl.headers || {}, tokenContext), ...buildAuthHeaders(tpl.auth) };
  const params = interpolate(tpl.queryParams || {}, tokenContext);
  const data = interpolate(tpl.bodyTemplate || {}, tokenContext);

  const res = await axios({
    method: tpl.method,
    url,
    headers,
    params,
    data: ['GET', 'DELETE'].includes(tpl.method) ? undefined : data,
    timeout: (tpl.timeout || 3) * 1000,
    validateStatus: () => true,
  });

  const ok = res.status < 400;

  // Cache the raw response so the Response Mapper step can list JSON paths without re-firing.
  tpl.lastTestResponse = res.data;
  tpl.lastTestStatus = res.status;
  tpl.lastTestedAt = new Date();
  await tpl.save();

  // Apply the saved Response Mapper and log a structured Activity History entry.
  const mappedFields = (tpl.responseMapping || []).map((m) => ({
    label: m.label,
    type: m.type,
    value: getByPath(res.data, m.jsonPath),
  }));

  if (context.logActivity && context.lead && typeof context.lead.save === 'function') {
    context.lead.activities.unshift({
      type: 'api_call',
      templateName: tpl.name,
      description: `${tpl.name} → HTTP ${res.status}`,
      fields: [
        { label: 'Status Code', type: 'Number', value: res.status },
        { label: 'Status Text', type: 'Text', value: ok ? 'OK' : 'Error' },
        ...mappedFields,
      ],
      performedBy: context.user?._id,
    });
    await context.lead.save();
  }

  return { status: res.status, ok, body: res.data, mappedFields };
}

/**
 * Dispatch an outbound webhook with an HMAC signature header.
 */
async function triggerWebhook(webhookId, eventName, payload) {
  try {
    const hook = await Webhook.findById(webhookId);
    if (!hook) return { ok: false, message: 'Webhook not found' };
    if (hook.status !== 'active') return { ok: false, message: 'Webhook inactive' };

    const body = JSON.stringify({ event: eventName, timestamp: Date.now(), ...payload });
    const signature = crypto.createHmac('sha256', hook.secret).update(body).digest('hex');

    const res = await axios.post(hook.url, body, {
      headers: { 'Content-Type': 'application/json', 'X-AOTMS-Signature': signature, 'X-AOTMS-Event': eventName },
      timeout: 15000,
      validateStatus: () => true,
    });

    const ok = res.status < 400;
    hook.lastTriggeredAt = new Date();
    if (ok) hook.successCount += 1; else { hook.failCount += 1; hook.lastError = `HTTP ${res.status}`; }
    await hook.save();
    return { ok, message: `Webhook → HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, message: err.message };
  }
}

/**
 * Fan out an event to every active webhook subscribed to it. Called directly from
 * fireEvent's callers when they want all subscribers notified (not just one action).
 */
async function broadcastWebhooks(eventName, payload) {
  const hooks = await Webhook.find({ status: 'active', events: eventName });
  await Promise.all(hooks.map((h) => triggerWebhook(h._id, eventName, payload)));
}

module.exports = { runApiTemplate, triggerWebhook, broadcastWebhooks, interpolate, getByPath };