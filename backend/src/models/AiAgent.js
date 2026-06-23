const mongoose = require('mongoose');

const outputFieldSchema = new mongoose.Schema({
  key: { type: String, required: true },
  label: { type: String, required: true },
  type: { type: String, enum: ['text', 'number', 'boolean', 'score'], default: 'text' },
}, { _id: false });

const aiAgentSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  template: { type: String, enum: ['call_audit_agent', 'custom'], default: 'custom' },
  provider: { type: String, enum: ['openai', 'openrouter'], default: 'openai' },
  model: { type: String, default: 'gpt-4o' },
  // optional per-agent key; falls back to OPENAI_API_KEY / OPENROUTER_API_KEY env vars when blank
  apiKey: { type: String, default: '' },
  prompt: { type: String, required: true },
  outputFields: { type: [outputFieldSchema], default: [] },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

aiAgentSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  if (obj.apiKey) obj.apiKey = '••••••••' + obj.apiKey.slice(-4);
  return obj;
};

module.exports = mongoose.model('AiAgent', aiAgentSchema);