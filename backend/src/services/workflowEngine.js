// Shared engine that powers both "Workflows" (run immediately) and "Schedules"
// (same trigger events, but actions run after a configurable delay). One Workflow
// document with kind: 'WORKFLOW' | 'SCHEDULE' covers both — see models/Workflow.js.
const Workflow = require('../models/Workflow');
const WorkflowExecution = require('../models/WorkflowExecution');
const Lead = require('../models/Lead');
const User = require('../models/User');
const { runApiTemplate, triggerWebhook } = require('./automationRunners');
const { notifyWorkflowAction } = require('./notificationService');

// ── Metadata consumed by the frontend builder UI ────────────────────────────
const EVENT_DEFINITIONS = [
  { value: 'lead.assignee_changed', label: 'Lead Assignee Change', group: 'Events' },
  { value: 'lead.field_changed', label: 'Lead Field Change', group: 'Events' },
  { value: 'lead.rating_changed', label: 'Lead Rating Change', group: 'Events' },
  { value: 'lead.status_changed', label: 'Lead Status Change', group: 'Events' },
  { value: 'lead.added_to_list', label: 'Added in List', group: 'Events' },
  { value: 'lead.removed_from_list', label: 'Removed from List', group: 'Events' },
];

const ACTION_DEFINITIONS = [
  { value: 'call_api', label: 'Call API', needsApiTemplate: true },
  { value: 'trigger_webhook', label: 'Trigger Webhook', needsWebhook: true },
  { value: 'notify_team_member', label: 'Notification To TeamMember' },
  { value: 'update_lead_assignee', label: 'Update Lead Assignee' },
  { value: 'update_lead_status', label: 'Update Lead Status' },
  { value: 'update_lead_rating', label: 'Update Lead Rating' },
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
        const result = await runApiTemplate(action.config.apiTemplateId, context);
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
        // Placeholder hook point for bespoke logic — logged but performs no side effects yet.
        log.push({ type: action.type, ok: true, message: `Custom action "${action.config.label || ''}" acknowledged` });
        return true;
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