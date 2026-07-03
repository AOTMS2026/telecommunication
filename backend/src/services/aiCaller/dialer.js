// backend/src/services/aiCaller/dialer.js
//
// Per Sarvam+Exotel integration PDF:
// Pass StreamUrl directly in the Calls/connect API call.
// DO NOT use App Bazaar Url= flow for AI calls.
// StreamType=bidirectional tells Exotel to connect the call directly
// to our WebSocket orchestrator at /ai-caller/stream.

const axios = require('axios');
const Lead = require('../../models/Lead');
const { releaseLock } = require('./leadLock');

function getExotelConfig() {
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  const accountSid = process.env.EXOTEL_ACCOUNT_SID;
  const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
  if (!apiKey || !apiToken || !accountSid) {
    throw new Error('Exotel credentials not configured (EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_ACCOUNT_SID)');
  }
  return { apiKey, apiToken, accountSid, subdomain };
}

function getBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

function getOrchestratorWsBase() {
  const base = getBaseUrl();
  if (!base) throw new Error('PUBLIC_BASE_URL is not configured');
  return base
    .replace(/^https:\/\//, 'wss://')
    .replace(/^http:\/\//, 'ws://');
}

function normalizePhone(rawPhone) {
  let toNumber = (rawPhone || '').trim();
  if (toNumber.startsWith('+')) {
    toNumber = `+${toNumber.slice(1).replace(/\D/g, '')}`;
  } else {
    toNumber = `+91${toNumber.replace(/\D/g, '').slice(-10)}`;
  }
  return toNumber;
}

async function triggerAiCall(lead, campaign = null, { performedBy = null } = {}) {
  if (!lead.phone) throw new Error('Lead has no phone number');

  const baseUrl = getBaseUrl();
  const wsBase = getOrchestratorWsBase();
  const exophone = process.env.EXOTEL_EXOPHONE;
  if (!exophone) throw new Error('EXOTEL_EXOPHONE is not configured');

  const toNumber = normalizePhone(lead.phone);
  const campaignQuery = campaign ? `&campaignId=${campaign._id}` : '';

  // Per PDF: StreamUrl is the WebSocket endpoint of our orchestrator.
  // Exotel connects directly to this WS — no App Bazaar flow needed.
  const streamUrl = `${wsBase}/ai-caller/stream?leadId=${lead._id}${campaignQuery}`;

  try {
    const { apiKey, apiToken, accountSid, subdomain } = getExotelConfig();

    // From PDF: exact field names for Calls/connect with StreamType=bidirectional
    const params = new URLSearchParams({
      From: toNumber,        // caller's number (who gets the call)
      CallerId: exophone,    // your Exophone virtual number
      StreamUrl: streamUrl,  // our WS orchestrator
      StreamType: 'bidirectional',
      StatusCallback: `${baseUrl}/api/ai-caller/status?leadId=${lead._id}${campaignQuery}`,
      StatusCallbackEvent: 'terminal',
      Record: 'true',
    });

    const url = `https://${apiKey}:${apiToken}@${subdomain}/v1/Accounts/${accountSid}/Calls/connect`;
    console.log(`[dialer] POST ${url.replace(apiToken, '***')}`);
    console.log(`[dialer] To=${toNumber} CallerId=${exophone}`);
    console.log(`[dialer] StreamUrl=${streamUrl}`);

    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // Exotel returns TwiML-compatible XML
    const xml = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const sidMatch = xml.match(/<Sid>([^<]+)<\/Sid>/);
    const callSid = sidMatch ? sidMatch[1] : 'unknown';

    console.log(`[dialer] call placed SID=${callSid}`);

    lead.activities.unshift({
      type: 'note',
      description: `AI Call initiated to ${toNumber} (SID: ${callSid})${campaign ? ` [Campaign: ${campaign.name}]` : ''}`,
      performedBy: performedBy || undefined,
    });
    lead.activeCallSid = callSid;
    await lead.save();

    return { success: true, callSid, to: toNumber, status: 'in-progress' };
  } catch (err) {
    await Lead.updateOne({ _id: lead._id }, { aiCallState: 'none' }).catch(() => {});
    await releaseLock(lead._id, 'ai-engine').catch(() => {});
    const message = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[dialer] Exotel call failed: ${message}`);
    throw new Error(`Exotel call failed: ${message}`);
  }
}

// Actively terminate a live Exotel call (used by ai-pause "stop" so calls
// don't just keep ringing/talking after the user hits stop).
// Exotel's standard Call-update endpoint: POST .../Calls/{CallSid}.json
// with Status=completed hangs up an in-progress call.
async function hangupCall(callSid) {
  if (!callSid || callSid === 'unknown') return { success: false, reason: 'no callSid' };

  const { apiKey, apiToken, accountSid, subdomain } = getExotelConfig();
  const url = `https://${apiKey}:${apiToken}@${subdomain}/v1/Accounts/${accountSid}/Calls/${callSid}.json`;

  try {
    await axios.post(url, new URLSearchParams({ Status: 'completed' }).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    console.log(`[dialer] hung up call SID=${callSid}`);
    return { success: true };
  } catch (err) {
    const message = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    console.error(`[dialer] hangup failed for SID=${callSid}: ${message}`);
    return { success: false, reason: message };
  }
}

module.exports = { triggerAiCall, hangupCall, getExotelConfig, getBaseUrl, normalizePhone };