const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const mongoose = require('mongoose');
const FollowUp = require('../models/FollowUp');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { notifyAdminsTaskCreated, notifyAdminsTaskEdited, notifyAssignerTaskPendingApproval, notifyAssigneeTaskApproved, notifyAssigneeTaskRejected } = require('../services/notificationService');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// Safety cap so a bad "endDate" (e.g. years out) can't create thousands of rows
const MAX_RECURRING_OCCURRENCES = 366;

// Given a start date + frequency + endDate, build the list of scheduledAt
// dates for every occurrence (including the first one). Each occurrence
// keeps the same time-of-day as the original scheduledAt.
function buildRecurrenceDates(startDate, frequency, endDate) {
  const dates = [new Date(startDate)];
  if (frequency === 'none' || !endDate) return dates;

  const stepDays = frequency === 'daily' ? 1 : frequency === 'weekly' ? 7 : null;
  const stepMonths = frequency === 'monthly' ? 1 : null;

  let cursor = new Date(startDate);
  while (dates.length < MAX_RECURRING_OCCURRENCES) {
    const next = new Date(cursor);
    if (stepDays) next.setDate(next.getDate() + stepDays);
    else if (stepMonths) next.setMonth(next.getMonth() + stepMonths);
    else break; // unknown frequency, stop

    if (next.getTime() > new Date(endDate).getTime()) break;
    dates.push(next);
    cursor = next;
  }
  return dates;
}

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

