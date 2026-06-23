const mongoose = require('mongoose');

const workflowExecutionSchema = new mongoose.Schema({
  workflow: { type: mongoose.Schema.Types.ObjectId, ref: 'Workflow', required: true, index: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  // pending = queued for a future run (used by SCHEDULE kind); success/failed/cancelled = finished
  status: { type: String, enum: ['pending', 'success', 'failed', 'cancelled'], default: 'pending', index: true },
  runAt: { type: Date, default: Date.now, index: true },
  triggerEvent: { type: String },
  triggerSnapshot: { type: mongoose.Schema.Types.Mixed, default: {} },
  actionsLog: [{
    type: { type: String },
    ok: { type: Boolean },
    message: { type: String },
    ranAt: { type: Date, default: Date.now },
  }],
  durationMs: { type: Number, default: 0 },
  error: { type: String, default: '' },
}, { timestamps: true });

workflowExecutionSchema.index({ workflow: 1, createdAt: -1 });
workflowExecutionSchema.index({ status: 1, runAt: 1 });

module.exports = mongoose.model('WorkflowExecution', workflowExecutionSchema);