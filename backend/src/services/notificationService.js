const Notification = require('../models/Notification');
const User = require('../models/User');

/**
 * Create a notification for a user
 */
async function createNotification({ recipient, type, title, message, lead, performedBy, data = {} }) {
  try {
    if (!recipient) return null;
    const notif = await Notification.create({ recipient, type, title, message, lead, performedBy, data });
    return notif;
  } catch (err) {
    console.error('Failed to create notification:', err.message);
    return null;
  }
}

/**
 * Notify caller when a lead is assigned to them
 */
async function notifyLeadAssigned({ lead, assignedToId, performedBy }) {
  return createNotification({
    recipient: assignedToId,
    type: 'lead_assigned',
    title: '📋 New Lead Assigned',
    message: `You have been assigned lead: ${lead.name} (${lead.phone})`,
    lead: lead._id,
    performedBy,
    data: { leadName: lead.name, leadPhone: lead.phone },
  });
}

/**
 * Notify caller when lead status changes (done by admin)
 */
async function notifyLeadStatusChanged({ lead, prevStatus, newStatus, assignedToId, performedByUser }) {
  if (!assignedToId) return null;
  if (performedByUser?._id?.toString() === assignedToId?.toString()) return null;

  return createNotification({
    recipient: assignedToId,
    type: 'lead_status_changed',
    title: '🔄 Lead Status Updated',
    message: `"${lead.name}" status changed from ${prevStatus} → ${newStatus} by ${performedByUser?.name || 'Admin'}`,
    lead: lead._id,
    performedBy: performedByUser?._id,
    data: { leadName: lead.name, prevStatus, newStatus },
  });
}

/**
 * Notify caller when admin updates lead info
 */
async function notifyLeadUpdated({ lead, assignedToId, performedByUser, changedFields = [] }) {
  if (!assignedToId) return null;
  if (performedByUser?._id?.toString() === assignedToId?.toString()) return null;

  const fieldStr = changedFields.length > 0 ? changedFields.join(', ') : 'details';
  return createNotification({
    recipient: assignedToId,
    type: 'lead_updated',
    title: '✏️ Lead Updated',
    message: `"${lead.name}" was updated (${fieldStr}) by ${performedByUser?.name || 'Admin'}`,
    lead: lead._id,
    performedBy: performedByUser?._id,
    data: { leadName: lead.name, changedFields },
  });
}

/**
 * Notify caller when a new lead is created and assigned to them
 */
async function notifyNewLeadCreated({ lead, assignedToId, performedByUser }) {
  if (!assignedToId) return null;
  if (performedByUser?._id?.toString() === assignedToId?.toString()) return null;

  return createNotification({
    recipient: assignedToId,
    type: 'new_lead',
    title: '🆕 New Lead Created',
    message: `New lead "${lead.name}" (${lead.phone}) created and assigned to you by ${performedByUser?.name || 'Admin'}`,
    lead: lead._id,
    performedBy: performedByUser?._id,
    data: { leadName: lead.name, leadPhone: lead.phone },
  });
}

/**
 * Notify caller when call is initiated via push
 */
async function notifyCallInitiated({ lead, callerId, performedByUser }) {
  return createNotification({
    recipient: callerId,
    type: 'call_initiated',
    title: '📞 Call Initiated',
    message: `${performedByUser?.name || 'Admin'} sent a call request for "${lead.name}" (${lead.phone})`,
    lead: lead._id,
    performedBy: performedByUser?._id,
    data: { leadName: lead.name, leadPhone: lead.phone },
  });
}

/**
 * Notify all Admin & Super Admin users whenever ANY task / follow-up is created —
 * whether by a caller or by another admin. The creator themself is skipped.
 * Also notify the assigned caller if they're not the creator.
 */
async function notifyAdminsTaskCreated({ followup, performedByUser }) {
  try {
    const admins = await User.find({ role: { $in: ['manager', 'admin'] } }).select('_id');
    const adminRecipients = admins
      .map(a => a._id)
      .filter(id => id.toString() !== performedByUser?._id?.toString());

    const isTodo = followup.type === 'todo';
    const taskLabel = isTodo ? 'To-do task' : 'Call follow-up';
    const noteSnippet = followup.note ? `: "${followup.note.slice(0, 80)}"` : '';
    const leadSuffix = followup.lead?.name ? ` for lead ${followup.lead.name}` : '';

    const notifications = [];

    // Notify admins/admins
    if (adminRecipients.length > 0) {
      const adminNotifs = adminRecipients.map(recipient => createNotification({
        recipient,
        type: 'task_created',
        title: isTodo ? '🗒️ New To-do Task Created' : '📞 New Call Follow-up Created',
        message: `${performedByUser?.name || 'Someone'} created a ${taskLabel.toLowerCase()}${leadSuffix}${noteSnippet}`,
        lead: followup.lead?._id || followup.lead,
        performedBy: performedByUser?._id,
        data: { followupId: followup._id, taskType: followup.type },
      }));
      notifications.push(...adminNotifs);
    }

    // Notify the assigned caller if they are NOT the one creating the task
    const assignedToId = followup.assignedTo?._id || followup.assignedTo;
    if (
      assignedToId &&
      assignedToId.toString() !== performedByUser?._id?.toString()
    ) {
      // Check that the assigned user is a caller (not an admin who would already be notified)
      const assignedUser = await User.findById(assignedToId).select('role');
      if (assignedUser && assignedUser.role === 'caller') {
        notifications.push(createNotification({
          recipient: assignedToId,
          type: 'task_assigned',
          title: isTodo ? '🗒️ New Task Assigned to You' : '📞 New Call Follow-up Assigned to You',
          message: `${performedByUser?.name || 'Admin'} assigned you a ${taskLabel.toLowerCase()}${leadSuffix}${noteSnippet}`,
          lead: followup.lead?._id || followup.lead,
          performedBy: performedByUser?._id,
          data: { followupId: followup._id, taskType: followup.type },
        }));
      }
    }

    return Promise.all(notifications);
  } catch (err) {
    console.error('Failed to notify admins of new task:', err.message);
    return [];
  }
}

