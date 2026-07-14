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
    refreshToken: { type: String, default: '' },
    tokenExpiryDate: { type: Number, default: 0 },
    apiKey: { type: String, default: '' },
    apiSecret: { type: String, default: '' },
    sheetId: { type: String, default: '' },
    sheetRange: { type: String, default: '' },
    webhookUrl: { type: String, default: '' },
    webhookVerifyToken: { type: String, default: '' },
    pageAccessToken: { type: String, default: '' },
    phoneNumberId: { type: String, default: '' },
    wabaId: { type: String, default: '' },
    did: { type: String, default: '' },
    virtualNumber: { type: String, default: '' },
    // Multiple Google Sheets sources, each with its own sheetId/range/fieldMapping/name.
    // Falls back to top-level sheetId/sheetRange/fieldMapping (above/outside config) when empty.
    sheetSources: { type: [mongoose.Schema.Types.Mixed], default: [] },
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
  // Auto-sync tracking (Google Sheets background poller)
  lastAutoSyncAt: { type: Date },
  lastAutoSyncResult: { type: mongoose.Schema.Types.Mixed },
  lastAutoSyncError: { type: String },
  // Set when a stored OAuth refresh token is expired/revoked (Google
  // "invalid_grant") — stops the auto-sync poller from retrying every 2
  // minutes against a dead token until the user reconnects.
  needsReconnect: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('Integration', integrationSchema);