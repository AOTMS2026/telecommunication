const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  amount: { type: Number, required: true, default: 0 },
  currency: { type: String, default: 'INR' },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'processing', 'cancelled', 'refunded'],
    default: 'pending',
  },
  description: { type: String, default: '' },
  referenceId: { type: String, default: '' },
  gateway: { type: String, default: 'manual' },
  gatewayResponse: { type: mongoose.Schema.Types.Mixed },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

paymentSchema.index({ lead: 1 });
paymentSchema.index({ status: 1 });

module.exports = mongoose.model('Payment', paymentSchema);