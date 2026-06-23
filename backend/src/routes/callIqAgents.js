const express = require('express');
const AiAgent = require('../models/AiAgent');
const CallAudit = require('../models/CallAudit');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { runCallAudit } = require('../services/callIqService');

const router = express.Router();

const TEMPLATES = [
  {
    key: 'call_audit_agent',
    name: 'Call Audit Agent',
    description: 'Analyzes call recordings/transcripts and provides audit scores.',
    prompt: 'You are a strict but fair call-quality auditor for a sales team. Evaluate how well the agent handled the call: greeting, needs discovery, objection handling, and closing.',
    outputFields: [
      { key: 'score', label: 'Overall Score (0-10)', type: 'score' },
      { key: 'sentiment', label: 'Customer Sentiment', type: 'text' },
      { key: 'objections', label: 'Objections Raised', type: 'text' },
      { key: 'summary', label: 'Summary', type: 'text' },
      { key: 'nextAction', label: 'Recommended Next Action', type: 'text' },
    ],
  },
];

router.get('/templates', protect, (req, res) => res.json({ templates: TEMPLATES }));

router.get('/', protect, async (req, res) => {
  try {
    const agents = await AiAgent.find().populate('createdBy', 'name').sort({ createdAt: -1 });
    res.json({ agents: agents.map(a => a.toSafeJSON()) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const agent = await AiAgent.findById(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    res.json({ agent: agent.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const agent = await AiAgent.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ agent: agent.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    // don't overwrite the stored key with the masked placeholder coming back from the UI
    if (body.apiKey && body.apiKey.startsWith('••••')) delete body.apiKey;
    const agent = await AiAgent.findByIdAndUpdate(req.params.id, body, { new: true, runValidators: true });
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    res.json({ agent: agent.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const agent = await AiAgent.findByIdAndDelete(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    res.json({ message: 'Agent deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Run an agent against a lead's call activity (or a pasted transcript)
router.post('/:id/run', protect, async (req, res) => {
  try {
    const agent = await AiAgent.findById(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const { leadId, activityId, transcript: pastedTranscript } = req.body;
    let transcript = pastedTranscript || '';
    let lead = null;

    if (leadId) {
      lead = await Lead.findById(leadId);
      if (lead && !transcript) {
        const callActivities = lead.activities.filter(a => a.type === 'call' && a.description);
        const target = activityId
          ? callActivities.find(a => a._id.toString() === activityId)
          : callActivities[0];
        transcript = target?.description || '';
      }
    }

    if (!transcript) return res.status(400).json({ message: 'No transcript available to audit' });

    let result, status = 'success', error = '';
    try {
      result = await runCallAudit(agent, transcript);
    } catch (e) {
      status = 'failed'; error = e.message; result = {};
    }

    const audit = await CallAudit.create({
      agent: agent._id,
      lead: lead?._id,
      activityId: activityId || undefined,
      transcriptSnapshot: transcript.slice(0, 5000),
      result,
      status,
      error,
      requestedBy: req.user._id,
    });

    res.json({ audit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/audits', protect, async (req, res) => {
  try {
    const audits = await CallAudit.find({ agent: req.params.id })
      .populate('lead', 'name phone')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ audits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;