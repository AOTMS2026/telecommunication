const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { notifyAdminsTaskCreated, notifyAdminsTaskEdited } = require('../services/notificationService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Safe fire-and-forget wrapper — notification failures must NEVER break the main response
function fireAndForget(fn) {
  try {
    Promise.resolve(fn()).catch(err =>
      console.error('[notification] fire-and-forget error:', err.message)
    );
  } catch (err) {
    console.error('[notification] sync error:', err.message);
  }
}

// GET /api/followups
router.get('/', protect, async (req, res) => {
  try {
    const { status, date, due: dueQuery, callerId, type, forMe: forMeQuery, leadId } = req.query;
    const query = {};

    // 0. Lead filter (for lead profile page)
    if (leadId) {
      query.lead = leadId;
    }

    // 1. assignedTo filtering (Me vs Team)
    const forMe = forMeQuery === 'true';
    const forTeam = forMeQuery === 'false';

    if (forMe) {
      query.assignedTo = req.user._id;
    } else if (forTeam) {
      // Team view: callers only see their own; admins/admins see all
      if (req.user.role === 'caller') {
        query.assignedTo = req.user._id;
      }
      // else: no assignedTo filter → returns all tasks
      if (callerId && callerId !== 'all') {
        query.assignedTo = callerId;
      }
    } else {
      // No forMe param at all
      if (req.user.role === 'caller') {
        query.assignedTo = req.user._id;
      }
    }

    // 2. Type filtering
    if (type) {
      if (type === 'todo') query.type = 'todo';
      else if (type === 'call' || type === 'call_followup') query.type = 'call_followup';
    }

    // 3. Status filtering
    if (status) {
      const statuses = status.split(',').map(s => s.trim() === 'pending' ? 'upcoming' : s.trim());
      query.status = { $in: statuses };
    }

    // 4. Date / Due filtering
    const due = dueQuery || date;
    if (due) {
      if (due === 'today') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setHours(23, 59, 59, 999);
        query.scheduledAt = { $gte: start, $lte: end };
      } else if (due === 'tomorrow') {
        const start = new Date(); start.setDate(start.getDate() + 1); start.setHours(0, 0, 0, 0);
        const end = new Date(); end.setDate(end.getDate() + 1); end.setHours(23, 59, 59, 999);
        query.scheduledAt = { $gte: start, $lte: end };
      } else if (due === 'this_week') {
        const start = new Date();
        const day = start.getDay();
        const startOfWeek = new Date(start);
        startOfWeek.setDate(start.getDate() - day);
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        query.scheduledAt = { $gte: startOfWeek, $lte: endOfWeek };
      } else if (due === 'overdue') {
        query.scheduledAt = { $lt: new Date() };
      } else if (due === 'upcoming') {
        const start = new Date(); start.setHours(0, 0, 0, 0);
        query.scheduledAt = { $gte: start };
      }
    }

    const followups = await FollowUp.find(query)
      .populate('lead', 'name phone status')
      .populate('assignedTo', 'name avatar')
      .populate('assignedBy', 'name avatar')
      .sort({ scheduledAt: 1 });

    res.json({ followups });
  } catch (err) {
    console.error('[GET /followups]', err);
    res.status(500).json({ message: err.message });
  }
});

// Enforce who a given user is allowed to assign a task to:
// - admin (super admin): anyone
// - manager: callers, or themselves
// - caller: themselves only
async function canAssignTo(actor, assigneeId) {
  if (!assigneeId) return true; // falls back to actor as assignee
  if (actor.role === 'admin') return true;
  if (assigneeId.toString() === actor._id.toString()) return true;
  if (actor.role === 'manager') {
    const User = require('../models/User');
    const assignee = await User.findById(assigneeId).select('role');
    return assignee?.role === 'caller';
  }
  return false; // callers can only assign to themselves
}

