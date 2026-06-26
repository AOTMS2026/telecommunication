// routes/recordings.js
//
// Matches the Flutter app's ApiService calls exactly:
//   POST   /api/recordings          (multipart, field "audio")  -> uploadCallRecording()
//   GET    /api/recordings/my                                   -> getMyRecordings()
//   GET    /api/recordings?userId=  (admin/super admin only)     -> getAllRecordings()
//
// Mount this in your main server file with:
//   app.use('/api/recordings', require('./routes/recordings'));
//
// Also serve the uploads folder as static files in your main server file:
//   app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const router = express.Router();
const CallRecording = require('../models/CallRecording');

// Adjust this import to match whatever auth middleware your project already
// uses elsewhere (e.g. in routes/leads.js, routes/campaigns.js, etc).
// It must set req.user = { id, role, ... } from the JWT.
const { protect } = require('../middleware/authMiddleware');

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

// ─── POST /api/recordings — upload a recording ──────────────────────────
router.post('/', protect, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file received (field name must be "audio")' });
    }

    const { leadId, recordedAt } = req.body;

    const doc = await CallRecording.create({
      user: req.user.id,
      lead: leadId || null,
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

// ─── GET /api/recordings?userId=... — admin/super admin, all employees ──
router.get('/', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.role !== 'super admin') {
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
// known render.com host — change this fallback to match your actual domain.
function absoluteUrl(relativePath) {
  const base = process.env.BASE_URL || 'https://telecommunication-hfvm.onrender.com';
  return `${base}${relativePath}`;
}

module.exports = router;