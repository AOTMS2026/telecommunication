// backend/src/routes/campaigns.js
//
// UPDATED for the RunPod + GPT-4.1-mini migration:
//  - All existing routes (GET /, GET /:id, POST /, PUT /:id, DELETE /:id,
//    POST /:id/add-leads, DELETE /:id/remove-lead/:leadId) are UNCHANGED.
//  - NEW: POST /:id/ai-start, POST /:id/ai-pause, GET /:id/ai-status —
//    control surface for the autonomous AI Campaign Execution Engine
//    (services/aiCaller/campaignEngine.js). The engine itself polls the
//    Campaign collection directly, so these routes simply flip
//    Campaign.aiCallingEnabled / read live counters — no new job-scheduling
//    logic lives in the route layer.

const express = require('express');
const Campaign = require('../models/Campaign');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

// GET /api/campaigns
router.get('/', protect, async (req, res) => {
  try {
    const campaigns = await Campaign.find()
      .populate('assignedCallers', 'name avatar')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });

    const campaignsWithStats = await Promise.all(campaigns.map(async (c) => {
      const stats = await Lead.aggregate([
        { $match: { campaign: c._id } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const totalLeads = stats.reduce((a, b) => a + b.count, 0);
      const freshLeads = stats.find(s => s._id === 'Fresh')?.count || 0;
      return { ...c.toObject(), totalLeads, freshLeads, statusBreakdown: stats };
    }));
    res.json({ campaigns: campaignsWithStats });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/campaigns/:id  — returns campaign + full status/call breakdown
router.get('/:id', protect, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id)
      .populate('assignedCallers', 'name avatar email')
      .populate('createdBy', 'name');
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    // Lead status breakdown
    const statusBreakdown = await Lead.aggregate([
      { $match: { campaign: campaign._id } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Lost/dropped reasons
    const lostReasons = await Lead.aggregate([
      { $match: { campaign: campaign._id, status: { $in: ['Not interested', 'Lost', 'Blocked'] } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Call outcomes from activity logs
    const callStats = await Lead.aggregate([
      { $match: { campaign: campaign._id } },
      { $unwind: '$activities' },
      { $match: { 'activities.type': 'call' } },
      { $group: { _id: '$activities.callStatus', count: { $sum: 1 } } }
    ]);

    const totalLeads = statusBreakdown.reduce((a, b) => a + b.count, 0);

    res.json({
      campaign: {
        ...campaign.toObject(),
        totalLeads,
        statusBreakdown,
        lostReasons,
        callStats
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/campaigns
router.post('/', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const campaign = await Campaign.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/campaigns/:id
router.put('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ campaign });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/campaigns/:id
router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    await Lead.updateMany({ campaign: campaign._id }, { $unset: { campaign: '' } });
    await Campaign.findByIdAndDelete(campaign._id);

    res.json({ message: 'Campaign deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/campaigns/:id/add-leads  — bulk assign existing leads to this campaign
router.post('/:id/add-leads', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { leadIds } = req.body; // array of lead _ids
    if (!leadIds || !Array.isArray(leadIds) || leadIds.length === 0) {
      return res.status(400).json({ message: 'Provide an array of leadIds' });
    }
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const result = await Lead.updateMany(
      { _id: { $in: leadIds } },
      { $set: { campaign: campaign._id } }
    );
    res.json({ message: `${result.modifiedCount} lead(s) added to campaign`, modifiedCount: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/campaigns/:id/remove-lead/:leadId
router.delete('/:id/remove-lead/:leadId', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    await Lead.findByIdAndUpdate(req.params.leadId, { $unset: { campaign: '' } });
    res.json({ message: 'Lead removed from campaign' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ====================== NEW ROUTES (AI Telecaller upgrade) ======================

// POST /api/campaigns/:id/ai-start  — enable autonomous AI dialing for this campaign
router.post('/:id/ai-start', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { aiConcurrencyLimit, aiCallWindow, aiAgentConfig, aiIncludesAssignedLeads } = req.body;
    const update = { aiCallingEnabled: true };
    if (aiConcurrencyLimit != null) update.aiConcurrencyLimit = aiConcurrencyLimit;
    if (aiCallWindow) update.aiCallWindow = aiCallWindow;
    if (aiAgentConfig) update.aiAgentConfig = aiAgentConfig;
    if (aiIncludesAssignedLeads != null) update.aiIncludesAssignedLeads = aiIncludesAssignedLeads;

    const campaign = await Campaign.findByIdAndUpdate(req.params.id, update, { new: true });
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    res.json({ campaign, message: 'AI calling enabled for this campaign.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/campaigns/:id/ai-pause  — stop the AI engine from picking up new leads
// (in-flight calls already placed are allowed to finish naturally; their lock
// auto-releases via outcomeService when the call ends)
router.post('/:id/ai-pause', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const campaign = await Campaign.findByIdAndUpdate(
      req.params.id,
      { aiCallingEnabled: false },
      { new: true }
    );
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    res.json({ campaign, message: 'AI calling paused for this campaign.' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/campaigns/:id/ai-status  — live counters for the dashboard panel
router.get('/:id/ai-status', protect, async (req, res) => {
  try {
    const campaign = await Campaign.findById(req.params.id);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

    const [inProgress, queued, completedToday] = await Promise.all([
      Lead.countDocuments({ campaign: campaign._id, aiCallState: 'in_progress' }),
      Lead.countDocuments({ campaign: campaign._id, aiCallState: 'queued' }),
      Lead.countDocuments({
        campaign: campaign._id,
        aiCallState: 'completed',
        lastCalledAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
      }),
    ]);

    res.json({
      aiCallingEnabled: campaign.aiCallingEnabled,
      aiConcurrencyLimit: campaign.aiConcurrencyLimit,
      aiCallWindow: campaign.aiCallWindow,
      inProgress,
      queued,
      completedToday,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
