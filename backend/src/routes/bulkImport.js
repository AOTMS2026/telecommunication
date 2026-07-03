const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const Lead = require('../models/Lead');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const ImportHistory = require('../models/ImportHistory');
const Notification = require('../models/Notification');
const { normalizePhone10 } = require('../utils/phone');
const { protect, authorize } = require('../middleware/auth');
const { fireEvent } = require('../services/workflowEngine');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','text/csv'].includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i);
    if (!ok) return cb(new Error('Only Excel/CSV files are allowed'));
    cb(null, true);
  },
});

// ── System fields ─────────────────────────────────────────────────────────────
const SYSTEM_FIELDS = [
  { key: 'name', label: 'Name', required: true },
  { key: 'phone', label: 'Phone Number', required: true },
  { key: 'email', label: 'Email ID' },
  { key: 'collegeName', label: 'College Name' },
  { key: 'alternatePhone', label: 'Alternate Phone' },
  { key: 'status', label: 'Status' },
  { key: 'leadSource', label: 'Lead Source' },
  { key: 'location', label: 'Location' },
  { key: 'budget', label: 'Budget' },
  { key: 'lastQualification', label: 'Last Qualification' },
  { key: 'preferredCourses', label: 'Preferred Courses' },
  { key: 'nextFollowupDate', label: 'Next Followup Date' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function normaliseStatus(raw) {
  if (!raw) return 'Fresh';
  const map = {
    fresh:'Fresh',connected:'Connected','call not responding':'Call Not Responding',cnr:'Call Not Responding',
    'call back later':'Call Back Later',cbl:'Call Back Later','not interested':'Not interested',
    'demo scheduled':'Demo Scheduled','demo done':'Demo Done',won:'Won',lost:'Lost',blocked:'Blocked',
  };
  return map[String(raw).toLowerCase().trim()] || 'Fresh';
}

function parseDate(val) {
  if (!val) return undefined;
  if (val instanceof Date) return val;
  const dm = String(val).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (dm) return new Date(`${dm[3]}-${dm[2]}-${dm[1]}`);
  const d = new Date(val); return isNaN(d) ? undefined : d;
}

// ── Dynamic header detection ──────────────────────────────────────────────────
// Different colleges/teams export sheets in different shapes — sometimes the
// real column headers sit in row 1, sometimes a title row (e.g. "Students -
// Agiripalli", often a merged cell) sits above the real headers. XLSX's
// default sheet_to_json() always trusts row 1, which on the second shape
// produces useless "__EMPTY", "__EMPTY_1" columns instead of the real names
// like "Full Name", "Mobile Number", etc. This scans the first few rows,
// picks whichever one actually looks like a header row (most filled-in
// cells), and builds the row objects from there — so every sheet shape still
// resolves to its real, respective column names automatically.
function sheetToRows(ws) {
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (!raw.length) return { rows: [], columns: [] };

  const scanLimit = Math.min(raw.length, 10);
  let headerIdx = 0, bestCount = -1;
  for (let i = 0; i < scanLimit; i++) {
    const r = raw[i] || [];
    const nonEmpty = r.filter(c => String(c).trim() !== '').length;
    if (nonEmpty > bestCount) { bestCount = nonEmpty; headerIdx = i; }
  }

  const headerRow = raw[headerIdx] || [];
  const seen = {};
  const columns = headerRow.map((h, idx) => {
    let name = String(h).trim();
    if (!name) name = `Column ${idx + 1}`;
    if (seen[name]) { seen[name] += 1; name = `${name} (${seen[name]})`; } else { seen[name] = 1; }
    return name;
  });

  const rows = [];
  for (let i = headerIdx + 1; i < raw.length; i++) {
    const r = raw[i] || [];
    if (!r.some(c => String(c).trim() !== '')) continue; // skip fully blank rows
    const obj = {};
    columns.forEach((col, idx) => { obj[col] = r[idx] !== undefined ? r[idx] : ''; });
    rows.push(obj);
  }
  return { rows, columns };
}

function applyMapping(row, fieldMapping, campaignId, importId) {
  const lead = {
    name:'',phone:'',email:'',alternatePhone:'',collegeName:'',status:'Fresh',
    leadSource:'Excel',location:'',budget:0,lastQualification:'',preferredCourses:[],
    customFields:{},
    ...(campaignId ? { campaign: campaignId } : {}),
    ...(importId ? { importId } : {}),
  };
  for (const [excelCol, systemField] of Object.entries(fieldMapping)) {
    const val = row[excelCol];
    if (val === undefined || val === null || val === '') continue;
    const strVal = String(val).trim();
    if (!systemField || systemField === '__ignore__') continue;
    // custom__ prefix = user-defined "Other" field
    if (systemField.startsWith('custom__')) {
      const customKey = systemField.replace('custom__', '');
      lead.customFields[customKey] = strVal;
      continue;
    }
    switch (systemField) {
      case 'name': lead.name = strVal; break;
      case 'phone': lead.phone = normalizePhone10(strVal); break;
      case 'email': lead.email = strVal; break;
      case 'alternatePhone': lead.alternatePhone = strVal.replace(/\s+/g,''); break;
      case 'collegeName': lead.collegeName = strVal; break;
      case 'status': lead.status = normaliseStatus(strVal); break;
      case 'leadSource': lead.leadSource = strVal; break;
      case 'location': lead.location = strVal; break;
      case 'budget': lead.budget = parseFloat(strVal) || 0; break;
      case 'lastQualification': lead.lastQualification = strVal; break;
      case 'preferredCourses': lead.preferredCourses = strVal.split(/[,;]/).map(s=>s.trim()).filter(Boolean); break;
      case 'nextFollowupDate': lead.nextFollowupDate = parseDate(strVal); break;
      default: lead.customFields[systemField] = strVal;
    }
  }
  // also store unmapped columns
  for (const [col, val] of Object.entries(row)) {
    if (!(col in fieldMapping) && val !== undefined && val !== null && val !== '') {
      lead.customFields[col] = String(val).trim();
    }
  }
  return lead;
}

// ── GET /api/bulk-import/system-fields ───────────────────────────────────────
router.get('/system-fields', protect, (req, res) => res.json({ fields: SYSTEM_FIELDS }));

// ── POST /api/bulk-import/parse-file ─────────────────────────────────────────
router.post('/parse-file', protect, authorize('manager','admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const wb = XLSX.read(req.file.buffer, { type:'buffer', cellDates:true });
    const sheetNames = wb.SheetNames;
    const ws = wb.Sheets[sheetNames[0]];
    const { rows, columns } = sheetToRows(ws);
    res.json({ sheetNames, defaultSheet:sheetNames[0], columns, preview:rows.slice(0,5), totalRows:rows.length, fileName:req.file.originalname });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/bulk-import/select-sheet ───────────────────────────────────────
router.post('/select-sheet', protect, authorize('manager','admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const wb = XLSX.read(req.file.buffer, { type:'buffer', cellDates:true });
    const name = req.body.sheetName || wb.SheetNames[0];
    const ws = wb.Sheets[name];
    if (!ws) return res.status(400).json({ message: `Sheet "${name}" not found` });
    const { rows, columns } = sheetToRows(ws);
    res.json({ sheetName:name, columns, preview:rows.slice(0,5), totalRows:rows.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/bulk-import/check-duplicates ────────────────────────────────────
router.post('/check-duplicates', protect, authorize('manager','admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { sheetName, fieldMapping: rawMapping } = req.body;
    const fieldMapping = JSON.parse(rawMapping || '{}');
    const wb = XLSX.read(req.file.buffer, { type:'buffer', cellDates:true });
    const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
    const { rows } = sheetToRows(ws);
    const phoneCol = Object.keys(fieldMapping).find(k => fieldMapping[k] === 'phone');
    const phonesSeen = new Set();
    const fileDuplicates = [];
    const uniqueRows = [];
    const emptyPhoneRows = [];
    for (let i = 0; i < rows.length; i++) {
      const rawPhone = phoneCol ? normalizePhone10(rows[i][phoneCol]) : '';
      if (!rawPhone) { emptyPhoneRows.push(i+2); continue; }
      if (phonesSeen.has(rawPhone)) { fileDuplicates.push(i+2); } else { phonesSeen.add(rawPhone); uniqueRows.push({ row:i, phone:rawPhone }); }
    }
    const allPhones = uniqueRows.map(r => r.phone);
    const existingLeads = await Lead.find({ phone: { $in: allPhones } }).select('phone status name').lean();
    const existingByPhone = {};
    for (const l of existingLeads) existingByPhone[l.phone] = l;
    const crmDuplicates = uniqueRows.filter(r => existingByPhone[r.phone]);
    const crmDupByStatus = {};
    for (const r of crmDuplicates) { const st = existingByPhone[r.phone].status || 'Fresh'; crmDupByStatus[st] = (crmDupByStatus[st]||0)+1; }
    res.json({
      totalRows:rows.length, fileErrorRows:fileDuplicates.length+emptyPhoneRows.length,
      fileDuplicates:fileDuplicates.length, emptyPhoneRows:emptyPhoneRows.length,
      uniqueInFile:uniqueRows.length, crmDuplicates:crmDuplicates.length,
      crmDupByStatus, uniqueCount:uniqueRows.length-crmDuplicates.length,
    });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── POST /api/bulk-import/import ──────────────────────────────────────────────
router.post('/import', protect, authorize('manager','admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const { sheetName, fieldMapping:rawMapping, campaignId, duplicateHandling='skip', importName } = req.body;
    const fieldMapping = JSON.parse(rawMapping || '{}');
    let callerAssignments = [];
    try { callerAssignments = JSON.parse(req.body.callerAssignments || '[]'); } catch { /**/ }
    if (!campaignId) return res.status(400).json({ message: 'Campaign is required' });
    if (!callerAssignments.length) return res.status(400).json({ message: 'At least one caller must be assigned' });
    const totalPct = callerAssignments.reduce((s,c) => s+(c.pct||0), 0);
    if (totalPct !== 100) return res.status(400).json({ message: `Caller percentages must total 100% (got ${totalPct}%)` });
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
    const callerIds = callerAssignments.map(c => c.callerId);
    const validCallers = await User.find({ _id: { $in: callerIds } }).select('_id name').lean();
    if (validCallers.length !== callerIds.length) return res.status(404).json({ message: 'One or more callers not found' });
    const callerMap = Object.fromEntries(validCallers.map(u => [String(u._id), u.name]));
    const wb = XLSX.read(req.file.buffer, { type:'buffer', cellDates:true });
    const ws = wb.Sheets[sheetName || wb.SheetNames[0]];
    if (!ws) return res.status(400).json({ message: 'Sheet not found' });
    const { rows } = sheetToRows(ws);
    if (!rows.length) return res.status(400).json({ message: 'File is empty' });

    const importRecord = await ImportHistory.create({
      importName: importName || req.file.originalname,
      fileName: req.file.originalname,
      sheetName: sheetName || wb.SheetNames[0],
      uploadedBy: req.user._id,
      campaign: campaignId,
      fieldMapping,
      duplicateHandling,
      callerAssignments: callerAssignments.map(c => ({ callerId:c.callerId, callerName:callerMap[String(c.callerId)]||'Unknown', pct:c.pct, count:0 })),
      status: 'processing',
      totalRecords: rows.length,
    });

    const phoneCol = Object.keys(fieldMapping).find(k => fieldMapping[k] === 'phone');
    const phonesSeen = new Set();
    const leads = [];
    let failedCount = 0;
    for (const row of rows) {
      const lead = applyMapping(row, fieldMapping, campaignId, importRecord._id);
      if (!lead.name || !lead.phone) { failedCount++; continue; }
      if (phonesSeen.has(lead.phone)) { failedCount++; continue; }
      phonesSeen.add(lead.phone);
      leads.push(lead);
    }

    const phones = leads.map(l => l.phone);
    const existingLeads = await Lead.find({ phone: { $in: phones } }).select('phone status _id').lean();
    const existingByPhone = {};
    for (const l of existingLeads) existingByPhone[l.phone] = l;

    let toInsert = [], duplicateCount = 0;
    if (duplicateHandling === 'skip') {
      toInsert = leads.filter(l => !existingByPhone[l.phone]);
      duplicateCount = leads.length - toInsert.length;
    } else if (duplicateHandling === 'add') {
      toInsert = leads; duplicateCount = Object.keys(existingByPhone).length;
    } else if (duplicateHandling === 'reset') {
      const dupPhones = leads.filter(l => existingByPhone[l.phone]).map(l => l.phone);
      if (dupPhones.length) await Lead.deleteMany({ phone: { $in: dupPhones } });
      toInsert = leads; duplicateCount = dupPhones.length;
    }

    if (!toInsert.length) {
      await ImportHistory.findByIdAndUpdate(importRecord._id, { status:'completed', importedRecords:0, duplicateRecords:duplicateCount, failedRecords:failedCount });
      return res.json({ message:'Import complete', total:rows.length, imported:0, skipped:duplicateCount, errors:failedCount, callerBreakdown:[], campaignName:campaign.name, importId:importRecord._id });
    }

    const total = toInsert.length;
    const callerBreakdown = [];
    let startIdx = 0;
    const callerLeadCounts = {};
    for (let i = 0; i < callerAssignments.length; i++) {
      const { callerId, pct } = callerAssignments[i];
      const count = i === callerAssignments.length-1 ? total-startIdx : Math.round((pct/100)*total);
      const slice = toInsert.slice(startIdx, startIdx+count);
      slice.forEach(lead => { lead.assignedTo = callerId; });
      startIdx += count;
      callerLeadCounts[callerId] = count;
      callerBreakdown.push({ callerId, callerName:callerMap[String(callerId)]||'Unknown', count, pct });
    }

    const inserted = await Lead.insertMany(toInsert, { ordered:false });
    if (inserted.length) {
      const newCallerIds = callerBreakdown.map(cb => cb.callerId);
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { totalLeads: inserted.length },
        $addToSet: { assignedCallers: { $each: newCallerIds } },
      });
    }

    await ImportHistory.findByIdAndUpdate(importRecord._id, {
      status:'completed', importedRecords:inserted.length,
      duplicateRecords:duplicateCount, failedRecords:failedCount, callerAssignments:callerBreakdown,
    });

    // ── Send notifications to each assigned caller ────────────────────────
    const notifPromises = callerBreakdown.map(cb =>
      Notification.create({
        recipient: cb.callerId,
        type: 'lead_assigned',
        title: '📋 New Leads Assigned',
        message: `${cb.count} new lead${cb.count===1?'':'s'} assigned to you from import "${importName || req.file.originalname}" (Campaign: ${campaign.name})`,
        performedBy: req.user._id,
        data: { importId: importRecord._id, count: cb.count, campaignName: campaign.name, importName: importName || req.file.originalname },
      }).catch(() => null)
    );
    await Promise.all(notifPromises);

    // Fire workflow events for each imported lead (non-blocking)
    if (inserted.length) {
      setImmediate(() => {
        inserted.forEach(lead => {
          fireEvent('lead.created', { lead, user: req.user, changes: { source: 'excel_upload' } }).catch(() => {});
          fireEvent('lead.excel_upload', { lead, user: req.user, changes: { source: 'excel_upload' } }).catch(() => {});
        });
      });
    }

    res.json({
      message:'Import complete', total:rows.length, imported:inserted.length,
      skipped:duplicateCount, errors:failedCount, campaignName:campaign.name,
      callerBreakdown, importId:importRecord._id,
    });
  } catch (err) {
    console.error('Bulk import error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ── GET /api/bulk-import/history ─────────────────────────────────────────────
router.get('/history', protect, authorize('manager','admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page)||1, limit = parseInt(req.query.limit)||10;
    const [records, total] = await Promise.all([
      ImportHistory.find()
        .populate('uploadedBy','name').populate('campaign','name')
        .sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit).lean(),
      ImportHistory.countDocuments(),
    ]);
    res.json({ records, total, page, pages:Math.ceil(total/limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── GET /api/bulk-import/history/:id/leads ───────────────────────────────────
router.get('/history/:id/leads', protect, authorize('manager','admin'), async (req, res) => {
  try {
    const page = parseInt(req.query.page)||1, limit = parseInt(req.query.limit)||100;
    const [leads, total] = await Promise.all([
      Lead.find({ importId: req.params.id })
        .populate('assignedTo','name').populate('campaign','name')
        .sort({ createdAt:-1 }).skip((page-1)*limit).limit(limit).lean(),
      Lead.countDocuments({ importId: req.params.id }),
    ]);
    res.json({ leads, total, page, pages:Math.ceil(total/limit) });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── DELETE /api/bulk-import/history/:id ──────────────────────────────────────
// Deletes import record AND all leads from that import
router.delete('/history/:id', protect, authorize('manager','admin'), async (req, res) => {
  try {
    const [delLeads] = await Promise.all([
      Lead.deleteMany({ importId: req.params.id }),
      ImportHistory.findByIdAndDelete(req.params.id),
    ]);
    res.json({ message:'Import and leads deleted', leadsDeleted: delLeads.deletedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── PUT /api/bulk-import/history/:id ─────────────────────────────────────────
// Edit import: reassign callers / campaign
router.put('/history/:id', protect, authorize('manager','admin'), async (req, res) => {
  try {
    const { campaignId, callerAssignments } = req.body;
    const importRecord = await ImportHistory.findById(req.params.id);
    if (!importRecord) return res.status(404).json({ message: 'Import not found' });

    const updates = {};
    if (campaignId) {
      const campaign = await Campaign.findById(campaignId);
      if (!campaign) return res.status(404).json({ message: 'Campaign not found' });
      updates.campaign = campaignId;
      // Reassign all leads from this import to new campaign
      await Lead.updateMany({ importId: req.params.id }, { $set: { campaign: campaignId } });
    }

    if (callerAssignments && callerAssignments.length) {
      const callerIds = callerAssignments.map(c => c.callerId);
      const validCallers = await User.find({ _id: { $in: callerIds } }).select('_id name').lean();
      const callerMap = Object.fromEntries(validCallers.map(u => [String(u._id), u.name]));
      // Re-distribute leads
      const leads = await Lead.find({ importId: req.params.id }).select('_id').lean();
      const total = leads.length;
      let startIdx = 0;
      const newBreakdown = [];
      for (let i = 0; i < callerAssignments.length; i++) {
        const { callerId, pct } = callerAssignments[i];
        const count = i === callerAssignments.length-1 ? total-startIdx : Math.round((pct/100)*total);
        const slice = leads.slice(startIdx, startIdx+count);
        if (slice.length) {
          await Lead.updateMany({ _id: { $in: slice.map(l=>l._id) } }, { $set: { assignedTo: callerId } });
        }
        startIdx += count;
        newBreakdown.push({ callerId, callerName:callerMap[String(callerId)]||'Unknown', pct, count });
      }
      updates.callerAssignments = newBreakdown;

      // Update campaign.assignedCallers
      const targetCampaignId = campaignId || importRecord.campaign;
      if (targetCampaignId) {
        await Campaign.findByIdAndUpdate(targetCampaignId, {
          $addToSet: { assignedCallers: { $each: callerIds } },
        });
      }

      // Notify callers about reassignment
      const campaign = await Campaign.findById(targetCampaignId).select('name').lean();
      const notifPromises = newBreakdown.map(cb =>
        Notification.create({
          recipient: cb.callerId,
          type: 'lead_assigned',
          title: '📋 Leads Reassigned',
          message: `${cb.count} lead${cb.count===1?'':'s'} reassigned to you (Campaign: ${campaign?.name||''})`,
          performedBy: req.user._id,
          data: { importId: req.params.id, count: cb.count },
        }).catch(() => null)
      );
      await Promise.all(notifPromises);
    }

    const updated = await ImportHistory.findByIdAndUpdate(req.params.id, { $set: updates }, { new:true })
      .populate('campaign','name').populate('uploadedBy','name');
    res.json({ message:'Import updated', record: updated });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

// ── Legacy endpoints (preserved) ─────────────────────────────────────────────
router.post('/preview', protect, authorize('manager','admin'), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const wb = XLSX.read(req.file.buffer, { type:'buffer', cellDates:true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const { rows, columns } = sheetToRows(ws);
    if (!rows.length) return res.status(400).json({ message: 'File is empty' });
    res.json({ columns, preview:rows.slice(0,5), totalRows:rows.length });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/template', protect, (req, res) => {
  const headers = ['Name','Phone','Alternate Phone','Email','College Name','Status','Lead Source','Location','Budget','Last Qualification','Preferred Courses'];
  const sample = [['Rahul Sharma','9876543210','9876543211','rahul@example.com','NIT Warangal','Fresh','Facebook','Hyderabad','50000','B.Tech','MBA, BBA']];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers,...sample]), 'Leads');
  const buf = XLSX.write(wb, { type:'buffer', bookType:'xlsx' });
  res.setHeader('Content-Type','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition','attachment; filename="leads-import-template.xlsx"');
  res.send(buf);
});

router.post('/assign', protect, authorize('manager','admin'), async (req, res) => {
  try {
    const { leadIds, campaignId, callerId } = req.body;
    if (!leadIds?.length) return res.status(400).json({ message: 'No leads provided' });
    const update = {};
    if (campaignId) update.campaign = campaignId;
    if (callerId) update.assignedTo = callerId;
    if (!Object.keys(update).length) return res.status(400).json({ message: 'Provide campaignId or callerId' });
    const result = await Lead.updateMany({ _id: { $in: leadIds } }, { $set: update });
    if (campaignId) { const count = await Lead.countDocuments({ campaign:campaignId }); await Campaign.findByIdAndUpdate(campaignId, { totalLeads:count }); }
    res.json({ message:'Leads assigned', modified:result.modifiedCount });
  } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;