/**
 * Notify all Admin & Super Admin users when a caller edits a task.
 */
async function notifyAdminsTaskEdited({ followup, performedByUser }) {
  try {
    // Only send this notification when the editor is a caller
    if (!performedByUser || !['caller'].includes(performedByUser.role)) return [];

    const admins = await User.find({ role: { $in: ['manager', 'admin'] } }).select('_id');
    const recipients = admins.map(a => a._id);

    if (recipients.length === 0) return [];

    const isTodo = followup.type === 'todo';
    const taskLabel = isTodo ? 'to-do task' : 'call follow-up';
    const leadSuffix = followup.lead?.name ? ` for lead ${followup.lead.name}` : '';

    return Promise.all(recipients.map(recipient => createNotification({
      recipient,
      type: 'task_edited',
      title: '✏️ Task Edited by Caller',
      message: `${performedByUser.name} edited a ${taskLabel}${leadSuffix}`,
      lead: followup.lead?._id || followup.lead,
      performedBy: performedByUser._id,
      data: { followupId: followup._id, taskType: followup.type },
    })));
  } catch (err) {
    console.error('Failed to notify admins of task edit:', err.message);
    return [];
  }
}

/**
 * Generic notification emitted by a workflow/automation "Notify Team Member" action.
 */
async function notifyWorkflowAction({ recipient, lead, title, message }) {
  if (!recipient) return null;
  return createNotification({
    recipient,
    type: 'workflow_action',
    title: title || '🤖 Workflow Notification',
    message: message || 'An automation ran for one of your leads',
    lead: lead?._id || lead,
    data: { leadName: lead?.name },
  });
}

/**
 * Notify the assignee (and admins, if someone else is the assignee) that a
 * task/follow-up has gone past its scheduled time without being completed.
 * Called by the overdue-task sweep in server.js — never called directly
 * from request handlers.
 */
async function notifyTaskOverdue({ followup }) {
  try {
    const isTodo = followup.type === 'todo';
    const taskLabel = isTodo ? 'To-do task' : 'Call follow-up';
    const leadSuffix = followup.lead?.name ? ` for lead ${followup.lead.name}` : '';
    const noteSnippet = followup.note ? `: "${followup.note.slice(0, 80)}"` : (followup.title ? `: "${followup.title.slice(0, 80)}"` : '');

    const recipients = new Set();
    if (followup.assignedTo) recipients.add(followup.assignedTo._id?.toString() || followup.assignedTo.toString());

    const admins = await User.find({ role: { $in: ['manager', 'admin'] } }).select('_id');
    admins.forEach(a => recipients.add(a._id.toString()));

    return Promise.all([...recipients].map(recipient => createNotification({
      recipient,
      type: 'task_overdue',
      title: '⏰ Task Overdue',
      message: `${taskLabel}${leadSuffix}${noteSnippet} is now overdue`,
      lead: followup.lead?._id || followup.lead,
      data: { followupId: followup._id, taskType: followup.type, scheduledAt: followup.scheduledAt },
    })));
  } catch (err) {
    console.error('Failed to notify task overdue:', err.message);
    return [];
  }
}

/**
 * Notify the assignee that a task/follow-up is coming up soon (before it's
 * due), so they get a heads-up rather than only finding out once it's late.
 * Called by the reminder sweep in server.js — never called directly from
 * request handlers.
 */
async function notifyTaskReminder({ followup }) {
  try {
    const isTodo = followup.type === 'todo';
    const taskLabel = isTodo ? 'To-do task' : 'Call follow-up';
    const leadSuffix = followup.lead?.name ? ` for lead ${followup.lead.name}` : '';
    const noteSnippet = followup.note ? `: "${followup.note.slice(0, 80)}"` : (followup.title ? `: "${followup.title.slice(0, 80)}"` : '');

    const recipientId = followup.assignedTo?._id || followup.assignedTo;
    if (!recipientId) return null;

    return createNotification({
      recipient: recipientId,
      type: 'task_reminder',
      title: '🔔 Task Due Soon',
      message: `${taskLabel}${leadSuffix}${noteSnippet} is due soon`,
      lead: followup.lead?._id || followup.lead,
      data: { followupId: followup._id, taskType: followup.type, scheduledAt: followup.scheduledAt },
    });
  } catch (err) {
    console.error('Failed to notify task reminder:', err.message);
    return null;
  }
}

module.exports = {
  createNotification,
  notifyWorkflowAction,
  notifyLeadAssigned,
  notifyLeadStatusChanged,
  notifyLeadUpdated,
  notifyNewLeadCreated,
  notifyCallInitiated,
  notifyAdminsTaskCreated,
  notifyAdminsTaskEdited,
  notifyTaskOverdue,
  notifyTaskReminder,
};