const express = require('express');
const N8nConfig = require('../models/N8nConfig');
const n8nService = require('../services/n8nService');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Config (singleton) ───────────────────────────────────────────────────────

// GET /api/n8n/config — current n8n connection settings (API key masked)
router.get('/config', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const cfg = await N8nConfig.findOne().sort({ updatedAt: -1 });
    if (!cfg) return res.json({ config: null });
    res.json({ config: cfg.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/n8n/config — save or update connection settings
router.post('/config', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { baseUrl, apiKey } = req.body;
    if (!baseUrl || !apiKey) return res.status(400).json({ message: 'Base URL and API key are required' });

    let cfg = await N8nConfig.findOne().sort({ updatedAt: -1 });
    if (cfg) {
      cfg.baseUrl = baseUrl;
      // Only overwrite key if a real key was sent (not the masked placeholder)
      if (!apiKey.startsWith('••••')) cfg.apiKey = apiKey;
      cfg.updatedBy = req.user._id;
      cfg.status = 'disconnected';
      await cfg.save();
    } else {
      cfg = await N8nConfig.create({ baseUrl, apiKey, updatedBy: req.user._id });
    }

    // Auto-test
    const test = await n8nService.testConnection(cfg);
    res.json({ config: cfg.toSafeJSON(), test });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/n8n/test — test the saved connection
router.post('/test', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const cfg = await n8nService.getConfig();
    const result = await n8nService.testConnection(cfg);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Workflows ────────────────────────────────────────────────────────────────

// GET /api/n8n/workflows — list workflows from n8n (refreshes cache)
router.get('/workflows', protect, async (req, res) => {
  try {
    const workflows = await n8nService.listWorkflows();
    res.json({ workflows });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/n8n/workflows/cached — return cached list without hitting n8n
router.get('/workflows/cached', protect, async (req, res) => {
  try {
    const cfg = await N8nConfig.findOne().sort({ updatedAt: -1 });
    res.json({ workflows: cfg?.cachedWorkflows || [], cachedAt: cfg?.cachedAt });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/n8n/workflows/:n8nId — single workflow detail from n8n
router.get('/workflows/:n8nId', protect, async (req, res) => {
  try {
    const detail = await n8nService.getWorkflowDetail(req.params.n8nId);
    res.json({ workflow: detail });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/n8n/workflows/:n8nId/trigger — manually trigger an n8n workflow
router.post('/workflows/:n8nId/trigger', protect, async (req, res) => {
  try {
    const result = await n8nService.triggerWorkflow(req.params.n8nId, req.body.payload || req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/n8n/workflows/:n8nId/executions — recent executions
router.get('/workflows/:n8nId/executions', protect, async (req, res) => {
  try {
    const executions = await n8nService.getExecutions(req.params.n8nId, Number(req.query.limit) || 20);
    res.json({ executions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;