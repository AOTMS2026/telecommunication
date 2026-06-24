const mongoose = require('mongoose');

const statusSchema = new mongoose.Schema({
  name:      { type: String, required: true },
  color:     { type: String, default: '#94a3b8' },
  stage:     { type: String, enum: ['initial', 'active', 'closed_won', 'closed_lost'], required: true },
  order:     { type: Number, default: 0 },
  isDefault: { type: Boolean, default: false },
  isSystem:  { type: Boolean, default: false },
  archived:  { type: Boolean, default: false },
}, { _id: true });

const lostReasonSchema = new mongoose.Schema({
  name: { type: String, required: true },
}, { _id: true });

const leadStageSchema = new mongoose.Schema({
  // One config doc per organisation (singleton)
  org:         { type: String, default: 'default' },
  statuses:    [statusSchema],
  lostReasons: [lostReasonSchema],
}, { timestamps: true });

leadStageSchema.index({ org: 1 }, { unique: true });

module.exports = mongoose.model('LeadStage', leadStageSchema);