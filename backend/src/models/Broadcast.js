const mongoose = require('mongoose');

const broadcastErrorSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  phone: { type: String, default: '' },
  message: { type: String, default: '' },
}, { _id: false });

const broadcastSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  template: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate', required: true },
  message: { type: String, default: '' }, // snapshot of the template text used to send
  // Audience filters used to select leads for this broadcast
  filters: {
    status: { type: String, default: '' },
    campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
    leadSource: { type: String, default: '' },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  status: { type: String, enum: ['draft', 'sending', 'completed', 'failed', 'cancelled'], default: 'draft' },
  recipientCount: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  errors: [broadcastErrorSchema],
  startedAt: { type: Date },
  completedAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

broadcastSchema.index({ createdBy: 1 });
broadcastSchema.index({ status: 1 });
broadcastSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Broadcast', broadcastSchema);