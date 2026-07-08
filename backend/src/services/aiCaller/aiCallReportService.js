// backend/src/services/aiCaller/aiCallReportService.js
//
// ====================== NEW (AI Call Reports extension) ======================
// Pure extension of the existing AI Telecaller flow — does NOT touch dialing,
// the orchestrator, or the calling process in any way. This is called once,
// at the very end of outcomeService.applyAiCallOutcome(), after the existing
// Lead/FollowUp/AiCallOutcome writes have already happened.
//
// Responsibility: read the same structured GPT-4.1-mini `outcome` object that
// outcomeService already has, extract demo scheduling details, and keep a
// single up-to-date "AI Call Reports" row per student (Lead) — creating it on
// the first call and updating it (never duplicating) on every call after,
// including demo reschedules.

const Campaign = require('../../models/Campaign');
const AiCallReport = require('../../models/AiCallReport');

// Any of these leadStatus / interestLevel values from the structured outcome
// mean the student is not interested.
const NOT_INTERESTED_LEAD_STATUSES = new Set(['Not interested', 'Lost', 'Blocked']);
const INTERESTED_LEAD_STATUSES = new Set(['Demo Scheduled', 'Demo Done', 'Won']);
const INTERESTED_LEVELS = new Set(['Interested', 'Highly Interested']);

/**
 * Maps the rich structured outcome onto the simple 3-way bucket the
 * AI Call Reports dashboard/analytics are built around.
 */
function deriveInterestStatus(outcome = {}) {
  const leadStatus = outcome.leadStatus || '';
  const interestLevel = outcome.interestLevel || '';

  if (NOT_INTERESTED_LEAD_STATUSES.has(leadStatus) || interestLevel === 'Not Interested') {
    return 'Not Interested';
  }
  if (INTERESTED_LEAD_STATUSES.has(leadStatus) || INTERESTED_LEVELS.has(interestLevel) || outcome.demoRequired) {
    return 'Interested';
  }
  // Everything else (Need More Information, Call Back Later, Unknown, etc.)
  // is a student who still needs another touchpoint.
  return 'Follow-up';
}

function deriveDemoDay(demoDate) {
  if (!demoDate) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' }).format(new Date(demoDate));
  } catch {
    return '';
  }
}

function safeDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

// Small in-process cache so a busy campaign doesn't hammer the Campaign
// collection with a lookup on every single call outcome.
const campaignNameCache = new Map();
async function getCampaignName(campaignId) {
  if (!campaignId) return '';
  const key = String(campaignId);
  if (campaignNameCache.has(key)) return campaignNameCache.get(key);
  try {
    const campaign = await Campaign.findById(campaignId).select('name');
    const name = campaign?.name || '';
    campaignNameCache.set(key, name);
    return name;
  } catch {
    return '';
  }
}

/**
 * Called from outcomeService.applyAiCallOutcome() after a successful AI call.
 * `lead` is the already-saved Lead document; `outcome` is the raw structured
 * GPT-4.1-mini JSON. Never throws — failures here must never break the
 * calling flow, so all errors are caught and logged.
 */
async function upsertAiCallReport(lead, outcome = {}, meta = {}) {
  try {
    if (!lead || !lead._id) return null;

    const demoRequired = !!outcome.demoRequired || outcome.leadStatus === 'Demo Scheduled';

    // Prefer an explicit demoDate from the (extended) structured output.
    // Fall back to followUpDate/nextFollowupDate — the only date the model
    // extracted before this extension — when a demo was clearly agreed to.
    const demoDate = safeDate(
      outcome.demoDate
      || (demoRequired ? (outcome.followUpDate || outcome.nextFollowupDate) : null)
    );
    const demoTime = outcome.demoTime || '';
    const demoDay = outcome.demoDay || deriveDemoDay(demoDate);

    const interestStatus = deriveInterestStatus(outcome);
    const aiSummary = outcome.conversationSummary || outcome.summary || '';
    const campaignId = meta.campaignId || lead.campaign || null;
    const campaignName = meta.campaignName || await getCampaignName(campaignId);

    const existing = await AiCallReport.findOne({ lead: lead._id });

    const update = {
      lead: lead._id,
      campaign: campaignId || undefined,
      campaignName,
      studentName: lead.name,
      mobileNumber: lead.phone,
      aiSummary,
      interestStatus,
      leadStatus: outcome.leadStatus || '',
      callSid: meta.callSid || '',
      demoScheduled: !!demoDate || demoRequired,
      lastCallAt: new Date(),
    };
    if (meta.aiCallOutcomeId) update.aiCallOutcome = meta.aiCallOutcomeId;
    if (demoDate) update.demoDate = demoDate;
    if (demoTime) update.demoTime = demoTime;
    if (demoDay) update.demoDay = demoDay;

    if (existing) {
      // A reschedule = a new demoDate that differs from what we already had.
      const isReschedule = demoDate && existing.demoDate && demoDate.getTime() !== existing.demoDate.getTime();
      if (isReschedule) update.rescheduleCount = (existing.rescheduleCount || 0) + 1;
      await AiCallReport.updateOne({ _id: existing._id }, { $set: update });
      return { ...existing.toObject(), ...update };
    }

    return await AiCallReport.create(update);
  } catch (err) {
    console.error('[aiCallReportService] upsertAiCallReport failed:', err.message);
    return null;
  }
}

module.exports = { upsertAiCallReport, deriveInterestStatus };
