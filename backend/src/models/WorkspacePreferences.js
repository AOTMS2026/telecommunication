const mongoose = require('mongoose');

const WorkspacePreferencesSchema = new mongoose.Schema({
  workspace: {
    type: String,
    required: true,
    unique: true,
    default: 'default'
  },
  defaultCountryCode: {
    type: String,
    default: '+91'
  },
  defaultTimezone: {
    type: String,
    default: 'Asia/Kolkata'
  },
  defaultCurrency: {
    type: String,
    default: 'INR'
  },
  connectedCallMinDuration: {
    type: Number,
    default: 0
  },
  sessionTimeout: {
    type: String,
    default: 'Never'
  },
  leaderboard: {
    leadStage: {
      type: Boolean,
      default: true
    },
    leadRating: {
      type: Boolean,
      default: true
    }
  },
  features: {
    locationCheckIn: {
      type: Boolean,
      default: true
    },
    campaign: {
      type: Boolean,
      default: true
    },
    customActions: {
      type: Boolean,
      default: true
    },
    salesGroup: {
      type: Boolean,
      default: true
    },
    leadRecapture: {
      type: Boolean,
      default: true
    }
  },
  syncPermissions: {
    smartSyncing: {
      type: Boolean,
      default: true
    }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('WorkspacePreferences', WorkspacePreferencesSchema);