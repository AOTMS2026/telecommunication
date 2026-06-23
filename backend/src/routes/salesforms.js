const express = require('express');
const Salesform = require('../models/Salesform');
const SalesformSubmission = require('../models/SalesformSubmission');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');

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
      .sort({ updatedAt: -1 });
    res.json({ salesforms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Forms that should appear for a given lead context (used by the lead detail page)
// e.g. GET /api/salesforms/active?event=on_button_click
//      GET /api/salesforms/active?event=on_status_update&status=Demo%20Done
router.get('/active', protect, async (req, res) => {
  try {
    const { event, status } = req.query;
    const query = { status: 'published' };
    if (event) query.triggerEvent = event;
    const forms = await Salesform.find(query);
    const filtered = forms.filter(f => {
      if (f.triggerEvent === 'on_status_update' && f.triggerConfig?.status) {
        return f.triggerConfig.status === status;
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

// Submit a salesform against a lead. Optionally writes mapped values onto the Lead.
router.post('/:id/submit', protect, async (req, res) => {
  try {
    const { leadId, data } = req.body;
    const salesform = await Salesform.findById(req.params.id);
    if (!salesform) return res.status(404).json({ message: 'Salesform not found' });
    const lead = await Lead.findById(leadId);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const submission = await SalesformSubmission.create({
      salesform: salesform._id,
      lead: lead._id,
      data: data || {},
      submittedBy: req.user._id,
    });

    // Apply field mappings onto the lead
    let changed = false;
    for (const field of salesform.fields) {
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