const axios = require('axios');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');

const MQ_API = 'https://api.maqsam.com/v2';

function getHeaders(integration) {
  return {
    Authorization: `Basic ${Buffer.from(`${integration.config.apiKey}:${integration.config.apiSecret}`).toString('base64')}`,
    'Content-Type': 'application/json',
  };
}

// Get account info
async function getAccountInfo(integration) {
  const res = await axios.get(`${MQ_API}/account`, { headers: getHeaders(integration) });
  return res.data;
}

// Get agents
async function getAgents(integration) {
  const res = await axios.get(`${MQ_API}/extensions`, { headers: getHeaders(integration) });
  return res.data?.data || [];
}

// Get CDR (call logs)
async function getCallLogs(integration, startDate, endDate) {
  const res = await axios.get(`${MQ_API}/cdrs`, {
    headers: getHeaders(integration),
    params: {
      start: startDate || new Date(Date.now() - 86400000).toISOString().split('T')[0],
      end: endDate || new Date().toISOString().split('T')[0],
      limit: 100,
    },
  });
  return res.data?.data || [];
}

// Click-to-call
async function makeCall(integration, agentExtension, customerPhone) {
  const res = await axios.post(`${MQ_API}/calls/click-to-call`, {
    extension: agentExtension,
    number: customerPhone,
    did: integration.config.did,
  }, { headers: getHeaders(integration) });
  return res.data;
}

// Handle Maqsam CDR webhook
async function handleMaqsamWebhook(body, integration) {
  const { caller, direction, duration, status, recording, agent_extension } = body;

  if (!caller) return { processed: false };

  const phone = caller.replace(/\D/g, '').slice(-10);
  const existing = await Lead.findOne({ phone });

  if (!existing && direction === 'inbound') {
    const lead = await Lead.create({
      name: `Maqsam Lead - ${phone}`,
      phone,
      leadSource: 'Maqsam',
      status: 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
      notes: [{
        content: `Inbound call via Maqsam. Duration: ${duration || 0}s. Status: ${status || 'unknown'}${recording ? '. Recording: ' + recording : ''}`,
        type: 'note',
      }],
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() },
    });

    fireEvent('lead.created', { lead, user: null, changes: { source: 'maqsam' } }).catch(() => {});
    return { created: true, leadId: lead._id };
  }

  if (existing) {
    await Lead.findByIdAndUpdate(existing._id, {
      $push: {
        callHistory: {
          callType: direction || 'inbound',
          duration: parseInt(duration) || 0,
          status,
          startTime: new Date(),
          source: 'maqsam',
          recordingUrl: recording || '',
        },
      },
    });
    return { created: false, leadId: existing._id };
  }

  return { processed: false };
}

module.exports = { getAccountInfo, getAgents, getCallLogs, makeCall, handleMaqsamWebhook };