const mongoose = require('mongoose');

// ====================== NEW (AI Call Reports extension) ======================
// One document per student (Lead), kept in sync with every AI call outcome.
// This is intentionally DECOUPLED from AiCallOutcome (the raw/verbatim GPT
// audit log) — AiCallOutcome keeps a full history of every call, while
// AiCallReport is the current/latest CRM-facing snapshot per student that
// powers the AI Call Reports dashboard, analytics, and table.
//
// `lead` is unique so that a demo reschedule (or any subsequent AI call for
// the same student) UPDATES this single document instead of creating a
// duplicate row — see services/aiCaller/aiCallReportService.js.
const aiCallReportSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, unique: true, index: true },

  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', index: true },
  // Denormalized so the reports table/analytics don't need a populate/lookup
  // for campaigns that get renamed or deleted later.
  campaignName: { type: String, default: '' },

  studentName: { type: String, default: '' },
  mobileNumber: { type: String, default: '' },

  // Demo details extracted from the AI's structured end-of-call output.
  demoDate: { type: Date, default: null },
  demoTime: { type: String, default: '' }, // e.g. "5:00 PM" (kept as spoken/free text, not parsed to a fixed format)
  demoDay: { type: String, default: '' },  // e.g. "Monday" — derived from demoDate if not explicitly extracted
  demoScheduled: { type: Boolean, default: false, index: true },

  aiSummary: { type: String, default: '' },
  interestStatus: {
    type: String,
    enum: ['Interested', 'Not Interested', 'Follow-up'],
    default: 'Follow-up',
    index: true,
  },
  leadStatus: { type: String, default: '' }, // raw CRM status at the time of this call (Demo Scheduled, Won, etc.)

  callSid: { type: String, default: '' },
  aiCallOutcome: { type: mongoose.Schema.Types.ObjectId, ref: 'AiCallOutcome' },

  // Incremented whenever a later AI call changes an already-scheduled demoDate
  // for the same student, so reschedules stay visible without duplicating rows.
  rescheduleCount: { type: Number, default: 0 },

  lastCallAt: { type: Date, default: Date.now },
}, { timestamps: true });

aiCallReportSchema.index({ campaign: 1, interestStatus: 1 });
aiCallReportSchema.index({ demoDate: 1 });
aiCallReportSchema.index({ createdAt: -1 });

module.exports = mongoose.model('AiCallReport', aiCallReportSchema);
