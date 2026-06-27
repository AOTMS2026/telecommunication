const mongoose = require('mongoose');

const accessTokenSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  // raw token is shown to the user ONCE at creation time and never stored — only its hash is kept
  tokenHash: { type: String, required: true, unique: true },
  tokenPrefix: { type: String, required: true }, // e.g. "atms_3f2a" — safe to display in the table
  apiType: { type: String, enum: ['async', 'sync'], default: 'async' },
  recapturePreference: { type: String, enum: ['once_a_day', 'once_a_week', 'never'], default: 'once_a_day' },
  status: { type: String, enum: ['active', 'revoked'], default: 'active' },
  lastUsedAt: { type: Date },
  requestCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('AccessToken', accessTokenSchema);