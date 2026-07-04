const express = require('express');
const crypto = require('crypto');
const Integration = require('../models/Integration');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');

const googleSheets = require('../services/integrations/googleSheets');
const googleMeet = require('../services/integrations/googleMeet');
const facebook = require('../services/integrations/facebook');
const whatsapp = require('../services/integrations/whatsapp');
const knowlarity = require('../services/integrations/knowlarity');
const callerdesk = require('../services/integrations/callerdesk');
const maqsam = require('../services/integrations/maqsam');

const router = express.Router();

const CALL_SERVICES = { knowlarity, callerdesk, maqsam };

const CATALOG = [
  { type: 'facebook', name: 'Facebook', category: 'oauth', description: 'Auto-import leads from Facebook Lead Ads' },
  { type: 'google_sheets', name: 'Google Sheets', category: 'oauth', description: 'Sync leads to/from Google Sheets automatically' },
  { type: 'google_meet', name: 'Google Meet', category: 'oauth', description: 'Schedule and manage Google Meet calls from leads' },
  { type: 'whatsapp_cloud', name: 'Whatsapp Cloud API', category: 'webhook', description: 'Integrate WhatsApp Cloud API in your AOTMS account' },
  { type: 'whatsapp', name: 'Whatsapp', category: 'webhook', description: 'Integrate Whatsapp in your TeleCRM account' },
  { type: 'knowlarity', name: 'Knowlarity', category: 'webhook', description: 'Connect Knowlarity cloud telephony' },
  { type: 'callerdesk', name: 'CallerDesk', category: 'webhook', description: 'Connect CallerDesk cloud telephony' },
  { type: 'maqsam', name: 'Maqsam', category: 'webhook', description: 'Connect Maqsam cloud telephony' },
  { type: 'justdial', name: 'JustDial', category: 'generic_webhook', description: 'Auto-import leads from JustDial' },
  { type: '99acres', name: '99acres', category: 'generic_webhook', description: 'Auto-import leads from 99acres' },
  { type: 'housing', name: 'Housing', category: 'generic_webhook', description: 'Auto-import leads from Housing.com' },
  { type: 'indiamart', name: 'IndiaMart', category: 'generic_webhook', description: 'Auto-import leads from IndiaMart' },
  { type: 'magicbricks', name: 'MagicBricks', category: 'generic_webhook', description: 'Auto-import leads from MagicBricks' },
  { type: 'sulekha', name: 'Sulekha', category: 'generic_webhook', description: 'Auto-import leads from Sulekha' },
  { type: 'tradeindia', name: 'TradeIndia', category: 'generic_webhook', description: 'Auto-import leads from TradeIndia' },
];

function frontendBase() {
  return process.env.FRONTEND_URL || 'http://localhost:5173';
}

function encodeState(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}
function decodeState(state) {
  try { return JSON.parse(Buffer.from(state, 'base64url').toString('utf8')); }
  catch { return {}; }
}

// ---------- Base CRUD ----------

router.get('/catalog', protect, (req, res) => {
  res.json(CATALOG);
});

