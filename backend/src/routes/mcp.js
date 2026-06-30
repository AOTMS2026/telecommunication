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

// GET /api/mcp/status — returns all requests + approved connections for current user
router.get('/status', protect, async (req, res) => {
  try {
    // All requests made by this user
    const userRequests = await McpConnection
      .find({ requestedBy: req.user._id })
      .sort({ createdAt: -1 })
      .select('-tokenHash');

    // Approved connections (workspace-wide, minus token hash)
    const approvedConnections = await McpConnection
      .find({ requestedBy: req.user._id, status: 'approved' })
      .sort({ approvedAt: -1 })
      .select('-tokenHash');

    res.json({
      betaEnabled: BETA_ENABLED,
      providers: PROVIDERS,
      readOnly: true,
      requests: userRequests,          // all requests by this user
      connections: approvedConnections, // approved ones
      avgApprovalDays: 2,
      requestEmail: MCP_REQUEST_EMAIL,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/mcp/request-access
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

// POST /api/mcp/:id/connect — reveal token once to the approved user (one-time view)
router.post('/:id/connect', protect, async (req, res) => {
  try {
    const conn = await McpConnection.findOne({ _id: req.params.id, requestedBy: req.user._id, status: 'approved' });
    if (!conn) return res.status(404).json({ message: 'Approved connection not found' });

    // Update last used
    conn.lastUsedAt = new Date();
    await conn.save();

    // We return tokenPrefix so user can identify it; full token was returned only at approval time.
    // If the workspace wants to re-issue a token, admin must re-approve.
    res.json({
      connection: {
        _id: conn._id,
        provider: conn.provider,
        status: conn.status,
        tokenPrefix: conn.tokenPrefix,
        readOnly: conn.readOnly,
        approvedAt: conn.approvedAt,
        lastUsedAt: conn.lastUsedAt,
      },
      // NOTE: full rawToken is only available at approval time. Here we return the prefix for reference.
      tokenPrefix: conn.tokenPrefix,
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

    // Notify the user who requested it
    try {
      const requestingUser = await require('../models/User').findById(conn.requestedBy);
      if (requestingUser?.email) {
        await sendNotificationEmail({
          to: requestingUser.email,
          subject: `Your MCP Beta Access (${conn.provider}) has been approved!`,
          bodyHtml: `
            <p>Hi ${requestingUser.name || ''},</p>
            <p>Your request for <strong>${conn.provider}</strong> MCP beta access on AOTMS has been <strong>approved</strong>.</p>
            <p>Your access token: <code style="background:#f3f4f6;padding:4px 8px;border-radius:4px;font-family:monospace;">${rawToken}</code></p>
            <p><strong>Save this token — it won't be shown again.</strong></p>
            <p>You can now connect ${conn.provider} to your AOTMS workspace from the MCP settings page.</p>
          `,
        });
      }
    } catch (mailErr) {
      console.error('MCP approval email failed:', mailErr.message);
    }

    res.json({ connection: conn, rawToken });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/revoke', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const conn = await McpConnection.findByIdAndUpdate(req.params.id, { status: 'revoked', tokenHash: null, tokenPrefix: null }, { new: true }).select('-tokenHash');
    if (!conn) return res.status(404).json({ message: 'Connection not found' });
    res.json({ connection: conn });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;