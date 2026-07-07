// backend/src/services/aiCaller/dialer.js
//
// Uses Exotel's App Bazaar Voicebot Applet flow: From/CallerId/Url on
// Calls/connect. Exotel calls Url (our exoml app), which dynamically fetches
// the wss:// orchestrator address from /api/ai-caller/stream-url.
// (A prior attempt passed StreamUrl/StreamType directly instead of Url —
// Exotel accepted it and returned a success SID, but the phone never
// actually rang on this account. Do not switch back without re-verifying.)

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
  const exophone = process.env.EXOTEL_EXOPHONE;
  if (!exophone) throw new Error('EXOTEL_EXOPHONE is not configured');

  const appId = process.env.EXOTEL_APP_BAZAAR_ID;
  if (!appId) throw new Error('EXOTEL_APP_BAZAAR_ID is not configured');

  const toNumber = normalizePhone(lead.phone);
  const campaignQuery = campaign ? `&campaignId=${campaign._id}` : '';

  // Exotel's App Bazaar Url= param rejects a query string with 400/34001
  // ("Bad or missing parameters") — it must be the clean app path, nothing
  // appended. We don't need leadId/campaignId here anyway: dialer sets
  // lead.activeCallSid right after this call succeeds, and
  // /api/ai-caller/stream-url + orchestrator.js both resolve the lead by
  // looking up that CallSid (Exotel always forwards CallSid reliably,
  // unlike custom query params).
  const flowUrl = `http://my.exotel.com/${process.env.EXOTEL_ACCOUNT_SID}/exoml/start_voice/${appId}`;

  try {
    const { apiKey, apiToken, accountSid, subdomain } = getExotelConfig();

    const params = new URLSearchParams({
      From: toNumber,        // caller's number (who gets the call)
      CallerId: exophone,    // your Exophone virtual number
      Url: flowUrl,          // App Bazaar Voicebot Applet — resolves the WS stream URL dynamically
      StatusCallback: `${baseUrl}/api/ai-caller/status?leadId=${lead._id}${campaignQuery}`,
      StatusCallbackEvent: 'terminal',
      Record: 'true',
    });

    const url = `https://${apiKey}:${apiToken}@${subdomain}/v1/Accounts/${accountSid}/Calls/connect`;
    console.log(`[dialer] POST ${url.replace(apiToken, '***')}`);
    console.log(`[dialer] From=${toNumber} CallerId=${exophone}`);
    console.log(`[dialer] Url=${flowUrl}`);

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