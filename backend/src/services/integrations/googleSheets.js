const { google } = require('googleapis');
const Lead = require('../../models/Lead');
const Integration = require('../../models/Integration');
const { fireEvent } = require('../workflowEngine');
const { broadcastWebhooks } = require('../automationRunners');

// Accepts either a raw Sheet ID or a full Google Sheets URL and returns just the ID
function extractSheetId(raw) {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  const match = trimmed.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : trimmed;
}

function getOAuth2Client(config) {
  if (!config || (!config.refreshToken && !config.accessToken)) {
    const err = new Error('Google account not connected. Click "Connect with Google (OAuth)" in Step 1 and authorize access first.');
    err.code = 'GOOGLE_NOT_CONNECTED';
    throw err;
  }
  const client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
  client.setCredentials({
    refresh_token: config.refreshToken,
    access_token: config.accessToken,
  });
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

// Fetch header row (first row) of a sheet range so the UI can offer a column picker
async function getColumns(integration, sheetIdRaw, rangeRaw) {
  const sheetId = extractSheetId(sheetIdRaw || integration.config?.sheetId);
  if (!sheetId) {
    const err = new Error('Enter a Sheet ID first.');
    err.code = 'SHEET_ID_MISSING';
    throw err;
  }
  const range = rangeRaw || 'Sheet1!A1:Z1';
  const auth = getOAuth2Client(integration.config);
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
    const headerRow = (res.data.values && res.data.values[0]) || [];
    return headerRow.map(h => String(h).trim()).filter(Boolean);
  } catch (e) {
    if (e.code === 404 || e.response?.status === 404) {
      throw new Error('Sheet not found. Double-check the Sheet ID and make sure the sheet is shared with the Google account you connected.');
    }
    const apiMsg = e.errors?.[0]?.message || e.message || '';
    if (/unable to parse range/i.test(apiMsg)) {
      const requestedTab = range.split('!')[0].replace(/^'|'$/g, '');
      let availableTabs = [];
      try {
        const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId, fields: 'sheets.properties.title' });
        availableTabs = (meta.data.sheets || []).map(s => s.properties.title);
      } catch (_) { /* ignore, fall back to generic message */ }

      let message = `Tab "${requestedTab}" doesn't exist in this spreadsheet.`;
      if (availableTabs.length === 1) {
        message += ` This spreadsheet's only tab is named "${availableTabs[0]}". Update Sheet Range to "${availableTabs[0]}!A1:Z1000" and try again.`;
      } else if (availableTabs.length > 1) {
        message += ` Available tabs: ${availableTabs.join(', ')}. Update Sheet Range to use one of these, e.g. "${availableTabs[0]}!A1:Z1000".`;
      } else {
        message += ` Open the sheet and check the exact tab name at the bottom (case-sensitive), then update Sheet Range.`;
      }

      const err = new Error(message);
      err.code = 'SHEET_TAB_NOT_FOUND';
      err.availableTabs = availableTabs;
      throw err;
    }
    throw e;
  }
}

