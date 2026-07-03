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
  const hour = (new Date().getUTCHours() + 5) % 24; // UTC -> IST (+5:30, minute part ignored for hour check)
  const start = window.startHour ?? 0;
  const end = window.endHour ?? 24;
  return hour >= start && hour < end;
}

/**
 * FIX (permanent): self-heal leads stuck at aiCallState:'in_progress'.
 *
 * Why this happens: outcomeService.applyAiCallOutcome / applyNoConnectOutcome
 * are what flip aiCallState back to 'completed' and release the lock — but
 * those only run if the call lifecycle finishes cleanly (Twilio status
 * callback fires, or the RunPod orchestrator posts /outcome). A call that
 * dies mid-flight (e.g. a Twilio trial-account call ending abnormally before
 * any callback fires) never reaches either path, so aiCallState is left at
 * 'in_progress' forever — even after the lock itself expires via its own TTL
 * in leadLock.js. The lock expiring does NOT imply aiCallState gets reset;
 * they're independent fields, which is the actual bug.
 *
 * Fix: reuse the lock's own TTL as the recovery signal — once 600s have
 * passed (no realistic call lasts that long), if aiCallState is still
 * 'in_progress' AND the lock is gone/expired, treat it as an abandoned call
 * and reset it so the lead becomes eligible again on the next tick.
 */
async function recoverStuckLeads() {
  const result = await Lead.updateMany(
    {
      aiCallState: 'in_progress',
      $or: [
        { aiLock: { $exists: false } },
        { 'aiLock.expiresAt': { $exists: false } },
        { 'aiLock.expiresAt': { $lte: new Date() } },
      ],
    },
    { $set: { aiCallState: 'none' }, $unset: { aiLock: '' } }
  );
  if (result.modifiedCount > 0) {
    console.log(`[campaignEngine] recovered ${result.modifiedCount} stuck lead(s) back to 'none'`);
  }
}

async function tick() {
  await recoverStuckLeads().catch((err) =>
    console.error('[campaignEngine] recoverStuckLeads failed:', err.message)
  );

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
    aiCallState: { $in: ['none', 'queued', 'completed'] },
    $or: [
      { aiLock: { $exists: false } },
      { 'aiLock.expiresAt': { $exists: false } },
      { 'aiLock.expiresAt': { $lte: new Date() } },
    ],
  };

  // NOTE: assignee restriction intentionally removed at this project's request —
  // AI dials every eligible lead in the campaign regardless of `assignedTo`.
  // (Originally this respected Campaign.aiIncludesAssignedLeads; that guard
  // was removed. Re-add the block below if you want human-owned leads excluded again:
  //
  //   if (!campaign.aiIncludesAssignedLeads) {
  //     baseQuery.assignedTo = { $exists: false };
  //   }
  // )

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

    // Fire-and-forget — outcomeService releases the lock when the call finishes
    // (success or failure), so we never block the poll loop on call duration.
    // recoverStuckLeads() above is the safety net for when that never happens.
    triggerAiCall(lead, campaign).catch((err) => {
      console.error('[campaignEngine] dial error for lead', lead._id.toString(), err.message);
    });
  }
}

let pollHandle = null;

function startPoller() {
  if (pollHandle) return pollHandle; // idempotent — avoid double-starting on hot reload
  console.log('[campaignEngine] poller started');
  tick();
  pollHandle = setInterval(tick, POLL_INTERVAL_MS);
  return pollHandle;
}

function stopPoller() {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
}

module.exports = { startPoller, stopPoller, tick, processCampaign, recoverStuckLeads };