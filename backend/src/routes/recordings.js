// routes/recordings.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();
const CallRecording = require('../models/CallRecording');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const { transcribeAudioFile } = require('../services/transcriptionService');
const { getRecordingsDir } = require('../utils/recordingsStorage');

const UPLOAD_DIR = getRecordingsDir();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const ext = path.extname(file.originalname) || '.m4a';
    cb(null, `${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /\.(m4a|amr|mp3|wav|3gp|3gpp|aac|ogg)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Unsupported audio file type'));
  },
});

// ─── Extract phone number from recording filename ─────────────────────────
// Handles formats like:
//   Call_+919876543210_20240101.m4a
//   call_recorder_9876543210_2024-01-01.mp3
//   +91-9876543210.amr
//   Recording_919876543210.wav
function extractPhoneFromFilename(filename) {
  let name = path.basename(filename, path.extname(filename));

  // This app's own uploader names files as "<uploadTimestamp>_<agentName> <recordedAt>.ext"
  // e.g. "1783065247777_Mahesh 2026-07-02 14-00-37.m4a" — neither the leading
  // timestamp nor the trailing date/time is a phone number, but both are long
  // digit runs that used to get mistaken for one. Strip both before scanning.
  name = name.replace(/^\d{10,}_/, '');                              // leading upload timestamp
  name = name.replace(/\s+\d{4}-\d{2}-\d{2}[ _]\d{2}-\d{2}-\d{2}$/, ''); // trailing "YYYY-MM-DD HH-MM-SS"

  // Match sequences of digits (with optional +, -, spaces) that look like phone numbers
  const matches = name.match(/[\+]?[\d][\d\s\-]{7,}/g);
  if (!matches) return null;

  for (const raw of matches) {
    // Strip non-digit characters
    const digits = raw.replace(/\D/g, '');
    if (digits.length < 7) continue;

    // Last 10 digits (local number without country code)
    const last10 = digits.slice(-10);
    if (last10.length === 10) return last10;
  }
  return null;
}

// ─── Split a Date into plain "YYYY-MM-DD" / "HH:mm:ss" strings ─────────────
// Uses local (server) time components so the stored callDate/callTime match
// the same wall-clock date and time shown for recordedAt elsewhere.
function splitDateTime(date) {
  const pad = n => String(n).padStart(2, '0');
  const callDate = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const callTime = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return { callDate, callTime };
}

// ─── Match phone to lead (format/separator agnostic) ───────────────────────
// Builds a regex that matches the 10 digits in order, allowing any
// non-digit characters (spaces, dashes, +country code, etc.) in between,
// anchored to the END of the stored phone value. This means leads stored
// as "9876543210", "+91 98765-43210", "091-9876543210" etc. all match a
// recording whose extracted number is the bare 10-digit "9876543210".
function buildPhoneRegex(phone10) {
  const escaped = phone10.split('').join('\\D*');
  return new RegExp(`${escaped}$`);
}

async function findLeadByPhone(phone10, workspaceId) {
  if (!phone10 || phone10.length !== 10) return null;

  const query = { phone: { $regex: buildPhoneRegex(phone10) } };
  if (workspaceId) query.workspace = workspaceId;

  return Lead.findOne(query).select('_id name phone').lean();
}

// ─── POST /api/recordings ─────────────────────────────────────────────────
router.post('/', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file received (field name must be "audio")' });
    }

    const { leadId, recordedAt, phone: bodyPhone } = req.body;

    // Prefer the phone number sent directly by the caller app (mobile app
    // sends it as a form field). Filename parsing is only a fallback for
    // clients that don't send it, since filenames often contain timestamps
    // or other digit sequences that look like phone numbers but aren't.
    const bodyDigits = (bodyPhone || '').replace(/\D/g, '').slice(-10);
    const extractedPhone = bodyDigits.length === 10
      ? bodyDigits
      : extractPhoneFromFilename(req.file.originalname);

    // Resolve lead: prefer explicit leadId, then auto-match by phone
    let resolvedLead = null;
    if (leadId) {
      resolvedLead = leadId;
    } else if (extractedPhone) {
      const matched = await findLeadByPhone(extractedPhone, req.user.workspace);
      if (matched) resolvedLead = matched._id;
    }

    const resolvedRecordedAt = recordedAt ? new Date(recordedAt) : new Date();
    const { callDate, callTime } = splitDateTime(resolvedRecordedAt);

    const doc = await CallRecording.create({
      user: req.user.id,
      lead: resolvedLead || null,
      phone: extractedPhone || null,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      filePath: `recordings/${req.file.filename}`,
      url: `/uploads/recordings/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype || 'audio/mpeg',
      recordedAt: resolvedRecordedAt,
      callDate,
      callTime,
    });

    // Populate lead info for response
    const populated = await CallRecording.findById(doc._id)
      .populate('lead', 'name phone')
      .lean();

    return res.status(201).json({ success: true, recording: populated });
  } catch (err) {
    console.error('Recording upload error:', err);
    return res.status(500).json({ error: 'Failed to save recording' });
  }
});

