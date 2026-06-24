const mongoose = require('mongoose');

const FIELD_TYPES = ['text', 'number', 'phone', 'email', 'date', 'money', 'dropdown', 'checkbox', 'textarea'];

const leadFieldSchema = new mongoose.Schema({
  workspace: { type: String, default: 'default', index: true },
  name: { type: String, required: true, trim: true },
  type: { type: String, enum: FIELD_TYPES, default: 'text' },
  options: { type: [String], default: [] }, // for dropdown type
  isPrimary: { type: Boolean, default: false }, // H1/H2 assign fields (Name/Phone) — system, not editable/hidable
  isSystem: { type: Boolean, default: false },
  hidden: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
}, { timestamps: true });

leadFieldSchema.statics.FIELD_TYPES = FIELD_TYPES;

leadFieldSchema.statics.getDefaultSeed = function () {
  return [
    { name: 'affliatedcollege', type: 'text', order: 0 },
    { name: 'Alternate Phone', type: 'phone', order: 1 },
    { name: 'branchcode', type: 'number', order: 2 },
    { name: 'Budget', type: 'money', order: 3 },
    { name: 'code', type: 'text', order: 4 },
    { name: 'College Name', type: 'dropdown', options: [], order: 5 },
    { name: 'Demo Done Date', type: 'date', order: 6 },
    { name: 'Demo Scheduled Date', type: 'date', order: 7 },
  ];
};

module.exports = mongoose.model('LeadField', leadFieldSchema);