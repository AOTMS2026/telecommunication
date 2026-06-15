const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// Multer — memory storage (no disk writes needed)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const ok = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ].includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i);
    if (!ok) return cb(new Error('Only Excel/CSV files are allowed'));
    cb(null, true);
  },
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function normaliseStatus(raw) {
  if (!raw) return 'Fresh';
  const map = {
    fresh: 'Fresh',
    connected: 'Connected',
    'call not responding': 'Call Not Responding',
    cnr: 'Call Not Responding',
    'call back later': 'Call Back Later',
    cbl: 'Call Back Later',
    'not interested': 'Not interested',
    'demo scheduled': 'Demo Scheduled',
    'demo done': 'Demo Done',
    won: 'Won',
    lost: 'Lost',
    blocked: 'Blocked',
  };
  return map[String(raw).toLowerCase().trim()] || 'Fresh';
}

function parseDate(val) {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  const dm = String(val).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dm) return new Date(`${dm[3]}-${dm[2]}-${dm[1]}`);
  const d = new Date(val);
  return isNaN(d) ? undefined : d;
}

function rowToLead(row, campaignId, callerId) {
  const g = (keys) => {
    for (const k of keys) {
      const found = Object.keys(row).find(r => r.trim().toLowerCase() === k.toLowerCase());
      if (found && row[found] !== undefined && row[found] !== null && row[found] !== '') {
        return String(row[found]).trim();
      }
    }
    return '';
  };

  const name = g(['Name', 'name', 'Lead Name', 'Full Name']);
  const phone = g(['Phone', 'phone', 'Mobile', 'mobile', 'Phone Number']);
  if (!name || !phone) return null;

  return {
    name,
    phone: String(phone).replace(/\s+/g, ''),
    alternatePhone: g(['Alternate Phone', 'alternate phone', 'Alt Phone', 'altphone']),
    email: g(['Email', 'email', 'Email ID']),
    status: normaliseStatus(g(['Status', 'status', 'Lead Status'])),
    leadSource: g(['Lead Source', 'lead source', 'Source', 'source']) || 'Excel',
    location: g(['Location', 'location', 'City', 'city']),
    budget: parseFloat(g(['Budget', 'budget'])) || 0,
    lastQualification: g(['Last Qualification', 'last qualification', 'Qualification', 'Education', 'education']),
    preferredCourses: g(['Preferred Courses', 'preferred courses', 'Courses', 'courses'])
      ? g(['Preferred Courses', 'preferred courses', 'Courses', 'courses']).split(/[,;]/).map(s => s.trim()).filter(Boolean)
      : [],
    nextFollowupDate: parseDate(g(['Next Followup Date', 'next followup date', 'Followup Date'])),
    demoScheduledDate: parseDate(g(['Demo Scheduled Date', 'demo scheduled date'])),
    demoDoneDate: parseDate(g(['Demo Done Date', 'demo done date'])),
    ...(campaignId ? { campaign: campaignId } : {}),
    ...(callerId ? { assignedTo: callerId } : {}),
  };
}

