// routes/recordings.js
//
// Matches the Flutter app's ApiService calls exactly:
//   POST   /api/recordings           (multipart, field "audio")  -> uploadCallRecording()
//   GET    /api/recordings/my                                    -> getMyRecordings()
//   GET    /api/recordings?userId=   (admin/manager only)         -> getAllRecordings()
//   GET    /api/recordings?phone=    (any authenticated user)     -> getRecordingsForLead()
//
// Mounted in server.js:
//   app.use('/api/recordings', apiLimiter, require('./routes/recordings'));
// Static file serving added in server.js:
//   app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
//
// NOTE: files are written to local disk. On Render's free/web-service tier
// this disk is NOT persistent — it's wiped on every redeploy/restart. Fine
// for getting the feature working now; move UPLOAD_DIR to S3/Cloudinary (or
// add a paid Render Disk) before relying on this for real call recordings.

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();
const CallRecording = require('../models/CallRecording');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');

// ─── Storage setup ───────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'recordings');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB per recording — adjust if needed
  fileFilter: (req, file, cb) => {
    const allowed = /\.(m4a|amr|mp3|wav|3gp|3gpp|aac|ogg)$/i;
    if (allowed.test(file.originalname)) cb(null, true);
    else cb(new Error('Unsupported audio file type'));
  },
});

// Keep just the last 10 digits so country-code prefixes (e.g. "91...")
// don't break matching against however the lead's number is stored.
function last10(p) {
  return (p || '').replace(/\D/g, '').slice(-10);
}

// ─── POST /api/recordings — upload a recording ──────────────────────────
router.post('/', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file received (field name must be "audio")' });
    }

    const { recordedAt } = req.body;
    let { leadId, phone } = req.body;
    const digits = last10(phone);

    // No explicit leadId? Try to auto-link via phone number.
    if (!leadId && digits) {
      const match = await Lead.findOne({ phone: { $regex: digits + '$' } }).select('_id').lean();
      if (match) leadId = match._id;
    }

    const doc = await CallRecording.create({
      user: req.user.id,
      lead: leadId || null,
      phone: digits || null,
      originalName: req.file.originalname,
      storedName: req.file.filename,
      filePath: `recordings/${req.file.filename}`,
      url: `/uploads/recordings/${req.file.filename}`,
      size: req.file.size,
      mimeType: req.file.mimetype || 'audio/mpeg',
      recordedAt: recordedAt ? new Date(recordedAt) : new Date(),
    });

    return res.status(201).json({ success: true, recording: doc });
  } catch (err) {
    console.error('Recording upload error:', err);
    return res.status(500).json({ error: 'Failed to save recording' });
  }
});

// ─── GET /api/recordings/my — current user's own recordings ─────────────
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

// ─── GET /api/recordings?phone=  OR  ?userId=  ───────────────────────────
router.get('/', protect, async (req, res) => {
  try {
    // Phone lookup powers the lead-panel recordings list. Open to any
    // logged-in user — lead access itself is already gated elsewhere.
    if (req.query.phone) {
      const digits = last10(req.query.phone);
      const matchingLeads = await Lead.find({ phone: { $regex: digits + '$' } }).select('_id').lean();
      const leadIds = matchingLeads.map((l) => l._id);

      const recordings = await CallRecording.find({
        $or: [{ phone: digits }, { lead: { $in: leadIds } }],
      })
        .sort({ recordedAt: -1 })
        .limit(200)
        .populate('user', 'name email')
        .populate('lead', 'name phone')
        .lean();

      return res.json({ recordings: recordings.map(formatRecording) });
    }

    // Otherwise: admin/manager viewing across employees.
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

// ─── Helper: shape each doc the way the Flutter UI expects ───────────────
// CallRecordingsScreen reads: recordedAt, url, userName/agentName
function formatRecording(r) {
  return {
    _id: r._id,
    recordedAt: r.recordedAt,
    url: absoluteUrl(r.url),
    size: r.size,
    mimeType: r.mimeType,
    userName: r.user && r.user.name ? r.user.name : undefined,
    leadName: r.lead && r.lead.name ? r.lead.name : undefined,
    leadPhone: r.lead && r.lead.phone ? r.lead.phone : undefined,
  };
}

// Turns "/uploads/recordings/x.m4a" into a full URL the phone can play
// directly. Uses BASE_URL env var if set, otherwise falls back to your
// known render.com host.
function absoluteUrl(relativePath) {
  const base = process.env.BASE_URL || 'https://telecommunication-hfvm.onrender.com';
  return `${base}${relativePath}`;
}

module.exports = router;
