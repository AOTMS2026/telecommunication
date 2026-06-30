const axios = require('axios');
const crypto = require('crypto');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');
const { broadcastWebhooks } = require('../automationRunners');

const FB_API = 'https://graph.facebook.com/v19.0';

// Verify webhook signature from Meta
function verifySignature(payload, signature, appSecret) {
  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(payload).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// Exchange short-lived token for long-lived token (60 days)
async function getLongLivedToken(shortToken, appId, appSecret) {
  const res = await axios.get(`${FB_API}/oauth/access_token`, {
    params: {
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortToken,
    },
  });
  return res.data.access_token;
}

// Get all pages for a user token
async function getUserPages(userToken) {
  const res = await axios.get(`${FB_API}/me/accounts`, {
    params: { access_token: userToken, fields: 'id,name,access_token' },
  });
  return res.data.data; // [{ id, name, access_token }]
}

// Get all lead forms for a page
async function getPageForms(pageId, pageToken) {
  const res = await axios.get(`${FB_API}/${pageId}/leadgen_forms`, {
    params: { access_token: pageToken, fields: 'id,name,status,leads_count' },
  });
  return res.data.data;
}

// Subscribe page to lead webhooks
async function subscribePage(pageId, pageToken) {
  const res = await axios.post(`${FB_API}/${pageId}/subscribed_apps`, null, {
    params: { subscribed_fields: 'leadgen', access_token: pageToken },
  });
  return res.data;
}

// Pull leads from a specific form (used for manual sync / missed leads)
async function pullLeadsFromForm(formId, pageToken, integration) {
  const res = await axios.get(`${FB_API}/${formId}/leads`, {
    params: {
      access_token: pageToken,
      fields: 'id,created_time,field_data',
      limit: 100,
    },
  });

  const fbLeads = res.data.data || [];
  let created = 0;

  for (const fl of fbLeads) {
    const fields = {};
    for (const f of fl.field_data) {
      fields[f.name] = f.values?.[0] || '';
    }

    const mapping = integration.fieldMapping || {};
    const name = fields[mapping.name || 'full_name'] || fields['full_name'] || fields['name'] || '';
    const phone = fields[mapping.phone || 'phone_number'] || fields['phone_number'] || fields['phone'] || '';
    const email = fields[mapping.email || 'email'] || fields['email'] || '';
    const location = fields[mapping.location || 'city'] || fields['city'] || fields['location'] || '';

    if (!phone) continue;

    const existing = await Lead.findOne({ phone });
    if (existing) continue;

    const lead = await Lead.create({
      name: name || 'Facebook Lead',
      phone,
      email,
      location,
      leadSource: 'Facebook',
      status: 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() },
    });

    const ctx = { lead, user: null, changes: { source: 'facebook' } };
    fireEvent('lead.created', ctx).catch(() => {});
    fireEvent('lead.facebook_lead', ctx).catch(() => {});
    broadcastWebhooks('lead.created', { lead: { id: lead._id, name: lead.name, phone: lead.phone, source: 'facebook' } }).catch(() => {});
    created++;
  }

  return { pulled: fbLeads.length, created };
}

// Handle real-time lead webhook from Meta
async function handleFacebookWebhookEvent(body, integration) {
  const entries = body.entry || [];
  let created = 0;

  for (const entry of entries) {
    for (const change of entry.changes || []) {
      if (change.field !== 'leadgen') continue;

      const leadgenId = change.value?.leadgen_id;
      const pageToken = integration.config?.pageAccessToken || integration.config?.accessToken;
      if (!leadgenId || !pageToken) continue;

      try {
        const res = await axios.get(`${FB_API}/${leadgenId}`, {
          params: { access_token: pageToken, fields: 'id,created_time,field_data,form_id' },
        });

        const fl = res.data;
        const fields = {};
        for (const f of fl.field_data) {
          fields[f.name] = f.values?.[0] || '';
        }

        const mapping = integration.fieldMapping || {};
        const name = fields[mapping.name || 'full_name'] || fields['full_name'] || fields['name'] || 'Facebook Lead';
        const phone = fields[mapping.phone || 'phone_number'] || fields['phone_number'] || fields['phone'] || '';
        const email = fields[mapping.email || 'email'] || fields['email'] || '';
        const location = fields[mapping.location || 'city'] || fields['city'] || fields['location'] || '';

        if (!phone) continue;

        const existing = await Lead.findOne({ phone });
        if (existing) continue;

        const lead = await Lead.create({
          name,
          phone,
          email,
          location,
          leadSource: 'Facebook',
          status: 'Fresh',
          campaign: integration.defaultCampaign || undefined,
          assignedTo: integration.defaultAssignedTo || undefined,
        });

        await Integration.findByIdAndUpdate(integration._id, {
          $inc: { totalLeadsImported: 1 },
          $set: { lastLeadAt: new Date() },
        });

        const ctx = { lead, user: null, changes: { source: 'facebook' } };
        fireEvent('lead.created', ctx).catch(() => {});
        fireEvent('lead.facebook_lead', ctx).catch(() => {});
        broadcastWebhooks('lead.created', { lead: { id: lead._id, name: lead.name, phone: lead.phone, source: 'facebook' } }).catch(() => {});
        created++;
      } catch (e) {
        console.error('FB lead fetch error:', e.message);
      }
    }
  }

  return { created };
}

module.exports = { verifySignature, getLongLivedToken, getUserPages, getPageForms, subscribePage, pullLeadsFromForm, handleFacebookWebhookEvent };