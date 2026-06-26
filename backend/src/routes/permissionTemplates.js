const express = require('express');
const PermissionTemplate = require('../models/PermissionTemplate');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const WORKSPACE = 'default';

async function seedIfEmpty() {
  const count = await PermissionTemplate.countDocuments({ workspace: WORKSPACE });
  if (count === 0) {
    const seed = PermissionTemplate.getDefaultSeed();
    await PermissionTemplate.insertMany(seed.map(s => ({ ...s, workspace: WORKSPACE })));
  }
}

// GET /api/permission-templates?filter=all|defaults
router.get('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    await seedIfEmpty();
    const query = { workspace: WORKSPACE };
    if (req.query.filter === 'defaults') query.isDefault = true;
    const templates = await PermissionTemplate.find(query).sort({ updatedAt: -1 });
    const withCounts = await Promise.all(templates.map(async t => {
      const assignedCount = await User.countDocuments({ permissionTemplate: t._id });
      return { ...t.toObject(), assignedCount };
    }));
    res.json({ templates: withCounts });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/permission-templates/:id
router.get('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const template = await PermissionTemplate.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/permission-templates
router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, baseRole, permissions } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Name is required' });
    const template = await PermissionTemplate.create({
      workspace: WORKSPACE,
      name: name.trim(),
      baseRole: baseRole || 'caller',
      permissions: permissions || undefined,
    });
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/permission-templates/:id
router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const template = await PermissionTemplate.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    const { name, baseRole, permissions } = req.body;
    if (name?.trim()) template.name = name.trim();
    if (baseRole) template.baseRole = baseRole;
    if (permissions) template.permissions = { ...template.permissions.toObject(), ...permissions };
    await template.save();
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/permission-templates/:id
router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const template = await PermissionTemplate.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!template) return res.status(404).json({ message: 'Template not found' });
    if (template.isDefault) return res.status(403).json({ message: "Can't delete a default template" });
    const assignedCount = await User.countDocuments({ permissionTemplate: template._id });
    if (assignedCount > 0) return res.status(400).json({ message: `Template is assigned to ${assignedCount} user(s)` });
    await template.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;