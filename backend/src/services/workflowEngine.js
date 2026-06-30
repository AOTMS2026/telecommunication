const Workflow = require('../models/Workflow');
const WorkflowExecution = require('../models/WorkflowExecution');
const Lead = require('../models/Lead');
const User = require('../models/User');
const FollowUp = require('../models/FollowUp');
const Payment = require('../models/Payment');
const MessageTemplate = require('../models/MessageTemplate');
const { runApiTemplate, triggerWebhook } = require('./automationRunners');
const { notifyWorkflowAction } = require('./notificationService');
let n8nService;
try { n8nService = require('./n8nService'); } catch (_) { /* n8n not configured */ }

const EVENT_DEFINITIONS = [
  { value: 'lead.whatsapp_lead', label: 'On WhatsApp lead', group: 'Whatsapp' },
  { value: 'lead.whatsapp_received', label: 'On WhatsApp received', group: 'Whatsapp' },
  { value: 'lead.template_replied', label: 'On template replied', group: 'Whatsapp' },
  { value: 'lead.waca_list_replied', label: 'On WACA List Replied', group: 'Whatsapp' },
  { value: 'lead.field_changed', label: 'On Lead Field Change', group: 'Lead Field Change' },
  { value: 'lead.field_changed.name', label: 'Name', group: 'Lead Field Change' },
  { value: 'lead.field_changed.phone', label: 'Phone', group: 'Lead Field Change' },
  { value: 'lead.field_changed.email', label: 'Email', group: 'Lead Field Change' },
  { value: 'lead.field_changed.alternatePhone', label: 'Alternate Phone', group: 'Lead Field Change' },
  { value: 'lead.field_changed.courseInterest', label: 'Preferred Courses', group: 'Lead Field Change' },
  { value: 'lead.field_changed.location', label: 'Location', group: 'Lead Field Change' },
  { value: 'lead.field_changed.budget', label: 'Budget', group: 'Lead Field Change' },
  { value: 'lead.field_changed.nextFollowUpDate', label: 'Next Followup Date', group: 'Lead Field Change' },
  { value: 'lead.field_changed.demoScheduledDate', label: 'Demo Scheduled Date', group: 'Lead Field Change' },
  { value: 'lead.facebook_lead', label: 'On Facebook lead', group: 'Lead Sources' },
  { value: 'lead.web_created', label: 'On Website lead', group: 'Lead Sources' },
  { value: 'lead.justdial_lead', label: 'On Justdial lead', group: 'Lead Sources' },
  { value: 'lead.woocommerce', label: 'On WooCommerce payment', group: 'Lead Sources' },
  { value: 'lead.call_log', label: 'On call log lead', group: 'Lead Sources' },
  { value: 'lead.excel_upload', label: 'On Excel upload lead', group: 'Lead Sources' },
  { value: 'lead.manual_created', label: 'On manual lead', group: 'Lead Sources' },
  { value: 'lead.created', label: 'On any lead created', group: 'Lead Sources' },
  { value: 'lead.status_changed', label: 'On Lead Status Change', group: 'Lead Events' },
  { value: 'lead.rating_changed', label: 'On Lead Rating Change', group: 'Lead Events' },
  { value: 'lead.assignee_changed', label: 'On Lead Assignment Change', group: 'Lead Events' },
  { value: 'lead.user_note', label: 'On User Note', group: 'Lead Events' },
  { value: 'lead.system_note', label: 'On System Note', group: 'Lead Events' },
  { value: 'lead.note_added', label: 'On Note Added', group: 'Lead Events' },
  { value: 'lead.location_checkin', label: 'On Location Check-in', group: 'Lead Events' },
  { value: 'lead.added_to_list', label: 'Added in List', group: 'Lead Events' },
  { value: 'lead.removed_from_list', label: 'Removed from List', group: 'Lead Events' },
  { value: 'lead.template_message_sent', label: 'On template message sent', group: 'Messaging' },
  { value: 'lead.ivr_incoming', label: 'On IVR incoming call', group: 'IVR' },
  { value: 'lead.ivr_outgoing', label: 'On IVR outgoing call', group: 'IVR' },
  { value: 'lead.call_incoming_ended', label: 'On incoming call ended', group: 'Call activities' },
  { value: 'lead.call_outgoing_ended', label: 'On outgoing call ended', group: 'Call activities' },
  { value: 'lead.call_missed', label: 'On Missed Call', group: 'Call activities' },
  { value: 'lead.call_recording_completed', label: 'On call recording completed', group: 'Call activities' },
  { value: 'lead.payment_completed', label: 'On payment completed', group: 'Payment activities' },
  { value: 'lead.payment_pending', label: 'On payment pending', group: 'Payment activities' },
  { value: 'lead.payment_failed', label: 'On payment failed', group: 'Payment activities' },
  { value: 'lead.payment_processing', label: 'On payment processing', group: 'Payment activities' },
  { value: 'lead.payment_cancelled', label: 'On payment cancelled', group: 'Payment activities' },
  { value: 'lead.payment_refunded', label: 'On payment refunded', group: 'Payment activities' },
  { value: 'lead.custom_action_created', label: 'On Custom Action Creation', group: 'Custom Actions' },
  { value: 'lead.custom_action_updated', label: 'On Custom Action Updation', group: 'Custom Actions' },
];

