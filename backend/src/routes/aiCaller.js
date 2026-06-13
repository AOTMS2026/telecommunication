const express = require('express');
const twilio = require('twilio');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const { buildWelcomeGreeting } = require('./../services/aiCaller/promptBuilder');
const { applyNoConnectOutcome } = require('./../services/aiCaller/outcomeService');

const router = express.Router();

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials not configured');
  return twilio(sid, token);
}

function getBaseUrl() {
  // e.g. https://loyola-lms.onrender.com
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

/**
 * POST /api/ai-caller/trigger/:leadId
 * Starts an outbound AI call to the lead's phone number.
 * Protected — only logged-in admin/caller users can trigger this.
 */
router.post('/trigger/:leadId', protect, async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.leadId).populate('courseInterest', 'name');
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    if (!lead.phone) return res.status(400).json({ message: 'Lead has no phone number' });

    const baseUrl = getBaseUrl();
    if (!baseUrl) return res.status(500).json({ message: 'PUBLIC_BASE_URL is not configured on the server' });

    const client = getTwilioClient();
    const fromNumber = process.env.TWILIO_PHONE_NUMBER;
    if (!fromNumber) return res.status(500).json({ message: 'TWILIO_PHONE_NUMBER is not configured on the server' });

    // Twilio requires E.164 format, e.g. +91XXXXXXXXXX
    let toNumber = lead.phone.trim();
    if (!toNumber.startsWith('+')) {
      // naive default — adjust if your leads aren't Indian numbers
      toNumber = `+91${toNumber.replace(/\D/g, '').slice(-10)}`;
    }

    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: `${baseUrl}/api/ai-caller/twiml?leadId=${lead._id}`,
      statusCallback: `${baseUrl}/api/ai-caller/status?leadId=${lead._id}`,
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed', 'canceled'],
      statusCallbackMethod: 'POST',
    });

    lead.activities.unshift({
      type: 'note',
      description: `AI Call initiated to ${toNumber} (Call SID: ${call.sid})`,
      performedBy: req.user._id,
    });
    await lead.save();

    res.json({ success: true, callSid: call.sid, to: toNumber, status: call.status });
  } catch (err) {
    console.error('[ai-caller] trigger error:', err.message);
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET/POST /api/ai-caller/twiml
 * Twilio fetches this when the call connects. Returns TwiML that opens
 * a ConversationRelay WebSocket session to our server.
 * NOT protected — this is called by Twilio directly.
 */
router.all('/twiml', (req, res) => {
  const leadId = req.query.leadId || req.body.leadId || '';
  const baseUrl = getBaseUrl();
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/ai-caller/relay';

  // Minimal default greeting if no lead found (still works)
  const greeting = 'Hello, this is Priya calling from AOTMS. Is this a good time to talk?';

  const twiml = new twilio.twiml.VoiceResponse();
  const connect = twiml.connect();
  const relay = connect.conversationRelay({
    url: wsUrl,
    welcomeGreeting: greeting,
    voice: 'Polly.Aditi', // Indian-English voice; change if you prefer another
  });
  relay.parameter({ name: 'leadId', value: String(leadId) });

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

module.exports = router;
