// backend/src/services/aiCaller/dialer.js
//
// SARVAM MIGRATION: RUNPOD_WS_URL removed.
// The orchestrator now runs inside the Node.js backend (see
// services/aiCaller/orchestrator.js) — the WS URL is built directly from
// PUBLIC_BASE_URL instead of pointing at a separate RunPod pod.
//
// Everything else is unchanged: Exotel's Connect API call shape, the
// statuscallback, normalizePhone(), and the error-rollback that resets
// aiCallState when a dial fails.

const axios = require('axios');
const Lead = require('../../models/Lead');
const { releaseLock } = require('./leadLock');

function getExotelConfig() {
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  const accountSid = process.env.EXOTEL_ACCOUNT_SID;
  const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.in.exotel.com';
  if (!apiKey || !apiToken || !accountSid) {
    throw new Error('Exotel credentials not configured (EXOTEL_API_KEY / EXOTEL_API_TOKEN / EXOTEL_ACCOUNT_SID)');
  }
  return { apiKey, apiToken, accountSid, subdomain };
}

function getBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

/**
 * Builds the WebSocket URL for the in-process orchestrator.
 * Converts https:// → wss:// (and http:// → ws:// for local dev).
 */
function getOrchestratorWsBase() {
  const base = getBaseUrl();
  if (!base) throw new Error('PUBLIC_BASE_URL is not configured on the server');
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

/**
 * Places one outbound AI call for `lead` via Exotel's Connect API.
 * Used by:
 *  - routes/aiCaller.js  POST /trigger/:leadId   (manual "Call Now" button)
 *  - services/aiCaller/campaignEngine.js          (autonomous campaign dialer)
 */
async function triggerAiCall(lead, campaign = null, { performedBy = null } = {}) {
  if (!lead.phone) throw new Error('Lead has no phone number');

  const baseUrl = getBaseUrl();
  const wsBase = getOrchestratorWsBase();

  const exophone = process.env.EXOTEL_EXOPHONE;
  if (!exophone) throw new Error('EXOTEL_EXOPHONE is not configured on the server');

  const appId = process.env.EXOTEL_APP_BAZAAR_ID;
  if (!appId) throw new Error('EXOTEL_APP_BAZAAR_ID is not configured on the server');

  const toNumber = normalizePhone(lead.phone);
  const campaignQuery = campaign ? `&campaignId=${campaign._id}` : '';

  try {
    const { apiKey, apiToken, accountSid, subdomain } = getExotelConfig();

    // App Bazaar Voicebot Applet flow — the applet's own dynamic-URL fetch
    // (/api/ai-caller/stream-url) resolves the actual WSS endpoint per-call
    // using the leadId/campaignId passed here as query params.
    const flowUrl = `http://my.exotel.com/${accountSid}/exoml/start_voice/${appId}?leadId=${lead._id}${campaignQuery}`;

    const params = new URLSearchParams({
      from: toNumber,
      callerid: exophone,
      url: flowUrl,
      statuscallback: `${baseUrl}/api/ai-caller/status?leadId=${lead._id}${campaignQuery}`,
      'statuscallbackevents[]': 'terminal',
    });

const url = `https://${apiKey}:${apiToken}@${subdomain}/v1/Accounts/${accountSid}/Calls/connect`;    const response = await axios.post(url, params);
    const call = response.data?.call || {};

    lead.activities.unshift({
      type: 'note',
      description: `AI Call initiated to ${toNumber} (Call SID: ${call.sid || 'unknown'})${campaign ? ` [Campaign: ${campaign.name}]` : ''}`,
      performedBy: performedBy || undefined,
    });
    await lead.save();

    return { success: true, callSid: call.sid, to: toNumber, status: call.status };
  } catch (err) {
    await Lead.updateOne({ _id: lead._id }, { aiCallState: 'none' }).catch(() => {});
    await releaseLock(lead._id, 'ai-engine').catch(() => {});
    const message = err.response?.data ? JSON.stringify(err.response.data) : err.message;
    throw new Error(`Exotel call failed: ${message}`);
  }
}

module.exports = { triggerAiCall, getExotelConfig, getBaseUrl, normalizePhone };