const FollowUp = require('../models/FollowUp');
const { notifyTaskReminder } = require('./notificationService');

/**
 * Periodically scans for tasks/follow-ups that are still 'upcoming' and whose
 * scheduledAt is coming up within their reminderMinutesBefore window (default
 * 30 minutes), and fires a one-time 'task_reminder' notification for each.
 * Uses reminderNotifiedAt as a guard so the same task never triggers more
 * than one reminder. Started once from server.js.
 */
function startTaskReminderChecker(intervalMs = 5 * 60 * 1000) {
  const tick = async () => {
    try {
      const now = new Date();

      // Find upcoming tasks that haven't been reminded yet and aren't overdue
      const candidates = await FollowUp.find({
        status: 'upcoming',
        scheduledAt: { $gt: now },
        reminderNotifiedAt: { $exists: false },
      })
        .limit(500)
        .populate('lead', 'name phone')
        .populate('assignedTo', 'name');

      const due = candidates.filter(f => {
        const minutesBefore = f.reminderMinutesBefore || 30;
        const reminderTime = new Date(f.scheduledAt.getTime() - minutesBefore * 60 * 1000);
        return reminderTime <= now;
      });

      for (const followup of due) {
        await notifyTaskReminder({ followup });
        followup.reminderNotifiedAt = new Date();
        await followup.save();
      }
    } catch (err) {
      console.error('[taskReminderChecker] sweep error:', err.message);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { startTaskReminderChecker };