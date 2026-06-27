// backend/src/services/aiCaller/campaignEngine.js

const Campaign = require('../../models/Campaign');
const Lead = require('../../models/Lead');
const { acquireLock } = require('./leadLock');
const { triggerAiCall } = require('./dialer');

const POLL_INTERVAL_MS = 15000;

// Lead statuses that should never be auto-dialed by the AI engine.
const EXCLUDED_STATUSES = ['Do Not Call', 'Invalid Number', 'Converted', 'Already Joined', 'Won', 'Blocked'];

function withinCallWindow(window) {
  if (!window || (window.startHour == null && window.endHour == null)) return true;
  const hour = new Date().getHours();
  const start = window.startHour ?? 0;
  const end = window.endHour ?? 24;
  return hour >= start && hour < end;
}

async function tick() {
  let activeCampaigns;
  try {
    activeCampaigns = await Campaign.find({ aiCallingEnabled: true, status: 'active' });
  } catch (err) {
    console.error('[campaignEngine] failed to load campaigns:', err.message);
    return;
  }

  if (activeCampaigns.length > 0) {
    console.log(`[campaignEngine] tick — ${activeCampaigns.length} active campaign(s)`);
  }

  for (const campaign of activeCampaigns) {
    try {
      await processCampaign(campaign);
    } catch (err) {
      console.error(`[campaignEngine] error processing campaign ${campaign._id}:`, err.message);
    }
  }
}

async function processCampaign(campaign) {
  if (!withinCallWindow(campaign.aiCallWindow)) {
    console.log(`[campaignEngine] campaign ${campaign._id} outside call window — skipping`);
    return;
  }

  const inFlight = await Lead.countDocuments({
    campaign: campaign._id,
    aiCallState: 'in_progress',
  });
  const capacity = (campaign.aiConcurrencyLimit || 5) - inFlight;
  if (capacity <= 0) {
    console.log(`[campaignEngine] campaign ${campaign._id} at capacity (${inFlight} in flight)`);
    return;
  }

  const baseQuery = {
    campaign: campaign._id,
    status: { $nin: EXCLUDED_STATUSES },
    aiCallState: { $in: ['none', 'queued'] },
    $or: [
      { aiLock: { $exists: false } },
      { 'aiLock.expiresAt': { $exists: false } },
      { 'aiLock.expiresAt': { $lte: new Date() } },
    ],
  };

  // FIX: Assignee restriction REMOVED — AI calls all leads in campaign
  // regardless of whether they are assigned to a human caller or not.

  const eligibleLeads = await Lead.find(baseQuery).limit(capacity);
  console.log(`[campaignEngine] campaign ${campaign._id} — ${eligibleLeads.length} eligible lead(s), capacity ${capacity}`);

  for (const lead of eligibleLeads) {
    const locked = await acquireLock(lead._id, 'ai-engine');
    if (!locked) {
      console.log(`[campaignEngine] could not lock lead ${lead._id} — skipping`);
      continue;
    }

    await Lead.updateOne({ _id: lead._id }, { aiCallState: 'in_progress' });
    console.log(`[campaignEngine] dialing lead ${lead._id} (${lead.phone})`);

    triggerAiCall(lead, campaign).catch((err) => {
      console.error('[campaignEngine] dial error for lead', lead._id.toString(), err.message);
    });
  }
}

let pollHandle = null;

function startPoller() {
  if (pollHandle) return pollHandle;
  console.log('[campaignEngine] poller started');
  tick();
  pollHandle = setInterval(tick, POLL_INTERVAL_MS);
  return pollHandle;
}

function stopPoller() {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
}

module.exports = { startPoller, stopPoller, tick, processCampaign };