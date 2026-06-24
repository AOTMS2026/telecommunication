const express = require('express');
const mongoose = require('mongoose');
const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const EmailCampaign = require('../models/EmailCampaign');
const { protect, authorize } = require('../middleware/auth');
const { sendBulkEmails } = require('../services/emailService');
const router = express.Router();

function parseCampaignIds(input) {
  if (!input) return [];
  const arr = Array.isArray(input) ? input : [input];
  return arr.filter((id) => mongoose.Types.ObjectId.isValid(id));
}

// Fetch + dedupe students (by email) across the given campaigns.
// Reuses the existing Lead<->Campaign relationship; does not modify any lead.
async function getUniqueStudentsForCampaigns(campaignIds) {
  const campaigns = await Campaign.find({ _id: { $in: campaignIds } }).select('name');
  const campaignNameMap = {};
  campaigns.forEach((c) => { campaignNameMap[c._id.toString()] = c.name; });

  const leads = await Lead.find({ campaign: { $in: campaignIds } })
    .select('name email campaign')
    .lean();

  const seenEmails = new Set();
  const students = [];
  let skippedNoEmail = 0;

  leads.forEach((lead) => {
    const email = (lead.email || '').trim();
    if (!email) { skippedNoEmail += 1; return; }
    const key = email.toLowerCase();
    if (seenEmails.has(key)) return;
    seenEmails.add(key);
    students.push({
      leadId: lead._id,
      name: lead.name,
      email,
      campaignId: lead.campaign,
      campaignName: campaignNameMap[lead.campaign?.toString()] || '',
    });
  });

  return { campaigns, students, skippedNoEmail };
}

// POST /api/email-campaigns/preview-recipients
// body: { campaignIds: [ids] }
router.post('/preview-recipients', protect, async (req, res) => {
  try {
    const campaignIds = parseCampaignIds(req.body.campaignIds);
    if (campaignIds.length === 0) {
      return res.status(400).json({ message: 'Select at least one campaign' });
    }

    const { campaigns, students, skippedNoEmail } = await getUniqueStudentsForCampaigns(campaignIds);

    res.json({
      totalCampaigns: campaigns.length,
      campaigns: campaigns.map((c) => ({ _id: c._id, name: c.name })),
      totalStudents: students.length,
      skippedNoEmail,
      students,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/email-campaigns/send
// body: { campaignIds, subject, body, bodyFormat?, name?, fromEmail?, fromName? }
router.post('/send', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { subject, body, name } = req.body;
    const bodyFormat = req.body.bodyFormat === 'html' ? 'html' : 'text';
    const campaignIds = parseCampaignIds(req.body.campaignIds);

    if (campaignIds.length === 0) return res.status(400).json({ message: 'Select at least one campaign' });
    if (!subject || !body) return res.status(400).json({ message: 'subject and body are required' });
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ message: 'Email sending is not configured. Set RESEND_API_KEY on the server.' });
    }

    const fromEmail = req.body.fromEmail || process.env.EMAIL_FROM_ADDRESS;
    const fromName = req.body.fromName || process.env.EMAIL_FROM_NAME || 'AOTMS';
    if (!fromEmail) {
      return res.status(500).json({ message: 'Sender email is not configured. Set EMAIL_FROM_ADDRESS on the server.' });
    }

    const { campaigns, students } = await getUniqueStudentsForCampaigns(campaignIds);
    if (students.length === 0) {
      return res.status(400).json({ message: 'No students with a valid email were found in the selected campaign(s)' });
    }

    const emailCampaign = await EmailCampaign.create({
      name: name || `Email Campaign - ${new Date().toLocaleString()}`,
      sourceCampaigns: campaignIds,
      subject,
      body,
      bodyFormat,
      totalCampaigns: campaigns.length,
      totalRecipients: students.length,
      status: 'sending',
      recipients: students.map((s) => ({
        lead: s.leadId, name: s.name, email: s.email, campaignName: s.campaignName, status: 'pending',
      })),
      createdBy: req.user._id,
    });

    const results = await sendBulkEmails({
      recipients: students,
      subject,
      body,
      bodyFormat,
      fromEmail,
      fromName,
    });

    const resultByEmail = {};
    results.forEach((r) => { resultByEmail[r.email.toLowerCase()] = r; });

    let sentCount = 0;
    let failedCount = 0;
    const failures = [];

    emailCampaign.recipients.forEach((rec) => {
      const r = resultByEmail[rec.email.toLowerCase()];
      if (r && r.status === 'sent') {
        rec.status = 'sent';
        rec.resendId = r.resendId || '';
        sentCount += 1;
      } else {
        rec.status = 'failed';
        rec.error = (r && r.error) || 'No response from email provider';
        failedCount += 1;
        failures.push({ name: rec.name, email: rec.email, error: rec.error });
      }
    });

    emailCampaign.sentCount = sentCount;
    emailCampaign.failedCount = failedCount;
    emailCampaign.status = sentCount === 0 ? 'failed' : 'completed';
    await emailCampaign.save();

    res.json({
      emailCampaignId: emailCampaign._id,
      totalCampaigns: campaigns.length,
      totalRecipients: students.length,
      sent: sentCount,
      failed: failedCount,
      failures,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/email-campaigns — history list of past blasts
router.get('/', protect, async (req, res) => {
  try {
    const list = await EmailCampaign.find()
      .select('name subject body bodyFormat sourceCampaigns totalCampaigns totalRecipients sentCount failedCount status createdAt createdBy')
      .populate('createdBy', 'name')
      .populate('sourceCampaigns', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ emailCampaigns: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/email-campaigns/:id — full detail incl. per-recipient status
router.get('/:id', protect, async (req, res) => {
  try {
    const item = await EmailCampaign.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('sourceCampaigns', 'name');
    if (!item) return res.status(404).json({ message: 'Email campaign not found' });
    res.json({ emailCampaign: item });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/email-campaigns/:id — removes only this history record.
// Does NOT touch the underlying Campaign(s) or any Lead/student data.
router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const item = await EmailCampaign.findByIdAndDelete(req.params.id);
    if (!item) return res.status(404).json({ message: 'Email campaign not found' });
    res.json({ message: 'Email campaign history entry deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;