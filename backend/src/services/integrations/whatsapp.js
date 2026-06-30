const axios = require('axios');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');
const { broadcastWebhooks } = require('../automationRunners');

const WA_API = 'https://graph.facebook.com/v19.0';

// Send a WhatsApp text message
async function sendTextMessage(phoneNumberId, accessToken, to, text) {
  const res = await axios.post(`${WA_API}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    recipient_type: 'individual',
    to,
    type: 'text',
    text: { preview_url: false, body: text },
  }, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  return res.data;
}

// Send a WhatsApp template message
async function sendTemplateMessage(phoneNumberId, accessToken, to, templateName, languageCode = 'en_US', components = []) {
  const res = await axios.post(`${WA_API}/${phoneNumberId}/messages`, {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: { name: templateName, language: { code: languageCode }, components },
  }, {
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  return res.data;
}

// Get phone number details
async function getPhoneNumberDetails(phoneNumberId, accessToken) {
  const res = await axios.get(`${WA_API}/${phoneNumberId}`, {
    params: { fields: 'verified_name,display_phone_number,status,quality_rating', access_token: accessToken },
  });
  return res.data;
}

// Get message templates
async function getTemplates(wabaId, accessToken) {
  const res = await axios.get(`${WA_API}/${wabaId}/message_templates`, {
    params: { access_token: accessToken, fields: 'name,status,language,category,components', limit: 100 },
  });
  return res.data.data || [];
}

// Handle incoming WhatsApp webhook event
async function handleWhatsAppWebhookEvent(body, integration) {
  const entry = body.entry?.[0];
  const changes = entry?.changes?.[0];
  const value = changes?.value;

  if (!value || !value.messages) return { processed: false };

  const msg = value.messages[0];
  const contact = value.contacts?.[0];

  const phone = msg.from; // WhatsApp number
  const name = contact?.profile?.name || 'WhatsApp Lead';
  const text = msg.text?.body || '';
  const msgType = msg.type;

  // Create lead if not exists
  const existing = await Lead.findOne({ phone });

  if (!existing) {
    const lead = await Lead.create({
      name,
      phone,
      leadSource: 'Whatsapp',
      status: 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
      notes: text ? [{ content: `First WhatsApp message: ${text}`, type: 'note' }] : [],
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() },
    });

    const ctx = { lead, user: null, changes: { source: 'whatsapp' } };
    fireEvent('lead.created', ctx).catch(() => {});
    fireEvent('lead.whatsapp_lead', ctx).catch(() => {});
    broadcastWebhooks('lead.created', { lead: { id: lead._id, name, phone, source: 'whatsapp' } }).catch(() => {});

    return { created: true, leadId: lead._id };
  }

  // Existing lead — log message as note
  await Lead.findByIdAndUpdate(existing._id, {
    $push: { notes: { content: `WhatsApp (${msgType}): ${text}`, type: 'note', createdAt: new Date() } },
  });

  return { created: false, leadId: existing._id };
}

// Verify webhook token
function verifyWebhookToken(mode, token, challenge, verifyToken) {
  if (mode === 'subscribe' && token === verifyToken) {
    return { valid: true, challenge };
  }
  return { valid: false };
}

module.exports = { sendTextMessage, sendTemplateMessage, getPhoneNumberDetails, getTemplates, handleWhatsAppWebhookEvent, verifyWebhookToken };