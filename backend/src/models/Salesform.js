const mongoose = require('mongoose');

// Trigger taxonomy shown in the "Select event" picker (matches TeleCRM reference 1:1).
const TRIGGER_EVENTS = [
  'on_adding_lead',                  // On adding single lead
  'on_lead_field_update',            // On lead field update -> triggerConfig.leadField
  'on_button_click',                 // On button click (manual, from lead detail page)
  'on_outgoing_call',                 // On System activity -> Outgoing Call
  'on_incoming_call',                  // On System activity -> Incoming Call
  'on_location_checkin',               // On System activity -> Location Check-in
  'on_payment',                         // On System activity -> Payment
  'on_call_followup_task_creation',   // On task creation activity -> Call Followup
];

const ruleSchema = new mongoose.Schema({
  field: { type: String, default: 'status' },                 // e.g. status, rating, leadSource, assignedTo, createdAt
  operator: { type: String, enum: ['is', 'is_not', 'contains', 'any'], default: 'is' },
  values: [{ type: String }],
}, { _id: false });

const flowFieldSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'number', 'date', 'select', 'textarea', 'checkbox'], default: 'date' },
  options: [{ type: String }],
  required: { type: Boolean, default: true },
  // optional: write the submitted value straight onto the Lead document (e.g. 'demoDoneDate')
  mapToLeadField: { type: String, default: '' },
}, { _id: false });

// One node on the "Salesform" tab canvas — event | condition ("Check if lead") | section
const flowNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['event', 'condition', 'section'], required: true },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  pathIndex: { type: Number, default: 0 }, // which top-level branch ("Path 1", "Path 2"...) this node belongs to
  label: { type: String, default: '' },
  rules: { type: [ruleSchema], default: [] },       // for 'condition' nodes
  fields: { type: [flowFieldSchema], default: [] }, // for 'section' nodes
}, { _id: false });

const flowEdgeSchema = new mongoose.Schema({ from: String, to: String }, { _id: false });

// One node on the "Workflow" tab canvas — post-submission automation, n8n-style
const ACTION_TYPES = [
  'call_api', 'create_custom_action', 'notify_team_member', 'update_lead_assignee',
  'update_lead_fields', 'update_lead_rating', 'update_lead_status', 'time_delay',
  'send_template', 'add_in_list', 'remove_from_list', 'add_call_followup',
  'cancel_tasks', 'add_payment', 'add_ivr_action', 'trigger_n8n',
];

const actionNodeSchema = new mongoose.Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['event', 'action', 'condition'], required: true },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  label: { type: String, default: '' },
  actionType: { type: String, enum: ACTION_TYPES },
  conditionScope: { type: String, enum: ['lead', 'event'] }, // for type:'condition' — Lead Condition vs Event Condition
  rules: { type: [ruleSchema], default: [] },                // for type:'condition'
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { _id: false });

const actionEdgeSchema = new mongoose.Schema({ from: String, to: String }, { _id: false });

const permissionSchema = new mongoose.Schema({
  role: { type: String, enum: ['caller', 'admin', 'super admin'], required: true },
  view: { type: Boolean, default: false },
  submit: { type: Boolean, default: true },
}, { _id: false });

const salesformSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },

  // ── Trigger (legacy values kept so old documents keep loading) ──
  triggerEvent: { type: String, enum: [...TRIGGER_EVENTS, 'on_status_update', 'on_field_change'], required: true },
  triggerConfig: { type: mongoose.Schema.Types.Mixed, default: {} }, // { leadField, ... }

  // ── "Salesform" tab — branching Check-if-lead → Section canvas ──
  flowNodes: { type: [flowNodeSchema], default: [] },
  flowEdges: { type: [flowEdgeSchema], default: [] },

  // ── "Workflow" tab — post-submission automation canvas ──
  workflowNodes: { type: [actionNodeSchema], default: [] },
  workflowEdges: { type: [actionEdgeSchema], default: [] },
  n8nWorkflowId: { type: String, default: '' }, // linked n8n workflow, triggered on every submission

  // ── "Configuration" tab ──
  mandatory: { type: Boolean, default: false },
  permissions: {
    type: [permissionSchema],
    default: () => ([
      { role: 'caller', view: false, submit: true },
      { role: 'admin', view: true, submit: true },
      { role: 'super admin', view: true, submit: true },
    ]),
  },

  // ── legacy (pre-flowchart) shape — kept so existing submissions keep working ──
  fields: { type: [flowFieldSchema], default: [] },
  actions: [{
    type: { type: String, enum: ['notify_team_member', 'update_lead_status', 'trigger_webhook', 'call_api'] },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  }],

  statusUpdatedAt: { type: Date },
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

salesformSchema.index({ status: 1, triggerEvent: 1 });
salesformSchema.statics.TRIGGER_EVENTS = TRIGGER_EVENTS;
salesformSchema.statics.ACTION_TYPES = ACTION_TYPES;

module.exports = mongoose.model('Salesform', salesformSchema);