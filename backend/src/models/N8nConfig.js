const mongoose = require('mongoose');

// Singleton config — one document per organization. Stores the n8n instance URL and API key.
const n8nConfigSchema = new mongoose.Schema({
  baseUrl: { type: String, required: true, trim: true }, // e.g. https://n8n.yourdomain.com
  apiKey: { type: String, required: true },
  status: { type: String, enum: ['connected', 'disconnected', 'error'], default: 'disconnected' },
  lastCheckedAt: { type: Date },
  lastError: { type: String, default: '' },
  n8nVersion: { type: String, default: '' },
  // cached list of available n8n workflows (refreshed on demand)
  cachedWorkflows: [{
    id: { type: String },
    name: { type: String },
    active: { type: Boolean },
    tags: [{ type: String }],
    updatedAt: { type: String },
  }],
  cachedAt: { type: Date },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

n8nConfigSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  if (obj.apiKey) obj.apiKey = '••••••••' + obj.apiKey.slice(-4);
  return obj;
};

module.exports = mongoose.model('N8nConfig', n8nConfigSchema);