const mongoose = require('mongoose');
const crypto = require('crypto');

const webhookSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  url: { type: String, required: true },
  secret: { type: String, default: () => crypto.randomBytes(16).toString('hex') },
  // subscribed trigger events — reuses the same event names as Workflow.triggerEvent
  events: [{ type: String }],
  status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  successCount: { type: Number, default: 0 },
  failCount: { type: Number, default: 0 },
  lastTriggeredAt: { type: Date },
  lastError: { type: String, default: '' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Webhook', webhookSchema);