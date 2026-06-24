const express = require('express');
const Salesform = require('../models/Salesform');
const SalesformSubmission = require('../models/SalesformSubmission');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { matchPath, runWorkflow } = require('../services/salesformEngine');

const router = express.Router();

// GET /api/salesforms?status=published|draft&search=
router.get('/', protect, async (req, res) => {
  try {
    const { status, search } = req.query;
    const query = {};
    if (status) query.status = status;
    if (search) query.name = { $regex: search, $options: 'i' };
    const salesforms = await Salesform.find(query)
      .populate('statusUpdatedBy', 'name')
      .populate('createdBy', 'name')
      .sort({ updatedAt: -1 });
    res.json({ salesforms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forms that should appear/fire for a given runtime event — used by the lead detail
// page (manual button-click forms) and by leads.js / followUps.js when dispatching events.
// e.g. GET /api/salesforms/active?event=on_button_click
//      GET /api/salesforms/active?event=on_lead_field_update&leadField=status
router.get('/active', protect, async (req, res) => {
  try {
    const { event, leadField } = req.query;
    const query = { status: 'published' };
    if (event) query.triggerEvent = event;
    const forms = await Salesform.find(query);
    const filtered = forms.filter(f => {
      if (f.triggerEvent === 'on_lead_field_update' && f.triggerConfig?.leadField && leadField) {
        return f.triggerConfig.leadField === leadField;
      }
      return true;
    });
    res.json({ salesforms: filtered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const salesform = await Salesform.findById(req.params.id);
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    res.json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/submissions', protect, async (req, res) => {
  try {
    const submissions = await SalesformSubmission.find({ salesform: req.params.id })
      .populate('lead', 'name phone')
      .populate('submittedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ submissions });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const salesform = await Salesform.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const salesform = await Salesform.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    res.json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/salesforms/:id/flowchart — save the "Salesform" tab canvas (nodes/edges)
router.patch('/:id/flowchart', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { flowNodes, flowEdges } = req.body;
    const salesform = await Salesform.findByIdAndUpdate(
      req.params.id,
      { flowNodes: flowNodes || [], flowEdges: flowEdges || [] },
      { new: true, runValidators: true }
    );
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    res.json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/salesforms/:id/workflow — save the "Workflow" tab canvas (nodes/edges + n8n link)
router.patch('/:id/workflow', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { workflowNodes, workflowEdges, n8nWorkflowId } = req.body;
    const salesform = await Salesform.findByIdAndUpdate(
      req.params.id,
      { workflowNodes: workflowNodes || [], workflowEdges: workflowEdges || [], n8nWorkflowId: n8nWorkflowId || '' },
      { new: true, runValidators: true }
    );
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    res.json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/salesforms/:id/configuration — Mandatory toggle + Permission Templates
router.patch('/:id/configuration', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { mandatory, permissions } = req.body;
    const update = {};
    if (typeof mandatory === 'boolean') update.mandatory = mandatory;
    if (Array.isArray(permissions)) update.permissions = permissions;
    const salesform = await Salesform.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    res.json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/status', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!['published', 'draft'].includes(status)) return res.status(400).json({ message: 'Invalid status' });
    const salesform = await Salesform.findByIdAndUpdate(
      req.params.id,
      { status, statusUpdatedAt: new Date(), statusUpdatedBy: req.user._id },
      { new: true }
    );
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    res.json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/salesforms/:id/duplicate
router.post('/:id/duplicate', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const original = await Salesform.findById(req.params.id);
    if (!original) return res.status(404).json({ message: 'Salesform not found' });
    const clone = original.toObject();
    delete clone._id;
    delete clone.createdAt;
    delete clone.updatedAt;
    clone.name = `${clone.name} (Copy)`;
    clone.status = 'draft';
    clone.createdBy = req.user._id;
    const salesform = await Salesform.create(clone);
    res.status(201).json({ salesform });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Submit a salesform against a lead. Matches the Salesform-tab branch (Path) for this lead,
// writes mapped field values onto the Lead, then runs the Workflow-tab automation chain.
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { leadId, data } = req.body;
    const salesform = await Salesform.findById(req.params.id);
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    // Resolve which branch (Path N) applies, falling back to legacy flat `fields` shape
    const { condition, section } = matchPath(salesform, lead);
    const activeFields = section?.fields?.length ? section.fields : salesform.fields;

    const submission = await SalesformSubmission.create({
      salesform: salesform._id,
      lead: lead._id,
      data: data || {},
      pathIndex: condition ? condition.pathIndex : null,
      submittedBy: req.user._id,
    });

    // Apply field mappings onto the lead
    let changed = false;
    for (const field of activeFields || []) {
      if (field.mapToLeadField && data?.[field.id] !== undefined) {
        lead[field.mapToLeadField] = data[field.id];
        changed = true;
      }
    }
    if (changed) {
      lead.activities.unshift({
        type: 'note',
        description: `Salesform "${salesform.name}" submitted`,
        performedBy: req.user._id,
      });
      await lead.save();
    }

    // Run the post-submission automation chain (Workflow tab + linked n8n workflow)
    const actionsLog = await runWorkflow(salesform, { lead, user: req.user, submission });
    submission.actionsLog = actionsLog;
    await submission.save();

    res.status(201).json({ submission });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const salesform = await Salesform.findByIdAndDelete(req.params.id);
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    await SalesformSubmission.deleteMany({ salesform: req.params.id });
    res.json({ message: 'Salesform deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;