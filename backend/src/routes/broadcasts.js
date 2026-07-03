const express = require('express');
const Broadcast = require('../models/Broadcast');
const Lead = require('../models/Lead');
const MessageTemplate = require('../models/MessageTemplate');
const Integration = require('../models/Integration');
const whatsappService = require('../services/integrations/whatsapp');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Build a Mongo query for Lead from broadcast filters
function buildLeadQuery(filters = {}) {
  const query = {};
  if (filters.status) query.status = filters.status;
  if (filters.campaign) query.campaign = filters.campaign;
  if (filters.leadSource) query.leadSource = filters.leadSource;
  if (filters.assignedTo) query.assignedTo = filters.assignedTo;
  // Only leads with a phone number can receive WhatsApp messages
  query.phone = { $exists: true, $ne: '' };
  return query;
}

// ── GET /api/broadcasts?status=&page=&limit= ──────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [broadcasts, total] = await Promise.all([
      Broadcast.find(query)
        .populate('template', 'shortcut message')
        .populate('filters.campaign', 'name')
        .populate('createdBy', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Broadcast.countDocuments(query),
    ]);

    res.json({ broadcasts, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/broadcasts/:id ────────────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id)
      .populate('template', 'shortcut message')
      .populate('filters.campaign', 'name')
      .populate('createdBy', 'name')
      .populate('errors.lead', 'name phone');
    if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });
    res.json({ broadcast });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/broadcasts/preview ───────────────────────────────────────────────
// Given filters, return how many leads match (audience size) before sending
router.post('/preview', protect, async (req, res) => {
  try {
    const { filters = {} } = req.body;
    const query = buildLeadQuery(filters);
    const count = await Lead.countDocuments(query);
    const sample = await Lead.find(query).select('name phone').limit(5);
    res.json({ count, sample });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/broadcasts ───────────────────────────────────────────────────────
// Create a broadcast and immediately send it to all matching leads
router.post('/', protect, async (req, res) => {
  try {
    const { name, templateId, filters = {} } = req.body;
    if (!name || !templateId) {
      return res.status(400).json({ message: 'name and templateId are required' });
    }

    const template = await MessageTemplate.findById(templateId);
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const integration = await Integration.findOne({ type: 'whatsapp_cloud', status: 'active' });
    if (!integration) {
      return res.status(400).json({ message: 'No active WhatsApp integration found. Connect WhatsApp Cloud API first.' });
    }

    const query = buildLeadQuery(filters);
    const leads = await Lead.find(query).select('name phone');

    const broadcast = await Broadcast.create({
      name,
      template: template._id,
      message: template.message,
      filters: {
        status: filters.status || '',
        campaign: filters.campaign || undefined,
        leadSource: filters.leadSource || '',
        assignedTo: filters.assignedTo || undefined,
      },
      status: 'sending',
      recipientCount: leads.length,
      startedAt: new Date(),
      createdBy: req.user._id,
    });

    let sentCount = 0;
    const errors = [];

    for (const lead of leads) {
      try {
        const personalized = template.message
          .replace(/\{\{\s*name\s*\}\}/gi, lead.name || '')
          .replace(/\{\{\s*first_name\s*\}\}/gi, (lead.name || '').split(' ')[0] || '');
        const sendResult = await whatsappService.sendTextMessage(
          integration.config.phoneNumberId,
          integration.config.accessToken,
          lead.phone,
          personalized
        );
        sentCount += 1;

        // Record on the lead so it shows up in the WhatsApp inbox ("All" tab).
        // Note: a broadcast alone does NOT change waStatus — a lead only moves
        // to "Pending" once they actually reply (see whatsapp.js webhook handler).
        await Lead.findByIdAndUpdate(lead._id, {
          $push: {
            activities: {
              type: 'whatsapp',
              description: personalized,
              direction: 'outbound_broadcast',
              metaMessageId: sendResult?.messages?.[0]?.id || '',
            },
          },
          $set: {
            lastWaMessageAt: new Date(),
            lastWaMessagePreview: personalized,
          },
        });
      } catch (sendErr) {
        errors.push({
          lead: lead._id,
          phone: lead.phone,
          message: sendErr.response?.data?.error?.message || sendErr.message,
        });
      }
    }

    broadcast.sentCount = sentCount;
    broadcast.failedCount = errors.length;
    broadcast.errors = errors;
    broadcast.status = errors.length && sentCount === 0 ? 'failed' : 'completed';
    broadcast.completedAt = new Date();
    await broadcast.save();

    await broadcast.populate('template', 'shortcut message');
    await broadcast.populate('filters.campaign', 'name');
    await broadcast.populate('createdBy', 'name');

    res.status(201).json({ broadcast });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/broadcasts/:id ────────────────────────────────────────────────────
// Limited updates: rename a broadcast, or cancel a draft
router.put('/:id', protect, async (req, res) => {
  try {
    const broadcast = await Broadcast.findById(req.params.id);
    if (!broadcast) return res.status(404).json({ message: 'Broadcast not found' });

    const { name, status } = req.body;
    if (name) broadcast.name = name;
    if (status && ['draft', 'cancelled'].includes(status) && broadcast.status === 'draft') {
      broadcast.status = status;
    }
    await broadcast.save();

    await broadcast.populate('template', 'shortcut message');
    await broadcast.populate('filters.campaign', 'name');
    await broadcast.populate('createdBy', 'name');

    res.json({ broadcast });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;