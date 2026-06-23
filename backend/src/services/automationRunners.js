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

/**
 * Execute a saved API Template. `context` typically contains { lead, user }.
 * Used by the "Call API" workflow action and the API Templates "Run / Test" button.
 */
async function runApiTemplate(apiTemplateId, context) {
  const tpl = await ApiTemplate.findById(apiTemplateId);
  if (!tpl) throw new Error('API template not found');

  const tokenContext = {
    lead: context.lead?.toObject ? context.lead.toObject() : context.lead,
    user: context.user?.toObject ? context.user.toObject() : context.user,
  };

  const url = interpolate(tpl.endpointUrl, tokenContext);
  const headers = interpolate(tpl.headers || {}, tokenContext);
  const data = interpolate(tpl.bodyTemplate || {}, tokenContext);

  const res = await axios({
    method: tpl.method,
    url,
    headers,
    data: ['GET', 'DELETE'].includes(tpl.method) ? undefined : data,
    timeout: 15000,
    validateStatus: () => true,
  });

  return { status: res.status, ok: res.status < 400, body: res.data };
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

module.exports = { runApiTemplate, triggerWebhook, broadcastWebhooks, interpolate };