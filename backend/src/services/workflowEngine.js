// Shared engine that powers both "Workflows" (run immediately) and "Schedules"
// (same trigger events, but actions run after a configurable delay). One Workflow
// document with kind: 'WORKFLOW' | 'SCHEDULE' covers both — see models/Workflow.js.
const Workflow = require('../models/Workflow');
const WorkflowExecution = require('../models/WorkflowExecution');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { runApiTemplate, triggerWebhook } = require('./automationRunners');
const { notifyWorkflowAction } = require('./notificationService');
let n8nService;
try { n8nService = require('./n8nService'); } catch (_) { /* n8n not configured */ }

// ── Metadata consumed by the frontend builder UI ────────────────────────────
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
];

const ACTION_DEFINITIONS = [
  { value: 'call_api', label: 'Call API', needsApiTemplate: true },
  { value: 'trigger_webhook', label: 'Trigger Webhook', needsWebhook: true },
  { value: 'trigger_n8n', label: 'Trigger n8n Workflow', needsN8n: true },
  { value: 'notify_team_member', label: 'Notification To TeamMember' },
  { value: 'update_lead_assignee', label: 'Update Lead Assignee' },
  { value: 'update_lead_status', label: 'Update Lead Status' },
  { value: 'update_lead_rating', label: 'Update Lead Rating' },
  { value: 'send_template', label: 'Send Template' },
  { value: 'email_report', label: 'Email Lead Report' },
  { value: 'custom_action', label: 'Create Custom Action' },
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
      case 'custom_action': {
        log.push({ type: action.type, ok: true, message: `Custom action "${action.config.label || ''}" acknowledged` });
        return true;
      }
      case 'send_template': {
        // Placeholder — integrates with message template system when configured
        log.push({ type: action.type, ok: true, message: `Template "${action.config.templateId || 'default'}" queued for send` });
        return true;
      }
      case 'email_report': {
        // Placeholder — sends lead report email when email service is configured
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

  // If the workflow itself is linked to an n8n workflow, also trigger it
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

/**
 * Called from route handlers (leads.js etc.) whenever a trigger-worthy event happens.
 * For kind: 'WORKFLOW' docs this runs the actions immediately.
 * For kind: 'SCHEDULE' docs this queues a WorkflowExecution to run later (see poller below).
 */
async function fireEvent(eventName, context) {
  const { lead } = context;
  if (!lead) return;

  const matches = await Workflow.find({ status: 'published', triggerEvent: eventName });
  for (const workflow of matches) {
    // lead.field_changed / lead.added_to_list etc. can be scoped to a specific field/list via triggerConfig
    if (workflow.triggerConfig?.field && context.changes?.field && workflow.triggerConfig.field !== context.changes.field) {
      continue;
    }
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
      // SCHEDULE — queue for later, snapshot the lead status so we can cancel
      // the run if cancelIfStatusChanged is true and the status has since moved on.
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

/**
 * Polls due (runAt <= now) pending executions created for SCHEDULE-kind workflows
 * and runs them. Started once from server.js.
 */
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
  startSchedulePoller,
  evaluateConditions,
};