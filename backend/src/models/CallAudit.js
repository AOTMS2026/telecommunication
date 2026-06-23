const mongoose = require('mongoose');

const callAuditSchema = new mongoose.Schema({
  agent: { type: mongoose.Schema.Types.ObjectId, ref: 'AiAgent', required: true, index: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  activityId: { type: mongoose.Schema.Types.ObjectId }, // the call activity (Lead.activities[]) that was audited
  transcriptSnapshot: { type: String, default: '' },
  result: { type: mongoose.Schema.Types.Mixed, default: {} }, // keyed by AiAgent.outputFields[].key
  status: { type: String, enum: ['success', 'failed'], default: 'success' },
  error: { type: String, default: '' },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

callAuditSchema.index({ lead: 1, createdAt: -1 });

module.exports = mongoose.model('CallAudit', callAuditSchema);