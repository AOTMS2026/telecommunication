const express = require('express');
const WorkspacePreferences = require('../models/WorkspacePreferences');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();
const WORKSPACE = 'default';

async function getOrCreateConfig() {
  let config = await WorkspacePreferences.findOne({ workspace: WORKSPACE });
  if (!config) config = await WorkspacePreferences.create({ workspace: WORKSPACE });
  return config;
}

// GET /api/workspace-preferences
router.get('/', protect, async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    res.json({ preferences: config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/workspace-preferences — deep-merge partial update
router.put('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const config = await getOrCreateConfig();
    const body = req.body || {};

    const scalarFields = ['defaultCountryCode', 'defaultTimezone', 'defaultCurrency', 'connectedCallMinDuration', 'sessionTimeout'];
    scalarFields.forEach(f => { if (body[f] !== undefined) config[f] = body[f]; });

    if (body.leaderboard) Object.assign(config.leaderboard, body.leaderboard);
    if (body.features) Object.assign(config.features, body.features);
    if (body.syncPermissions) Object.assign(config.syncPermissions, body.syncPermissions);

    await config.save();
    res.json({ preferences: config });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;