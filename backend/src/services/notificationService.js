const Notification = require('../models/Notification');

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
  // Don't notify if the caller changed it themselves
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

module.exports = {
  createNotification,
  notifyLeadAssigned,
  notifyLeadStatusChanged,
  notifyLeadUpdated,
  notifyNewLeadCreated,
  notifyCallInitiated,
};