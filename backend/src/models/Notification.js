const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'lead_assigned', 'lead_status_changed', 'lead_updated', 'new_lead',
      'call_initiated', 'callback_due', 'task_created', 'task_assigned',
      'task_edited', 'task_overdue', 'workflow_action', 'general',
      'task_pending_approval', 'task_approved', 'task_rejected'
    ],
    required: true
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  read: { type: Boolean, default: false },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);