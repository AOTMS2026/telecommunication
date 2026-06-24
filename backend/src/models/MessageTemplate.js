const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema({
  type: { type: String, enum: ['whatsapp', 'sms', 'email'], required: true },
  shortcut: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  // Added for the professional Email Template editor. Optional + defaulted
  // so existing WhatsApp/SMS/Email templates are completely unaffected.
  subject: { type: String, default: '' },
  bodyFormat: { type: String, enum: ['text', 'html'], default: 'text' },
  isShared: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

messageTemplateSchema.index({ type: 1 });
messageTemplateSchema.index({ createdBy: 1 });

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);