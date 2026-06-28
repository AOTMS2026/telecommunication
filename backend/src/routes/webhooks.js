const express = require('express');
const Webhook  = require('../models/Webhook');
const Lead     = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { triggerWebhook } = require('../services/automationRunners');
const { fireEvent, executeWorkflow } = require('../services/workflowEngine');

const router = express.Router();

/* ─────────────────────────────────────────────────────────────────────────────
   PUBLIC INBOUND ENDPOINT  –  POST /api/webhooks/inbound/:token
   Called by external systems (Facebook, IndiaMART, website forms, etc.)
   No auth required — secured by the unique inboundToken per webhook.
───────────────────────────────────────────────────────────────────────────── */
router.post('/inbound/:token', async (req, res) => {
  try {
    const wh = await Webhook.findOne({ inboundToken: req.params.token, status: 'active' });
    if (!wh) return res.status(404).json({ message: 'Webhook not found or inactive' });

    const payload = req.body || {};

    // ── Optional: verify auth header ──────────────────────────────────────
    if (wh.config?.authType && wh.config.authType !== 'none') {
      const authHeader = req.headers['authorization'] || req.headers['x-api-key'] || '';
      if (wh.config.authType === 'bearer' && authHeader !== `Bearer ${wh.config.authValue}`) {
        await Webhook.findByIdAndUpdate(wh._id, { $inc: { failCount: 1 }, lastError: 'Auth failed', lastTriggeredAt: new Date() });
        return res.status(401).json({ message: 'Unauthorized' });
      }
      if (wh.config.authType === 'api_key' && authHeader !== wh.config.authValue) {
        await Webhook.findByIdAndUpdate(wh._id, { $inc: { failCount: 1 }, lastError: 'Auth failed', lastTriggeredAt: new Date() });
        return res.status(401).json({ message: 'Unauthorized' });
      }
    }

    // ── Map incoming fields → lead fields ─────────────────────────────────
    const leadData = {};
    if (wh.fieldMappings && wh.fieldMappings.length) {
      for (const m of wh.fieldMappings) {
        if (m.from && m.to && payload[m.from] !== undefined) {
          leadData[m.to] = payload[m.from];
        }
      }
    } else {
      // Fallback: try common field names
      const nameMap = { name:'name', full_name:'name', fullName:'name', phone:'phone', phone_number:'phone',
        mobile:'phone', email:'email', status:'status', source:'leadSource', city:'location' };
      for (const [k, v] of Object.entries(payload)) {
        if (nameMap[k]) leadData[nameMap[k]] = v;
      }
    }

    if (!leadData.name && !leadData.phone) {
      return res.status(400).json({ message: 'Could not map name or phone from payload. Check field mappings.' });
    }

    // ── Duplicate detection ───────────────────────────────────────────────
    const identifierField = wh.config?.leadIdentifier || 'phone';
    const identifierValue = leadData[identifierField] || payload[identifierField];
    let lead = null;
    let isNew = false;

    if (identifierValue) {
      lead = await Lead.findOne({ [identifierField]: identifierValue });
    }

    if (lead) {
      // Update existing lead with new payload data
      Object.assign(lead, leadData);
      lead.activities.unshift({ type: 'note', description: `Updated via webhook: ${wh.name}` });
      await lead.save();
    } else {
      // Create new lead
      if (!leadData.name) leadData.name = payload.name || payload.full_name || 'Unknown';
      if (!leadData.phone) leadData.phone = payload.phone || payload.mobile || payload.phone_number || '';
      lead = await Lead.create({
        ...leadData,
        status: leadData.status || 'Fresh',
        leadSource: leadData.leadSource || wh.name,
        workspace: wh.workspace,
      });
      isNew = true;
    }

    // ── Update webhook stats ──────────────────────────────────────────────
    await Webhook.findByIdAndUpdate(wh._id, {
      $inc: { successCount: 1 },
      lastTriggeredAt: new Date(),
      lastError: '',
    });

    // ── Fire workflow engine events (non-blocking) ────────────────────────
    const eventCtx = { lead, changes: { source: wh.name, payload } };
    if (isNew) {
      fireEvent('lead.created', eventCtx).catch(() => {});
      fireEvent('lead.web_created', eventCtx).catch(() => {});
    }

    // ── Trigger connected AOTMS workflow if set ───────────────────────────
    if (wh.connectedWorkflowId) {
      const Workflow = require('../models/Workflow');
      Workflow.findById(wh.connectedWorkflowId).then(wfDoc => {
        if (wfDoc && wfDoc.status === 'published') {
          executeWorkflow(wfDoc, { lead, user: null, changes: { webhookPayload: payload } }).catch(() => {});
        }
      }).catch(() => {});
    }

    res.json({ success: true, leadId: lead._id, isNew, message: isNew ? 'Lead created' : 'Lead updated' });
  } catch (err) {
    console.error('Inbound webhook error:', err);
    res.status(500).json({ message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────────────────────────
   AUTHENTICATED CRUD
───────────────────────────────────────────────────────────────────────────── */
router.get('/', protect, async (req, res) => {
  try {
    const webhooks = await Webhook.find().populate('createdBy', 'name').sort({ createdAt: -1 });
    res.json({ webhooks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const webhook = await Webhook.findById(req.params.id);
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ webhook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const webhook = await Webhook.create({
      ...req.body,
      createdBy: req.user._id,
    });
    // Build the inbound URL and save it as url field
    const baseUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
    webhook.url = `${baseUrl}/api/webhooks/inbound/${webhook.inboundToken}`;
    await webhook.save();
    res.status(201).json({ webhook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const webhook = await Webhook.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ webhook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fire a test payload at the webhook URL
router.post('/:id/test', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const result = await triggerWebhook(req.params.id, 'webhook.test', {
      test: true,
      message: 'This is a test event from AOTMS',
    });
    res.json({ result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const webhook = await Webhook.findByIdAndDelete(req.params.id);
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;