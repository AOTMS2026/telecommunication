// backend/src/services/aiCaller/dialer.js

const axios = require('axios');
const Lead = require('../../models/Lead');
const { releaseLock } = require('./leadLock');

function getExotelConfig() {
  const apiKey = process.env.EXOTEL_API_KEY;
  const apiToken = process.env.EXOTEL_API_TOKEN;
  const accountSid = process.env.EXOTEL_ACCOUNT_SID;
  const subdomain = process.env.EXOTEL_SUBDOMAIN || 'api.exotel.com';
  if (!apiKey || !apiToken || !accountSid) {
    throw new Error('Exotel credentials not configured');
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
  const fromNumber = normalizePhone(exophone);
  const campaignQuery = campaign ? `&campaignId=${campaign._id}` : '';
  const streamUrl = `${wsBase}/ai-caller/stream?leadId=${lead._id}${campaignQuery}`;

  try {
    const { apiKey, apiToken, accountSid, subdomain } = getExotelConfig();

    // Exact same format as working curl command — capital field names
    const params = new URLSearchParams({
      From: fromNumber,
      To: toNumber,
      CallerId: fromNumber,
      StreamUrl: streamUrl,
      StreamType: 'bidirectional',
      StatusCallback: `${baseUrl}/api/ai-caller/status?leadId=${lead._id}${campaignQuery}`,
      StatusCallbackEvent: 'terminal',
    });

    const url = `https://${apiKey}:${apiToken}@${subdomain}/v1/Accounts/${accountSid}/Calls/connect`;
    console.log(`[dialer] → ${url.replace(apiToken, '***')}`);
    console.log(`[dialer] From=${fromNumber} To=${toNumber} StreamUrl=${streamUrl}`);

    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    // Exotel returns TwiML-compatible XML — parse Call.Sid from it
    const xml = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    const sidMatch = xml.match(/<Sid>([^<]+)<\/Sid>/);
    const callSid = sidMatch ? sidMatch[1] : 'unknown';

    lead.activities.unshift({
      type: 'note',
      description: `AI Call initiated to ${toNumber} (SID: ${callSid})${campaign ? ` [Campaign: ${campaign.name}]` : ''}`,
      performedBy: performedBy || undefined,
    });
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

module.exports = { triggerAiCall, getExotelConfig, getBaseUrl, normalizePhone };