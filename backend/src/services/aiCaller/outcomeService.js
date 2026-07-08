// backend/src/services/aiCaller/outcomeService.js
//
// UPDATED for the RunPod + GPT-4.1-mini migration:
//  - applyAiCallOutcome() now accepts the extended structured-output schema
//    (interestLevel, studentIntent, followUpRequired, demoRequired,
//    callbackReason, nextRecommendedAction, confidenceScore) while staying
//    fully backward compatible with the old {status, callStatus, summary,
//    nextFollowupDate} shape — old field names are read as fallbacks so no
//    other caller breaks.
//  - Releases the AI lead lock (leadLock.js) on every outcome path.
//  - Resets Lead.aiCallState back to 'completed'.
//  - Writes lead.lastAiOutcome so conversationMemory.js has context for the
//    next callback.
//  - Records a full AiCallOutcome audit document.

const Lead = require('../../models/Lead');
const FollowUp = require('../../models/FollowUp');
const AiCallOutcome = require('../../models/AiCallOutcome');
const { releaseLock } = require('./leadLock');

const VALID_STATUSES = [
  'Fresh', 'Connected', 'Call Not Responding', 'Call Back Later',
  'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost', 'Blocked',
];

const VALID_CALL_STATUSES = ['connected', 'no_answer', 'busy', 'failed', ''];

// Maps the richer structured leadStatus/nextRecommendedAction onto the existing
// CRM status vocabulary, per the brief's "Automatic CRM Updates" examples.
const RECOMMENDED_ACTION_TO_STATUS = {
  schedule_demo: 'Demo Scheduled',
  mark_converted: 'Won',
  mark_invalid: 'Blocked',
  close_lost: 'Lost',
  callback_later: 'Call Back Later',
};

/**
 * Called when the AI call ends successfully (student spoke with the agent).
 * `outcome` is the structured GPT-4.1-mini JSON object (see
 * promptBuilder.buildOutcomeExtractionPrompt() for the exact schema).
 */
async function applyAiCallOutcome(leadId, outcome, {
  durationSeconds = 0,
  recordingUrl = '',
  transcript = '',
  campaignId = null,
  callSid = '',
  transferredToHr = false,
} = {}) {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    console.error('[aiCaller] applyAiCallOutcome: lead not found', leadId);
    return null;
  }

  // Backward-compatible field reads (old shape used `status` / `callStatus` / `summary`).
  const rawStatus = outcome.leadStatus || outcome.status;
  const rawCallStatus = outcome.callStatus || 'connected';
  const summary = outcome.conversationSummary || outcome.summary || 'Call completed.';
  const followUpDate = outcome.followUpDate || outcome.nextFollowupDate || null;

  const status = VALID_STATUSES.includes(rawStatus)
    ? rawStatus
    : (RECOMMENDED_ACTION_TO_STATUS[outcome.nextRecommendedAction] || 'Connected');
  const callStatus = VALID_CALL_STATUSES.includes(rawCallStatus) ? rawCallStatus : 'connected';

  lead.activities.unshift({
    type: 'call',
    description: `AI Call: ${summary}${transcript ? `\n\nTranscript:\n${transcript}` : ''}`,
    callDuration: durationSeconds,
    callStatus,
  });

  if (transferredToHr) {
    lead.activities.unshift({
      type: 'note',
      description: 'Call transferred to HR — student showed genuine interest (AI handoff).',
    });
  }

  lead.totalCalls += 1;
  lead.totalCallDuration += durationSeconds;
  lead.lastCalledAt = new Date();

  const prevStatus = lead.status;
  if (status !== prevStatus) {
    lead.status = status;
    lead.activities.unshift({
      type: 'status_change',
      description: `Status changed from ${prevStatus} to ${status} (by AI agent)`,
    });
  }

  if (followUpDate) {
    const date = new Date(followUpDate);
    if (!isNaN(date.getTime())) {
      lead.nextFollowupDate = date;

      if (lead.assignedTo) {
        await FollowUp.create({
          lead: lead._id,
          assignedTo: lead.assignedTo,
          scheduledAt: date,
          status: 'upcoming',
          type: 'call_followup',
          note: `Auto-scheduled by AI agent: ${outcome.callbackReason || summary || ''}`,
        });
      }
    }
  }

  // --- NEW: persist full structured outcome + conversation memory ---
  lead.lastAiOutcome = outcome;
  lead.aiCallState = 'completed';

  await lead.save();

  // Release the AI lock now that the call is fully processed.
  await releaseLock(lead._id, 'ai-engine');

  // Full audit record (separate from the trimmed Lead.activities text).
  await AiCallOutcome.create({
    lead: lead._id,
    campaign: campaignId || lead.campaign || undefined,
    callSid,
    outcome,
    transcript,
    durationSeconds,
    recordingUrl,
    status: 'success',
  }).catch((err) => console.error('[aiCaller] AiCallOutcome write failed:', err.message));

  return lead;
}

/**
 * Called when the call never connected (no answer / busy / failed),
 * based on Twilio's call status callback.
 */
async function applyNoConnectOutcome(leadId, twilioCallStatus) {
  const lead = await Lead.findById(leadId);
  if (!lead) return null;

  const map = {
    'no-answer': 'no_answer',
    busy: 'busy',
    failed: 'failed',
    canceled: 'failed',
  };
  const callStatus = map[twilioCallStatus] || 'failed';

  lead.activities.unshift({
    type: 'call',
    description: `AI Call attempt - ${twilioCallStatus}`,
    callDuration: 0,
    callStatus,
  });
  lead.totalCalls += 1;
  lead.lastCalledAt = new Date();
  lead.aiCallState = 'completed'; // NEW — release back into the eligible pool for re-attempt

  if (callStatus === 'no_answer' && lead.status === 'Fresh') {
    lead.status = 'Call Not Responding';
  }

  await lead.save();

  // NEW — always release the lock on a no-connect outcome too, otherwise a
  // busy/no-answer call would leave the lead locked until TTL expiry.
  await releaseLock(lead._id, 'ai-engine');

  return lead;
}

module.exports = { applyAiCallOutcome, applyNoConnectOutcome };