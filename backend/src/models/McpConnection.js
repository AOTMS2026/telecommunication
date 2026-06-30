const mongoose = require('mongoose');

const mcpConnectionSchema = new mongoose.Schema({
  provider: { type: String, enum: ['claude', 'chatgpt', 'gemini'], required: true },
  status: { type: String, enum: ['pending', 'approved', 'revoked'], default: 'pending' },
  tokenHash: { type: String },
  tokenPrefix: { type: String },
  readOnly: { type: Boolean, default: true },
  requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  requestedAt: { type: Date, default: Date.now },
  notifiedEmail: { type: String, default: '' },
  emailSent: { type: Boolean, default: false },
  approvedAt: { type: Date },
  lastUsedAt: { type: Date },
}, { timestamps: true });

module.exports = mongoose.model('McpConnection', mcpConnectionSchema);