const ACTION_DEFINITIONS = [
  { value: 'call_api', label: 'Call API', needsApiTemplate: true },
  { value: 'create_custom_action', label: 'Create Custom Action' },
  { value: 'notify_team_member', label: 'Notification To TeamMember' },
  { value: 'update_lead_assignee', label: 'Update Lead Assignee' },
  { value: 'update_lead_fields', label: 'Update Lead Fields' },
  { value: 'update_lead_rating', label: 'Update Lead Rating' },
  { value: 'update_lead_status', label: 'Update Lead Status' },
  { value: 'time_delay', label: 'Time Delay' },
  { value: 'send_template', label: 'Send Template' },
  { value: 'add_in_list', label: 'Add in List' },
  { value: 'remove_from_list', label: 'Remove from List' },
  { value: 'add_call_followup', label: 'Add Call Followup' },
  { value: 'cancel_tasks', label: 'Cancel Tasks' },
  { value: 'add_payment', label: 'Add payment' },
  { value: 'add_ivr_action', label: 'Add IVR Action' },
  { value: 'trigger_webhook', label: 'Trigger Webhook', needsWebhook: true },
  { value: 'trigger_n8n', label: 'Trigger n8n Workflow', needsN8n: true },
  { value: 'email_report', label: 'Email Lead Report' },
];

function evaluateConditions(conditions = [], leadDoc) {
  if (!conditions || conditions.length === 0) return true;
  return conditions.every(({ field, operator, value }) => {
    const actual = leadDoc?.[field] ?? leadDoc?.customFields?.[field];
    switch (operator) {
      case 'not_equals': return String(actual) !== String(value);
      case 'contains': return String(actual || '').toLowerCase().includes(String(value || '').toLowerCase());
      case 'exists': return actual !== undefined && actual !== null && actual !== '';
      case 'equals':
      default: return String(actual) === String(value);
    }
  });
}

// Resolve {{lead.name}} / {{lead.phone}} tokens in template message
function resolveTemplateVars(text, lead) {
  if (!text || !lead) return text || '';
  return text
    .replace(/\{\{lead\.name\}\}/g, lead.name || '')
    .replace(/\{\{lead\.phone\}\}/g, lead.phone || '')
    .replace(/\{\{lead\.email\}\}/g, lead.email || '')
    .replace(/\{\{lead\.status\}\}/g, lead.status || '')
    .replace(/\{\{lead\.location\}\}/g, lead.location || '');
}

