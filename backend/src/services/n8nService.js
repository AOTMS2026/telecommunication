const axios = require('axios');
const N8nConfig = require('../models/N8nConfig');

// ── Helpers ──────────────────────────────────────────────────────────────────

async function getConfig() {
  const cfg = await N8nConfig.findOne().sort({ updatedAt: -1 });
  if (!cfg) throw new Error('n8n is not configured. Go to Settings → n8n to set it up.');
  return cfg;
}

function client(cfg) {
  const baseURL = cfg.baseUrl.replace(/\/+$/, '') + '/api/v1';
  return axios.create({
    baseURL,
    headers: { 'X-N8N-API-KEY': cfg.apiKey, 'Content-Type': 'application/json' },
    timeout: 15000,
  });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Test connection to the n8n instance by fetching /api/v1/workflows?limit=1.
 * Saves the connection status back onto the config doc.
 */
async function testConnection(cfg) {
  try {
    const api = client(cfg);
    const res = await api.get('/workflows', { params: { limit: 1 } });
    cfg.status = 'connected';
    cfg.lastCheckedAt = new Date();
    cfg.lastError = '';
    // Try to pull version from response headers or just mark ok
    cfg.n8nVersion = res.headers?.['x-n8n-version'] || 'unknown';
    await cfg.save();
    return { ok: true, version: cfg.n8nVersion };
  } catch (err) {
    cfg.status = 'error';
    cfg.lastCheckedAt = new Date();
    cfg.lastError = err.response?.data?.message || err.message;
    await cfg.save();
    return { ok: false, error: cfg.lastError };
  }
}

/**
 * Fetch all workflows from the n8n instance and cache them.
 */
async function listWorkflows() {
  const cfg = await getConfig();
  const api = client(cfg);
  const all = [];
  let cursor = '';
  // n8n uses cursor-based pagination
  for (let i = 0; i < 10; i++) {
    const params = { limit: 100 };
    if (cursor) params.cursor = cursor;
    const res = await api.get('/workflows', { params });
    const data = res.data?.data || res.data || [];
    if (Array.isArray(data)) all.push(...data);
    cursor = res.data?.nextCursor;
    if (!cursor) break;
  }
  const mapped = all.map(w => ({
    id: String(w.id),
    name: w.name,
    active: !!w.active,
    tags: (w.tags || []).map(t => t.name || t),
    updatedAt: w.updatedAt || '',
  }));
  cfg.cachedWorkflows = mapped;
  cfg.cachedAt = new Date();
  await cfg.save();
  return mapped;
}

/**
 * Trigger (execute) an n8n workflow by its ID with a payload.
 * Uses the "Webhook" or "Execute Workflow" API depending on the n8n setup.
 *
 * The recommended n8n setup: the target workflow should start with a
 * **Webhook node** whose path equals the workflow ID, so we POST to
 * /webhook/<workflowId>. If that fails we fall back to the Executions API.
 */
async function triggerWorkflow(n8nWorkflowId, payload) {
  const cfg = await getConfig();
  const baseURL = cfg.baseUrl.replace(/\/+$/, '');
  const api = client(cfg);

  // Strategy 1: Try the webhook trigger (most reliable for production flows)
  try {
    const webhookUrl = `${baseURL}/webhook/${n8nWorkflowId}`;
    const res = await axios.post(webhookUrl, payload, { timeout: 30000, validateStatus: () => true });
    if (res.status < 400) {
      return { ok: true, method: 'webhook', status: res.status, data: res.data };
    }
  } catch (_) { /* fall through */ }

  // Strategy 2: Try the webhook-test path (for testing / draft workflows)
  try {
    const webhookTestUrl = `${baseURL}/webhook-test/${n8nWorkflowId}`;
    const res = await axios.post(webhookTestUrl, payload, { timeout: 30000, validateStatus: () => true });
    if (res.status < 400) {
      return { ok: true, method: 'webhook-test', status: res.status, data: res.data };
    }
  } catch (_) { /* fall through */ }

  // Strategy 3: Execute via the REST API (requires n8n version ≥ 1.x with execution API)
  try {
    const res = await api.post(`/workflows/${n8nWorkflowId}/execute`, { data: payload });
    return { ok: true, method: 'api', status: res.status, data: res.data };
  } catch (err) {
    return { ok: false, error: err.response?.data?.message || err.message };
  }
}

/**
 * Get recent executions for a specific n8n workflow.
 */
async function getExecutions(n8nWorkflowId, limit = 20) {
  const cfg = await getConfig();
  const api = client(cfg);
  try {
    const res = await api.get('/executions', {
      params: { workflowId: n8nWorkflowId, limit, status: 'all' },
    });
    return res.data?.data || res.data || [];
  } catch (err) {
    return [];
  }
}

/**
 * Get a single workflow's details from n8n (nodes, connections, settings).
 */
async function getWorkflowDetail(n8nWorkflowId) {
  const cfg = await getConfig();
  const api = client(cfg);
  const res = await api.get(`/workflows/${n8nWorkflowId}`);
  return res.data;
}

module.exports = {
  getConfig,
  testConnection,
  listWorkflows,
  triggerWorkflow,
  getExecutions,
  getWorkflowDetail,
};