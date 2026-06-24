const mongoose = require('mongoose');

const feedbackStatusSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
  isSystem: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  archived: { type: Boolean, default: false },
}, { _id: true, timestamps: true });

const callFeedbackSchema = new mongoose.Schema({
  workspace: { type: String, default: 'default', index: true },
  minConnectedDuration: { type: Number, default: 0 },
  statuses: { type: [feedbackStatusSchema], default: [] },
}, { timestamps: true });

callFeedbackSchema.statics.getDefaultSeed = function () {
  return {
    minConnectedDuration: 0,
    statuses: [
      { name: 'NUMBER BUSY', isSystem: true, order: 0 },
      { name: 'NO ANSWER', isSystem: true, order: 1 },
      { name: 'WRONG NUMBER', isSystem: true, order: 2 },
      { name: 'SWITCHED OFF', isSystem: true, order: 3 },
      { name: 'CONNECTED', isDefault: true, isSystem: true, order: 4 },
      { name: 'CALL LATER', order: 5 },
      { name: 'REDIALED', order: 6 },
    ],
  };
};

module.exports = mongoose.model('CallFeedback', callFeedbackSchema);