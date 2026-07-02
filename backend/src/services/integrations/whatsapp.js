const axios = require('axios');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');
const { broadcastWebhooks } = require('../automationRunners');

const WA_API = 'https://graph.facebook.com/v19.0';

// ── Webhook verification (Meta hub.challenge handshake) ────────────────────────
function verifyWebhookToken(mode, token, challenge, verifyToken) {
  if (mode === 'subscribe' && token && verifyToken && token === verifyToken) {
    return { valid: true, challenge };
  }
  return { valid: false, challenge: null };
}

// ── Send a plain text message ───────────────────────────────────────────────────
async function sendTextMessage(phoneNumberId, accessToken, to, message) {
  const res = await axios.post(
    `${WA_API}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'text',
      text: { body: message },
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

// ── Send a pre-approved template message ────────────────────────────────────────
async function sendTemplateMessage(phoneNumberId, accessToken, to, templateName, languageCode, components) {
  const res = await axios.post(
    `${WA_API}/${phoneNumberId}/messages`,
    {
      messaging_product: 'whatsapp',
      to,
      type: 'template',
      template: {
        name: templateName,
        language: { code: languageCode || 'en_US' },
        components: components || [],
      },
    },
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  return res.data;
}

// ── List approved message templates for a WABA ─────────────────────────────────
async function getTemplates(wabaId, accessToken) {
  const res = await axios.get(`${WA_API}/${wabaId}/message_templates`, {
    params: { access_token: accessToken, limit: 100 },
  });
  return res.data.data || [];
}

// ── Handle incoming WhatsApp Cloud webhook events ───────────────────────────────
// Creates a Lead for first-time senders and fires workflow/webhook events for
// every inbound message so automations (auto-reply, assignment, etc.) can react.
async function handleWhatsAppWebhookEvent(body, integration) {
  const entries = body.entry || [];
  let created = 0;
  let processed = 0;

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const messages = value.messages || [];
      const contacts = value.contacts || [];

      for (const msg of messages) {
        const phone = msg.from;
        if (!phone) continue;

        const contact = contacts.find(c => c.wa_id === phone);
        const name = contact?.profile?.name || 'WhatsApp Lead';
        const text = msg.text?.body || '';

        let lead = await Lead.findOne({ phone });

        if (!lead) {
          lead = await Lead.create({
            name,
            phone,
            leadSource: 'Whatsapp',
            status: 'Fresh',
            campaign: integration.defaultCampaign || undefined,
            assignedTo: integration.defaultAssignedTo || undefined,
          });

          await Integration.findByIdAndUpdate(integration._id, {
            $inc: { totalLeadsImported: 1 },
            $set: { lastLeadAt: new Date() },
          });

          created++;
        }

        lead.activities = lead.activities || [];
        lead.activities.push({
          type: 'whatsapp',
          description: text,
        });
        await lead.save();

        const ctx = { lead, user: null, changes: { source: 'whatsapp', message: text } };
        fireEvent('lead.created', ctx).catch(() => {});
        fireEvent('lead.whatsapp_lead', ctx).catch(() => {});
        broadcastWebhooks('lead.whatsapp_message', {
          lead: { id: lead._id, name: lead.name, phone: lead.phone, source: 'whatsapp' },
          message: text,
        }).catch(() => {});

        processed++;
      }
    }
  }

  return { processed, created };
}

module.exports = {
  verifyWebhookToken,
  sendTextMessage,
  sendTemplateMessage,
  getTemplates,
  handleWhatsAppWebhookEvent,
};