// backend/src/services/aiCaller/campaignEngine.js
//
// Autonomous AI Campaign Execution Engine. Polls campaigns with aiCallingEnabled,
// fetches eligible leads, acquires locks, and dials — all within each
// campaign's configured concurrency limit and calling-hours window.
//
// Mirrors the setInterval poller pattern already used in
// backend/src/services/workflowEngine.js (startSchedulePoller) so it fits the
// codebase's existing conventions rather than introducing a new job queue
// dependency (no Redis/Bull needed at current scale).

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

  for (const campaign of activeCampaigns) {
    try {
      await processCampaign(campaign);
    } catch (err) {
      console.error(`[campaignEngine] error processing campaign ${campaign._id}:`, err.message);
    }
  }
}

async function processCampaign(campaign) {
  if (!withinCallWindow(campaign.aiCallWindow)) return;

  const inFlight = await Lead.countDocuments({
    campaign: campaign._id,
    aiCallState: 'in_progress',
  });
  const capacity = (campaign.aiConcurrencyLimit || 5) - inFlight;
  if (capacity <= 0) return;

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

  // Respect human ownership unless the campaign explicitly opts in to calling
  // leads a human already owns (Campaign.aiIncludesAssignedLeads).
  if (!campaign.aiIncludesAssignedLeads) {
    baseQuery.assignedTo = { $exists: false };
  }

  const eligibleLeads = await Lead.find(baseQuery).limit(capacity);

  for (const lead of eligibleLeads) {
    const locked = await acquireLock(lead._id, 'ai-engine');
    if (!locked) continue; // another tick / a human grabbed it first — atomic, no race

    await Lead.updateOne({ _id: lead._id }, { aiCallState: 'in_progress' });

    // Fire-and-forget — outcomeService releases the lock when the call finishes
    // (success or failure), so we never block the poll loop on call duration.
    triggerAiCall(lead, campaign).catch((err) => {
      console.error('[campaignEngine] dial error for lead', lead._id.toString(), err.message);
    });
  }
}

let pollHandle = null;

function startPoller() {
  if (pollHandle) return pollHandle; // idempotent — avoid double-starting on hot reload
  tick();
  pollHandle = setInterval(tick, POLL_INTERVAL_MS);
  return pollHandle;
}

function stopPoller() {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
}

module.exports = { startPoller, stopPoller, tick, processCampaign };
