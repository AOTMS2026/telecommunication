const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');
const Integration = require('../models/Integration');
const Lead = require('../models/Lead');
const { fireEvent } = require('../services/workflowEngine');
const { broadcastWebhooks } = require('../services/automationRunners');

// Real integration services
const facebookService = require('../services/integrations/facebook');
const whatsappService = require('../services/integrations/whatsapp');
const googleSheetsService = require('../services/integrations/googleSheets');
const googleMeetService = require('../services/integrations/googleMeet');
const knowlarityService = require('../services/integrations/knowlarity');
const callerDeskService = require('../services/integrations/callerdesk');
const maqsamService = require('../services/integrations/maqsam');

const AVAILABLE_INTEGRATIONS = [
  { type: 'facebook', name: 'Facebook', description: 'Capture Facebook Lead Ads in real-time via Meta Graph API', logo: 'fb' },
  { type: 'justdial', name: 'JustDial', description: 'Capture JustDial Leads in your TeleCRM account', logo: 'jd' },
  { type: 'whatsapp', name: 'Whatsapp', description: 'Integrate Whatsapp in your TeleCRM account', logo: 'wa' },
  { type: 'whatsapp_cloud', name: 'Whatsapp Cloud API', description: 'Receive & send WhatsApp messages via Meta Cloud API', logo: 'wa' },
  { type: '99acres', name: '99acres', description: 'Capture 99acres Leads in your Telecrm account', logo: '99' },
  { type: 'callerdesk', name: 'CallerDesk', description: 'Integrate CallerDesk calling & CDR in your Telecrm account', logo: 'cd' },
  { type: 'google_meet', name: 'Google Meet', description: 'Create Google Meet links directly from lead profiles', logo: 'gm' },
  { type: 'google_sheets', name: 'Google Sheets', description: 'Sync leads to/from Google Sheets automatically', logo: 'gs' },
  { type: 'housing', name: 'Housing', description: 'Integrate Housing.com in your Telecrm account', logo: 'ho' },
  { type: 'indiamart', name: 'IndiaMart', description: 'Integrate IndiaMart in your Telecrm account', logo: 'im' },
  { type: 'knowlarity', name: 'Knowlarity', description: 'Integrate Knowlarity calling & CDR in your Telecrm account', logo: 'kn' },
  { type: 'magicbricks', name: 'MagicBricks', description: 'Integrate MagicBricks in your Telecrm account', logo: 'mb' },
  { type: 'maqsam', name: 'Maqsam', description: 'Integrate Maqsam VoIP & CDR in your Telecrm account', logo: 'mq' },
  { type: 'sulekha', name: 'Sulekha', description: 'Capture Sulekha Leads in your Telecrm account', logo: 'sl' },
  { type: 'tradeindia', name: 'TradeIndia', description: 'Capture TradeIndia Leads in your Telecrm account', logo: 'ti' },
  { type: 'webhook', name: 'Custom Webhook', description: 'Receive leads from any source via webhook', logo: 'wh' },
];

const INTEGRATION_EVENT_MAP = {
  facebook: 'lead.facebook_lead',
  justdial: 'lead.justdial_lead',
  whatsapp: 'lead.whatsapp_lead',
  whatsapp_cloud: 'lead.whatsapp_lead',
  woocommerce: 'lead.woocommerce',
};

// ── Standard CRUD ─────────────────────────────────────────────────────────────

