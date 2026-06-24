// backend/src/services/aiCaller/conversationMemory.js
//
// Builds the "last time we spoke..." context block injected into the system
// prompt for callback calls, per the brief's Conversation Memory requirement.
// Reads from Lead.lastAiOutcome (the full structured GPT-4.1-mini output saved
// by outcomeService.js after the previous AI call) plus Lead.activities for a
// human-readable fallback if lastAiOutcome isn't present (e.g. last call was
// handled by a human telecaller, not the AI).

const Lead = require('../../models/Lead');

async function buildMemoryBlock(leadId) {
  const lead = await Lead.findById(leadId).populate('courseInterest', 'name');
  if (!lead) return '';

  const courseInterest = lead.courseInterest?.name || lead.preferredCourses?.join(', ') || 'our courses';

  if (lead.lastAiOutcome) {
    const o = lead.lastAiOutcome;
    return [
      `Previous call summary: ${o.conversationSummary || 'No summary recorded.'}`,
      `Previous interest level: ${o.interestLevel || 'Unknown'}`,
      o.callbackReason ? `Reason for this callback: ${o.callbackReason}` : '',
      `Course interest: ${courseInterest}`,
    ].filter(Boolean).join('\n');
  }

  // Fallback: most recent 'call' activity (covers human-handled previous calls too).
  const lastCallActivity = (lead.activities || []).find((a) => a.type === 'call');
  if (lastCallActivity) {
    return [
      `Previous call notes: ${lastCallActivity.description}`,
      `Course interest: ${courseInterest}`,
    ].join('\n');
  }

  return `Course interest: ${courseInterest} (first contact — no previous call history).`;
}

module.exports = { buildMemoryBlock };
