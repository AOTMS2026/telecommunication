// backend/src/services/aiCaller/leadLock.js

const Lead = require('../../models/Lead');

// BUG FIX: this was temporarily dropped to 90s "for faster test recovery"
// and left that way. A normal AI call — especially with the 3-minute
// transfer-eligibility window — routinely runs past 90s, so the lock was
// expiring WHILE the call was still live. campaignEngine's recoverStuckLeads()
// then saw an "expired lock + in_progress" lead, assumed it was abandoned,
// and redialed the SAME lead mid-call — causing a second concurrent call to
// the same number, duplicate finalizeCall runs, and Mongoose VersionErrors.
// 600s (10 min) comfortably covers any real call + its finalize step.
const DEFAULT_TTL_SECONDS = 600;

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