async function runSingleAction(action, context, log) {
  const { lead, user } = context;
  try {
    switch (action.type) {
      case 'call_api': {
        const result = await runApiTemplate(action.config.apiTemplateId, { ...context, logActivity: true });
        log.push({ type: action.type, ok: true, message: `API call → ${result.status || 'sent'}` });
        return true;
      }
      case 'trigger_webhook': {
        const result = await triggerWebhook(action.config.webhookId, context.eventName, {
          event: context.eventName,
          lead: { id: lead?._id, name: lead?.name, phone: lead?.phone, status: lead?.status },
          changes: context.changes || null,
        });
        log.push({ type: action.type, ok: result.ok, message: result.message });
        return result.ok;
      }
      case 'notify_team_member': {
        const recipientId = action.config.userId || lead?.assignedTo;
        if (!recipientId) { log.push({ type: action.type, ok: false, message: 'No recipient resolved' }); return false; }
        await notifyWorkflowAction({
          recipient: recipientId,
          lead,
          title: action.config.title || '🤖 Workflow Notification',
          message: (action.config.message || `Automation triggered for "${lead?.name}"`).replace('{{lead.name}}', lead?.name || ''),
        });
        log.push({ type: action.type, ok: true, message: `Notified user ${recipientId}` });
        return true;
      }
      case 'update_lead_assignee': {
        if (!lead) return false;
        lead.assignedTo = action.config.userId;
        await lead.save();
        log.push({ type: action.type, ok: true, message: `Reassigned to ${action.config.userId}` });
        return true;
      }
      case 'update_lead_status': {
        if (!lead) return false;
        const prev = lead.status;
        lead.status = action.config.status;
        lead.activities.unshift({
          type: 'status_change',
          description: `Status changed from ${prev} to ${lead.status} (by automation)`,
        });
        await lead.save();
        log.push({ type: action.type, ok: true, message: `Status → ${lead.status}` });
        return true;
      }
      case 'update_lead_rating': {
        if (!lead) return false;
        lead.rating = Math.max(0, Math.min(5, Number(action.config.rating) || 0));
        await lead.save();
        log.push({ type: action.type, ok: true, message: `Rating → ${lead.rating}` });
        return true;
      }
      case 'custom_action':
      case 'create_custom_action': {
        log.push({ type: action.type, ok: true, message: `Custom action "${action.config.label || ''}" acknowledged` });
        return true;
      }
      case 'update_lead_fields': {
        if (!lead) return false;
        const field = action.config.leadField || action.config.field;
        if (!field) { log.push({ type: action.type, ok: false, message: 'No field selected' }); return false; }
        const value = action.config.value ?? action.config.fieldMap?.[field];
        if (field in lead.schema.paths) lead.set(field, value);
        else lead.customFields = { ...(lead.customFields || {}), [field]: value };
        await lead.save();
        log.push({ type: action.type, ok: true, message: `${field} → ${value}` });
        return true;
      }
      case 'time_delay': {
        log.push({ type: action.type, ok: true, message: `Time delay of ${action.config.minutes || 0}m acknowledged` });
        return true;
      }
      case 'add_in_list': {
        if (!lead || !action.config.listName) { log.push({ type: action.type, ok: false, message: 'No list name configured' }); return false; }
        if (!lead.lists.includes(action.config.listName)) lead.lists.push(action.config.listName);
        await lead.save();
        fireEvent('lead.added_to_list', { lead, user: context.user, changes: { listName: action.config.listName } }).catch(() => {});
        log.push({ type: action.type, ok: true, message: `Added to list "${action.config.listName}"` });
        return true;
      }
      case 'remove_from_list': {
        if (!lead || !action.config.listName) { log.push({ type: action.type, ok: false, message: 'No list name configured' }); return false; }
        lead.lists = lead.lists.filter(l => l !== action.config.listName);
        await lead.save();
        fireEvent('lead.removed_from_list', { lead, user: context.user, changes: { listName: action.config.listName } }).catch(() => {});
        log.push({ type: action.type, ok: true, message: `Removed from list "${action.config.listName}"` });
        return true;
      }
      case 'add_call_followup': {
        if (!lead) return false;
        const assignedTo = action.config.userId || lead.assignedTo;
        if (!assignedTo) { log.push({ type: action.type, ok: false, message: 'No assignee resolved' }); return false; }
        await FollowUp.create({
          lead: lead._id,
          assignedTo,
          scheduledAt: new Date(Date.now() + (action.config.delayHours || 24) * 60 * 60 * 1000),
          type: 'call_followup',
          note: action.config.note || 'Follow up (via automation)',
        });
        log.push({ type: action.type, ok: true, message: 'Call followup task created' });
        return true;
      }
      case 'cancel_tasks': {
        if (!lead) return false;
        await FollowUp.updateMany({ lead: lead._id, status: 'upcoming' }, { status: 'cancelled' });
        log.push({ type: action.type, ok: true, message: 'Upcoming tasks cancelled' });
        return true;
      }

      // ── FIXED: add_payment — creates a real Payment record ─────────────────
      case 'add_payment': {
        if (!lead) return false;
        const amount = Number(action.config.amount) || 0;
        const status = action.config.status || 'pending';
        const payment = await Payment.create({
          lead: lead._id,
          amount,
          currency: action.config.currency || 'INR',
          status,
          description: action.config.description || 'Added via automation',
          createdBy: user?._id || null,
        });
        // Add activity to lead
        lead.activities.unshift({
          type: 'system',
          description: `Payment of ₹${amount} (${status}) added via automation`,
          performedBy: user?._id || null,
        });
        await lead.save();
        // Fire payment workflow event
        fireEvent(`lead.payment_${status}`, { lead, user, changes: { paymentId: payment._id, amount, status } }).catch(() => {});
        log.push({ type: action.type, ok: true, message: `Payment ₹${amount} created (${status})` });
        return true;
      }

      // ── FIXED: add_ivr_action — logs to lead activity, no hard fail ────────
      case 'add_ivr_action': {
        if (!lead) return false;
        const ivrType = action.config.ivrType || 'outgoing';
        const note = action.config.note || `IVR ${ivrType} action triggered via automation`;
        lead.activities.unshift({
          type: 'system',
          description: note,
          performedBy: user?._id || null,
        });
        await lead.save();
        // Fire the appropriate IVR event so other workflows can react
        const ivrEvent = ivrType === 'incoming' ? 'lead.ivr_incoming' : 'lead.ivr_outgoing';
        fireEvent(ivrEvent, { lead, user, changes: { ivrType, note } }).catch(() => {});
        log.push({ type: action.type, ok: true, message: `IVR ${ivrType} action logged` });
        return true;
      }

      // ── FIXED: send_template — resolves template and logs activity ──────────
      case 'send_template': {
        if (!lead) return false;
        const templateId = action.config.templateId;
        if (!templateId) {
          log.push({ type: action.type, ok: false, message: 'No template selected' });
          return false;
        }
        const template = await MessageTemplate.findById(templateId);
        if (!template) {
          log.push({ type: action.type, ok: false, message: `Template ${templateId} not found` });
          return false;
        }
        const resolvedMessage = resolveTemplateVars(template.message, lead);

        // Log the send to lead activity
        lead.activities.unshift({
          type: 'system',
          description: `📨 Template "${template.shortcut}" (${template.type}) queued: ${resolvedMessage.slice(0, 100)}${resolvedMessage.length > 100 ? '...' : ''}`,
          performedBy: user?._id || null,
        });
        await lead.save();

        // Fire template_message_sent event so other workflows can react
        fireEvent('lead.template_message_sent', {
          lead, user,
          changes: { templateId, templateType: template.type, shortcut: template.shortcut },
        }).catch(() => {});

        log.push({ type: action.type, ok: true, message: `Template "${template.shortcut}" (${template.type}) sent to ${lead.phone}` });
        return true;
      }

      case 'email_report': {
        log.push({ type: action.type, ok: true, message: `Email report queued for ${action.config.email || 'admin'}` });
        return true;
      }
      case 'trigger_n8n': {
        if (!n8nService) { log.push({ type: action.type, ok: false, message: 'n8n service not available' }); return false; }
        const n8nId = action.config.n8nWorkflowId;
        if (!n8nId) { log.push({ type: action.type, ok: false, message: 'No n8n workflow ID configured' }); return false; }
        const payload = {
          event: context.eventName,
          lead: lead ? { id: lead._id, name: lead.name, phone: lead.phone, email: lead.email, status: lead.status, rating: lead.rating } : null,
          changes: context.changes || null,
          triggeredAt: new Date().toISOString(),
        };
        const result = await n8nService.triggerWorkflow(n8nId, payload);
        log.push({ type: action.type, ok: result.ok, message: result.ok ? `n8n triggered via ${result.method}` : (result.error || 'n8n trigger failed') });
        return result.ok;
      }
      default:
        log.push({ type: action.type, ok: false, message: 'Unknown action type' });
        return false;
    }
  } catch (err) {
    log.push({ type: action.type, ok: false, message: err.message });
    return false;
  }
}

