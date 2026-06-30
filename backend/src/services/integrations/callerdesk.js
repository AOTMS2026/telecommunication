const axios = require('axios');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');

const CD_API = 'https://api.callerdesk.io/api/v2';

function getHeaders(integration) {
  return {
    Authorization: `Bearer ${integration.config.apiKey}`,
    'Content-Type': 'application/json',
  };
}

// Get agents
async function getAgents(integration) {
  const res = await axios.get(`${CD_API}/agents`, { headers: getHeaders(integration) });
  return res.data?.data || [];
}

// Get call logs
async function getCallLogs(integration, page = 1, limit = 50) {
  const res = await axios.get(`${CD_API}/call-logs`, {
    headers: getHeaders(integration),
    params: { page, limit },
  });
  return res.data?.data || [];
}

// Initiate outbound call
async function makeCall(integration, agentExtension, customerPhone) {
  const res = await axios.post(`${CD_API}/click-to-call`, {
    agent: agentExtension,
    customer: customerPhone,
    did: integration.config.did || integration.config.virtualNumber,
  }, { headers: getHeaders(integration) });
  return res.data;
}

// Handle CallerDesk webhook for inbound calls / CDR
async function handleCallerDeskWebhook(body, integration) {
  const { caller_number, call_type, duration, call_status, recording_url, agent_id } = body;

  if (!caller_number) return { processed: false };

  const phone = caller_number.replace(/\D/g, '').slice(-10);
  const existing = await Lead.findOne({ phone });

  if (!existing && (call_type === 'inbound' || !call_type)) {
    const lead = await Lead.create({
      name: `CallerDesk Lead - ${phone}`,
      phone,
      leadSource: 'CallerDesk',
      status: 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
      notes: [{
        content: `Inbound call via CallerDesk. Duration: ${duration || 0}s. Status: ${call_status || 'unknown'}${recording_url ? '. Recording: ' + recording_url : ''}`,
        type: 'note',
      }],
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() },
    });

    fireEvent('lead.created', { lead, user: null, changes: { source: 'callerdesk' } }).catch(() => {});
    return { created: true, leadId: lead._id };
  }

  if (existing) {
    const update = {
      $push: {
        callHistory: {
          callType: call_type || 'inbound',
          duration: parseInt(duration) || 0,
          status: call_status,
          startTime: new Date(),
          source: 'callerdesk',
          recordingUrl: recording_url || '',
        },
      },
    };
    await Lead.findByIdAndUpdate(existing._id, update);
    return { created: false, leadId: existing._id };
  }

  return { processed: false };
}

module.exports = { getAgents, getCallLogs, makeCall, handleCallerDeskWebhook };