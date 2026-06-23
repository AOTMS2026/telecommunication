const mongoose = require('mongoose');

const apiTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' },
  endpointUrl: { type: String, required: true },
  headers: { type: mongoose.Schema.Types.Mixed, default: {} },
  bodyTemplate: { type: mongoose.Schema.Types.Mixed, default: {} },
  // dot-paths like 'lead.name', 'lead.phone' referenced by {{lead.name}} tokens in the template
  variablesUsed: [{ type: String }],
  usedInWorkflows: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' }],
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ApiTemplate', apiTemplateSchema);