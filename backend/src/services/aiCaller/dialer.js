// backend/src/services/aiCaller/dialer.js
//
// EXOTEL MIGRATION: replaced the Twilio SDK (`client.calls.create`) with a
// direct call to Exotel's outbound Connect API. Exotel has no TwiML/callback-URL
// concept for streaming — the WebSocket URL is passed directly as `streamurl`
// in this same API call, so backend/src/routes/aiCaller.js's old /twiml route
// (which built Twilio XML) is no longer used for outbound AI calls; see that
// file's updated comments. statuscallback/statuscallbackevents below mirror
// the old statusCallback/statusCallbackEvent Twilio config, but Exotel's event
// bucket is just "terminal" (covers completed/failed/busy/no-answer in one),
// not Twilio's per-status list.
//
// Reference: https://developer.exotel.com/docs/agentstream/developer-guide
// POST https://<api_key>:<api_token>@api.in.exotel.com/v1/accounts/<account_sid>/calls/connect

const axios = require('axios');
const Lead = require('../../models/Lead');
const { releaseLock } = require('./leadLock');

function getExotelConfig() {
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  const accountSid = process.env.EXOTEL_ACCOUNT_SID;
  const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.in.exotel.com'; // use the Mumbai/Veeno instance host if that's your account's region
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
    // BUGFIX: previously returned as-is, including any internal spaces/dashes
    // (e.g. "+1 555 123 4567"), which is not valid E.164 and would be sent
    // unmodified as Exotel's `from` param, causing a confusing API-level
    // rejection instead of a clean local validation. Strip everything except
    // digits after the leading +.
    toNumber = `+${toNumber.slice(1).replace(/\D/g, '')}`;
  } else {
    // naive default — adjust if your leads aren't Indian numbers
    toNumber = `+91${toNumber.replace(/\D/g, '').slice(-10)}`;
  }
  return toNumber;
}

/**
 * Places one outbound AI call for `lead`. Used by:
 *  - routes/aiCaller.js  POST /trigger/:leadId   (manual, human-initiated)
 *  - services/aiCaller/campaignEngine.js          (autonomous)
 *
 * `campaign` is optional — when present, campaignId is threaded through the
 * RunPod WebSocket URL's query string (passed as `streamurl`) so the
 * orchestrator can read it back as a custom_parameter, and so
 * /api/ai-caller/outcome can release the right lock and decrement the right
 * campaign's in-flight counter when the call ends.
 *
 * On any failure to actually start the call, the lead's AI lock/state is rolled
 * back so a failed dial attempt doesn't leave the lead stuck "in_progress" forever.
 */
async function triggerAiCall(lead, campaign = null, { performedBy = null } = {}) {
  if (!lead.phone) throw new Error('Lead has no phone number');

  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('PUBLIC_BASE_URL is not configured on the server');

  const exophone = process.env.EXOTEL_EXOPHONE;
  if (!exophone) throw new Error('EXOTEL_EXOPHONE is not configured on the server');

  const runpodWsUrl = process.env.RUNPOD_WS_URL; // e.g. wss://<pod-id>-8080.proxy.runpod.net/media
  if (!runpodWsUrl) throw new Error('RUNPOD_WS_URL is not configured on the server');

  const toNumber = normalizePhone(lead.phone);

  try {
    const { apiKey, apiToken, accountSid, subdomain } = getExotelConfig();
    const campaignQuery = campaign ? `&campaignId=${campaign._id}` : '';

    // EXOTEL: WebSocket URL is passed inline as `streamurl` — Exotel has no
    // TwiML-style fetch-then-XML step. leadId/campaignId are appended as
    // query params on the WSS URL itself since Exotel's Connect API custom
    // parameter support is limited (max 3, set via the Voicebot Applet UI,
    // not this direct-API path) — server.py reads them back out of the URL
    // via Exotel's "start" event custom_parameters where configured, or via
    // this query string if you switch to the HTTPS-resolver pattern later.
    const streamUrl = `${runpodWsUrl}?leadId=${lead._id}${campaignQuery}`;

    const params = new URLSearchParams({
      from: toNumber,
      callerid: exophone,
      streamurl: streamUrl,
      streamtype: 'bidirectional',
      statuscallback: `${baseUrl}/api/ai-caller/status?leadId=${lead._id}${campaignQuery}`,
      'statuscallbackevents[]': 'terminal',
    });

    // NOTE: axios automatically sets Content-Type: application/x-www-form-urlencoded
    // for a URLSearchParams body. Exotel's own docs show a `curl -F` (multipart)
    // example, but their API accepts standard form-urlencoded POST bodies for
    // simple text fields like these — if your account/region rejects this,
    // switch to a multipart/form-data body instead (e.g. via the `form-data`
    // npm package) — but try this first since it's the simpler, more common path.
    const url = `https://${apiKey}:${apiToken}@${subdomain}/v1/accounts/${accountSid}/calls/connect`;
    const response = await axios.post(url, params);
    const call = response.data && response.data.call ? response.data.call : {};

    lead.activities.unshift({
      type: 'note',
      description: `AI Call initiated to ${toNumber} (Call SID: ${call.sid || 'unknown'})${campaign ? ` [Campaign: ${campaign.name}]` : ''}`,
      performedBy: performedBy || undefined,
    });
    await lead.save();

    return { success: true, callSid: call.sid, to: toNumber, status: call.status };
  } catch (err) {
    // Roll back lock/state so the lead becomes eligible again instead of being
    // stuck "in_progress" with no call actually placed.
    await Lead.updateOne({ _id: lead._id }, { aiCallState: 'none' }).catch(() => {});
    await releaseLock(lead._id, 'ai-engine').catch(() => {});
    const message = err.response && err.response.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Exotel call failed: ${message}`);
  }
}

module.exports = { triggerAiCall, getExotelConfig, getBaseUrl, normalizePhone };