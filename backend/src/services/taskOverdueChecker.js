const FollowUp = require('../models/FollowUp');
const { notifyTaskOverdue } = require('./notificationService');

/**
 * Periodically scans for tasks/follow-ups that are still 'upcoming' but whose
 * scheduledAt has already passed, and fires a one-time 'task_overdue'
 * notification for each. Uses overdueNotifiedAt as a guard so the same task
 * never triggers more than one overdue alert. Started once from server.js.
 */
function startOverdueTaskChecker(intervalMs = 5 * 60 * 1000) {
  const tick = async () => {
    try {
      const overdue = await FollowUp.find({
        status: 'upcoming',
        scheduledAt: { $lt: new Date() },
        overdueNotifiedAt: { $exists: false },
      })
        .limit(200)
        .populate('lead', 'name phone')
        .populate('assignedTo', 'name');

      for (const followup of overdue) {
        await notifyTaskOverdue({ followup });
        followup.overdueNotifiedAt = new Date();
        await followup.save();
      }
    } catch (err) {
      console.error('[taskOverdueChecker] sweep error:', err.message);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = { startOverdueTaskChecker };