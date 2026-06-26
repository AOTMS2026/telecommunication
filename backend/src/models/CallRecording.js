// models/CallRecording.js
// Collection: callrecordings
const mongoose = require('mongoose');

const callRecordingSchema = new mongoose.Schema(
  {
    // Who recorded this call (the caller/agent)
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    // Optional link to the lead this call was about
    lead: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
      index: true,
    },

    // Original filename as saved by the phone's call-recorder app
    originalName: { type: String, required: true },

    // Filename actually stored on disk (sanitized + unique)
    storedName: { type: String, required: true },

    // Relative path on disk, e.g. "recordings/167900_call.m4a"
    filePath: { type: String, required: true },

    // Publicly servable URL, e.g. "/uploads/recordings/167900_call.m4a"
    url: { type: String, required: true },

    // File size in bytes
    size: { type: Number, default: 0 },

    // MIME type, e.g. "audio/mp4", "audio/amr"
    mimeType: { type: String, default: 'audio/mpeg' },

    // When the call actually happened (sent by the app), vs createdAt = upload time
    recordedAt: { type: Date, required: true },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

// Fast lookups for "my recordings" and admin "all recordings" sorted by newest first
callRecordingSchema.index({ user: 1, recordedAt: -1 });

module.exports = mongoose.model('CallRecording', callRecordingSchema);