// Import leads from a single {sheetId, sheetRange, fieldMapping} source.
// Only columns explicitly selected in fieldMapping are read — unmapped fields are left blank.
async function importFromOneSource(integration, source) {
  const sheetId = extractSheetId(source.sheetId);
  if (!sheetId) return { imported: 0, skipped: 0, error: 'No Sheet ID set for this sheet.' };

  const range = source.sheetRange || 'Sheet1!A1:Z1000';
  const mapping = source.fieldMapping || {};
  if (!mapping.phone) return { imported: 0, skipped: 0, error: 'Phone column not mapped — this sheet was skipped.' };

  const auth = getOAuth2Client(integration.config);
  const sheets = google.sheets({ version: 'v4', auth });

  const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
  const rows = res.data.values || [];
  if (rows.length < 2) return { imported: 0, skipped: 0 };

  const headers = rows[0].map(h => String(h).trim());
  const colIndex = (colName) => (colName ? headers.indexOf(colName) : -1);

  const nameCol = colIndex(mapping.name);
  const phoneCol = colIndex(mapping.phone);
  const alternatePhoneCol = colIndex(mapping.alternatePhone);
  const emailCol = colIndex(mapping.email);
  const locationCol = colIndex(mapping.location);
  const collegeNameCol = colIndex(mapping.collegeName);
  const lastQualificationCol = colIndex(mapping.lastQualification);
  const modeCol = colIndex(mapping.mode);
  const budgetCol = colIndex(mapping.budget);

  const extraColumns = Array.isArray(source.extraColumns) ? source.extraColumns : [];
  const extraColIndexes = extraColumns
    .map(col => ({ col, i: headers.indexOf(col) }))
    .filter(({ i }) => i >= 0);

  let imported = 0, skipped = 0, updated = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const phone = phoneCol >= 0 ? row[phoneCol]?.trim() : '';
    if (!phone) { skipped++; continue; }

    const existing = await Lead.findOne({ phone });
    if (existing) {
      // Lead already exists. Always sync it to whatever campaign/assignee is
      // currently set in Step 3 / Step 4 of this integration's config — so
      // changing those and re-importing actually re-assigns the lead, instead
      // of only filling in blanks.
      const backfill = {};
      if (integration.defaultCampaign && String(existing.campaign || '') !== String(integration.defaultCampaign)) {
        backfill.campaign = integration.defaultCampaign;
      }
      if (integration.defaultAssignedTo && String(existing.assignedTo || '') !== String(integration.defaultAssignedTo)) {
        backfill.assignedTo = integration.defaultAssignedTo;
      }
      if (Object.keys(backfill).length > 0) {
        await Lead.findByIdAndUpdate(existing._id, { $set: backfill });
        updated++;
      }
      skipped++;
      continue;
    }

    const customFields = {};
    for (const { col, i: ci } of extraColIndexes) {
      const val = row[ci];
      if (val !== undefined && val !== null && String(val).trim() !== '') customFields[col] = String(val).trim();
    }

    const validModes = ['Online', 'Offline', 'Hybrid'];
    const rawMode = modeCol >= 0 ? row[modeCol]?.trim() : '';
    const rawBudget = budgetCol >= 0 ? row[budgetCol]?.trim() : '';

    const lead = await Lead.create({
      name: (nameCol >= 0 ? row[nameCol]?.trim() : '') || 'Sheet Lead',
      phone,
      alternatePhone: alternatePhoneCol >= 0 ? row[alternatePhoneCol]?.trim() || '' : '',
      email: emailCol >= 0 ? row[emailCol]?.trim() || '' : '',
      location: locationCol >= 0 ? row[locationCol]?.trim() || '' : '',
      collegeName: collegeNameCol >= 0 ? row[collegeNameCol]?.trim() || '' : '',
      lastQualification: lastQualificationCol >= 0 ? row[lastQualificationCol]?.trim() || '' : '',
      mode: validModes.includes(rawMode) ? rawMode : '',
      budget: rawBudget && !isNaN(Number(rawBudget)) ? Number(rawBudget) : 0,
      customFields,
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

  return { imported, skipped, updated };
}

// Get sheet rows and import as leads. Supports multiple sheet sources
// (integration.config.sheetSources) each with its own sheetId/range/fieldMapping,
// falling back to the single legacy sheetId/sheetRange/fieldMapping if none are set.
async function importLeadsFromSheet(integration) {
  const sources = (integration.config?.sheetSources && integration.config.sheetSources.length > 0)
    ? integration.config.sheetSources
    : [{ sheetId: integration.config?.sheetId, sheetRange: integration.config?.sheetRange, fieldMapping: integration.fieldMapping }];

  if (!sources.some(s => s.sheetId)) {
    const err = new Error('No Google Sheet ID set. Enter your Sheet ID in Step 1 and save before importing.');
    err.code = 'SHEET_ID_MISSING';
    throw err;
  }

  let imported = 0, skipped = 0, updated = 0;
  const perSheet = [];

  for (const source of sources) {
    const result = await importFromOneSource(integration, source);
    imported += result.imported;
    skipped += result.skipped;
    updated += result.updated || 0;
    perSheet.push({ sheetId: source.sheetId, name: source.name || '', ...result });
  }

  return { imported, skipped, updated, perSheet };
}

// Append a lead to a Google Sheet (export)
async function appendLeadToSheet(integration, leadData) {
  const auth = getOAuth2Client(integration.config);
  const sheets = google.sheets({ version: 'v4', auth });

  const sheetId = extractSheetId(integration.config.sheetId);
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
  if (!integration.config?.sheetId) {
    const err = new Error('No Google Sheet ID set. Enter your Sheet ID in Step 1 and save before testing.');
    err.code = 'SHEET_ID_MISSING';
    throw err;
  }
  const auth = getOAuth2Client(integration.config);
  const sheets = google.sheets({ version: 'v4', auth });
  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId: extractSheetId(integration.config.sheetId), fields: 'sheets.properties' });
    return res.data.sheets.map(s => ({ id: s.properties.sheetId, title: s.properties.title }));
  } catch (e) {
    if (e.code === 404 || e.response?.status === 404) {
      throw new Error('Sheet not found. Double-check the Sheet ID (not the full URL) and make sure the sheet is shared with the Google account you connected.');
    }
    throw e;
  }
}

module.exports = { getAuthUrl, exchangeCode, importLeadsFromSheet, appendLeadToSheet, listSheets, extractSheetId, getColumns };