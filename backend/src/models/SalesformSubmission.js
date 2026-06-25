const mongoose = require('mongoose');

const salesformSubmissionSchema = new mongoose.Schema({
  salesform: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesform', required: true, index: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  // which top-level branch ("Path N") on the Salesform-tab canvas matched this lead, if any
  pathIndex: { type: Number, default: null },
  // result of running the Workflow-tab action chain after this submission
  actionsLog: { type: [mongoose.Schema.Types.Mixed], default: [] },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SalesformSubmission', salesformSubmissionSchema);