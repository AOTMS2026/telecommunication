// backend/src/routes/aiCaller.js
//
// SARVAM MIGRATION:
//  - POST /trigger/:leadId   — unchanged. Manual "Call Now" → dialer.js.
//  - GET  /stream-url/:leadId — unchanged. Alternative Exotel Applet resolver.
//  - POST /status            — unchanged. Exotel terminal callback.
//  - POST /outcome           — REMOVED. The orchestrator now runs in-process
//                              (services/aiCaller/orchestrator.js) and writes
//                              outcomes directly to MongoDB. No HTTP callback needed.
//  - GET  /prompt/:leadId    — REMOVED. Same reason — context is loaded
//                              directly from DB inside orchestrator.js on
//                              WebSocket connection, no inter-service fetch.

const express = require('express');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const { protect } = require('../middleware/auth');
const { applyNoConnectOutcome } = require('../services/aiCaller/outcomeService');
const { triggerAiCall } = require('../services/aiCaller/dialer');

const router = express.Router();

/**
 * POST /api/ai-caller/trigger/:leadId
 * Starts an outbound AI call (manual "Call Now" from dashboard).
 * Protected — only logged-in admin/caller users.
 */
router.post('/trigger/:leadId', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.leadId).populate('courseInterest', 'name');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const campaign = lead.campaign ? await Campaign.findById(lead.campaign) : null;

    const result = await triggerAiCall(lead, campaign, { performedBy: req.user._id });
    res.json(result);
  } catch (err) {
    console.error('[ai-caller] trigger error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET/POST /api/ai-caller/stream-url  (and /stream-url/:leadId for back-compat)
 * Used by the App Bazaar Voicebot Applet's dynamic-URL fetch. Exotel calls
 * this with leadId/campaignId as query params (set in dialer.js's flowUrl).
 * Returns { "url": "wss://..." }.
 * NOT protected — called by Exotel directly.
 */
router.all(['/stream-url', '/stream-url/:leadId'], (req, res) => {
  const leadId = req.params.leadId || req.query.leadId || req.body?.leadId || '';
  const campaignId = req.query.campaignId || req.body?.campaignId || '';

  const baseUrl = (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
  if (!baseUrl) return res.status(500).json({ message: 'PUBLIC_BASE_URL not configured' });

  const wsBase = baseUrl
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');

  const campaignQuery = campaignId ? `&campaignId=${campaignId}` : '';
  const url = `${wsBase}/ai-caller/stream?leadId=${leadId}${campaignQuery}`;

  res.json({ url });
});

/**
 * POST /api/ai-caller/status
 * Exotel terminal status callback. Handles calls that never connected
 * (no-answer / busy / failed) — the WebSocket never opens in those cases,
 * so orchestrator.js never runs, and this is the only path that fires.
 * NOT protected — called by Exotel directly.
 */
router.post('/status', async (req, res) => {
  try {
    const leadId = req.query.leadId;
    const callStatus = req.body.Status || req.body.status;
    console.log('[ai-caller] Exotel status callback:', leadId, callStatus);

    if (leadId && ['no-answer', 'busy', 'failed'].includes(callStatus)) {
      await applyNoConnectOutcome(leadId, callStatus);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[ai-caller] status error:', err.message);
    res.sendStatus(200); // always 200 to Exotel
  }
});

module.exports = router;