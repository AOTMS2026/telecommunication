const express = require('express');
const ApiTemplate = require('../models/ApiTemplate');
const { protect, authorize } = require('../middleware/auth');
const { runApiTemplate } = require('../services/automationRunners');
const Lead = require('../models/Lead');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const templates = await ApiTemplate.find()
      .populate('lastModifiedBy', 'name')
      .sort({ updatedAt: -1 });
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const template = await ApiTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'API template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const template = await ApiTemplate.create({
      ...req.body,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    });
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const template = await ApiTemplate.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastModifiedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: 'API template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Test-run a template against a sample lead (or the most recent lead)
router.post('/:id/test', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const lead = req.body.leadId
      ? await Lead.findById(req.body.leadId)
      : await Lead.findOne().sort({ createdAt: -1 });
    const result = await runApiTemplate(req.params.id, { lead, user: req.user });
    res.json({ result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const template = await ApiTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ message: 'API template not found' });
    res.json({ message: 'API template deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;