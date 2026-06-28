const mongoose = require('mongoose');
const crypto = require('crypto');

const fieldMappingSchema = new mongoose.Schema({
  from: { type: String }, // incoming payload field name
  to:   { type: String }, // AOTMS lead field name
}, { _id: false });

const webhookSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  url:  { type: String, default: '' },

  // Inbound token — used in the public endpoint: POST /api/webhooks/inbound/:token
  inboundToken: { type: String, default: () => crypto.randomBytes(20).toString('hex'), index: true },

  // Outbound signing secret
  secret: { type: String, default: () => crypto.randomBytes(16).toString('hex') },

  // subscribed trigger events — same event names as Workflow.triggerEvent
  events: [{ type: String }],

  // Step 3 — which incoming field identifies the lead (e.g. "phone" / "email")
  config: {
    leadIdentifier:  { type: String, default: 'phone' },
    duplicateField:  { type: String, default: '' },
    authType:        { type: String, enum: ['none','bearer','basic','api_key'], default: 'none' },
    authValue:       { type: String, default: '' },
    samplePayload:   { type: mongoose.Schema.Types.Mixed, default: {} },
  },

  // Step 6 — field mappings: incoming JSON key → lead field
  fieldMappings: [fieldMappingSchema],

  // Step 7 — connected AOTMS workflow triggered on every inbound hit
  connectedWorkflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', default: null },

  status: { type: String, enum: ['active','inactive'], default: 'active' },
  successCount: { type: Number, default: 0 },
  failCount:    { type: Number, default: 0 },
  lastTriggeredAt: { type: Date },
  lastError:    { type: String, default: '' },
  createdBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  workspace:    { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace' },
}, { timestamps: true });

module.exports = mongoose.model('Webhook', webhookSchema);