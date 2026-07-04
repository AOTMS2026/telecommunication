const Lead = require('../models/Lead');
const CallRecording = require('../models/CallRecording');
const Integration = require('../models/Integration');

const TOOLS = [
  {
    name: 'list_leads',
    description: 'List CRM leads, optionally filtered by status or search text (name/phone). Read-only.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', description: 'Filter by lead status, e.g. Fresh, Interested, Not Interested' },
        search: { type: 'string', description: 'Search by name or phone' },
        limit: { type: 'number', description: 'Max results (default 20, max 100)' },
      },
    },
  },
  {
    name: 'get_lead',
    description: 'Get full details for a single lead by its ID. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { leadId: { type: 'string', description: 'The lead _id' } },
      required: ['leadId'],
    },
  },
  {
    name: 'list_call_recordings',
    description: 'List recent call recordings with phone, transcript status, and Call IQ English summary if available. Read-only.',
    inputSchema: {
      type: 'object',
      properties: { limit: { type: 'number', description: 'Max results (default 20, max 100)' } },
    },
  },
  {
    name: 'list_integrations',
    description: 'List configured lead-source integrations (JustDial, Facebook, Google Sheets, etc.) and their status. Read-only.',
    inputSchema: { type: 'object', properties: {} },
  },
];

function clampLimit(n, def = 20, max = 100) {
  const v = Number(n) || def;
  return Math.min(Math.max(v, 1), max);
}

async function callTool(name, args = {}) {
  switch (name) {
    case 'list_leads': {
      const query = {};
      if (args.status) query.status = args.status;
      if (args.search) {
        query.$or = [
          { name: { $regex: args.search, $options: 'i' } },
          { phone: { $regex: args.search } },
        ];
      }
      const leads = await Lead.find(query)
        .select('name phone email status leadSource createdAt')
        .sort({ createdAt: -1 })
        .limit(clampLimit(args.limit))
        .lean();
      return { count: leads.length, leads };
    }

    case 'get_lead': {
      if (!args.leadId) throw new Error('leadId is required');
      const lead = await Lead.findById(args.leadId).lean();
      if (!lead) throw new Error('Lead not found');
      return { lead };
    }

    case 'list_call_recordings': {
      const recordings = await CallRecording.find()
        .select('phone transcript transcriptStatus lastCallIqReport recordedAt')
        .sort({ recordedAt: -1 })
        .limit(clampLimit(args.limit))
        .lean();
      return {
        count: recordings.length,
        recordings: recordings.map(r => ({
          phone: r.phone,
          recordedAt: r.recordedAt,
          transcriptStatus: r.transcriptStatus,
          summary: r.lastCallIqReport?.result?.summary || null,
          transcript: r.lastCallIqReport?.result?.summary ? undefined : r.transcript,
        })),
      };
    }

    case 'list_integrations': {
      const integrations = await Integration.find()
        .select('name type status totalLeadsImported lastLeadAt')
        .lean();
      return { count: integrations.length, integrations };
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

module.exports = { TOOLS, callTool };