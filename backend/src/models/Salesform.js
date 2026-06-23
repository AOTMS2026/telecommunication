const mongoose = require('mongoose');

const fieldSchema = new mongoose.Schema({
  id: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'number', 'date', 'select', 'textarea', 'checkbox'], default: 'text' },
  options: [{ type: String }],
  required: { type: Boolean, default: false },
  // optional: write the submitted value straight onto the Lead document (e.g. 'budget', 'location')
  mapToLeadField: { type: String, default: '' },
}, { _id: false });

const salesformSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  status: { type: String, enum: ['draft', 'published'], default: 'draft', index: true },
  triggerEvent: { type: String, enum: ['on_status_update', 'on_button_click', 'on_field_change'], required: true },
  // e.g. { status: 'Demo Done' } for on_status_update, { field: 'leadSource' } for on_field_change
  triggerConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  fields: { type: [fieldSchema], default: [] },
  // "Workflow" tab — actions that run right after a successful submission
  actions: [{
    type: { type: String, enum: ['notify_team_member', 'update_lead_status', 'trigger_webhook', 'call_api'] },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  }],
  statusUpdatedAt: { type: Date },
  statusUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Salesform', salesformSchema);