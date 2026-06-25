const mongoose = require('mongoose');

const responseMappingFieldSchema = new mongoose.Schema({
  jsonPath: { type: String, required: true },          // e.g. 'message.content', 'usage.prompt_tokens'
  type: { type: String, enum: ['Text', 'Number', 'Date', 'Website', 'Dropdown', 'Money', 'Tags'], default: 'Text' },
  label: { type: String, required: true },              // e.g. 'Answer'
  required: { type: Boolean, default: false },
}, { _id: false });

const apiTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  method: { type: String, enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'POST' },
  endpointUrl: { type: String, required: true },
  timeout: { type: Number, default: 3 }, // seconds
  headers: { type: mongoose.Schema.Types.Mixed, default: {} },
  bodyTemplate: { type: mongoose.Schema.Types.Mixed, default: {} },
  queryParams: { type: mongoose.Schema.Types.Mixed, default: {} },
  auth: {
    type: { type: String, enum: ['none', 'bearer', 'basic', 'api_key'], default: 'none' },
    token: { type: String, default: '' },         // bearer
    username: { type: String, default: '' },      // basic
    password: { type: String, default: '' },      // basic
    headerName: { type: String, default: '' },    // api_key
    headerValue: { type: String, default: '' },   // api_key
  },
  // dot-paths like 'lead.name', 'lead.phone' referenced by {{lead.name}} tokens in the template
  variablesUsed: [{ type: String }],

  // ── Response Mapper (step 2) ──
  responseMapping: { type: [responseMappingFieldSchema], default: [] },
  // last raw response body, cached straight after "Test Template" so the Response
  // Mapper step can list "Available JSON Paths" without re-firing the API
  lastTestResponse: { type: mongoose.Schema.Types.Mixed, default: null },
  lastTestStatus: { type: Number, default: null },
  lastTestedAt: { type: Date },

  usedInWorkflows: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Workflow' }],
  lastModifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ApiTemplate', apiTemplateSchema);