router.get('/', protect, async (req, res) => {
  try {
    const saved = await Integration.find()
      .populate('defaultCampaign', 'name')
      .populate('defaultAssignedTo', 'name role')
      .sort({ createdAt: -1 });
    const active = saved.filter(i => i.status === 'active');
    const pending = saved.filter(i => i.status !== 'active');
    const savedTypes = new Set(saved.map(i => i.type));
    const available = CATALOG.filter(c => !savedTypes.has(c.type)).map(c => ({
      type: c.type,
      name: c.name,
      description: c.description || `Integrate ${c.name} in your AOTMS account`,
      category: c.category,
    }));
    res.json({ active, pending, available });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- Google OAuth (must be before /:id) ----------

router.get('/google/oauth/url', protect, async (req, res) => {
  try {
    const { type, integrationId } = req.query;
    if (!integrationId) return res.status(400).json({ message: 'integrationId is required' });
    const state = encodeState({ integrationId, type, userId: String(req.user._id) });
    const svc = type === 'google_meet' ? googleMeet : googleSheets;
    const url = svc.getAuthUrl(state);
    res.json({ url });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/google/oauth/callback', async (req, res) => {
  const { code, state, error } = req.query;
  const base = frontendBase();
  if (error) {
    return res.redirect(`${base}/integrations?google_oauth=error&message=${encodeURIComponent(error)}`);
  }
  try {
    const { integrationId, type } = decodeState(state);
    if (!integrationId) throw new Error('Missing integration reference in OAuth state');

    const svc = type === 'google_meet' ? googleMeet : googleSheets;
    const tokens = await svc.exchangeCode(code);

    const update = {
      'config.accessToken': tokens.access_token || '',
      status: 'active',
    };
    if (tokens.refresh_token) update['config.refreshToken'] = tokens.refresh_token;
    if (tokens.expiry_date) update['config.tokenExpiryDate'] = tokens.expiry_date;

    await Integration.findByIdAndUpdate(integrationId, { $set: update });

    return res.redirect(`${base}/integrations/${integrationId}?google_oauth=success&type=${type || ''}`);
  } catch (err) {
    return res.redirect(`${base}/integrations?google_oauth=error&message=${encodeURIComponent(err.message)}`);
  }
});

// ---------- Facebook OAuth ----------

router.get('/facebook/oauth/url', protect, (req, res) => {
  const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${process.env.BACKEND_URL || ''}/api/integrations/facebook/oauth/callback`;
  const state = encodeState({ userId: String(req.user._id) });
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${process.env.FACEBOOK_APP_ID}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}&scope=leads_retrieval,pages_show_list,pages_manage_ads,pages_read_engagement`;
  res.json({ url });
});

router.get('/facebook/oauth/callback', async (req, res) => {
  const base = frontendBase();
  const { code, error } = req.query;
  if (error) return res.redirect(`${base}/integrations?google_oauth=error&type=facebook&message=${encodeURIComponent(error)}`);
  try {
    const redirectUri = process.env.FACEBOOK_REDIRECT_URI || `${process.env.BACKEND_URL || ''}/api/integrations/facebook/oauth/callback`;
    const shortToken = await facebook.exchangeCodeForToken(code, redirectUri);
    const longToken = await facebook.getLongLivedToken(shortToken, process.env.FACEBOOK_APP_ID, process.env.FACEBOOK_APP_SECRET);
    return res.redirect(`${base}/integrations?google_oauth=success&type=facebook&fb_token=${encodeURIComponent(longToken || '')}`);
  } catch (err) {
    return res.redirect(`${base}/integrations?google_oauth=error&type=facebook&message=${encodeURIComponent(err.message)}`);
  }
});

// ---------- Public inbound webhook (JustDial, 99acres, Housing, IndiaMart, MagicBricks, Sulekha, TradeIndia) ----------

router.post('/webhook/:webhookKey', async (req, res) => {
  try {
    const integration = await Integration.findOne({ webhookKey: req.params.webhookKey });
    if (!integration) return res.status(404).json({ message: 'Invalid webhook key' });

    const payload = req.body || {};
    const mapping = integration.fieldMapping || {};
    const leadData = {};

    for (const [srcField, leadField] of Object.entries(mapping)) {
      if (leadField && payload[srcField] !== undefined && payload[srcField] !== '') {
        leadData[leadField] = payload[srcField];
      }
    }

    if (!leadData.name || !leadData.phone) {
      const fallbackMap = {
        name: 'name', full_name: 'name', fullName: 'name', customer_name: 'name', customername: 'name',
        phone: 'phone', mobile: 'phone', mobileno: 'phone', mobile_no: 'phone', phone_number: 'phone', contact: 'phone', contact_no: 'phone',
        email: 'email', email_id: 'email', emailid: 'email',
        city: 'location', location: 'location',
      };
      for (const [k, v] of Object.entries(payload)) {
        const key = String(k).toLowerCase();
        if (fallbackMap[key] && !leadData[fallbackMap[key]]) leadData[fallbackMap[key]] = v;
      }
    }

    if (!leadData.phone) {
      await Integration.findByIdAndUpdate(integration._id, { lastAutoSyncError: 'Webhook payload missing phone number' });
      return res.status(400).json({ message: 'Could not map a phone number from payload' });
    }
    if (!leadData.name) leadData.name = 'Unknown';

    const lead = await Lead.create({
      ...leadData,
      leadSource: integration.name,
      status: leadData.status || 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      lastLeadAt: new Date(),
      lastAutoSyncError: '',
      ...(integration.status === 'pending' ? { status: 'active' } : {}),
    });

    res.json({ success: true, leadId: lead._id });
  } catch (err) {
    console.error('Integration webhook error:', err);
    res.status(500).json({ message: err.message });
  }
});

// ---------- Single integration CRUD ----------

router.get('/:id', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id)
      .populate('defaultCampaign', 'name')
      .populate('defaultAssignedTo', 'name role');
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    res.json(integration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const data = { ...req.body, createdBy: req.user._id };
    if (!data.webhookKey && data.type) {
      data.webhookKey = crypto.randomBytes(16).toString('hex');
    }
    const integration = await Integration.create(data);
    res.status(201).json(integration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const body = { ...req.body };
    if (body.config?.sheetId) {
      const m = String(body.config.sheetId).trim().match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
      body.config = { ...body.config, sheetId: m ? m[1] : String(body.config.sheetId).trim() };
    }
    const integration = await Integration.findByIdAndUpdate(req.params.id, { $set: body }, { new: true })
      .populate('defaultCampaign', 'name')
      .populate('defaultAssignedTo', 'name role');
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    res.json(integration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const integration = await Integration.findByIdAndDelete(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    res.json({ message: 'Integration removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/leads', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const query = { leadSource: integration.name };
    const leads = await Lead.find(query)
      .populate('assignedTo', 'name role')
      .populate('campaign', 'name')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    const total = await Lead.countDocuments(query);
    res.json({ leads, total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/test-webhook', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    if (!integration.webhookKey) return res.status(400).json({ message: 'No webhook key set for this integration' });
    const base = process.env.BACKEND_URL || '';
    res.json({ webhookUrl: `${base}/api/integrations/webhook/${integration.webhookKey}`, message: 'Send a test POST with lead fields to this URL' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- Facebook actions ----------

router.get('/:id/facebook/pages', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const pages = await facebook.getUserPages(integration.config.accessToken);
    res.json(pages);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/facebook/forms', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const forms = await facebook.getPageForms(integration.config.pageId, integration.config.pageAccessToken);
    res.json(forms);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/facebook/subscribe', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await facebook.subscribePage(integration.config.pageId, integration.config.pageAccessToken);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/facebook/sync', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await facebook.pullLeadsFromForm(integration.config.formId, integration.config.pageAccessToken, integration);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- WhatsApp actions ----------

router.post('/:id/whatsapp/send', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const { to, message } = req.body;
    const result = await whatsapp.sendTextMessage(integration.config.phoneNumberId, integration.config.accessToken, to, message);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/whatsapp/send-template', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const { to, templateName, languageCode, components } = req.body;
    const result = await whatsapp.sendTemplateMessage(integration.config.phoneNumberId, integration.config.accessToken, to, templateName, languageCode, components);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/whatsapp/templates', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const templates = await whatsapp.getTemplates(integration.config.wabaId, integration.config.accessToken);
    res.json(templates);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ---------- Google Sheets actions ----------

router.post('/:id/sheets/import', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const result = await googleSheets.importLeadsFromSheet(integration);
    res.json(result);
  } catch (err) {
    res.status(err.code === 'GOOGLE_NOT_CONNECTED' || err.code === 'SHEET_ID_MISSING' ? 400 : 500).json({ message: err.message });
  }
});

router.get('/:id/sheets/columns', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const { sheetId, sheetRange } = req.query;
    const columns = await googleSheets.getColumns(integration, sheetId, sheetRange);
    res.json({ columns });
  } catch (err) {
    const isClientErr = ['GOOGLE_NOT_CONNECTED', 'SHEET_ID_MISSING', 'SHEET_TAB_NOT_FOUND'].includes(err.code);
    res.status(isClientErr ? 400 : 500).json({ message: err.message, availableTabs: err.availableTabs || [] });
  }
});

router.get('/:id/sheets/list', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const sheets = await googleSheets.listSheets(integration);
    res.json(sheets);
  } catch (err) {
    res.status(err.code === 'GOOGLE_NOT_CONNECTED' || err.code === 'SHEET_ID_MISSING' ? 400 : 500).json({ message: err.message });
  }
});

// ---------- Google Meet actions ----------

router.post('/:id/meet/create', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const { summary, description, startTime, endTime, attendeeEmails } = req.body;
    const attendees = typeof attendeeEmails === 'string'
      ? attendeeEmails.split(',').map(e => e.trim()).filter(Boolean)
      : (attendeeEmails || []);
    const meeting = await googleMeet.createMeeting({
      config: integration.config, summary, description, startTime, endTime, attendeeEmails: attendees,
    });
    res.json(meeting);
  } catch (err) {
    res.status(err.code === 'GOOGLE_NOT_CONNECTED' ? 400 : 500).json({ message: err.message });
  }
});

router.get('/:id/meet/list', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const meetings = await googleMeet.listMeetings(integration.config);
    res.json(meetings);
  } catch (err) {
    res.status(err.code === 'GOOGLE_NOT_CONNECTED' ? 400 : 500).json({ message: err.message });
  }
});

router.delete('/:id/meet/:eventId', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    await googleMeet.deleteMeeting(integration.config, req.params.eventId);
    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    res.status(err.code === 'GOOGLE_NOT_CONNECTED' ? 400 : 500).json({ message: err.message });
  }
});

// ---------- Calling providers (Knowlarity / CallerDesk / Maqsam) ----------

router.get('/:id/:type/agents', protect, async (req, res) => {
  try {
    const svc = CALL_SERVICES[req.params.type];
    if (!svc) return res.status(400).json({ message: 'Unsupported provider' });
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const agents = await svc.getAgents(integration);
    res.json(agents);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/:type/call-logs', protect, async (req, res) => {
  try {
    const svc = CALL_SERVICES[req.params.type];
    if (!svc) return res.status(400).json({ message: 'Unsupported provider' });
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const { startDate, endDate, page, limit } = req.query;
    const logs = req.params.type === 'callerdesk'
      ? await svc.getCallLogs(integration, page, limit)
      : await svc.getCallLogs(integration, startDate, endDate);
    res.json(logs);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/:type/call', protect, async (req, res) => {
  try {
    const svc = CALL_SERVICES[req.params.type];
    if (!svc) return res.status(400).json({ message: 'Unsupported provider' });
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const result = req.params.type === 'maqsam' || req.params.type === 'callerdesk'
      ? await svc.makeCall(integration, req.body.agentExtension, req.body.customerPhone)
      : await svc.makeCall(integration, req.body.callerPhone, req.body.customerPhone, req.body.callerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;