router.get('/', protect, async (req, res) => {
  try {
    const active = await Integration.find({ status: 'active' })
      .populate('defaultCampaign', 'name')
      .populate('defaultAssignedTo', 'name')
      .populate('createdBy', 'name')
      .lean();
    const pending = await Integration.find({ status: 'pending' })
      .populate('defaultCampaign', 'name')
      .populate('defaultAssignedTo', 'name')
      .populate('createdBy', 'name')
      .lean();
    const takenTypes = [...active, ...pending].map(i => i.type);
    const available = AVAILABLE_INTEGRATIONS.filter(i => !takenTypes.includes(i.type));
    res.json({ active, pending, available });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/catalog', protect, (req, res) => res.json(AVAILABLE_INTEGRATIONS));

router.get('/:id', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id)
      .populate('defaultCampaign', 'name')
      .populate('defaultAssignedTo', 'name');
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    res.json(integration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { type, config, fieldMapping, defaultCampaign, defaultAssignedTo } = req.body;
    const catalog = AVAILABLE_INTEGRATIONS.find(i => i.type === type);
    if (!catalog) return res.status(400).json({ message: 'Unknown integration type' });
    const existing = await Integration.findOne({ type, status: { $in: ['active', 'pending'] } });
    if (existing) return res.status(400).json({ message: 'Integration already added. Finish configuring it from the integrations list.' });
    const webhookKey = crypto.randomBytes(24).toString('hex');
    const integration = await Integration.create({
      type, name: catalog.name, description: catalog.description,
      status: 'pending', webhookKey,
      config: config || {},
      fieldMapping: fieldMapping || { name: 'name', phone: 'phone', email: 'email', location: 'location' },
      defaultCampaign: defaultCampaign || null,
      defaultAssignedTo: defaultAssignedTo || null,
      createdBy: req.user._id,
    });
    res.status(201).json(integration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const integration = await Integration.findByIdAndUpdate(
      req.params.id, { $set: req.body }, { new: true }
    ).populate('defaultCampaign', 'name').populate('defaultAssignedTo', 'name');
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    res.json(integration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    await Integration.findByIdAndDelete(req.params.id);
    res.json({ message: 'Integration removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/leads', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const leads = await Lead.find({ leadSource: integration.name })
      .sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('assignedTo', 'name').lean();
    const total = await Lead.countDocuments({ leadSource: integration.name });
    res.json({ leads, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/test-webhook', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    res.json({
      webhookUrl: `${process.env.BACKEND_URL || ''}/api/integrations/webhook/${integration.webhookKey}`,
      samplePayload: { name: 'Test Lead', phone: '9876543210', email: 'test@example.com', location: 'Hyderabad' },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Generic webhook receiver (JustDial, 99acres, Housing, MagicBricks, Sulekha, TradeIndia, IndiaMart, Custom) ──

router.post('/webhook/:webhookKey', async (req, res) => {
  try {
    const integration = await Integration.findOne({ webhookKey: req.params.webhookKey, status: 'active' });
    if (!integration) return res.status(404).json({ message: 'Integration not found' });

    // Route to real handlers for specific types
    if (integration.type === 'facebook') {
      const result = await facebookService.handleFacebookWebhookEvent(req.body, integration);
      return res.json(result);
    }
    if (integration.type === 'whatsapp_cloud') {
      const result = await whatsappService.handleWhatsAppWebhookEvent(req.body, integration);
      return res.json(result);
    }
    if (integration.type === 'knowlarity') {
      const result = await knowlarityService.handleKnowlarityWebhook(req.body, integration);
      return res.json(result);
    }
    if (integration.type === 'callerdesk') {
      const result = await callerDeskService.handleCallerDeskWebhook(req.body, integration);
      return res.json(result);
    }
    if (integration.type === 'maqsam') {
      const result = await maqsamService.handleMaqsamWebhook(req.body, integration);
      return res.json(result);
    }

    // Generic handler for all other types (JustDial, 99acres, etc.)
    const data = req.body;
    const mapping = integration.fieldMapping || {};
    const getField = (f) => data[mapping[f] || f] || data[f] || '';

    const name = getField('name');
    const phone = getField('phone');
    if (!name || !phone) return res.status(400).json({ message: 'Name and phone are required' });

    const Blocklist = require('../models/Blocklist');
    const blocked = await Blocklist.findOne({ phone });
    if (blocked) return res.status(200).json({ message: 'Lead blocked', skipped: true });

    const existing = await Lead.findOne({ phone });
    if (existing) return res.status(200).json({ message: 'Duplicate lead skipped', skipped: true, leadId: existing._id });

    const lead = await Lead.create({
      name, phone,
      email: getField('email'),
      location: getField('location'),
      leadSource: integration.name,
      status: 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() },
    });

    const eventCtx = { lead, user: null, changes: { source: integration.type } };
    fireEvent('lead.created', eventCtx).catch(() => {});
    const specificEvent = INTEGRATION_EVENT_MAP[integration.type];
    if (specificEvent) fireEvent(specificEvent, eventCtx).catch(() => {});
    broadcastWebhooks('lead.created', { lead: { id: lead._id, name: lead.name, phone: lead.phone, source: integration.type } }).catch(() => {});

    res.status(201).json({ message: 'Lead created', leadId: lead._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Facebook Meta webhook verification (GET) ──────────────────────────────────

router.get('/facebook/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === process.env.FACEBOOK_WEBHOOK_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// Facebook real-time lead webhook (POST from Meta)
router.post('/facebook/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const sig = req.headers['x-hub-signature-256'];
    if (sig && process.env.FACEBOOK_APP_SECRET) {
      const valid = facebookService.verifySignature(req.body, sig, process.env.FACEBOOK_APP_SECRET);
      if (!valid) return res.sendStatus(403);
    }

    const body = JSON.parse(req.body);
    if (body.object !== 'page') return res.sendStatus(404);

    // Find active facebook integration
    const integration = await Integration.findOne({ type: 'facebook', status: 'active' });
    if (integration) {
      await facebookService.handleFacebookWebhookEvent(body, integration);
    }

    res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('FB webhook error:', err.message);
    res.sendStatus(500);
  }
});

// ── Facebook OAuth flow ───────────────────────────────────────────────────────

router.get('/facebook/oauth/url', protect, authorize('manager', 'admin'), (req, res) => {
  const appId = process.env.FACEBOOK_APP_ID;
  const redirectUri = encodeURIComponent(`${process.env.BACKEND_URL}/api/integrations/facebook/oauth/callback`);
  const scope = 'pages_show_list,pages_read_engagement,leads_retrieval,pages_manage_metadata';
  const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=code&state=facebook_oauth`;
  res.json({ url });
});

router.get('/facebook/oauth/callback', async (req, res) => {
  try {
    const { code } = req.query;
    const longToken = await facebookService.getLongLivedToken(code, process.env.FACEBOOK_APP_ID, process.env.FACEBOOK_APP_SECRET);
    const pages = await facebookService.getUserPages(longToken);
    // Redirect to frontend with token & pages info
    const encoded = encodeURIComponent(JSON.stringify({ token: longToken, pages }));
    res.redirect(`${process.env.FRONTEND_URL}/integrations/facebook/setup?data=${encoded}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/integrations?error=facebook_oauth_failed`);
  }
});

router.get('/:id/facebook/pages', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const pages = await facebookService.getUserPages(integration.config.accessToken);
    res.json({ pages });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/facebook/forms', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const forms = await facebookService.getPageForms(integration.config.pageId, integration.config.pageAccessToken || integration.config.accessToken);
    res.json({ forms });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/facebook/subscribe', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await facebookService.subscribePage(integration.config.pageId, integration.config.pageAccessToken || integration.config.accessToken);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/facebook/sync', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await facebookService.pullLeadsFromForm(
      integration.config.formId,
      integration.config.pageAccessToken || integration.config.accessToken,
      integration
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── WhatsApp Cloud API webhook verification ───────────────────────────────────

router.get('/whatsapp/webhook', async (req, res) => {
  try {
    const integration = await Integration.findOne({ type: 'whatsapp_cloud', status: 'active' });
    const verifyToken = integration?.config?.webhookVerifyToken || process.env.WHATSAPP_VERIFY_TOKEN;
    const result = whatsappService.verifyWebhookToken(req.query['hub.mode'], req.query['hub.verify_token'], req.query['hub.challenge'], verifyToken);
    if (result.valid) return res.status(200).send(result.challenge);
    res.sendStatus(403);
  } catch (err) {
    res.sendStatus(500);
  }
});

router.post('/whatsapp/webhook', async (req, res) => {
  try {
    const integration = await Integration.findOne({ type: 'whatsapp_cloud', status: 'active' });
    if (integration) await whatsappService.handleWhatsAppWebhookEvent(req.body, integration);
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

router.post('/:id/whatsapp/send', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const { to, message } = req.body;
    const result = await whatsappService.sendTextMessage(
      integration.config.phoneNumberId,
      integration.config.accessToken,
      to, message
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/whatsapp/send-template', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const { to, templateName, languageCode, components } = req.body;
    const result = await whatsappService.sendTemplateMessage(
      integration.config.phoneNumberId,
      integration.config.accessToken,
      to, templateName, languageCode, components
    );
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/whatsapp/templates', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const templates = await whatsappService.getTemplates(integration.config.wabaId, integration.config.accessToken);
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Google OAuth shared callback ──────────────────────────────────────────────

router.get('/google/oauth/url', protect, authorize('manager', 'admin'), (req, res) => {
  const type = req.query.type || 'google_sheets'; // google_sheets | google_meet
  const state = `${type}|${req.query.integrationId || ''}`;
  const url = type === 'google_meet'
    ? googleMeetService.getAuthUrl(state)
    : googleSheetsService.getAuthUrl(state);
  res.json({ url });
});

router.get('/google/oauth/callback', async (req, res) => {
  try {
    const { code, state } = req.query;
    const [type, integrationId] = (state || '').split('|');

    let tokens;
    if (type === 'google_meet') {
      tokens = await googleMeetService.exchangeCode(code);
    } else {
      tokens = await googleSheetsService.exchangeCode(code);
    }

    if (integrationId) {
      await Integration.findByIdAndUpdate(integrationId, {
        $set: {
          'config.accessToken': tokens.access_token,
          'config.refreshToken': tokens.refresh_token,
          'config.tokenExpiry': tokens.expiry_date,
        },
      });
    }

    res.redirect(`${process.env.FRONTEND_URL}/integrations?google_oauth=success&type=${type}`);
  } catch (err) {
    res.redirect(`${process.env.FRONTEND_URL}/integrations?error=google_oauth_failed`);
  }
});

// ── Google Sheets actions ─────────────────────────────────────────────────────

router.post('/:id/sheets/import', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await googleSheetsService.importLeadsFromSheet(integration);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/sheets/list', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const sheets = await googleSheetsService.listSheets(integration);
    res.json({ sheets });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Google Meet actions ───────────────────────────────────────────────────────

router.post('/:id/meet/create', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const meeting = await googleMeetService.createMeeting({ config: integration.config, ...req.body });
    res.json(meeting);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/meet/list', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const meetings = await googleMeetService.listMeetings(integration.config);
    res.json({ meetings });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id/meet/:eventId', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    await googleMeetService.deleteMeeting(integration.config, req.params.eventId);
    res.json({ message: 'Meeting deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Knowlarity actions ────────────────────────────────────────────────────────

router.get('/:id/knowlarity/agents', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const agents = await knowlarityService.getAgents(integration);
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/knowlarity/call-logs', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const logs = await knowlarityService.getCallLogs(integration, req.query.start, req.query.end);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/knowlarity/call', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await knowlarityService.makeCall(integration, req.body.callerPhone, req.body.customerPhone, req.body.callerId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── CallerDesk actions ────────────────────────────────────────────────────────

router.get('/:id/callerdesk/agents', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const agents = await callerDeskService.getAgents(integration);
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/callerdesk/call-logs', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const logs = await callerDeskService.getCallLogs(integration, req.query.page);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/callerdesk/call', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await callerDeskService.makeCall(integration, req.body.agentExtension, req.body.customerPhone);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ── Maqsam actions ────────────────────────────────────────────────────────────

router.get('/:id/maqsam/agents', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const agents = await maqsamService.getAgents(integration);
    res.json({ agents });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id/maqsam/call-logs', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const logs = await maqsamService.getCallLogs(integration, req.query.start, req.query.end);
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/:id/maqsam/call', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    const result = await maqsamService.makeCall(integration, req.body.agentExtension, req.body.customerPhone);
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;