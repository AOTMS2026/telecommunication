const mongoose = require('mongoose');

// A single selectable row inside a section (Meta limit: title <= 24 chars,
// description <= 72 chars — enforced softly here, hard-validated on send).
const rowSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 24 },
  description: { type: String, default: '', trim: true, maxlength: 72 },
}, { _id: false });

// Meta allows up to 10 sections, each with a title (<=24 chars) and rows.
// Across ALL sections combined, Meta allows a maximum of 10 rows total.
const sectionSchema = new mongoose.Schema({
  title: { type: String, default: '', trim: true, maxlength: 24 },
  rows: { type: [rowSchema], default: [] },
}, { _id: false });

const whatsAppListSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },       // internal label, shown in the sidebar
  header: { type: String, default: '', trim: true, maxlength: 60 },
  body: { type: String, required: true, trim: true, maxlength: 1024 },
  footer: { type: String, default: '', trim: true, maxlength: 60 },
  buttonLabel: { type: String, required: true, trim: true, maxlength: 20 },
  sections: { type: [sectionSchema], default: [] },
  isShared: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

whatsAppListSchema.index({ createdBy: 1 });

module.exports = mongoose.model('WhatsAppList', whatsAppListSchema);