const express = require('express');
const CallFeedback = require('../models/CallFeedback');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const WORKSPACE = 'default';

async function getOrCreateConfig() {
  let config = await CallFeedback.findOne({ workspace: WORKSPACE });
  if (!config) {
    const seed = CallFeedback.getDefaultSeed();
    config = await CallFeedback.create({ workspace: WORKSPACE, ...seed });
  }
  return config;
}

// GET /api/call-feedback
router.get('/', protect, async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/call-feedback/min-duration
router.put('/min-duration', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    config.minConnectedDuration = Number(req.body.minConnectedDuration) || 0;
    await config.save();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/call-feedback/statuses
router.post('/statuses', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const config = await getOrCreateConfig();
    config.statuses.push({ name: name.trim().toUpperCase(), order: config.statuses.length });
    await config.save();
    res.status(201).json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/call-feedback/statuses/:statusId
router.put('/statuses/:statusId', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const status = config.statuses.id(req.params.statusId);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    if (status.isSystem) return res.status(403).json({ message: "Can't edit system generated status" });
    if (req.body.name?.trim()) status.name = req.body.name.trim().toUpperCase();
    await config.save();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/call-feedback/statuses/:statusId/default
router.patch('/statuses/:statusId/default', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const status = config.statuses.id(req.params.statusId);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    config.statuses.forEach(s => { s.isDefault = false; });
    status.isDefault = true;
    await config.save();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/call-feedback/statuses/:statusId/archive
router.patch('/statuses/:statusId/archive', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const status = config.statuses.id(req.params.statusId);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    status.archived = req.body.archived !== undefined ? !!req.body.archived : !status.archived;
    await config.save();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/call-feedback/statuses/:statusId
router.delete('/statuses/:statusId', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const status = config.statuses.id(req.params.statusId);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    if (status.isSystem) return res.status(403).json({ message: "Can't delete system generated status" });
    status.deleteOne();
    await config.save();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/call-feedback/reorder
router.put('/reorder', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { orderedIds } = req.body;
    const config = await getOrCreateConfig();
    orderedIds.forEach((id, idx) => {
      const s = config.statuses.id(id);
      if (s) s.order = idx;
    });
    await config.save();
    res.json({ config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;