// ─── POST /api/recordings/:id/link-lead — manually link/unlink a lead ────
router.post('/:id/link-lead', protect, async (req, res) => {
  try {
    const { leadId } = req.body;
    const update = { lead: leadId || null };

    // If unlinking and we have a phone, try auto-match again
    if (!leadId) {
      const rec = await CallRecording.findById(req.params.id).lean();
      if (rec && rec.phone) {
        const matched = await findLeadByPhone(rec.phone, req.user.workspace);
        if (matched) update.lead = matched._id;
      }
    }

    const updated = await CallRecording.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true }
    ).populate('lead', 'name phone').lean();

    if (!updated) return res.status(404).json({ error: 'Recording not found' });
    return res.json({ success: true, recording: updated });
  } catch (err) {
    console.error('link-lead error:', err);
    return res.status(500).json({ error: 'Failed to link lead' });
  }
});

// ─── POST /api/recordings/rematch — re-match all unlinked recordings ──────
router.post('/rematch', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const unlinked = await CallRecording.find({ lead: null }).lean();
    let matched = 0;
    let corrected = 0;

    for (const rec of unlinked) {
      // Re-derive phone with the current (fixed) extraction logic — this
      // corrects previously-stored bad values (e.g. an upload timestamp
      // that used to get mistaken for a phone number) and fills in phone
      // for records that never had one extracted.
      const freshPhone = extractPhoneFromFilename(rec.originalName);
      if (freshPhone !== rec.phone) {
        await CallRecording.findByIdAndUpdate(rec._id, { phone: freshPhone || null });
        corrected++;
      }

      if (freshPhone) {
        const lead = await findLeadByPhone(freshPhone, req.user.workspace);
        if (lead) {
          await CallRecording.findByIdAndUpdate(rec._id, { lead: lead._id });
          matched++;
        }
      }
    }

    return res.json({ success: true, total: unlinked.length, matched, corrected });
  } catch (err) {
    console.error('rematch error:', err);
    return res.status(500).json({ error: 'Rematch failed' });
  }
});

// ─── GET /api/recordings/my ───────────────────────────────────────────────
router.get('/my', protect, async (req, res) => {
  try {
    const recordings = await CallRecording.find({ user: req.user.id })
      .sort({ recordedAt: -1 })
      .limit(200)
      .populate('lead', 'name phone')
      .lean();

    return res.json({ recordings: recordings.map(formatRecording) });
  } catch (err) {
    console.error('getMyRecordings error:', err);
    return res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

// ─── GET /api/recordings ─────────────────────────────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'manager') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const filter = {};
    if (req.query.userId) filter.user = req.query.userId;

    const recordings = await CallRecording.find(filter)
      .sort({ recordedAt: -1 })
      .limit(500)
      .populate('user', 'name email')
      .populate('lead', 'name phone')
      .lean();

    return res.json({ recordings: recordings.map(formatRecording) });
  } catch (err) {
    console.error('getAllRecordings error:', err);
    return res.status(500).json({ error: 'Failed to fetch recordings' });
  }
});

// ─── POST /api/recordings/:id/transcribe — speech-to-text on demand ──────
// Idempotent: if a transcript already exists, returns it immediately
// instead of re-calling Whisper (saves cost). Pass { force: true } to
// re-transcribe anyway.
router.post('/:id/transcribe', protect, async (req, res) => {
  try {
    const rec = await CallRecording.findById(req.params.id);
    if (!rec) return res.status(404).json({ error: 'Recording not found' });

    if (rec.transcriptStatus === 'done' && rec.transcript && !req.body.force) {
      return res.json({ success: true, transcript: rec.transcript, cached: true });
    }

    rec.transcriptStatus = 'pending';
    await rec.save();

    try {
      const absolutePath = path.join(UPLOAD_DIR, rec.storedName);
      const transcript = await transcribeAudioFile(absolutePath, req.body.apiKey);
      rec.transcript = transcript;
      rec.transcriptStatus = 'done';
      rec.transcriptError = '';
      await rec.save();
      return res.json({ success: true, transcript, cached: false });
    } catch (sttErr) {
      rec.transcriptStatus = 'failed';
      rec.transcriptError = sttErr.message || 'Transcription failed';
      await rec.save();
      return res.status(500).json({ error: rec.transcriptError });
    }
  } catch (err) {
    console.error('transcribe error:', err);
    return res.status(500).json({ error: 'Failed to transcribe recording' });
  }
});

function formatRecording(r) {
  return {
    _id: r._id,
    recordedAt: r.recordedAt,
    callDate: r.callDate || null,
    callTime: r.callTime || null,
    url: absoluteUrl(r.url),
    size: r.size,
    mimeType: r.mimeType,
    phone: r.phone || null,
    userName: r.user && r.user.name ? r.user.name : undefined,
    leadId: r.lead ? r.lead._id : null,
    leadName: r.lead && r.lead.name ? r.lead.name : null,
    leadPhone: r.lead && r.lead.phone ? r.lead.phone : null,
    transcript: r.transcript || '',
    transcriptStatus: r.transcriptStatus || 'none',
    transcriptError: r.transcriptError || '',
    lastCallIqReport: r.lastCallIqReport && r.lastCallIqReport.runAt ? r.lastCallIqReport : null,
  };
}

function absoluteUrl(relativePath) {
  const base = process.env.BASE_URL || 'https://telecommunication-hfvm.onrender.com';
  return `${base}${relativePath}`;
}

module.exports = router;