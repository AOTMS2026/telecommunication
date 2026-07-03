// models/CallRecording.js
// Collection: callrecordings
const mongoose = require('mongoose');
const { normalizePhone10 } = require('../utils/phone');

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

    // Phone number extracted from the recording filename (digits only, last
    // 10 kept) — lets a recording be matched to a lead's call history even
    // when no leadId was sent or the lead didn't exist yet at upload time.
    // Always normalized to exactly the last 10 digits — never more, never
    // less — same rule as Lead.phone (see utils/phone.js). Left as null
    // only when no phone digits could be found anywhere in the upload.
    phone: {
      type: String,
      default: null,
      index: true,
      set: v => (v === null || v === undefined || v === '' ? null : normalizePhone10(v)),
      validate: {
        validator: v => v === null || /^\d{10}$/.test(v),
        message: props => `Recording phone must be exactly 10 digits (got "${props.value}")`,
      },
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

    // Speech-to-text result (via OpenAI Whisper), populated on demand the
    // first time someone runs a Call IQ agent against this recording, then
    // cached here so repeat audits don't re-transcribe the same audio.
    transcript: { type: String, default: '' },
    transcriptStatus: { type: String, enum: ['none', 'pending', 'done', 'failed'], default: 'none' },
    transcriptError: { type: String, default: '' },

    // Snapshot of the MOST RECENT Call IQ audit run against this recording.
    // Overwritten every time "Run Call IQ" is used (never appended), so this
    // always reflects the latest report — not the first one ever run — and
    // can be shown directly in the recordings list without a second fetch.
    lastCallIqReport: {
      audit: { type: mongoose.Schema.Types.ObjectId, ref: 'CallAudit', default: null },
      agent: { type: mongoose.Schema.Types.ObjectId, ref: 'AiAgent', default: null },
      agentName: { type: String, default: '' },
      status: { type: String, enum: ['success', 'failed', ''], default: '' },
      result: { type: mongoose.Schema.Types.Mixed, default: null },
      error: { type: String, default: '' },
      runAt: { type: Date, default: null },
      runBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    },
  },
  { timestamps: true } // adds createdAt, updatedAt
);

// Fast lookups for "my recordings" and admin "all recordings" sorted by newest first
callRecordingSchema.index({ user: 1, recordedAt: -1 });

module.exports = mongoose.model('CallRecording', callRecordingSchema);