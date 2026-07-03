// backend/src/services/aiCaller/leadLock.js
// Reduced TTL to 90s for faster recovery during testing.
// Change back to 600 for production.

const Lead = require('../../models/Lead');

const DEFAULT_TTL_SECONDS = 90; // was 600 (10 min) — reduced for faster test recovery

async function acquireLock(leadId, ownerId = 'ai-engine', ttlSeconds = DEFAULT_TTL_SECONDS) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const result = await Lead.updateOne(
    {
      _id: leadId,
      $or: [
        { aiLock: { $exists: false } },
        { 'aiLock.expiresAt': { $exists: false } },
        { 'aiLock.expiresAt': { $lte: now } },
      ],
    },
    { $set: { aiLock: { lockedBy: ownerId, lockedAt: now, expiresAt } } }
  );

  return result.modifiedCount === 1;
}

async function releaseLock(leadId, ownerId = 'ai-engine') {
  await Lead.updateOne(
    { _id: leadId, 'aiLock.lockedBy': ownerId },
    { $unset: { aiLock: '' } }
  );
}

async function renewLock(leadId, ownerId = 'ai-engine', ttlSeconds = DEFAULT_TTL_SECONDS) {
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  await Lead.updateOne(
    { _id: leadId, 'aiLock.lockedBy': ownerId },
    { $set: { 'aiLock.expiresAt': expiresAt } }
  );
}

async function isLockedByHuman(leadId) {
  const lead = await Lead.findById(leadId).select('aiLock').lean();
  const aiHoldsIt = lead.aiLock?.lockedBy === 'ai-engine' && lead.aiLock?.expiresAt > new Date();
  return !aiHoldsIt && !!(lead?.aiLock?.expiresAt && lead.aiLock.expiresAt > new Date());
}

async function isLocked(leadId) {
  const lead = await Lead.findById(leadId).select('aiLock').lean();
  return !!(lead?.aiLock?.expiresAt && lead.aiLock.expiresAt > new Date());
}

module.exports = { acquireLock, releaseLock, renewLock, isLockedByHuman, isLocked, DEFAULT_TTL_SECONDS };