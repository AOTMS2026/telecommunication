const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  // Lead is optional — a call follow-up can be created without linking a specific lead
  lead: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Lead'
  },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  // Who created / delegated this task (defaults to the creator, but can be overridden by admins)
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  scheduledAt: { type: Date, required: true },
  status: { type: String, enum: ['upcoming', 'done', 'late', 'cancelled'], default: 'upcoming' },
  // FIX BUG-03: added type field so Tasks page "To-Do" tab works
  type: { type: String, enum: ['call_followup', 'todo'], default: 'call_followup' },
  note: { type: String, default: '' },
  title: { type: String, default: '' },       // for todo tasks
  priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  completedAt: { type: Date },
  // Set once an overdue notification has been sent for this task, so the
  // background job never sends duplicate "task overdue" alerts.
  overdueNotifiedAt: { type: Date },

  // ── Recurrence ──────────────────────────────────────────────────────────
  // When a task is created with a recurrence, we pre-generate one FollowUp
  // document per occurrence (e.g. one per day for a month). Every generated
  // document shares the same `recurringGroupId` so the whole series can be
  // identified, edited in bulk, or cancelled together later if needed.
  recurrence: {
    frequency: { type: String, enum: ['none', 'daily', 'weekly', 'monthly'], default: 'none' },
    endDate: { type: Date }, // last date an occurrence can be scheduled on (inclusive)
  },
  recurringGroupId: { type: mongoose.Schema.Types.ObjectId }, // shared by every occurrence in a series
}, { timestamps: true });

// Indexes for frequent query patterns
followUpSchema.index({ scheduledAt: 1 });
followUpSchema.index({ assignedTo: 1 });
followUpSchema.index({ status: 1 });
followUpSchema.index({ assignedTo: 1, status: 1 });
followUpSchema.index({ lead: 1 });
followUpSchema.index({ recurringGroupId: 1 });

module.exports = mongoose.model('FollowUp', followUpSchema);