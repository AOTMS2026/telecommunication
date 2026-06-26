const express = require('express');
const Workflow = require('../models/Workflow');
const WorkflowExecution = require('../models/WorkflowExecution');
const { protect, authorize } = require('../middleware/auth');
const { EVENT_DEFINITIONS, ACTION_DEFINITIONS } = require('../services/workflowEngine');

const router = express.Router();

// Builder metadata for the frontend (event list + action palette)
router.get('/meta', protect, (req, res) => {
  res.json({ events: EVENT_DEFINITIONS, actions: ACTION_DEFINITIONS });
});

// GET /api/workflows?kind=WORKFLOW|SCHEDULE&status=published|draft&search=
router.get('/', protect, async (req, res) => {
  try {
    const { kind = 'WORKFLOW', status, search } = req.query;
    const query = { kind };
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };

    const workflows = await Workflow.find(query)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name')
      .sort({ updatedAt: -1 });

    // aggregate "last 24h" run stats for the header cards
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = await WorkflowExecution.aggregate([
      { $match: { createdAt: { $gte: since }, status: { $in: ['success', 'failed'] } } },
      { $lookup: { from: 'workflows', localField: 'workflow', foreignField: '_id', as: 'wf' } },
      { $unwind: '$wf' },
      { $match: { 'wf.kind': kind } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    const summary = { totalRuns: 0, success: 0, failed: 0 };
    recent.forEach(r => {
      summary.totalRuns += r.count;
      if (r._id === 'success') summary.success = r.count;
      if (r._id === 'failed') summary.failed = r.count;
    });

    res.json({ workflows, summary });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const workflow = await Workflow.findById(req.params.id)
      .populate('createdBy', 'name')
      .populate('updatedBy', 'name');
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    res.json({ workflow });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Executions log for a single workflow (Executions tab in the editor)
router.get('/:id/executions', protect, async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const query = { workflow: req.params.id };
    if (status && status !== 'all') query.status = status;

    const total = await WorkflowExecution.countDocuments(query);
    const executions = await WorkflowExecution.find(query)
      .populate('lead', 'name phone status')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ executions, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const workflow = await Workflow.create({
      ...req.body,
      kind: req.body.kind || 'WORKFLOW',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });
    res.status(201).json({ workflow });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndUpdate(
      req.params.id,
      { ...req.body, updatedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    res.json({ workflow });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Publish / unpublish toggle
router.patch('/:id/status', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { status } = req.body; // 'published' | 'draft'
    if (!['published', 'draft'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }
    const workflow = await Workflow.findById(req.params.id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });

    if (status === 'published' && (!workflow.actions || workflow.actions.length === 0)) {
      return res.status(400).json({ message: 'Add at least one action before publishing' });
    }

    workflow.status = status;
    workflow.updatedBy = req.user._id;
    await workflow.save();
    res.json({ workflow });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const workflow = await Workflow.findByIdAndDelete(req.params.id);
    if (!workflow) return res.status(404).json({ message: 'Workflow not found' });
    await WorkflowExecution.deleteMany({ workflow: req.params.id });
    res.json({ message: 'Workflow deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;