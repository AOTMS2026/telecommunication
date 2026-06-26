const express = require('express');
const axios = require('axios');
const ApiTemplate = require('../models/ApiTemplate');
const Workflow = require('../models/Workflow');
const Lead = require('../models/Lead');
const { protect, authorize } = require('../middleware/auth');
const { runApiTemplate, interpolate, getByPath } = require('../services/automationRunners');

const router = express.Router();

router.get('/', protect, async (req, res) => {
  try {
    const templates = await ApiTemplate.find()
      .populate('lastModifiedBy', 'name')
      .populate({ path: 'usedInWorkflows', select: 'name status triggerEvent' })
      .sort({ updatedAt: -1 });
    res.json({ templates });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const template = await ApiTemplate.findById(req.params.id)
      .populate({ path: 'usedInWorkflows', select: 'name status triggerEvent updatedAt updatedBy' });
    if (!template) return res.status(404).json({ message: 'API template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const template = await ApiTemplate.create({
      ...req.body,
      createdBy: req.user._id,
      lastModifiedBy: req.user._id,
    });
    res.status(201).json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.put('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const template = await ApiTemplate.findByIdAndUpdate(
      req.params.id,
      { ...req.body, lastModifiedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: 'API template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Live test, step 1 of the wizard. Fires the request using whatever config is currently
// in the editor (req.body), even before the template is saved — exactly what "Test
// Template" needs to do. Never logs to a lead's Activity History (pure preview).
router.post('/:id/test', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const draft = req.body?.draft;
    let res_;
    if (draft) {
      // Test unsaved editor state directly, without persisting it yet.
      const url = interpolate(draft.endpointUrl, {});
      const headers = { ...(draft.headers || {}) };
      if (draft.auth?.type === 'bearer' && draft.auth.token) headers.Authorization = `Bearer ${draft.auth.token}`;
      if (draft.auth?.type === 'api_key' && draft.auth.headerName) headers[draft.auth.headerName] = draft.auth.headerValue || '';
      if (draft.auth?.type === 'basic' && draft.auth.username) {
        headers.Authorization = `Basic ${Buffer.from(`${draft.auth.username}:${draft.auth.password || ''}`).toString('base64')}`;
      }
      res_ = await axios({
        method: draft.method,
        url,
        headers,
        params: draft.queryParams || {},
        data: ['GET', 'DELETE'].includes(draft.method) ? undefined : (draft.bodyTemplate || {}),
        timeout: (draft.timeout || 3) * 1000,
        validateStatus: () => true,
      });
      // Cache against the template if it's already been saved (req.params.id !== 'new')
      if (req.params.id && req.params.id !== 'new') {
        await ApiTemplate.findByIdAndUpdate(req.params.id, {
          lastTestResponse: res_.data, lastTestStatus: res_.status, lastTestedAt: new Date(),
        });
      }
      return res.json({ result: { status: res_.status, ok: res_.status < 400, body: res_.data } });
    }
    // Saved template, no draft override
    const lead = req.body.leadId
      ? await Lead.findById(req.body.leadId)
      : await Lead.findOne().sort({ createdAt: -1 });
    const result = await runApiTemplate(req.params.id, { lead, user: req.user }); // logActivity not set → pure preview
    res.json({ result });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Save the Response Mapper (step 2)
router.patch('/:id/response-mapping', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { responseMapping } = req.body;
    const template = await ApiTemplate.findByIdAndUpdate(
      req.params.id,
      { responseMapping: responseMapping || [], lastModifiedBy: req.user._id },
      { new: true, runValidators: true }
    );
    if (!template) return res.status(404).json({ message: 'API template not found' });
    res.json({ template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Attach Workflow — creates a real, published Workflow document with a two-node graph
// (the chosen trigger event → "Call an API" running this template), matching exactly
// what the Workflows module itself would produce, then links it back onto this template.
router.post('/:id/attach-workflow', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { triggerEvent, triggerConfig, name } = req.body;
    const template = await ApiTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'API template not found' });
    if (!triggerEvent) return res.status(400).json({ message: 'triggerEvent is required' });

    const evtNode = { id: 'evt_0', type: 'event', event: triggerEvent, label: name || triggerEvent, x: 380, y: 60 };
    const actId = `act_${Date.now()}`;
    const actNode = { id: actId, type: 'action', actionType: 'call_api', label: 'Call an API', config: { apiTemplateId: template._id.toString() }, x: 380, y: 200 };

    const workflow = await Workflow.create({
      name: name || `${template.name} workflow`,
      kind: 'WORKFLOW',
      status: 'published',
      triggerEvent,
      triggerConfig: triggerConfig || {},
      nodes: [evtNode, actNode],
      edges: [{ from: 'evt_0', to: actId }],
      actions: [{ type: 'call_api', config: { apiTemplateId: template._id.toString() } }],
      createdBy: req.user._id,
      updatedBy: req.user._id,
    });

    template.usedInWorkflows = [...(template.usedInWorkflows || []), workflow._id];
    await template.save();

    res.status(201).json({ workflow, template });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// "View Leads" — leads whose Activity History contains an entry from this template,
// optionally filtered by one of its mapped response fields (?field=Answer&op=contains&value=scout)
router.get('/:id/leads', protect, async (req, res) => {
  try {
    const template = await ApiTemplate.findById(req.params.id);
    if (!template) return res.status(404).json({ message: 'API template not found' });
    const { field, op, value } = req.query;

    let leads = await Lead.find({ 'activities.templateName': template.name })
      .select('name phone status rating assignedTo createdAt activities')
      .populate('assignedTo', 'name')
      .sort({ createdAt: -1 });

    if (field && value) {
      leads = leads.filter((lead) =>
        lead.activities.some((a) => {
          if (a.templateName !== template.name) return false;
          const match = (a.fields || []).find((f) => f.label === field);
          if (!match) return false;
          const actual = String(match.value ?? '').toLowerCase();
          const target = String(value).toLowerCase();
          return op === 'contains' ? actual.includes(target) : actual === target;
        })
      );
    }

    res.json({ leads: leads.map(({ activities, ...rest }) => rest) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const template = await ApiTemplate.findByIdAndDelete(req.params.id);
    if (!template) return res.status(404).json({ message: 'API template not found' });
    res.json({ message: 'API template deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;