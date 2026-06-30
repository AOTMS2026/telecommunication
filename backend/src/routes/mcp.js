const express = require('express');
const crypto = require('crypto');
const McpConnection = require('../models/McpConnection');
const { protect, authorize } = require('../middleware/auth');
const { sendNotificationEmail } = require('../services/emailService');

const router = express.Router();

const PROVIDERS = ['claude', 'chatgpt', 'gemini'];
const MCP_REQUEST_EMAIL = process.env.MCP_REQUEST_EMAIL || 'aotms.marketing@gmail.com';

// Closed beta toggle. Flip via env MCP_BETA_ENABLED=true once invited.
const BETA_ENABLED = process.env.MCP_BETA_ENABLED === 'true';

router.get('/status', protect, async (req, res) => {
  try {
    const connections = await McpConnection.find({ status: 'approved' }).select('-tokenHash');
    const pendingRequest = await McpConnection.findOne({ requestedBy: req.user._id, status: 'pending' }).sort({ createdAt: -1 });
    res.json({
      betaEnabled: BETA_ENABLED,
      providers: PROVIDERS,
      readOnly: true,
      connections,
      avgApprovalDays: 2,
      requestEmail: MCP_REQUEST_EMAIL,
      hasPendingRequest: !!pendingRequest,
      pendingProvider: pendingRequest?.provider || null,
      pendingRequestedAt: pendingRequest?.createdAt || null,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Request access — sends a beta-access request, no token issued until approved.
// Also emails the AOTMS marketing/account-management inbox so a human sees it.
router.post('/request-access', protect, async (req, res) => {
  try {
    const provider = req.body.provider && PROVIDERS.includes(req.body.provider) ? req.body.provider : 'claude';

    const existing = await McpConnection.findOne({ requestedBy: req.user._id, status: 'pending', provider });
    if (existing) return res.status(200).json({ message: 'Request already submitted', request: existing, sentTo: MCP_REQUEST_EMAIL });

    const request = await McpConnection.create({
      provider,
      status: 'pending',
      requestedBy: req.user._id,
      notifiedEmail: MCP_REQUEST_EMAIL,
    });

    let emailSent = false;
    try {
      await sendNotificationEmail({
        to: MCP_REQUEST_EMAIL,
        subject: `MCP Beta Access Request — ${provider} (${req.user.name || req.user.email})`,
        bodyHtml: `
          <p><strong>New MCP closed-beta access request</strong></p>
          <p>
            Requested by: <strong>${req.user.name || ''}</strong> (${req.user.email})<br/>
            Provider requested: <strong>${provider}</strong><br/>
            Workspace: ${req.user.organization || req.user._id}<br/>
            Requested at: ${new Date().toLocaleString()}
          </p>
          <p>Approve or reject this request from the AOTMS admin panel.</p>
        `,
      });
      emailSent = true;
    } catch (mailErr) {
      console.error('MCP request-access email failed:', mailErr.message);
    }

    request.emailSent = emailSent;
    await request.save();

    res.status(201).json({
      message: emailSent
        ? `Request submitted and emailed to ${MCP_REQUEST_EMAIL}. We'll respond within 2 business days.`
        : "Request submitted, but the notification email failed to send. We'll respond within 2 business days.",
      request,
      sentTo: MCP_REQUEST_EMAIL,
      emailSent,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Admin-only: approve a pending request and issue a read-only scoped token
router.patch('/:id/approve', protect, authorize('manager', 'admin'), async (req, res) => {
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

router.patch('/:id/revoke', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const conn = await McpConnection.findByIdAndUpdate(req.params.id, { status: 'revoked' }, { new: true }).select('-tokenHash');
    if (!conn) return res.status(404).json({ message: 'Connection not found' });
    res.json({ connection: conn });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;