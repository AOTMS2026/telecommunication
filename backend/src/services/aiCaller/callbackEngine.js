// backend/src/services/aiCaller/callbackEngine.js
//
// Intelligent Callback Engine. Polls for due FollowUp tasks that the AI itself
// scheduled (created by outcomeService.applyAiCallOutcome, always prefixed
// "Auto-scheduled by AI agent") and re-queues that lead for the AI dialer.
//
// IMPORTANT: only AI-originated callbacks are auto-redialed. A human-created
// follow-up task is never touched here — this is what keeps the "human + AI
// parallel calling model" rule intact for callbacks, not just first attempts.

const FollowUp = require('../../models/FollowUp');
const Lead = require('../../models/Lead');

const POLL_INTERVAL_MS = 60000;
const AI_FOLLOWUP_PREFIX = 'Auto-scheduled by AI agent';

async function tick() {
  let due;
  try {
    due = await FollowUp.find({
      status: 'upcoming',
      type: 'call_followup',
      scheduledAt: { $lte: new Date() },
      note: { $regex: `^${AI_FOLLOWUP_PREFIX}` },
    }).populate('lead');
  } catch (err) {
    console.error('[callbackEngine] failed to load due follow-ups:', err.message);
    return;
  }

  for (const followUp of due) {
    try {
      await processFollowUp(followUp);
    } catch (err) {
      console.error('[callbackEngine] error processing follow-up', followUp._id.toString(), err.message);
    }
  }
}

async function processFollowUp(followUp) {
  const lead = followUp.lead;
  if (!lead || lead.status === 'Do Not Call' || lead.status === 'Blocked') {
    followUp.status = 'cancelled';
    await followUp.save();
    return;
  }

  // Re-queue the lead — campaignEngine.tick() will pick it up (and acquire the
  // lock itself) on its next pass since aiCallState is now 'queued'.
  await Lead.updateOne({ _id: lead._id }, { aiCallState: 'queued' });

  followUp.status = 'done';
  followUp.completedAt = new Date();
  await followUp.save();
}

let pollHandle = null;

function startPoller() {
  if (pollHandle) return pollHandle;
  tick();
  pollHandle = setInterval(tick, POLL_INTERVAL_MS);
  return pollHandle;
}

function stopPoller() {
  if (pollHandle) clearInterval(pollHandle);
  pollHandle = null;
}

module.exports = { startPoller, stopPoller, tick };
