const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
  type: { type: String, enum: ['call', 'note', 'status_change', 'whatsapp', 'sms', 'followup'], required: true },
  description: { type: String, default: '' },
  callDuration: { type: Number, default: 0 },
  callStatus: { type: String, enum: ['connected', 'no_answer', 'busy', 'failed', ''], default: '' },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  createdAt: { type: Date, default: Date.now }
});

const leadSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true },
  alternatePhone: { type: String, default: '' },
  email: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Fresh', 'Connected', 'Call Not Responding', 'Call Back Later', 'Not interested', 'Demo Scheduled', 'Demo Done', 'Won', 'Lost', 'Blocked'],
    default: 'Fresh'
  },
  rating: { type: Number, min: 0, max: 5, default: 0 },
  leadSource: { type: String, default: 'Manual' },
  leadSourceNote: { type: String, default: '' }, // custom message when leadSource is "Other"
  preferredCourses: [{ type: String }],
  courseInterest: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
  mode: { type: String, enum: ['Online', 'Offline', 'Hybrid', ''], default: '' },
  budget: { type: Number, default: 0 },
  location: { type: String, default: '' },
  lastQualification: { type: String, default: '' },
  nextFollowupDate: { type: Date },
  demoScheduledDate: { type: Date },
  demoDoneDate: { type: Date },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  campaign: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  activities: [activitySchema],
  isStarred: { type: Boolean, default: false },
  totalCalls: { type: Number, default: 0 },
  totalCallDuration: { type: Number, default: 0 },
  lastCalledAt: { type: Date },
  // --- NEW: store extra/custom columns from Excel import ---
  customFields: { type: mongoose.Schema.Types.Mixed, default: {} },
  importId: { type: mongoose.Schema.Types.ObjectId, ref: 'ImportHistory' },
  collegeName: { type: String, default: '' },
}, { timestamps: true });

leadSchema.index({ phone: 1 });
leadSchema.index({ assignedTo: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ campaign: 1 });
leadSchema.index({ importId: 1 });

module.exports = mongoose.model('Lead', leadSchema);