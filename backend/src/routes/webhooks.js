const express = require('express');
const Webhook = require('../models/Webhook');
const { protect, authorize } = require('../middleware/auth');
const { triggerWebhook } = require('../services/automationRunners');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const webhooks = await Webhook.find().populate('createdBy', 'name').sort({ createdAt: -1 });
    res.json({ webhooks });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const webhook = await Webhook.findById(req.params.id);
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ webhook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const webhook = await Webhook.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ webhook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const webhook = await Webhook.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ webhook });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Fire a test payload at the webhook URL
router.post('/:id/test', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const result = await triggerWebhook(req.params.id, 'webhook.test', {
      test: true,
      message: 'This is a test event from AOTMS',
    });
    res.json({ result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const webhook = await Webhook.findByIdAndDelete(req.params.id);
    if (!webhook) return res.status(404).json({ message: 'Webhook not found' });
    res.json({ message: 'Webhook deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;