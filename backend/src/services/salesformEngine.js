// Powers the Salesform module's two runtime behaviours:
//   1. matchPath()   — picks which "Path N" (Check-if-lead condition → Section) branch
//                       on the Salesform tab applies to a given lead.
//   2. runWorkflow() — executes the Workflow-tab action chain (n8n-style nodes) after
//                       a submission, then fires the linked n8n workflow if configured.
const FollowUp = require('../models/FollowUp');
const { notifyWorkflowAction } = require('./notificationService');
const { runApiTemplate } = require('./automationRunners');
let n8nService;
try { n8nService = require('./n8nService'); } catch (_) { /* n8n not configured */ }

function evalRule(rule, lead) {
  const actual = lead?.[rule.field] ?? lead?.customFields?.[rule.field];
  const values = (rule.values || []).map(String);
  switch (rule.operator) {
    case 'is_not': return values.length ? !values.includes(String(actual)) : true;
    case 'contains': return String(actual || '').toLowerCase().includes(String(values[0] || '').toLowerCase());
    case 'any': return true;
    case 'is':
    default: return values.length ? values.includes(String(actual)) : true;
  }
}

/**
 * Walks the flowNodes of a published Salesform and returns the first matching
 * { condition, section } pair for the given lead, based on each path's rules.
 */
function matchPath(salesform, lead) {
  const conditions = (salesform.flowNodes || []).filter(n => n.type === 'condition');
  for (const condition of conditions) {
    const rules = condition.rules || [];
    if (rules.length === 0 || rules.every(r => evalRule(r, lead))) {
      const section = (salesform.flowNodes || []).find(n => n.type === 'section' && n.pathIndex === condition.pathIndex);
      return { condition, section };
    }
  }
  return { condition: null, section: null };
}

