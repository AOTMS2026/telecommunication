const mongoose = require('mongoose');

const integrationSchema = new mongoose.Schema({
  name: { type: String, required: true }, // e.g. 'Facebook', 'JustDial', 'IndiaMart'
  type: { type: String, required: true }, // 'facebook', 'justdial', 'indiamart', 'google_sheets', 'webhook', etc.
  status: { type: String, enum: ['active', 'inactive', 'pending'], default: 'pending' },
  description: { type: String, default: '' },
  logoUrl: { type: String, default: '' },
  // Webhook key for receiving leads
  webhookKey: { type: String, unique: true, sparse: true },
  // Config fields (API keys, tokens, page IDs etc.)
  config: {
    pageId: { type: String, default: '' },
    formId: { type: String, default: '' },
    accessToken: { type: String, default: '' },
    apiKey: { type: String, default: '' },
    sheetId: { type: String, default: '' },
    webhookUrl: { type: String, default: '' },
    extraConfig: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  // Field mapping: integration field -> lead field
  fieldMapping: {
    type: mongoose.Schema.Types.Mixed,
    default: {
      name: 'name',
      phone: 'phone',
      email: 'email',
      location: 'location',
    }
  },
  // Default campaign to assign leads to
  defaultCampaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  // Default assignee
  defaultAssignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  // Leads imported via this integration
  totalLeadsImported: { type: Number, default: 0 },
  lastLeadAt: { type: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Integration', integrationSchema);