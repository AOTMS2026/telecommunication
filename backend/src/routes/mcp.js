const express = require('express');
const crypto = require('crypto');
const McpConnection = require('../models/McpConnection');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const PROVIDERS = ['claude', 'chatgpt', 'gemini'];

// Closed beta toggle. Flip via env MCP_BETA_ENABLED=true once invited.
const BETA_ENABLED = process.env.MCP_BETA_ENABLED === 'true';

router.get('/status', protect, async (req, res) => {
  try {
    const connections = await McpConnection.find({ status: 'approved' }).select('-tokenHash');
    res.json({
      betaEnabled: BETA_ENABLED,
      providers: PROVIDERS,
      readOnly: true,
      connections,
      avgApprovalDays: 2,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Request access — sends a beta-access request, no token issued until approved
router.post('/request-access', protect, async (req, res) => {
  try {
    const existing = await McpConnection.findOne({ requestedBy: req.user._id, status: 'pending' });
    if (existing) return res.status(200).json({ message: 'Request already submitted', request: existing });

    const request = await McpConnection.create({
      provider: req.body.provider && PROVIDERS.includes(req.body.provider) ? req.body.provider : 'claude',
      status: 'pending',
      requestedBy: req.user._id,
    });
    res.status(201).json({ message: "Request submitted. We'll respond within 2 business days.", request });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin-only: approve a pending request and issue a read-only scoped token
router.patch('/:id/approve', protect, authorize('admin', 'super admin'), async (req, res) => {
  if (!BETA_ENABLED) return res.status(403).json({ message: 'MCP is in closed beta for this workspace' });
  try {
    const rawToken = `mcp_${crypto.randomBytes(24).toString('hex')}`;
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const conn = await McpConnection.findByIdAndUpdate(req.params.id, {
      status: 'approved', tokenHash, tokenPrefix: rawToken.slice(0, 10),
      approvedBy: req.user._id, approvedAt: new Date(),
    }, { new: true }).select('-tokenHash');
    if (!conn) return res.status(404).json({ message: 'Request not found' });
    res.json({ connection: conn, rawToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/revoke', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const conn = await McpConnection.findByIdAndUpdate(req.params.id, { status: 'revoked' }, { new: true }).select('-tokenHash');
    if (!conn) return res.status(404).json({ message: 'Connection not found' });
    res.json({ connection: conn });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;