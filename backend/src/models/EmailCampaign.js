const mongoose = require('mongoose');

// Per-recipient send log for a single Email Campaign blast.
const emailRecipientSchema = new mongoose.Schema({
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
  name: { type: String, default: '' },
  email: { type: String, default: '' },
  campaignName: { type: String, default: '' },
  status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
  error: { type: String, default: '' },
  resendId: { type: String, default: '' },
}, { _id: false });

// Independent collection for the new "Email Campaign" feature.
// Does NOT modify Lead, Campaign or MessageTemplate schemas/relationships.
const emailCampaignSchema = new mongoose.Schema({
  name: { type: String, default: '' },
  sourceCampaigns: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' }],
  templateRef: { type: mongoose.Schema.Types.ObjectId, ref: 'MessageTemplate', default: null },
  subject: { type: String, required: true },
  body: { type: String, required: true },
  // 'html' for campaigns composed with the rich editor (may contain images/
  // formatting); 'text' for legacy plain-text bodies. Defaults preserve the
  // original escape+line-break behaviour for anything sent before this field existed.
  bodyFormat: { type: String, enum: ['text', 'html'], default: 'text' },
  totalCampaigns: { type: Number, default: 0 },
  totalRecipients: { type: Number, default: 0 },
  sentCount: { type: Number, default: 0 },
  failedCount: { type: Number, default: 0 },
  status: { type: String, enum: ['pending', 'sending', 'completed', 'failed'], default: 'pending' },
  recipients: [emailRecipientSchema],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

emailCampaignSchema.index({ createdBy: 1 });
emailCampaignSchema.index({ createdAt: -1 });

module.exports = mongoose.model('EmailCampaign', emailCampaignSchema);