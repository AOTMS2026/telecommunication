const mongoose = require('mongoose');

// --- NEW: defines the calling-hours window AI is allowed to dial in (24h, local server time) ---
const callWindowSchema = new mongoose.Schema({
  startHour: { type: Number, min: 0, max: 23, default: 9 },
  endHour: { type: Number, min: 0, max: 23, default: 20 },
}, { _id: false });

const campaignSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' },
  assignedCallers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  totalLeads: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

  // ====================== NEW FIELDS (AI Telecaller upgrade) ======================
  // Master switch — when false, campaignEngine.tick() skips this campaign entirely.
  aiCallingEnabled: { type: Boolean, default: false },

  // Max number of leads this campaign may have in aiCallState:'in_progress' at once.
  // Keeps RunPod pod load and Twilio concurrent-call usage bounded and predictable.
  aiConcurrencyLimit: { type: Number, default: 5 },

  // Calling-hours guardrail so the AI doesn't dial outside acceptable hours.
  aiCallWindow: { type: callWindowSchema, default: () => ({}) },

  // Optional link to an AiAgent document (models/AiAgent.js) if this campaign
  // should use a non-default prompt/model configuration for its AI calls.
  aiAgentConfig: { type: mongoose.Schema.Types.ObjectId, ref: 'AiAgent' },

  // If true, the AI engine may also dial leads that already have a human
  // assignedTo (still respecting any active aiLock/human-in-call state).
  // Default false: AI only takes unassigned/Available leads, so duplicate
  // calling is avoided by construction rather than by detection.
  aiIncludesAssignedLeads: { type: Boolean, default: false },
  // =================================================================================
}, { timestamps: true });

module.exports = mongoose.model('Campaign', campaignSchema);
