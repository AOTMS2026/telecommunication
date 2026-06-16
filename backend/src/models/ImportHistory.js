const mongoose = require('mongoose');

const importHistorySchema = new mongoose.Schema({
  importName: { type: String, default: '' },
  fileName: { type: String, required: true },
  sheetName: { type: String, default: '' },
  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  fieldMapping: { type: mongoose.Schema.Types.Mixed, default: {} }, // { excelCol: systemField }
  duplicateHandling: { type: String, enum: ['skip', 'add', 'reset'], default: 'skip' },
  callerAssignments: [{ callerId: String, callerName: String, pct: Number, count: Number }],
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'completed' },
  totalRecords: { type: Number, default: 0 },
  importedRecords: { type: Number, default: 0 },
  duplicateRecords: { type: Number, default: 0 },
  failedRecords: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('ImportHistory', importHistorySchema);