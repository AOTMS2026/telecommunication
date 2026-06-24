const mongoose = require('mongoose');

// Stores the FULL structured GPT-4.1-mini end-of-call output verbatim, for every
// AI call, regardless of whether every field fit onto Lead/FollowUp. Parallels
// the existing CallAudit model's pattern (models/CallAudit.js) but is specific
// to the autonomous AI Telecaller flow rather than the manual "Call Audit Agent"
// feature, so the two stay decoupled.
const aiCallOutcomeSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', index: true },
  callSid: { type: String, default: '', index: true }, // Twilio Call SID

  // Raw structured JSON returned by GPT-4.1-mini at end-of-call (see §5 of the
  // migration plan for the exact schema: leadStatus, interestLevel, studentIntent,
  // followUpRequired, followUpDate, demoRequired, callbackReason,
  // conversationSummary, nextRecommendedAction, confidenceScore).
  outcome: { type: mongoose.Schema.Types.Mixed, default: {} },

  transcript: { type: String, default: '' },
  durationSeconds: { type: Number, default: 0 },
  recordingUrl: { type: String, default: '' },

  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  error: { type: String, default: '' },
}, { timestamps: true });

aiCallOutcomeSchema.index({ lead: 1, createdAt: -1 });
aiCallOutcomeSchema.index({ campaign: 1, createdAt: -1 });

module.exports = mongoose.model('AiCallOutcome', aiCallOutcomeSchema);
