const axios = require('axios');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');

const KL_API = 'https://kpi.knowlarity.com/Basic/v1/account';

function getHeaders(integration) {
  return {
    'x-api-key': integration.config.apiKey,
    Authorization: integration.config.accessToken,
    'Content-Type': 'application/json',
  };
}

// Get call logs from Knowlarity
async function getCallLogs(integration, startDate, endDate) {
  const headers = getHeaders(integration);
  const res = await axios.get(`${KL_API}/calllog`, {
    headers,
    params: {
      start_time: startDate || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      end_time: endDate || new Date().toISOString(),
      limit: 100,
    },
  });
  return res.data?.response?.objects || [];
}

// Get agents list
async function getAgents(integration) {
  const headers = getHeaders(integration);
  const res = await axios.get(`${KL_API}/agent`, { headers });
  return res.data?.response?.objects || [];
}

// Make an outbound call via Knowlarity
async function makeCall(integration, callerPhone, customerPhone, callerId) {
  const headers = getHeaders(integration);
  const res = await axios.post(`${KL_API}/call/makecall`, {
    k_number: integration.config.virtualNumber,
    agent_number: `+91${callerPhone}`,
    customer_number: `+91${customerPhone}`,
    caller_id: callerId || integration.config.virtualNumber,
    get_call_id: true,
  }, { headers });
  return res.data;
}

// Handle Knowlarity CDR webhook — creates lead if new number
async function handleKnowlarityWebhook(body, integration) {
  const { caller_id_number, call_type, start_time, end_time, duration, status, agent_number } = body;

  if (!caller_id_number) return { processed: false };

  const phone = caller_id_number.replace(/\D/g, '').slice(-10);
  const existing = await Lead.findOne({ phone });

  if (!existing && call_type === 'inbound') {
    const lead = await Lead.create({
      name: `Knowlarity Lead - ${phone}`,
      phone,
      leadSource: 'Knowlarity',
      status: 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
      notes: [{
        content: `Inbound call via Knowlarity. Duration: ${duration}s. Status: ${status}`,
        type: 'note',
      }],
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() },
    });

    fireEvent('lead.created', { lead, user: null, changes: { source: 'knowlarity' } }).catch(() => {});
    return { created: true, leadId: lead._id };
  }

  if (existing) {
    // Log call on existing lead
    await Lead.findByIdAndUpdate(existing._id, {
      $push: {
        callHistory: {
          callType: call_type,
          duration: parseInt(duration) || 0,
          status,
          startTime: start_time ? new Date(start_time) : new Date(),
          source: 'knowlarity',
        },
      },
    });
    return { created: false, leadId: existing._id };
  }

  return { processed: false };
}

module.exports = { getCallLogs, getAgents, makeCall, handleKnowlarityWebhook };