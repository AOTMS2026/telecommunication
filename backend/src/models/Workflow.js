const mongoose = require('mongoose');

const actionSchema = new mongoose.Schema({
  type: {
    type: String,
    required: true,
    enum: [
      'call_api', 'notify_team_member', 'update_lead_assignee',
      'update_lead_status', 'update_lead_rating', 'trigger_webhook',
      'trigger_n8n', 'send_template', 'email_report', 'custom_action',
      // extended action palette (parity with the real TeleCRM action list)
      'create_custom_action', 'update_lead_fields', 'time_delay',
      'add_in_list', 'remove_from_list', 'add_call_followup',
      'cancel_tasks', 'add_payment', 'add_ivr_action',
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
      'lead.created', 'lead.manual_created', 'lead.web_created',
      'lead.facebook_lead', 'lead.justdial_lead', 'lead.excel_upload',
      'lead.woocommerce', 'lead.call_log', 'lead.location_checkin',
      'lead.template_message_sent', 'lead.note_added',
      'lead.whatsapp_lead', 'lead.whatsapp_received', 'lead.template_replied',
      'lead.waca_list_replied', 'lead.user_note', 'lead.system_note',
      // field-specific triggers (lead.field_changed.name, etc.)
      'lead.field_changed.name', 'lead.field_changed.phone', 'lead.field_changed.email',
      'lead.field_changed.alternatePhone', 'lead.field_changed.courseInterest',
      'lead.field_changed.location', 'lead.field_changed.budget',
      'lead.field_changed.nextFollowUpDate', 'lead.field_changed.demoScheduledDate',
      // IVR
      'lead.ivr_incoming', 'lead.ivr_outgoing',
      // Call activities
      'lead.call_incoming_ended', 'lead.call_outgoing_ended',
      'lead.call_missed', 'lead.call_recording_completed',
      // Payment activities
      'lead.payment_completed', 'lead.payment_pending', 'lead.payment_failed',
      'lead.payment_processing', 'lead.payment_cancelled', 'lead.payment_refunded',
      // Custom actions (specific custom action picked via triggerConfig.customActionId)
      'lead.custom_action_created', 'lead.custom_action_updated',
    ],
    required: true,
  },
  // optional: link this workflow to an n8n workflow so every execution also triggers n8n
  n8nWorkflowId: { type: String, default: '' },
  // Visual flowchart editor state (nodes + edges persisted for the canvas)
  nodes: { type: [mongoose.Schema.Types.Mixed], default: [] },
  edges: { type: [mongoose.Schema.Types.Mixed], default: [] },
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