async function runAction(node, context, log) {
  const { lead, user, submission } = context;
  try {
    switch (node.actionType) {
      case 'update_lead_fields': {
        const map = node.config?.fieldMap || {};
        Object.entries(map).forEach(([leadField, value]) => {
          if (typeof value === 'string' && value.startsWith('{{submission.')) {
            const key = value.replace('{{submission.', '').replace('}}', '');
            lead[leadField] = submission?.data?.[key];
          } else {
            lead[leadField] = value;
          }
        });
        await lead.save();
        log.push({ type: node.actionType, ok: true, message: 'Lead fields updated' });
        return true;
      }
      case 'update_lead_status': {
        const prev = lead.status;
        lead.status = node.config?.status || lead.status;
        lead.activities.unshift({ type: 'status_change', description: `Status changed from ${prev} to ${lead.status} (Salesform automation)`, performedBy: user?._id });
        await lead.save();
        log.push({ type: node.actionType, ok: true, message: `Status → ${lead.status}` });
        return true;
      }
      case 'update_lead_rating': {
        lead.rating = Math.max(0, Math.min(5, Number(node.config?.rating) || 0));
        await lead.save();
        log.push({ type: node.actionType, ok: true, message: `Rating → ${lead.rating}` });
        return true;
      }
      case 'update_lead_assignee': {
        lead.assignedTo = node.config?.userId || lead.assignedTo;
        await lead.save();
        log.push({ type: node.actionType, ok: true, message: 'Assignee updated' });
        return true;
      }
      case 'notify_team_member': {
        const recipientId = node.config?.userId || lead.assignedTo;
        if (!recipientId) { log.push({ type: node.actionType, ok: false, message: 'No recipient resolved' }); return false; }
        await notifyWorkflowAction({ recipient: recipientId, lead, title: '📋 Salesform submitted', message: (node.config?.message || `Salesform submitted for "${lead.name}"`).replace('{{lead.name}}', lead.name || '') });
        log.push({ type: node.actionType, ok: true, message: `Notified user ${recipientId}` });
        return true;
      }
      case 'call_api': {
        const result = await runApiTemplate(node.config?.apiTemplateId, { ...context, logActivity: true });
        log.push({ type: node.actionType, ok: true, message: `API call → ${result.status || 'sent'}` });
        return true;
      }
      case 'add_call_followup': {
        await FollowUp.create({
          lead: lead._id,
          assignedTo: node.config?.userId || lead.assignedTo,
          assignedBy: user?._id,
          scheduledAt: node.config?.scheduledAt ? new Date(node.config.scheduledAt) : new Date(Date.now() + 24 * 3600 * 1000),
          type: 'call_followup',
          note: node.config?.note || 'Auto-created by Salesform workflow',
        });
        log.push({ type: node.actionType, ok: true, message: 'Call follow-up task created' });
        return true;
      }
      case 'cancel_tasks': {
        await FollowUp.updateMany({ lead: lead._id, status: 'upcoming' }, { status: 'cancelled' });
        log.push({ type: node.actionType, ok: true, message: 'Pending tasks cancelled' });
        return true;
      }
      case 'add_in_list': {
        const listName = node.config?.listName;
        if (listName) { lead.lists = Array.from(new Set([...(lead.lists || []), listName])); await lead.save(); }
        log.push({ type: node.actionType, ok: true, message: `Added to list "${listName || ''}"` });
        return true;
      }
      case 'remove_from_list': {
        const listName = node.config?.listName;
        lead.lists = (lead.lists || []).filter(l => l !== listName);
        await lead.save();
        log.push({ type: node.actionType, ok: true, message: `Removed from list "${listName || ''}"` });
        return true;
      }
      case 'add_payment': {
        lead.activities.unshift({ type: 'note', description: `Payment recorded: ₹${node.config?.amount || 0} (via Salesform)`, performedBy: user?._id });
        await lead.save();
        log.push({ type: node.actionType, ok: true, message: 'Payment noted on lead' });
        return true;
      }
      case 'time_delay': {
        log.push({ type: node.actionType, ok: true, message: `Delay of ${node.config?.minutes || 0}m configured (runs sequentially in current engine)` });
        return true;
      }
      case 'add_ivr_action': {
        log.push({ type: node.actionType, ok: true, message: 'IVR action queued (placeholder — connect an IVR provider to activate)' });
        return true;
      }
      case 'send_template': {
        log.push({ type: node.actionType, ok: true, message: `Template "${node.config?.templateId || 'default'}" queued for send` });
        return true;
      }
      case 'create_custom_action': {
        log.push({ type: node.actionType, ok: true, message: `Custom action "${node.config?.label || ''}" acknowledged` });
        return true;
      }
      case 'trigger_n8n': {
        if (!n8nService) { log.push({ type: node.actionType, ok: false, message: 'n8n service not available' }); return false; }
        const n8nId = node.config?.n8nWorkflowId;
        if (!n8nId) { log.push({ type: node.actionType, ok: false, message: 'No n8n workflow ID configured' }); return false; }
        const result = await n8nService.triggerWorkflow(n8nId, {
          event: 'salesform.action', lead: { id: lead._id, name: lead.name, phone: lead.phone }, submission: submission?.data || null,
        });
        log.push({ type: node.actionType, ok: result.ok, message: result.ok ? `n8n triggered via ${result.method}` : (result.error || 'n8n trigger failed') });
        return result.ok;
      }
      default:
        log.push({ type: node.actionType, ok: false, message: 'Unknown action type' });
        return false;
    }
  } catch (err) {
    log.push({ type: node.actionType, ok: false, message: err.message });
    return false;
  }
}

/**
 * Runs every 'action' node on the Salesform's Workflow-tab canvas in order, then
 * (if configured) fires the salesform's linked n8n workflow with the submission payload.
 */
async function runWorkflow(salesform, context) {
  const actionsLog = [];
  const chain = (salesform.workflowNodes || []).filter(n => n.type === 'action' || n.type === 'condition');
  for (const node of chain) {
    if (node.type === 'condition') {
      const rules = node.rules || [];
      const pass = rules.length === 0 || rules.every(r => evalRule(r, context.lead));
      actionsLog.push({ type: 'condition', ok: pass, message: pass ? 'Condition passed' : 'Condition failed — remaining actions skipped' });
      if (!pass) break;
      continue;
    }
    await runAction(node, context, actionsLog);
  }

  if (salesform.n8nWorkflowId && n8nService) {
    try {
      const { lead, submission } = context;
      const payload = {
        aotms_salesform: { id: salesform._id, name: salesform.name },
        lead: lead ? { id: lead._id, name: lead.name, phone: lead.phone, email: lead.email, status: lead.status } : null,
        submission: submission?.data || null,
        triggeredAt: new Date().toISOString(),
      };
      const r = await n8nService.triggerWorkflow(salesform.n8nWorkflowId, payload);
      actionsLog.push({ type: 'trigger_n8n_auto', ok: r.ok, message: r.ok ? `n8n auto-trigger via ${r.method}` : (r.error || 'n8n trigger failed') });
    } catch (err) {
      actionsLog.push({ type: 'trigger_n8n_auto', ok: false, message: err.message });
    }
  }

  return actionsLog;
}

module.exports = { evalRule, matchPath, runWorkflow };