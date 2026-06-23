const mongoose = require('mongoose');

const salesformSubmissionSchema = new mongoose.Schema({
  salesform: { type: mongoose.Schema.Types.ObjectId, ref: 'Salesform', required: true, index: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true, index: true },
  data: { type: mongoose.Schema.Types.Mixed, default: {} },
  submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SalesformSubmission', salesformSubmissionSchema);