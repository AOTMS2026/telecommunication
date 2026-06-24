// backend/src/routes/aiCaller.js
//
// UPDATED for the RunPod + GPT-4.1-mini migration:
//  - POST /trigger/:leadId   — now delegates to services/aiCaller/dialer.js
//                              (shared with campaignEngine) instead of inline Twilio logic.
//  - ALL /twiml              — TwiML changed from <Connect><ConversationRelay> to
//                              <Connect><Stream>, pointing at the RunPod pod's
//                              public WebSocket URL (RUNPOD_WS_URL), not this server.
//  - POST /status            — unchanged behavior, now also resets aiCallState.
//  - POST /outcome           — NEW. RunPod orchestrator calls this once per
//                              completed call with the full transcript + structured
//                              GPT-4.1-mini outcome. Authenticated with a scoped
//                              service token (AI_CALLER_SERVICE_TOKEN), NOT the
//                              normal user JWT, since this is a server-to-server
//                              callback from the RunPod pod.
//  - GET  /prompt/:leadId    — NEW. RunPod orchestrator fetches the system prompt
//                              + conversation-memory block at call start, so the
//                              prompt template stays versioned in this repo
//                              instead of being duplicated on the pod.

const express = require('express');
const twilio = require('twilio');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const { protect } = require('../middleware/auth');
const { buildWelcomeGreeting, buildSystemPrompt, buildOutcomeExtractionPrompt } = require('../services/aiCaller/promptBuilder');
const { buildMemoryBlock } = require('../services/aiCaller/conversationMemory');
const { applyNoConnectOutcome, applyAiCallOutcome } = require('../services/aiCaller/outcomeService');
const { triggerAiCall, getBaseUrl } = require('../services/aiCaller/dialer');

const router = express.Router();

// --- NEW: simple shared-secret auth for RunPod -> AOTMS server-to-server calls ---
// Deliberately NOT the same JWT users get — this is a scoped service token so the
// RunPod pod (a less locked-down, GPU-rented environment) never needs a user
// credential or a database connection string.
function requireServiceToken(req, res, next) {
  const expected = process.env.AI_CALLER_SERVICE_TOKEN;
  if (!expected) return res.status(500).json({ message: 'AI_CALLER_SERVICE_TOKEN is not configured on the server' });
  const provided = req.headers['x-ai-caller-token'];
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
 * GET/POST /api/ai-caller/twiml
 * Twilio fetches this when the call connects. Returns TwiML that opens a raw
 * Media Streams WebSocket session to the RunPod pod (NOT this server — the
 * old ConversationRelay-based flow handled audio in-process via relayHandler.js;
 * that has been superseded, see services/aiCaller/relayHandler.js's deprecation note).
 * NOT protected — this is called by Twilio directly.
 */
router.all('/twiml', (req, res) => {
  const leadId = req.query.leadId || req.body.leadId || '';
  const campaignId = req.query.campaignId || req.body.campaignId || '';

  const runpodWsUrl = process.env.RUNPOD_WS_URL; // e.g. wss://<pod-id>-8080.proxy.runpod.net/media
  if (!runpodWsUrl) {
    console.error('[ai-caller] RUNPOD_WS_URL is not configured — cannot build TwiML');
    const fallback = new twilio.twiml.VoiceResponse();
    fallback.say('Sorry, our calling system is temporarily unavailable. Goodbye.');
    fallback.hangup();
    res.type('text/xml');
    return res.send(fallback.toString());
  }

  const twiml = new twilio.twiml.VoiceResponse();
  const connect = twiml.connect();
  const stream = connect.stream({ url: runpodWsUrl, track: 'both_tracks' });
  stream.parameter({ name: 'leadId', value: String(leadId) });
  if (campaignId) stream.parameter({ name: 'campaignId', value: String(campaignId) });

  res.type('text/xml');
  res.send(twiml.toString());
});

/**
 * POST /api/ai-caller/status
 * Twilio call status callback. We mainly use this to catch calls that
 * NEVER connected (no-answer / busy / failed) since the WebSocket never opens then.
 * NOT protected — called by Twilio directly.
 */
router.post('/status', async (req, res) => {
  try {
    const leadId = req.query.leadId;
    const callStatus = req.body.CallStatus; // e.g. completed, no-answer, busy, failed, canceled
    console.log('[ai-caller] status callback:', leadId, callStatus);

    if (leadId && ['no-answer', 'busy', 'failed', 'canceled'].includes(callStatus)) {
      await applyNoConnectOutcome(leadId, callStatus);
    }

    res.sendStatus(200);
  } catch (err) {
    console.error('[ai-caller] status error:', err.message);
    res.sendStatus(200); // always 200 to Twilio
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
