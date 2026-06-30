const express = require('express');
const router = express.Router();
const Lead = require('../models/Lead');
const { protectWithAccessToken } = require('../middleware/accessTokenAuth');
const { fireEvent } = require('../services/workflowEngine');
const { broadcastWebhooks } = require('../services/automationRunners');

/**
 * POST /api/public/leads
 * External endpoint for websites, forms, and scripts to push leads.
 * Requires: Authorization: Bearer atms_<token>
 * Body: { name, phone, email?, location?, source?, campaign?, assignedTo? }
 */
router.post('/leads', protectWithAccessToken, async (req, res) => {
  try {
    const token = req.accessToken;
    const { name, phone, email, location, source, campaign, assignedTo } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ message: 'name and phone are required' });
    }

    // Blocklist check
    const Blocklist = require('../models/Blocklist');
    const blocked = await Blocklist.findOne({ phone });
    if (blocked) {
      return res.status(200).json({ message: 'Lead blocked', skipped: true });
    }

    // Duplicate check based on recapture preference
    const existing = await Lead.findOne({ phone });
    if (existing) {
      const pref = token.recapturePreference;
      if (pref === 'never') {
        return res.status(200).json({ message: 'Duplicate lead skipped', skipped: true, leadId: existing._id });
      }
      if (pref === 'once_a_day') {
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        if (existing.createdAt > oneDayAgo) {
          return res.status(200).json({ message: 'Duplicate lead skipped (within 24h)', skipped: true, leadId: existing._id });
        }
      }
      if (pref === 'once_a_week') {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        if (existing.createdAt > oneWeekAgo) {
          return res.status(200).json({ message: 'Duplicate lead skipped (within 7 days)', skipped: true, leadId: existing._id });
        }
      }
    }

    const leadData = {
      name,
      phone,
      email: email || '',
      location: location || '',
      leadSource: source || 'API',
      status: 'Fresh',
    };
    if (campaign) leadData.campaign = campaign;
    if (assignedTo) leadData.assignedTo = assignedTo;

    const apiType = token.apiType;
    const lead = await Lead.create(leadData);

    // Fire workflow events
    const eventCtx = { lead, user: null, changes: { source: 'api', apiType, tokenId: token._id } };
    fireEvent('lead.created', eventCtx).catch(() => {});
    fireEvent('lead.web_created', eventCtx).catch(() => {});
    broadcastWebhooks('lead.created', { lead: { id: lead._id, name: lead.name, phone: lead.phone, source: 'api' } }).catch(() => {});

    if (apiType === 'async') {
      // Fire-and-forget
      return res.status(202).json({ message: 'Lead accepted', leadId: lead._id });
    } else {
      // Sync: return full lead
      return res.status(201).json({ message: 'Lead created', lead });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/public/leads/:id
 * Fetch a lead by ID using access token auth.
 */
router.get('/leads/:id', protectWithAccessToken, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id)
      .populate('assignedTo', 'name')
      .populate('campaign', 'name');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json({ lead });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;