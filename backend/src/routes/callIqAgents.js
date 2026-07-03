const express = require('express');
const AiAgent = require('../models/AiAgent');
const CallAudit = require('../models/CallAudit');
const Lead = require('../models/Lead');
const CallRecording = require('../models/CallRecording');
const path = require('path');
const { protect, authorize } = require('../middleware/auth');
const { runCallAudit } = require('../services/callIqService');
const { transcribeAudioFile } = require('../services/transcriptionService');

const UPLOAD_DIR = process.env.RECORDINGS_DIR
  || (process.env.NODE_ENV === 'production'
    ? path.join('/var/data', 'recordings')
    : path.join(__dirname, '..', 'uploads', 'recordings'));

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

// Must be registered before GET '/:id' — otherwise Express would match
// "by-recording" as an :id value and 404/misroute.
router.get('/by-recording/:recordingId', protect, async (req, res) => {
  try {
    const audits = await CallAudit.find({ recording: req.params.recordingId })
      .populate('agent', 'name')
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ audits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

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

router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const agent = await AiAgent.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ agent: agent.toSafeJSON() });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
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

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const agent = await AiAgent.findByIdAndDelete(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });
    res.json({ message: 'Agent deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Run an agent against a lead's call activity, a manual recording, or a pasted transcript
router.post('/:id/run', protect, async (req, res) => {
  try {
    const agent = await AiAgent.findById(req.params.id);
    if (!agent) return res.status(404).json({ message: 'Agent not found' });

    const { leadId, activityId, recordingId, transcript: pastedTranscript } = req.body;
    let transcript = pastedTranscript || '';
    let lead = null;
    let recording = null;

    if (recordingId) {
      recording = await CallRecording.findById(recordingId);
      if (!recording) return res.status(404).json({ message: 'Recording not found' });

      if (recording.transcriptStatus === 'done' && recording.transcript) {
        transcript = recording.transcript;
      } else {
        // Auto-transcribe on demand (cached on the recording for next time)
        try {
          const absolutePath = path.join(UPLOAD_DIR, recording.storedName);
          transcript = await transcribeAudioFile(absolutePath, agent.apiKey);
          recording.transcript = transcript;
          recording.transcriptStatus = 'done';
          recording.transcriptError = '';
          await recording.save();
        } catch (sttErr) {
          recording.transcriptStatus = 'failed';
          recording.transcriptError = sttErr.message || 'Transcription failed';
          await recording.save();
          return res.status(500).json({ message: `Could not transcribe recording: ${sttErr.message}` });
        }
      }
      if (recording.lead) lead = await Lead.findById(recording.lead);
    } else if (leadId) {
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
      recording: recording?._id || undefined,
      transcriptSnapshot: transcript.slice(0, 5000),
      result,
      status,
      error,
      requestedBy: req.user._id,
    });

    // Store this as the recording's LATEST Call IQ report — overwrite, never
    // append, so re-running Call IQ always replaces the previous snapshot
    // instead of leaving the recordings list showing the first-ever result.
    if (recording) {
      recording.lastCallIqReport = {
        audit: audit._id,
        agent: agent._id,
        agentName: agent.name,
        status,
        result,
        error,
        runAt: new Date(),
        runBy: req.user._id,
      };
      await recording.save();
    }

    res.json({ audit });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/audits', protect, async (req, res) => {
  try {
    const audits = await CallAudit.find({ agent: req.params.id })
      .populate('lead', 'name phone')
      .populate('recording', 'phone originalName recordedAt')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ audits });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;