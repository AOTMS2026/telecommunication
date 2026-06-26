const express = require('express');
const CustomAction = require('../models/CustomAction');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const WORKSPACE = 'default';

// GET /api/custom-actions?status=active|archived
router.get('/', protect, async (req, res) => {
  try {
    const status = req.query.status === 'archived' ? 'archived' : 'active';
    const actions = await CustomAction.find({ workspace: WORKSPACE, status }).sort({ createdAt: -1 });
    const activeCount = await CustomAction.countDocuments({ workspace: WORKSPACE, status: 'active' });
    const archivedCount = await CustomAction.countDocuments({ workspace: WORKSPACE, status: 'archived' });
    res.json({ actions, activeCount, archivedCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/custom-actions/:id
router.get('/:id', protect, async (req, res) => {
  try {
    const action = await CustomAction.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!action) return res.status(404).json({ message: 'Custom action not found' });
    res.json({ action });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/custom-actions
router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { icon, name, score, direction, description, allowPredefinedActions, fields } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const action = await CustomAction.create({
      workspace: WORKSPACE,
      icon: icon || 'activity',
      name: name.trim(),
      score: Number(score) || 0,
      direction: direction || 'information',
      description: description || '',
      allowPredefinedActions: !!allowPredefinedActions,
      fields: fields?.length ? fields : undefined,
    });
    res.status(201).json({ action });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/custom-actions/:id
router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const action = await CustomAction.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!action) return res.status(404).json({ message: 'Custom action not found' });
    const { icon, name, score, direction, description, allowPredefinedActions, fields } = req.body;
    if (icon !== undefined) action.icon = icon;
    if (name?.trim()) action.name = name.trim();
    if (score !== undefined) action.score = Number(score) || 0;
    if (direction !== undefined) action.direction = direction;
    if (description !== undefined) action.description = description;
    if (allowPredefinedActions !== undefined) action.allowPredefinedActions = !!allowPredefinedActions;
    if (fields !== undefined) action.fields = fields;
    await action.save();
    res.json({ action });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/custom-actions/:id/archive
router.patch('/:id/archive', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const action = await CustomAction.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!action) return res.status(404).json({ message: 'Custom action not found' });
    action.status = action.status === 'active' ? 'archived' : 'active';
    await action.save();
    res.json({ action });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/custom-actions/:id
router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const action = await CustomAction.findOneAndDelete({ _id: req.params.id, workspace: WORKSPACE });
    if (!action) return res.status(404).json({ message: 'Custom action not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;