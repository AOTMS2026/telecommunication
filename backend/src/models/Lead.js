const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: { type: String, enum: ['call', 'note', 'status_change', 'whatsapp', 'sms', 'followup', 'api_call'], required: true },
  description: { type: String, default: '' },
  callDuration: { type: Number, default: 0 },
  callStatus: { type: String, enum: ['connected', 'no_answer', 'busy', 'failed', ''], default: '' },
  // for type: 'api_call' — name of the API Template that ran, and its structured result
  templateName: { type: String, default: '' },
  fields: [{
    label: { type: String },
    type: { type: String, enum: ['Text', 'Number', 'Date', 'Website', 'Dropdown', 'Money', 'Tags'], default: 'Text' },
    value: { type: mongoose.Schema.Types.Mixed },
  }],
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

// --- NEW: AI lock sub-schema (lead-locking mechanism) ---
// Prevents AI and human telecallers from double-dialing the same lead at the
// same time. Acquired/released atomically by services/aiCaller/leadLock.js
// using findOneAndUpdate — never read-then-write — to avoid race conditions
// under concurrent campaign execution.
const aiLockSchema = new mongoose.Schema({
  lockedBy: { type: String, default: '' },      // 'ai-engine' or a worker/instance id
  lockedAt: { type: Date },
  expiresAt: { type: Date },                    // TTL self-heals stranded locks (e.g. crashed call)
}, { _id: false });

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  alternatePhone: { type: String, default: '' },
  email: { type: String, default: '' },
  status: {
    type: String,
    default: 'Fresh'
  },
  lostReason: { type: String, default: '' },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  leadSource: { type: String, default: 'Manual' },
  leadSourceNote: { type: String, default: '' }, // custom message when leadSource is "Other"
  preferredCourses: [{ type: String }],
  courseInterest: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  mode: { type: String, enum: ['Online', 'Offline', 'Hybrid', ''], default: '' },
  budget: { type: Number, default: 0 },
  location: { type: String, default: '' },
  lastQualification: { type: String, default: '' },
  nextFollowupDate: { type: Date },
  demoScheduledDate: { type: Date },
  demoDoneDate: { type: Date },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  activities: [activitySchema],
  isStarred: { type: Boolean, default: false },
  totalCalls: { type: Number, default: 0 },
  totalCallDuration: { type: Number, default: 0 },
  lastCalledAt: { type: Date },
  // --- NEW: store extra/custom columns from Excel import ---
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportHistory' },
  collegeName: { type: String, default: '' },
  // Named lists a lead can be added to/removed from (used by Salesform "Add in List" / "Remove from List" actions)
  lists: { type: [String], default: [] },

  // ====================== NEW FIELDS (AI Telecaller upgrade) ======================
  // Lead-locking — see backend/src/services/aiCaller/leadLock.js
  aiLock: { type: aiLockSchema, default: undefined },

  // Tracks where this lead is in the autonomous AI dialing lifecycle.
  // 'none'        -> not currently part of any AI dial attempt
  // 'queued'      -> campaignEngine / callbackEngine has marked this for the next dial pass
  // 'in_progress' -> Twilio call placed, RunPod session active
  // 'completed'   -> last AI call finished (outcome already applied)
  aiCallState: { type: String, enum: ['none', 'queued', 'in_progress', 'completed'], default: 'none' },

  // Full structured GPT-4.1-mini output from the most recent AI call. Used by
  // conversationMemory.js to build "last time we spoke..." context for the next call.
  lastAiOutcome: { type: mongoose.Schema.Types.Mixed, default: null },

  // Detected/preferred spoken language for this lead (Telugu / English / Hinglish),
  // learned from the first AI call and reused so subsequent calls open in the right language.
  language: { type: String, enum: ['Telugu', 'English', 'Hinglish', ''], default: '' },
  // =================================================================================
}, { timestamps: true });

leadSchema.index({ phone: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ campaign: 1 });
leadSchema.index({ importId: 1 });
leadSchema.index({ 'aiLock.expiresAt': 1 }); // NEW — fast lookup of unlocked/expired leads
leadSchema.index({ campaign: 1, aiCallState: 1 }); // NEW — campaignEngine eligibility query

module.exports = mongoose.model('Lead', leadSchema);
