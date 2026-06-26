const express = require('express');
const LeadField = require('../models/LeadField');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const WORKSPACE = 'default';

async function seedIfEmpty() {
  const count = await LeadField.countDocuments({ workspace: WORKSPACE });
  if (count === 0) {
    const seed = LeadField.getDefaultSeed();
    await LeadField.insertMany(seed.map(s => ({ ...s, workspace: WORKSPACE })));
  }
}

// GET /api/lead-fields?view=Active%20Fields|Hidden%20Fields|All&search=
router.get('/', protect, async (req, res) => {
  try {
    await seedIfEmpty();
    const { search, view, fieldType } = req.query;
    const query = { workspace: WORKSPACE };
    if (view === 'Hidden Fields') query.hidden = true;
    else if (view === 'Active Fields') query.hidden = false;
    if (fieldType) query.type = fieldType;
    if (search) query.name = { $regex: search, $options: 'i' };

    const fields = await LeadField.find(query).sort({ order: 1, createdAt: 1 });
    res.json({ fields, total: fields.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/lead-fields
router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { name, type, options } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Field name is required' });
    const count = await LeadField.countDocuments({ workspace: WORKSPACE });
    const field = await LeadField.create({
      workspace: WORKSPACE,
      name: name.trim(),
      type: type || 'text',
      options: options || [],
      order: count,
    });
    res.status(201).json({ field });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/lead-fields/:id
router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const field = await LeadField.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!field) return res.status(404).json({ message: 'Field not found' });
    if (field.isSystem) return res.status(403).json({ message: "Can't edit system generated field" });
    const { name, type, options } = req.body;
    if (name?.trim()) field.name = name.trim();
    if (type) field.type = type;
    if (options) field.options = options;
    await field.save();
    res.json({ field });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/lead-fields/:id/hide — toggle hidden state
router.patch('/:id/hide', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const field = await LeadField.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!field) return res.status(404).json({ message: 'Field not found' });
    field.hidden = req.body.hidden !== undefined ? !!req.body.hidden : !field.hidden;
    await field.save();
    res.json({ field });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/lead-fields/:id
router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const field = await LeadField.findOne({ _id: req.params.id, workspace: WORKSPACE });
    if (!field) return res.status(404).json({ message: 'Field not found' });
    if (field.isSystem) return res.status(403).json({ message: "Can't delete system generated field" });
    await field.deleteOne();
    res.json({ message: 'Deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/lead-fields/reorder
router.put('/reorder', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { orderedIds } = req.body;
    await Promise.all(orderedIds.map((id, idx) => LeadField.findOneAndUpdate({ _id: id, workspace: WORKSPACE }, { order: idx })));
    const fields = await LeadField.find({ workspace: WORKSPACE }).sort({ order: 1 });
    res.json({ fields });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;