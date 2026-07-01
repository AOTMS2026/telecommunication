// backend/src/routes/aiCaller.js
//
// EXOTEL MIGRATION:
//  - POST /trigger/:leadId   — unchanged route shape; dialer.js underneath now
//                              calls Exotel's Connect API instead of Twilio.
//  - ALL /twiml              — REMOVED. Exotel has no TwiML/callback-URL
//                              concept; dialer.js now passes the RunPod WSS
//                              URL directly as `streamurl` in the same API
//                              call that places the call (see dialer.js).
//                              Replaced with GET /stream-url/:leadId below,
//                              which exists only for the alternative
//                              HTTPS-resolver pattern Exotel also supports
//                              (Voicebot Applet configured to POST/GET here
//                              and expect back `{"url": "wss://..."}`) — use
//                              this if you switch from the direct-API outbound
//                              flow to a call-flow/Applet-based one.
//  - POST /status            — field names updated for Exotel's callback
//                              payload shape (lowercase, e.g. "Status" not
//                              guaranteed to be "CallStatus"); status values
//                              also differ slightly from Twilio's set.
//  - POST /outcome           — unchanged. RunPod orchestrator calls this once
//                              per completed call with the full transcript +
//                              structured GPT-4.1-mini outcome. Authenticated
//                              with a scoped service token
//                              (AI_CALLER_SERVICE_TOKEN), NOT the normal user
//                              JWT, since this is a server-to-server callback
//                              from the RunPod pod.
//  - GET  /prompt/:leadId    — unchanged. RunPod orchestrator fetches the
//                              system prompt + conversation-memory block at
//                              call start, so the prompt template stays
//                              versioned in this repo instead of being
//                              duplicated on the pod.

const express = require('express');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const { protect } = require('../middleware/auth');
const { buildWelcomeGreeting, buildSystemPrompt, buildOutcomeExtractionPrompt } = require('../services/aiCaller/promptBuilder');
const { buildMemoryBlock } = require('../services/aiCaller/conversationMemory');
const { applyNoConnectOutcome, applyAiCallOutcome } = require('../services/aiCaller/outcomeService');
const { triggerAiCall } = require('../services/aiCaller/dialer');

const router = express.Router();

// --- NEW: simple shared-secret auth for RunPod -> AOTMS server-to-server calls ---
// Deliberately NOT the same JWT users get — this is a scoped service token so the
// RunPod pod (a less locked-down, GPU-rented environment) never needs a user
// credential or a database connection string.
function requireServiceToken(req, res, next) {
  const expected = process.env.AI_CALLER_SERVICE_TOKEN;
  if (!expected) return res.status(500).json({ message: 'AI_CALLER_SERVICE_TOKEN is not configured on the server' });
  const authHeader = req.headers['authorization'] || '';
  const provided = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader;
  if (provided !== expected) return res.status(401).json({ message: 'Invalid service token' });
  next();
}

/**
 * POST /api/ai-caller/trigger/:leadId
 * Starts an outbound AI call to the lead's phone number.
 * Protected — only logged-in admin/caller users can trigger this.
 * (Manual "Call Now" path — shares services/aiCaller/dialer.js with campaignEngine.)
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
 * GET/POST /api/ai-caller/stream-url/:leadId
 * EXOTEL: only used if you configure the Exotel Voicebot Applet to call an
 * HTTPS resolver instead of passing a static wss:// URL directly in the
 * Applet config. Exotel requires this endpoint to return JSON of the shape
 * {"url": "wss://..."} (per Exotel docs: "when you specify a https endpoint,
 * it must return a json with the key 'url'"). The direct-API flow in
 * dialer.js does NOT call this — it passes `streamurl` inline on
 * /calls/connect — so this route is unused by the current trigger path, but
 * is kept available for the call-flow/Applet-based outbound pattern.
 * NOT protected — this would be called by Exotel directly, not a logged-in user.
 */