// POST /api/followups — create a task/follow-up (optionally recurring)
router.post('/', protect, async (req, res) => {
  try {
    const { recurrence, ...body } = req.body;
    const baseDoc = {
      ...body,
      assignedTo: req.body.assignedTo || req.user._id,
      assignedBy: req.body.assignedBy || req.user._id,
    };

    const frequency = recurrence?.frequency;
    const isRecurring = frequency && frequency !== 'none' && recurrence?.endDate;

    if (!isRecurring) {
      // Plain, one-off task — unchanged behaviour
      const followup = await FollowUp.create(baseDoc);

      await followup.populate('lead', 'name phone status');
      await followup.populate('assignedTo', 'name email');
      await followup.populate('assignedBy', 'name email');

      fireAndForget(() => notifyAdminsTaskCreated({ followup, performedByUser: req.user }));

      return res.status(201).json({ followup });
    }

    // ── Recurring task: pre-generate one document per occurrence ──────────
    if (!baseDoc.scheduledAt) {
      return res.status(400).json({ message: 'scheduledAt is required to build a recurring series' });
    }
    const occurrenceDates = buildRecurrenceDates(baseDoc.scheduledAt, frequency, recurrence.endDate);
    const recurringGroupId = new mongoose.Types.ObjectId();

    const docs = occurrenceDates.map(scheduledAt => ({
      ...baseDoc,
      scheduledAt,
      recurrence: { frequency, endDate: recurrence.endDate },
      recurringGroupId,
    }));

    const created = await FollowUp.insertMany(docs);

    // Return the first occurrence (populated) so the UI can show/select it immediately;
    // the rest will simply appear on their scheduled day when the list is queried.
    const firstFollowup = await FollowUp.findById(created[0]._id)
      .populate('lead', 'name phone status')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    fireAndForget(() => notifyAdminsTaskCreated({ followup: firstFollowup, performedByUser: req.user }));

    res.status(201).json({ followup: firstFollowup, seriesCount: created.length });
  } catch (err) {
    console.error('[POST /followups]', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/followups/:id
router.put('/:id', protect, async (req, res) => {
  try {
    const existing = await FollowUp.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Follow-up not found' });

    const update = { ...req.body };

    if (update.status === 'done') {
      const assignerId = existing.assignedBy ? existing.assignedBy.toString() : null;
      const isSelfAssigned = !assignerId || assignerId === req.user._id.toString();

      if (isSelfAssigned) {
        // No one else to approve it — completing it is final, same as before.
        if (!update.completedAt) update.completedAt = new Date();
        update.completedBy = req.user._id;
      } else {
        // Someone else assigned this task — don't close it out yet. Flip it
        // to 'pending_approval' instead of 'done' until the assignedBy person
        // confirms it. This is what "notify assignedBy, hold until they
        // approve" means in practice.
        update.status = 'pending_approval';
        update.completedAt = new Date();
        update.completedBy = req.user._id;
      }
    }

    const followup = await FollowUp.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('lead', 'name phone status')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    // Notify admins when a caller edits — fire-and-forget
    fireAndForget(() => notifyAdminsTaskEdited({ followup, performedByUser: req.user }));

    // If the task just moved into pending_approval, alert the assignedBy person
    if (update.status === 'pending_approval') {
      fireAndForget(() => notifyAssignerTaskPendingApproval({ followup, performedByUser: req.user }));
    }

    res.json({ followup });
  } catch (err) {
    console.error('[PUT /followups/:id]', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/followups/:id/approve — the assignedBy person (or an admin/manager)
// confirms a completed task, finalizing its status as 'done'.
router.put('/:id/approve', protect, async (req, res) => {
  try {
    const existing = await FollowUp.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Task not found' });

    const assignerId = existing.assignedBy ? existing.assignedBy.toString() : null;
    const isAssigner = assignerId && assignerId === req.user._id.toString();
    const isAdmin = ['manager', 'admin'].includes(req.user.role);
    if (!isAssigner && !isAdmin) {
      return res.status(403).json({ message: 'Only the person who assigned this task can approve it' });
    }
    if (existing.status !== 'pending_approval') {
      return res.status(400).json({ message: 'Task is not awaiting approval' });
    }

    const followup = await FollowUp.findByIdAndUpdate(
      req.params.id,
      { status: 'done', approvedAt: new Date(), approvedBy: req.user._id },
      { new: true }
    )
      .populate('lead', 'name phone status')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    fireAndForget(() => notifyAssigneeTaskApproved({ followup, performedByUser: req.user }));

    res.json({ followup });
  } catch (err) {
    console.error('[PUT /followups/:id/approve]', err);
    res.status(500).json({ message: err.message });
  }
});

// PUT /api/followups/:id/reject — the assignedBy person (or an admin/manager)
// sends a completed task back to the assignee instead of approving it.
router.put('/:id/reject', protect, async (req, res) => {
  try {
    const existing = await FollowUp.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Task not found' });

    const assignerId = existing.assignedBy ? existing.assignedBy.toString() : null;
    const isAssigner = assignerId && assignerId === req.user._id.toString();
    const isAdmin = ['manager', 'admin'].includes(req.user.role);
    if (!isAssigner && !isAdmin) {
      return res.status(403).json({ message: 'Only the person who assigned this task can reject it' });
    }
    if (existing.status !== 'pending_approval') {
      return res.status(400).json({ message: 'Task is not awaiting approval' });
    }

    // Reopen it — 'upcoming' if still due in the future, otherwise 'late'
    const reopenStatus = new Date(existing.scheduledAt) < new Date() ? 'late' : 'upcoming';

    const followup = await FollowUp.findByIdAndUpdate(
      req.params.id,
      { status: reopenStatus, completedAt: null, completedBy: null },
      { new: true }
    )
      .populate('lead', 'name phone status')
      .populate('assignedTo', 'name email')
      .populate('assignedBy', 'name email');

    fireAndForget(() => notifyAssigneeTaskRejected({ followup, performedByUser: req.user, reason: req.body?.reason }));

    res.json({ followup });
  } catch (err) {
    console.error('[PUT /followups/:id/reject]', err);
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/followups/:id — only admin & admin allowed
// Pass ?series=true to delete every future occurrence in the same recurring
// series (past/completed occurrences in the series are left untouched).
router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const target = await FollowUp.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'Task not found' });

    if (req.query.series === 'true' && target.recurringGroupId) {
      const result = await FollowUp.deleteMany({
        recurringGroupId: target.recurringGroupId,
        scheduledAt: { $gte: target.scheduledAt },
      });
      return res.json({ message: 'Deleted series', count: result.deletedCount });
    }

    await FollowUp.findByIdAndDelete(req.params.id);
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