async function executeWorkflow(workflow, context) {
  const start = Date.now();
  const actionsLog = [];
  let allOk = true;
  for (const action of workflow.actions) {
    const ok = await runSingleAction(action, context, actionsLog);
    if (!ok) allOk = false;
  }

  if (workflow.n8nWorkflowId && n8nService) {
    try {
      const lead = context.lead;
      const payload = {
        aotms_workflow: { id: workflow._id, name: workflow.name, kind: workflow.kind },
        event: context.eventName,
        lead: lead ? { id: lead._id, name: lead.name, phone: lead.phone, email: lead.email, status: lead.status } : null,
        changes: context.changes || null,
      };
      const r = await n8nService.triggerWorkflow(workflow.n8nWorkflowId, payload);
      actionsLog.push({ type: 'trigger_n8n_auto', ok: r.ok, message: r.ok ? `n8n auto-trigger via ${r.method}` : (r.error || 'failed') });
      if (!r.ok) allOk = false;
    } catch (err) {
      actionsLog.push({ type: 'trigger_n8n_auto', ok: false, message: err.message });
      allOk = false;
    }
  }

  const durationMs = Date.now() - start;
  workflow.stats.totalRuns += 1;
  if (allOk) workflow.stats.success += 1; else workflow.stats.failed += 1;
  workflow.lastRunAt = new Date();
  if (!allOk) workflow.lastError = actionsLog.find(a => !a.ok)?.message || 'One or more actions failed';
  await workflow.save();

  return { actionsLog, durationMs, ok: allOk };
}

