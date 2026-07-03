const Integration = require('../models/Integration');
const googleSheets = require('./integrations/googleSheets');

let running = false;

async function syncAllActiveSheets() {
  if (running) return; // avoid overlapping runs
  running = true;
  try {
    const integrations = await Integration.find({ type: 'google_sheets', status: 'active' });
    for (const integration of integrations) {
      if (!integration.config?.refreshToken && !integration.config?.accessToken) continue; // not connected yet
      const hasSheet = integration.config?.sheetId || (integration.config?.sheetSources || []).some(s => s.sheetId);
      if (!hasSheet) continue;

      try {
        const result = await googleSheets.importLeadsFromSheet(integration);
        await Integration.findByIdAndUpdate(integration._id, {
          $set: {
            lastAutoSyncAt: new Date(),
            lastAutoSyncResult: { imported: result.imported, skipped: result.skipped, updated: result.updated || 0 },
            lastAutoSyncError: null,
          },
        });
      } catch (err) {
        console.error(`[sheetsAutoSync] failed for integration ${integration._id}:`, err.message);
        await Integration.findByIdAndUpdate(integration._id, {
          $set: { lastAutoSyncAt: new Date(), lastAutoSyncError: err.message },
        });
      }
    }
  } catch (err) {
    console.error('[sheetsAutoSync] poller error:', err.message);
  } finally {
    running = false;
  }
}

function startSheetsAutoSyncPoller(intervalMs = 2 * 60 * 1000) {
  syncAllActiveSheets(); // run once immediately on boot
  setInterval(syncAllActiveSheets, intervalMs);
  console.log(`[sheetsAutoSync] Google Sheets auto-sync poller started (every ${Math.round(intervalMs / 1000)}s)`);
}

module.exports = { startSheetsAutoSyncPoller, syncAllActiveSheets };