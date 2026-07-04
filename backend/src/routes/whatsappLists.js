const express = require('express');
const WhatsAppList = require('../models/WhatsAppList');
const Lead = require('../models/Lead');
const Integration = require('../models/Integration');
const whatsappService = require('../services/integrations/whatsapp');
const { protect } = require('../middleware/auth');
const { fireEvent } = require('../services/workflowEngine');

const router = express.Router();

// ── GET /api/whatsapp-lists ──────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const lists = await WhatsAppList.find({
      $or: [{ createdBy: req.user._id }, { isShared: true }],
    })
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ lists });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/whatsapp-lists/:id ───────────────────────────────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const list = await WhatsAppList.findById(req.params.id).populate('createdBy', 'name');
    if (!list) return res.status(404).json({ message: 'List not found' });
    res.json({ list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/whatsapp-lists ──────────────────────────────────────────────────
router.post('/', protect, async (req, res) => {
  try {
    const { name, header, body, footer, buttonLabel, sections, isShared } = req.body;
    if (!name || !body || !buttonLabel) {
      return res.status(400).json({ message: 'name, body and buttonLabel are required' });
    }

    const totalRows = (sections || []).reduce((n, s) => n + (s.rows || []).length, 0);
    if (totalRows === 0) return res.status(400).json({ message: 'Add at least one row to a section' });
    if (totalRows > 10) return res.status(400).json({ message: 'WhatsApp allows a maximum of 10 rows across all sections' });

    const list = await WhatsAppList.create({
      name,
      header: header || '',
      body,
      footer: footer || '',
      buttonLabel,
      sections: sections || [],
      isShared: !!isShared,
      createdBy: req.user._id,
    });
    await list.populate('createdBy', 'name');
    res.status(201).json({ list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/whatsapp-lists/:id ───────────────────────────────────────────────
router.put('/:id', protect, async (req, res) => {
  try {
    const list = await WhatsAppList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });
    if (list.createdBy.toString() !== req.user._id.toString() && req.user.role === 'caller') {
      return res.status(403).json({ message: "Cannot edit another user's list" });
    }

    if (req.body.sections) {
      const totalRows = req.body.sections.reduce((n, s) => n + (s.rows || []).length, 0);
      if (totalRows > 10) return res.status(400).json({ message: 'WhatsApp allows a maximum of 10 rows across all sections' });
    }

    const updated = await WhatsAppList.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('createdBy', 'name');
    res.json({ list: updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/whatsapp-lists/:id ────────────────────────────────────────────
router.delete('/:id', protect, async (req, res) => {
  try {
    const list = await WhatsAppList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });
    if (list.createdBy.toString() !== req.user._id.toString() && req.user.role === 'caller') {
      return res.status(403).json({ message: "Cannot delete another user's list" });
    }
    await WhatsAppList.findByIdAndDelete(req.params.id);
    res.json({ message: 'List deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/whatsapp-lists/:id/send — send this list to a lead ─────────────
router.post('/:id/send', protect, async (req, res) => {
  try {
    const { leadId } = req.body;
    if (!leadId) return res.status(400).json({ message: 'leadId is required' });

    const list = await WhatsAppList.findById(req.params.id);
    if (!list) return res.status(404).json({ message: 'List not found' });

    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const integration = await Integration.findOne({ type: 'whatsapp_cloud', status: 'active' });
    if (!integration) {
      return res.status(400).json({ message: 'No active WhatsApp integration found. Connect WhatsApp Cloud API first.' });
    }

    const sendResult = await whatsappService.sendListMessage(
      integration.config.phoneNumberId, integration.config.accessToken, lead.phone, list
    );

    const description = `[List: ${list.name}]`;
    lead.activities = lead.activities || [];
    lead.activities.push({
      type: 'whatsapp',
      description,
      direction: 'outbound_agent',
      metaMessageId: sendResult?.messages?.[0]?.id || '',
      performedBy: req.user._id,
    });
    lead.waStatus = 'intervened';
    lead.lastWaMessageAt = new Date();
    lead.lastWaMessagePreview = description;
    await lead.save();

    fireEvent('lead.whatsapp_agent_reply', { lead, user: req.user, changes: { message: description } }).catch(() => {});

    res.json({
      lead: { id: lead._id, name: lead.name, phone: lead.phone, waStatus: lead.waStatus },
      activity: lead.activities[lead.activities.length - 1],
    });
  } catch (err) {
    const message = err.response?.data?.error?.message || err.message;
    res.status(500).json({ message });
  }
});

module.exports = router;