// POST /api/followups — create a task/follow-up
router.post('/', protect, async (req, res) => {
  try {
    if (req.body.assignedTo && !(await canAssignTo(req.user, req.body.assignedTo))) {
      return res.status(403).json({ message: 'You are not allowed to assign tasks to this user' });
    }

    const followup = await FollowUp.create({
      ...req.body,
      assignedTo: req.body.assignedTo || req.user._id,
      assignedBy: req.body.assignedBy || req.user._id,
    });

    await followup.populate('lead', 'name phone status');
    await followup.populate('assignedTo', 'name email');
    await followup.populate('assignedBy', 'name email');

    // Fire-and-forget: notification failures must NOT affect the 201 response
    fireAndForget(() => notifyAdminsTaskCreated({ followup, performedByUser: req.user }));

    res.status(201).json({ followup });
  } catch (err) {
    console.error('[POST /followups]', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/followups/:id
router.put('/:id', protect, async (req, res) => {
  try {
    if (req.body.assignedTo && !(await canAssignTo(req.user, req.body.assignedTo))) {
      return res.status(403).json({ message: 'You are not allowed to assign tasks to this user' });
    }

    const existing = await FollowUp.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Follow-up not found' });

    // Callers never get edit rights on a task's details — view only. The one
    // exception is marking it complete, which is a status-only update.
    if (req.user.role === 'caller') {
      const bodyKeys = Object.keys(req.body).filter(k => k !== 'completedAt');
      const isStatusOnlyUpdate = bodyKeys.length === 1 && bodyKeys[0] === 'status' && req.body.status === 'done';
      if (!isStatusOnlyUpdate) {
        return res.status(403).json({ message: 'You can only view this task. You may still mark it complete.' });
      }
    }

    const update = { ...req.body };
    if (update.status === 'done' && !update.completedAt) {
      update.completedAt = new Date();
    }
    const followup = await FollowUp.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('lead', 'name phone status')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    if (!followup) return res.status(404).json({ message: 'Follow-up not found' });

    // Notify admins when a caller edits — fire-and-forget
    fireAndForget(() => notifyAdminsTaskEdited({ followup, performedByUser: req.user }));

    res.json({ followup });
  } catch (err) {
    console.error('[PUT /followups/:id]', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/followups/:id — only admin & admin allowed
router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const deleted = await FollowUp.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Task not found' });
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('[DELETE /followups/:id]', err);
    res.status(500).json({ message: err.message });
  }
});

// POST /api/followups/import — bulk import from Excel/CSV
router.post('/import', protect, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet);

    if (rows.length === 0) {
      return res.status(400).json({ message: 'Excel/CSV file is empty' });
    }

    let created = 0;
    for (const row of rows) {
      try {
        const normalizedRow = {};
        Object.keys(row).forEach(k => {
          normalizedRow[k.trim().toLowerCase()] = row[k];
        });

        const note = normalizedRow.note || normalizedRow.description || normalizedRow.task || '';
        const scheduledAtStr = normalizedRow.date || normalizedRow.scheduledat || normalizedRow.due_date || normalizedRow.duedate;

        let scheduledAt = new Date();
        if (scheduledAtStr) {
          const parsedDate = new Date(scheduledAtStr);
          if (!isNaN(parsedDate.getTime())) {
            scheduledAt = parsedDate;
          }
        }

        const priority = (normalizedRow.priority || 'medium').trim().toLowerCase();
        const type = (normalizedRow.type || 'call_followup').trim().toLowerCase();

        let leadId = undefined;
        const leadPhone = normalizedRow.phone || normalizedRow.lead_phone;
        if (leadPhone) {
          const lead = await Lead.findOne({ phone: String(leadPhone).trim() });
          if (lead) leadId = lead._id;
        }

        let finalType = ['call_followup', 'todo'].includes(type) ? type : 'call_followup';
        if (finalType === 'call_followup' && !leadId) {
          finalType = 'todo';
        }

        await FollowUp.create({
          lead: leadId,
          note,
          scheduledAt,
          priority: ['low', 'medium', 'high'].includes(priority) ? priority : 'medium',
          type: finalType,
          assignedTo: req.user._id,
          assignedBy: req.user._id,
        });
        created++;
      } catch (rowError) {
        console.error('Error importing bulk row:', row, rowError.message);
      }
    }

    res.json({ message: 'Import completed successfully', count: created, total: rows.length });
  } catch (err) {
    console.error('[POST /followups/import]', err);
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;