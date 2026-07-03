const mongoose = require('mongoose');

const messageTemplateSchema = new mongoose.Schema({
  type: { type: String, enum: ['whatsapp', 'email'], required: true },
  shortcut: { type: String, required: true, trim: true },
  message: { type: String, required: true },
  // Added for the professional Email Template editor. Optional + defaulted
  // so existing WhatsApp/Email templates are completely unaffected.
  subject: { type: String, default: '' },
  bodyFormat: { type: String, enum: ['text', 'html'], default: 'text' },
  isShared: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  // ====================== NEW FIELDS (Meta template approval) =====================
  // Only relevant when type === 'whatsapp'. Tracks the template through Meta's
  // review pipeline so the Templates tab can show real approval status.
  metaTemplateId: { type: String, default: '' },      // id returned by Meta on submission
  metaTemplateName: { type: String, default: '' },    // Meta requires a unique, lowercase_snake_case name
  category: { type: String, enum: ['MARKETING', 'UTILITY', 'AUTHENTICATION', ''], default: '' },
  language: { type: String, default: 'en_US' },        // Meta language code, e.g. en_US, hi, te
  components: { type: mongoose.Schema.Types.Mixed, default: [] }, // header/body/footer/buttons sent to Meta
  waStatus: {
    type: String,
    enum: ['LOCAL', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DISABLED'],
    default: 'LOCAL',
  },
  rejectedReason: { type: String, default: '' },
  integration: { type: mongoose.Schema.Types.ObjectId, ref: 'Integration' }, // which WABA it was submitted through
  // =================================================================================
}, { timestamps: true });

messageTemplateSchema.index({ type: 1 });
messageTemplateSchema.index({ createdBy: 1 });

module.exports = mongoose.model('MessageTemplate', messageTemplateSchema);