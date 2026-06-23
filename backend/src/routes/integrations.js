const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { protect, authorize } = require('../middleware/auth');
const Integration = require('../models/Integration');
const Lead = require('../models/Lead');

// All available integrations catalog
const AVAILABLE_INTEGRATIONS = [
  { type: 'facebook', name: 'Facebook', description: 'Capture Facebook Lead Ads in your TeleCRM account', logo: 'fb' },
  { type: 'justdial', name: 'JustDial', description: 'Capture JustDial Leads in your TeleCRM account', logo: 'jd' },
  { type: 'whatsapp', name: 'Whatsapp', description: 'Integrate Whatsapp in your TeleCRM account', logo: 'wa' },
  { type: 'whatsapp_cloud', name: 'Whatsapp Cloud API', description: 'Integrate Whatsapp Cloud API in your TeleCRM account', logo: 'wa' },
  { type: '99acres', name: '99acres', description: 'Capture 99acres Leads in your Telecrm account', logo: '99' },
  { type: 'callerdesk', name: 'CallerDesk', description: 'Integrate CallerDesk in your Telecrm account', logo: 'cd' },
  { type: 'google_meet', name: 'Google Meet', description: 'Integrate Google Meet in your Telecrm Account', logo: 'gm' },
  { type: 'google_sheets', name: 'Google Sheets', description: 'Integrate Google sheet in your Telecrm account', logo: 'gs' },
  { type: 'housing', name: 'Housing', description: 'Integrate Housing.com in your Telecrm account', logo: 'ho' },
  { type: 'indiamart', name: 'IndiaMart', description: 'Integrate IndiaMart in your Telecrm account', logo: 'im' },
  { type: 'knowlarity', name: 'Knowlarity', description: 'Integrate Knowlarity in your Telecrm account', logo: 'kn' },
  { type: 'magicbricks', name: 'MagicBricks', description: 'Integrate MagicBricks in your Telecrm account', logo: 'mb' },
  { type: 'maqsam', name: 'Maqsam', description: 'Integrate Maqsam in your Telecrm account', logo: 'mq' },
  { type: 'sulekha', name: 'Sulekha', description: 'Capture Sulekha Leads in your Telecrm account', logo: 'sl' },
  { type: 'tradeindia', name: 'TradeIndia', description: 'Capture TradeIndia Leads in your Telecrm account', logo: 'ti' },
  { type: 'webhook', name: 'Custom Webhook', description: 'Receive leads from any source via webhook', logo: 'wh' },
];

// GET /api/integrations - list all integrations (active + available)
router.get('/', protect, async (req, res) => {
  try {
    const active = await Integration.find({ status: 'active' })
      .populate('defaultCampaign', 'name')
      .populate('defaultAssignedTo', 'name')
      .populate('createdBy', 'name')
      .lean();

    // Map active types
    const activeTypes = active.map(i => i.type);

    // Available = catalog minus active
    const available = AVAILABLE_INTEGRATIONS.filter(i => !activeTypes.includes(i.type));

    res.json({ active, available });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/integrations/catalog - full catalog
router.get('/catalog', protect, (req, res) => {
  res.json(AVAILABLE_INTEGRATIONS);
});

// GET /api/integrations/:id - get single integration
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

// POST /api/integrations - activate/create integration (admin only)
router.post('/', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const { type, config, fieldMapping, defaultCampaign, defaultAssignedTo } = req.body;

    // Get catalog info
    const catalog = AVAILABLE_INTEGRATIONS.find(i => i.type === type);
    if (!catalog) return res.status(400).json({ message: 'Unknown integration type' });

    // Check if already active
    const existing = await Integration.findOne({ type, status: 'active' });
    if (existing) return res.status(400).json({ message: 'Integration already active' });

    // Generate webhook key
    const webhookKey = crypto.randomBytes(24).toString('hex');

    const integration = await Integration.create({
      type,
      name: catalog.name,
      description: catalog.description,
      status: 'active',
      webhookKey,
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

// PUT /api/integrations/:id - update integration
router.put('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const integration = await Integration.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    ).populate('defaultCampaign', 'name').populate('defaultAssignedTo', 'name');
    if (!integration) return res.status(404).json({ message: 'Integration not found' });
    res.json(integration);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/integrations/:id - deactivate/remove integration
router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    await Integration.findByIdAndDelete(req.params.id);
    res.json({ message: 'Integration removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/integrations/:id/leads - get leads from this integration
router.get('/:id/leads', protect, async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const leads = await Lead.find({ leadSource: integration.name })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('assignedTo', 'name')
      .lean();

    const total = await Lead.countDocuments({ leadSource: integration.name });

    res.json({ leads, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/integrations/webhook/:webhookKey - public webhook to receive leads
router.post('/webhook/:webhookKey', async (req, res) => {
  try {
    const integration = await Integration.findOne({ webhookKey: req.params.webhookKey, status: 'active' });
    if (!integration) return res.status(404).json({ message: 'Integration not found' });

    const data = req.body;
    const mapping = integration.fieldMapping || {};

    // Map fields
    const getField = (fieldName) => {
      const mappedKey = mapping[fieldName] || fieldName;
      return data[mappedKey] || data[fieldName] || '';
    };

    const name = getField('name');
    const phone = getField('phone');

    if (!name || !phone) {
      return res.status(400).json({ message: 'Name and phone are required' });
    }

    // Check blocklist
    const Blocklist = require('../models/Blocklist');
    const blocked = await Blocklist.findOne({ phone });
    if (blocked) {
      return res.status(200).json({ message: 'Lead blocked', skipped: true });
    }

    // Check duplicate
    const existing = await Lead.findOne({ phone });
    if (existing) {
      return res.status(200).json({ message: 'Duplicate lead skipped', skipped: true, leadId: existing._id });
    }

    const leadData = {
      name,
      phone,
      email: getField('email'),
      location: getField('location'),
      leadSource: integration.name,
      status: 'Fresh',
    };

    if (integration.defaultCampaign) leadData.campaign = integration.defaultCampaign;
    if (integration.defaultAssignedTo) leadData.assignedTo = integration.defaultAssignedTo;

    const lead = await Lead.create(leadData);

    // Update integration stats
    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() }
    });

    res.status(201).json({ message: 'Lead created', leadId: lead._id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/integrations/:id/test-webhook - send test lead
router.post('/:id/test-webhook', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: 'Integration not found' });

    res.json({
      webhookUrl: `${process.env.BACKEND_URL || ''}/api/integrations/webhook/${integration.webhookKey}`,
      samplePayload: {
        name: 'Test Lead',
        phone: '9876543210',
        email: 'test@example.com',
        location: 'Hyderabad'
      }
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;