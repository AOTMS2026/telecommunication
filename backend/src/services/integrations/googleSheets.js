const { google } = require('googleapis');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');
const { broadcastWebhooks } = require('../automationRunners');

function getOAuth2Client(config) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  if (config.refreshToken) {
    client.setCredentials({
      refresh_token: config.refreshToken,
      access_token: config.accessToken,
    });
  }
  return client;
}

// Generate OAuth URL for user to authorize
function getAuthUrl(state) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
    ],
    state,
  });
}

// Exchange auth code for tokens
async function exchangeCode(code) {
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  const { tokens } = await client.getToken(code);
  return tokens; // { access_token, refresh_token, expiry_date }
}

// Get sheet rows and import as leads
async function importLeadsFromSheet(integration) {
  const auth = getOAuth2Client(integration.config);
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetId = integration.config.sheetId;
  const range = integration.config.sheetRange || 'Sheet1!A1:Z1000';

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = res.data.values || [];
  if (rows.length < 2) return { imported: 0, skipped: 0 };

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const mapping = integration.fieldMapping || {};

  const nameCol = headers.indexOf(mapping.name || 'name');
  const phoneCol = headers.indexOf(mapping.phone || 'phone');
  const emailCol = headers.indexOf(mapping.email || 'email');
  const locationCol = headers.indexOf(mapping.location || 'location');

  let imported = 0, skipped = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const phone = row[phoneCol]?.trim();
    if (!phone) { skipped++; continue; }

    const existing = await Lead.findOne({ phone });
    if (existing) { skipped++; continue; }

    const lead = await Lead.create({
      name: row[nameCol]?.trim() || 'Sheet Lead',
      phone,
      email: emailCol >= 0 ? row[emailCol]?.trim() : '',
      location: locationCol >= 0 ? row[locationCol]?.trim() : '',
      leadSource: 'Google Sheets',
      status: 'Fresh',
      campaign: integration.defaultCampaign || undefined,
      assignedTo: integration.defaultAssignedTo || undefined,
    });

    await Integration.findByIdAndUpdate(integration._id, {
      $inc: { totalLeadsImported: 1 },
      $set: { lastLeadAt: new Date() },
    });

    const ctx = { lead, user: null, changes: { source: 'google_sheets' } };
    fireEvent('lead.created', ctx).catch(() => {});
    broadcastWebhooks('lead.created', { lead: { id: lead._id, name: lead.name, phone, source: 'google_sheets' } }).catch(() => {});
    imported++;
  }

  return { imported, skipped };
}

// Append a lead to a Google Sheet (export)
async function appendLeadToSheet(integration, leadData) {
  const auth = getOAuth2Client(integration.config);
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetId = integration.config.sheetId;
  const range = integration.config.sheetRange || 'Sheet1!A1';

  await sheets.spreadsheets.values.append({
    spreadsheetId: sheetId,
    range,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [[leadData.name, leadData.phone, leadData.email || '', leadData.location || '', leadData.status || 'Fresh', new Date().toLocaleDateString()]],
    },
  });
}

// List sheets in a spreadsheet
async function listSheets(integration) {
  const auth = getOAuth2Client(integration.config);
  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.get({ spreadsheetId: integration.config.sheetId, fields: 'sheets.properties' });
  return res.data.sheets.map(s => ({ id: s.properties.sheetId, title: s.properties.title }));
}

module.exports = { getAuthUrl, exchangeCode, importLeadsFromSheet, appendLeadToSheet, listSheets };