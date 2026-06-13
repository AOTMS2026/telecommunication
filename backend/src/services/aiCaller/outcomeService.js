const Lead = require('../../models/Lead');
const FollowUp = require('../../models/FollowUp');

const VALID_STATUSES = [
  'Fresh', 'Connected', 'Call Not Responding', 'Call Back Later',
  'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost', 'Blocked',
];

const VALID_CALL_STATUSES = ['connected', 'no_answer', 'busy', 'failed', ''];

/**
 * Called when the AI call ends successfully (student spoke with the agent).
 * outcome = { status, callStatus, summary, nextFollowupDate }
 */
async function applyAiCallOutcome(leadId, outcome, { durationSeconds = 0, recordingUrl = '', transcript = '' } = {}) {
  const lead = await Lead.findById(leadId);
  if (!lead) {
    console.error('[aiCaller] applyAiCallOutcome: lead not found', leadId);
    return null;
  }

  const status = VALID_STATUSES.includes(outcome.status) ? outcome.status : 'Connected';
  const callStatus = VALID_CALL_STATUSES.includes(outcome.callStatus) ? outcome.callStatus : 'connected';

  lead.activities.unshift({
    type: 'call',
    description: `AI Call: ${outcome.summary || 'Call completed.'}${transcript ? `\n\nTranscript:\n${transcript}` : ''}`,
    callDuration: durationSeconds,
    callStatus,
  });

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

  if (outcome.nextFollowupDate) {
    const date = new Date(outcome.nextFollowupDate);
    if (!isNaN(date.getTime())) {
      lead.nextFollowupDate = date;

      if (lead.assignedTo) {
        await FollowUp.create({
          lead: lead._id,
          assignedTo: lead.assignedTo,
          scheduledAt: date,
          status: 'upcoming',
          type: 'call_followup',
          note: `Auto-scheduled by AI agent: ${outcome.summary || ''}`,
        });
      }
    }
  }

  await lead.save();
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

  if (callStatus === 'no_answer' && lead.status === 'Fresh') {
    lead.status = 'Call Not Responding';
  }

  await lead.save();
  return lead;
}

module.exports = { applyAiCallOutcome, applyNoConnectOutcome };
