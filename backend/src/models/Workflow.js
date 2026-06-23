const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'call_api', 'notify_team_member', 'update_lead_assignee',
      'update_lead_status', 'update_lead_rating', 'trigger_webhook', 'custom_action',
    ],
  },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const conditionSchema = new mongoose.Schema({
  field: { type: String, required: true },
  operator: { type: String, enum: ['equals', 'not_equals', 'contains', 'exists'], default: 'equals' },
  value: { type: mongoose.Schema.Types.Mixed },
}, { _id: false });

const workflowSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // WORKFLOW = runs immediately when the event fires. SCHEDULE = same engine,
  // but actions run scheduleConfig.delayMinutes after the event fires.
  kind: { type: String, enum: ['WORKFLOW', 'SCHEDULE'], default: 'WORKFLOW', index: true },
  workflowType: { type: String, default: 'Lead Updation' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  triggerEvent: {
    type: String,
    enum: [
      'lead.assignee_changed', 'lead.field_changed', 'lead.rating_changed',
      'lead.status_changed', 'lead.added_to_list', 'lead.removed_from_list',
    ],
    required: true,
  },
  // e.g. { field: 'leadSource' } when triggerEvent === 'lead.field_changed'
  triggerConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  conditions: [conditionSchema],
  actions: { type: [actionSchema], default: [] },
  scheduleConfig: {
    delayMinutes: { type: Number, default: 0 },
    // if the lead's status changes before the delay elapses, skip the run
    cancelIfStatusChanged: { type: Boolean, default: true },
  },
  stats: {
    totalRuns: { type: Number, default: 0 },
    success: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
  },
  lastRunAt: { type: Date },
  lastError: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

workflowSchema.index({ kind: 1, status: 1, triggerEvent: 1 });

module.exports = mongoose.model('Workflow', workflowSchema);