// ── POST /api/bulk-import/preview ─────────────────────────────────────────────
router.post(
  '/preview',
  protect,
  authorize('admin', 'super admin'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) return res.status(400).json({ message: 'File is empty' });

      const columns = Object.keys(rows[0]);
      const preview = rows.slice(0, 5);

      res.json({ columns, preview, totalRows: rows.length });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

// ── POST /api/bulk-import/import ──────────────────────────────────────────────
// Supports multi-caller assignment with percentage distribution
router.post(
  '/import',
  protect,
  authorize('admin', 'super admin'),
  upload.single('file'),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

      const { campaignId, skipDuplicates = 'true' } = req.body;
      const shouldSkipDups = skipDuplicates !== 'false';

      // Parse caller assignments: [{ callerId, pct }]
      let callerAssignments = [];
      try {
        callerAssignments = JSON.parse(req.body.callerAssignments || '[]');
      } catch {
        return res.status(400).json({ message: 'Invalid callerAssignments format' });
      }

      // Validate required fields
      if (!campaignId) {
        return res.status(400).json({ message: 'Campaign is required' });
      }
      if (!callerAssignments.length) {
        return res.status(400).json({ message: 'At least one caller must be assigned' });
      }

      // Validate percentages sum to 100
      const totalPct = callerAssignments.reduce((s, c) => s + (c.pct || 0), 0);
      if (totalPct !== 100) {
        return res.status(400).json({ message: `Caller percentages must total 100% (got ${totalPct}%)` });
      }

      // Validate campaign
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });

      // Validate callers
      const callerIds = callerAssignments.map(c => c.callerId);
      const validCallers = await User.find({ _id: { $in: callerIds } }).select('_id name').lean();
      if (validCallers.length !== callerIds.length) {
        return res.status(404).json({ message: 'One or more callers not found' });
      }
      const callerMap = Object.fromEntries(validCallers.map(u => [String(u._id), u.name]));

      // Parse file
      const wb = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

      if (!rows.length) return res.status(400).json({ message: 'File is empty' });

      // Build leads (no caller assigned yet)
      const leads = [];
      const errors = [];
      for (let i = 0; i < rows.length; i++) {
        const lead = rowToLead(rows[i], campaignId, null);
        if (!lead) {
          errors.push({ row: i + 2, reason: 'Missing name or phone' });
        } else {
          leads.push(lead);
        }
      }

      if (!leads.length) {
        return res.status(400).json({ message: 'No valid leads found', errors });
      }

      // Duplicate check
      const phones = leads.map(l => l.phone);
      const existingPhones = shouldSkipDups
        ? new Set((await Lead.find({ phone: { $in: phones } }).select('phone').lean()).map(l => l.phone))
        : new Set();

      const toInsert = leads.filter(l => !existingPhones.has(l.phone));
      const skippedCount = leads.length - toInsert.length;

      if (!toInsert.length) {
        return res.json({ message: 'Import complete', total: rows.length, imported: 0, skipped: skippedCount, errors, callerBreakdown: [], campaignName: campaign.name });
      }

      // Distribute leads across callers by percentage
      // Build assignment list: for each lead index, which callerId gets it
      const total = toInsert.length;
      const callerBreakdown = [];
      let startIdx = 0;

      for (let i = 0; i < callerAssignments.length; i++) {
        const { callerId, pct } = callerAssignments[i];
        // Last caller gets the remainder to avoid rounding gaps
        const count = i === callerAssignments.length - 1
          ? total - startIdx
          : Math.round((pct / 100) * total);

        const slice = toInsert.slice(startIdx, startIdx + count);
        slice.forEach(lead => { lead.assignedTo = callerId; });
        startIdx += count;

        callerBreakdown.push({ callerId, callerName: callerMap[String(callerId)] || 'Unknown', count, pct });
      }

      // Insert all leads
      const inserted = await Lead.insertMany(toInsert, { ordered: false });

      // Update campaign totalLeads
      if (inserted.length) {
        await Campaign.findByIdAndUpdate(campaignId, { $inc: { totalLeads: inserted.length } });
      }

      res.json({
        message: 'Import complete',
        total: rows.length,
        imported: inserted.length,
        skipped: skippedCount,
        errors,
        campaignName: campaign.name,
        callerBreakdown,
      });
    } catch (err) {
      console.error('Bulk import error:', err);
      res.status(500).json({ message: err.message });
    }
  }
);

// ── GET /api/bulk-import/template ─────────────────────────────────────────────
router.get('/template', protect, (req, res) => {
  const headers = [
    'Name', 'Phone', 'Alternate Phone', 'Email', 'Status', 'Lead Source',
    'Location', 'Budget', 'Last Qualification', 'Preferred Courses',
    'Next Followup Date', 'Demo Scheduled Date', 'Demo Done Date',
  ];
  const sample = [
    ['Rahul Sharma', '9876543210', '9876543211', 'rahul@example.com', 'Fresh', 'Facebook',
     'Hyderabad', '50000', 'B.Tech', 'MBA, BBA', '', '', ''],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...sample]);
  XLSX.utils.book_append_sheet(wb, ws, 'Leads');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename="leads-import-template.xlsx"');
  res.send(buf);
});

// ── POST /api/bulk-import/assign ──────────────────────────────────────────────
router.post(
  '/assign',
  protect,
  authorize('admin', 'super admin'),
  async (req, res) => {
    try {
      const { leadIds, campaignId, callerId } = req.body;
      if (!leadIds?.length) return res.status(400).json({ message: 'No leads provided' });

      const update = {};
      if (campaignId) update.campaign = campaignId;
      if (callerId) update.assignedTo = callerId;

      if (!Object.keys(update).length) {
        return res.status(400).json({ message: 'Provide campaignId or callerId' });
      }

      const result = await Lead.updateMany({ _id: { $in: leadIds } }, { $set: update });

      if (campaignId) {
        const count = await Lead.countDocuments({ campaign: campaignId });
        await Campaign.findByIdAndUpdate(campaignId, { totalLeads: count });
      }

      res.json({ message: 'Leads assigned', modified: result.modifiedCount });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  }
);

module.exports = router;