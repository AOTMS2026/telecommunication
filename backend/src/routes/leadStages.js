const express = require('express');
const mongoose = require('mongoose');
const LeadStage = require('../models/LeadStage');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// ── Default seed data ─────────────────────────────────────────────────────────
const DEFAULT_STATUSES = [
  { name: 'Fresh',        color: '#60a5fa', stage: 'initial',      order: 0, isSystem: true,  isDefault: true },
  { name: 'Contacted',   color: '#a78bfa', stage: 'initial',      order: 1, isSystem: true  },
  { name: 'Interested',  color: '#34d399', stage: 'active',       order: 0 },
  { name: 'Follow Up',   color: '#f6c453', stage: 'active',       order: 1 },
  { name: 'Demo',        color: '#fb923c', stage: 'active',       order: 2 },
  { name: 'Negotiation', color: '#818cf8', stage: 'active',       order: 3 },
  { name: 'Enrolled',    color: '#22c55e', stage: 'closed_won',   order: 0, isSystem: true  },
  { name: 'Not Interested', color: '#f87171', stage: 'closed_lost', order: 0, isSystem: true },
  { name: 'Blocked',     color: '#ef4444', stage: 'closed_lost',  order: 1, isSystem: true  },
];

// Get or create the singleton config
async function getConfig() {
  let config = await LeadStage.findOne({ org: 'default' });
  if (!config) {
    config = await LeadStage.create({ org: 'default', statuses: DEFAULT_STATUSES, lostReasons: [] });
  }
  return config;
}

// ── GET /api/lead-stages ──────────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    const config = await getConfig();
    res.json({ config });
  } catch (err) {
    console.error('[GET /lead-stages]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/lead-stages/statuses ───────────────────────────────────────────
router.post('/statuses', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { name, color, stage } = req.body;
    if (!name || !stage) return res.status(400).json({ message: 'name and stage are required' });

    const config = await getConfig();
    const maxOrder = config.statuses
      .filter(s => s.stage === stage && !s.archived)
      .reduce((m, s) => Math.max(m, s.order), -1);

    config.statuses.push({ name, color: color || '#94a3b8', stage, order: maxOrder + 1 });
    await config.save();
    res.status(201).json({ config });
  } catch (err) {
    console.error('[POST /lead-stages/statuses]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/lead-stages/statuses/:id ────────────────────────────────────────
router.put('/statuses/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const config = await getConfig();
    const status = config.statuses.id(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });

    const { name, color, isDefault } = req.body;
    if (name  !== undefined) status.name  = name;
    if (color !== undefined) status.color = color;
    if (isDefault) {
      // Clear existing default in same stage
      config.statuses.forEach(s => { if (s.stage === status.stage) s.isDefault = false; });
      status.isDefault = true;
    }

    await config.save();
    res.json({ config });
  } catch (err) {
    console.error('[PUT /lead-stages/statuses/:id]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/lead-stages/statuses/:id  (archive) ──────────────────────────
router.delete('/statuses/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const config = await getConfig();
    const status = config.statuses.id(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });
    if (status.isSystem) return res.status(400).json({ message: 'Cannot delete system status' });

    status.archived = true;
    await config.save();
    res.json({ config });
  } catch (err) {
    console.error('[DELETE /lead-stages/statuses/:id]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── PUT /api/lead-stages/statuses/:id/archive ────────────────────────────────
// Used to restore archived statuses (archived: false)
router.put('/statuses/:id/archive', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const config = await getConfig();
    const status = config.statuses.id(req.params.id);
    if (!status) return res.status(404).json({ message: 'Status not found' });

    status.archived = req.body.archived !== undefined ? req.body.archived : status.archived;
    await config.save();
    res.json({ config });
  } catch (err) {
    console.error('[PUT /lead-stages/statuses/:id/archive]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/lead-stages/statuses/reorder ───────────────────────────────────
router.post('/statuses/reorder', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { stage, orderedIds } = req.body;
    if (!stage || !Array.isArray(orderedIds)) {
      return res.status(400).json({ message: 'stage and orderedIds[] are required' });
    }

    const config = await getConfig();
    orderedIds.forEach((id, idx) => {
      const s = config.statuses.id(id);
      if (s && s.stage === stage) s.order = idx;
    });

    await config.save();
    res.json({ config });
  } catch (err) {
    console.error('[POST /lead-stages/statuses/reorder]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── POST /api/lead-stages/lost-reasons ───────────────────────────────────────
router.post('/lost-reasons', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'name is required' });

    const config = await getConfig();
    if (config.lostReasons.length >= 25) {
      return res.status(400).json({ message: 'Maximum 25 lost reasons allowed' });
    }

    config.lostReasons.push({ name });
    await config.save();
    res.status(201).json({ config });
  } catch (err) {
    console.error('[POST /lead-stages/lost-reasons]', err.message);
    res.status(500).json({ message: err.message });
  }
});

// ── DELETE /api/lead-stages/lost-reasons/:id ─────────────────────────────────
router.delete('/lost-reasons/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const config = await getConfig();
    const reason = config.lostReasons.id(req.params.id);
    if (!reason) return res.status(404).json({ message: 'Reason not found' });

    reason.deleteOne();
    await config.save();
    res.json({ config });
  } catch (err) {
    console.error('[DELETE /lead-stages/lost-reasons/:id]', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;