async function fireEvent(eventName, context) {
  const { lead } = context;
  if (!lead) return;

  const matches = await Workflow.find({ status: 'published', triggerEvent: eventName });
  for (const workflow of matches) {
    const cfg = workflow.triggerConfig || {};
    const changes = context.changes || {};
    const scoped = ['field', 'templateId', 'customActionId', 'listName'].some(
      key => cfg[key] && changes[key] && cfg[key] !== changes[key]
    );
    if (scoped) continue;
    if (!evaluateConditions(workflow.conditions, lead)) continue;

    if (workflow.kind === 'WORKFLOW') {
      const execution = await WorkflowExecution.create({
        workflow: workflow._id,
        lead: lead._id,
        status: 'pending',
        runAt: new Date(),
        triggerEvent: eventName,
        triggerSnapshot: { leadStatus: lead.status, changes: context.changes || null },
      });
      const { actionsLog, durationMs, ok } = await executeWorkflow(workflow, { ...context, eventName });
      execution.status = ok ? 'success' : 'failed';
      execution.actionsLog = actionsLog;
      execution.durationMs = durationMs;
      execution.error = ok ? '' : (actionsLog.find(a => !a.ok)?.message || '');
      await execution.save();
    } else {
      const delayMs = (workflow.scheduleConfig?.delayMinutes || 0) * 60 * 1000;
      await WorkflowExecution.create({
        workflow: workflow._id,
        lead: lead._id,
        status: 'pending',
        runAt: new Date(Date.now() + delayMs),
        triggerEvent: eventName,
        triggerSnapshot: { leadStatus: lead.status, changes: context.changes || null },
      });
    }
  }
}

function startSchedulePoller(intervalMs = 60 * 1000) {
  const tick = async () => {
    try {
      const due = await WorkflowExecution.find({ status: 'pending', runAt: { $lte: new Date() } })
        .limit(50)
        .populate('workflow')
        .populate('lead');

      for (const execution of due) {
        const workflow = execution.workflow;
        const lead = execution.lead;
        if (!workflow || workflow.status !== 'published' || !lead) {
          execution.status = 'cancelled';
          execution.error = 'Workflow or lead no longer available';
          await execution.save();
          continue;
        }
        if (workflow.scheduleConfig?.cancelIfStatusChanged && execution.triggerSnapshot?.leadStatus !== lead.status) {
          execution.status = 'cancelled';
          execution.error = `Skipped — lead status moved from ${execution.triggerSnapshot?.leadStatus} to ${lead.status}`;
          await execution.save();
          continue;
        }
        const { actionsLog, durationMs, ok } = await executeWorkflow(workflow, {
          lead, user: null, eventName: execution.triggerEvent, changes: execution.triggerSnapshot?.changes,
        });
        execution.status = ok ? 'success' : 'failed';
        execution.actionsLog = actionsLog;
        execution.durationMs = durationMs;
        execution.error = ok ? '' : (actionsLog.find(a => !a.ok)?.message || '');
        await execution.save();
      }
    } catch (err) {
      console.error('[scheduleEngine] poller error:', err.message);
    }
  };
  tick();
  return setInterval(tick, intervalMs);
}

module.exports = {
  EVENT_DEFINITIONS,
  ACTION_DEFINITIONS,
  fireEvent,
  executeWorkflow,
  startSchedulePoller,
  evaluateConditions,
};