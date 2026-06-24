// backend/src/services/aiCaller/dialer.js
//
// Extracted from the old inline logic in routes/aiCaller.js's POST /trigger/:leadId
// handler so that BOTH the manual "Call Now" button (still a thin route handler)
// and the autonomous campaignEngine share exactly one code path for placing a
// Twilio call. No duplicated Twilio-calling logic anywhere in the codebase.

const twilio = require('twilio');
const Lead = require('../../models/Lead');
const { releaseLock } = require('./leadLock');

function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials not configured');
  return twilio(sid, token);
}

function getBaseUrl() {
  return (process.env.PUBLIC_BASE_URL || '').replace(/\/$/, '');
}

function normalizePhone(rawPhone) {
  let toNumber = (rawPhone || '').trim();
  if (!toNumber.startsWith('+')) {
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
 * TwiML query string so /api/ai-caller/outcome can release the right lock and
 * decrement the right campaign's in-flight counter when the call ends.
 *
 * On any failure to actually start the call, the lead's AI lock/state is rolled
 * back so a failed dial attempt doesn't leave the lead stuck "in_progress" forever.
 */
async function triggerAiCall(lead, campaign = null, { performedBy = null } = {}) {
  if (!lead.phone) throw new Error('Lead has no phone number');

  const baseUrl = getBaseUrl();
  if (!baseUrl) throw new Error('PUBLIC_BASE_URL is not configured on the server');

  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  if (!fromNumber) throw new Error('TWILIO_PHONE_NUMBER is not configured on the server');

  const toNumber = normalizePhone(lead.phone);

  try {
    const client = getTwilioClient();
    const campaignQuery = campaign ? `&campaignId=${campaign._id}` : '';

    const call = await client.calls.create({
      to: toNumber,
      from: fromNumber,
      url: `${baseUrl}/api/ai-caller/twiml?leadId=${lead._id}${campaignQuery}`,
      statusCallback: `${baseUrl}/api/ai-caller/status?leadId=${lead._id}${campaignQuery}`,
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed', 'canceled'],
      statusCallbackMethod: 'POST',
    });

    lead.activities.unshift({
      type: 'note',
      description: `AI Call initiated to ${toNumber} (Call SID: ${call.sid})${campaign ? ` [Campaign: ${campaign.name}]` : ''}`,
      performedBy: performedBy || undefined,
    });
    await lead.save();

    return { success: true, callSid: call.sid, to: toNumber, status: call.status };
  } catch (err) {
    // Roll back lock/state so the lead becomes eligible again instead of being
    // stuck "in_progress" with no call actually placed.
    await Lead.updateOne({ _id: lead._id }, { aiCallState: 'none' }).catch(() => {});
    await releaseLock(lead._id, 'ai-engine').catch(() => {});
    throw err;
  }
}

module.exports = { triggerAiCall, getTwilioClient, getBaseUrl, normalizePhone };