router.all('/stream-url/:leadId', (req, res) => {
  const leadId = req.params.leadId || '';
  const campaignId = req.query.campaignId || req.body.campaignId || '';

  const runpodWsUrl = process.env.ORCHESTRATOR_WS_URL; // e.g. wss://<your-orchestrator-host>/media
  if (!runpodWsUrl) {
    console.error('[ai-caller] ORCHESTRATOR_WS_URL is not configured — cannot resolve stream URL');
    return res.status(500).json({ message: 'Calling system is temporarily unavailable' });
  }

  const campaignQuery = campaignId ? `&campaignId=${campaignId}` : '';
  const url = `${runpodWsUrl}?leadId=${leadId}${campaignQuery}`;

  res.json({ url });
});

/**
 * POST /api/ai-caller/status
 * EXOTEL: status callback, registered via dialer.js's `statuscallback` +
 * `statuscallbackevents[]=terminal`. We mainly use this to catch calls that
 * NEVER connected (no-answer / busy / failed) since the WebSocket never opens
 * then. Exotel's call status values are queued/in-progress/completed/failed/
 * busy/no-answer (no separate "canceled" status the way Twilio has one) — the
 * field name in the callback payload is also lowercase/differently-cased
 * than Twilio's "CallStatus", so this reads `req.body.Status` with a
 * lowercase-key fallback in case Exotel sends it as `status` for your account.
 * NOT protected — called by Exotel directly.
 */
router.post('/status', async (req, res) => {
  try {
    const leadId = req.query.leadId;
    const callStatus = req.body.Status || req.body.status; // Exotel field naming can vary by account/version — handle both
    console.log('[ai-caller] status callback:', leadId, callStatus);

    if (leadId && ['no-answer', 'busy', 'failed'].includes(callStatus)) {
      await applyNoConnectOutcome(leadId, callStatus);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[ai-caller] status error:', err.message);
    res.sendStatus(200); // always 200 to Exotel
  }
});

/**
 * GET /api/ai-caller/prompt/:leadId
 * NEW — called once by the RunPod orchestrator at the start of each call
 * (server.py -> memory_client.py) to fetch the system prompt, welcome greeting,
 * and the structured-output extraction prompt to use at call end. Keeps prompt
 * templates versioned in this repo instead of duplicated on the pod.
 */
router.get('/prompt/:leadId', requireServiceToken, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.leadId).populate('courseInterest', 'name');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    const memoryBlock = await buildMemoryBlock(lead._id);
    const systemPrompt = buildSystemPrompt(lead, memoryBlock);
    const welcomeGreeting = buildWelcomeGreeting(lead);
    const outcomeExtractionPrompt = buildOutcomeExtractionPrompt();

    res.json({
      systemPrompt,
      welcomeGreeting,
      outcomeExtractionPrompt,
      language: lead.language || '',
    });
  } catch (err) {
    console.error('[ai-caller] prompt fetch error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * POST /api/ai-caller/outcome
 * NEW — called once by the RunPod orchestrator (outcome_client.py) when a call
 * ends. Body: { leadId, campaignId?, callSid?, durationSeconds, recordingUrl?,
 * transcript, outcome: { ...structured GPT-4.1-mini JSON... } }
 * Authenticated via the scoped service token, not a user JWT.
 */
router.post('/outcome', requireServiceToken, async (req, res) => {
  try {
    const { leadId, campaignId, callSid, durationSeconds, recordingUrl, transcript, outcome } = req.body;
    if (!leadId || !outcome) {
      return res.status(400).json({ message: 'leadId and outcome are required' });
    }

    const lead = await applyAiCallOutcome(leadId, outcome, {
      durationSeconds: durationSeconds || 0,
      recordingUrl: recordingUrl || '',
      transcript: transcript || '',
      campaignId: campaignId || undefined,
      callSid: callSid || '',
    });

    if (!lead) return res.status(404).json({ message: 'Lead not found' });

    res.json({ success: true });
  } catch (err) {
    console.error('[ai-caller] outcome error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;