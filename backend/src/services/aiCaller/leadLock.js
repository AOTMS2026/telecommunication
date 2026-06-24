// backend/src/services/aiCaller/leadLock.js
//
// Atomic lead-locking so AI and human telecallers never dial the same lead
// at the same time. All operations go through Mongo's findOneAndUpdate
// (atomic at the document level) — never read-then-write — so concurrent
// campaignEngine ticks or simultaneous human/AI attempts cannot race.

const Lead = require('../../models/Lead');

const DEFAULT_TTL_SECONDS = 600; // longer than any realistic call; self-heals crashed sessions

/**
 * Attempt to acquire the AI lock on a lead.
 * Returns true if the lock was acquired (or renewed by the same owner), false
 * if another, still-unexpired lock holder already owns it.
 */
async function acquireLock(leadId, ownerId = 'ai-engine', ttlSeconds = DEFAULT_TTL_SECONDS) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  const result = await Lead.findOneAndUpdate(
    {
      _id: leadId,
      $or: [
        { aiLock: { $exists: false } },
        { 'aiLock.expiresAt': { $exists: false } },
        { 'aiLock.expiresAt': { $lte: now } },   // expired lock — anyone may take it
        { 'aiLock.lockedBy': ownerId },          // re-entrant — same owner renewing/heartbeating
      ],
    },
    { $set: { aiLock: { lockedBy: ownerId, lockedAt: now, expiresAt } } },
    { new: true }
  );

  return !!result;
}

/**
 * Release the lock. Only succeeds if the caller is the current holder, so a
 * stale/late release from a previous attempt can't clobber a newer lock.
 */
async function releaseLock(leadId, ownerId = 'ai-engine') {
  const result = await Lead.updateOne(
    { _id: leadId, 'aiLock.lockedBy': ownerId },
    { $unset: { aiLock: '' } }
  );
  return result.modifiedCount > 0;
}

/**
 * Heartbeat — extend an in-progress call's lock so it doesn't expire mid-call
 * on a long conversation. Safe to call periodically from the RunPod orchestrator
 * via the outcome/keepalive callback, or from campaignEngine while a dial is active.
 */
async function renewLock(leadId, ownerId = 'ai-engine', ttlSeconds = DEFAULT_TTL_SECONDS) {
  return acquireLock(leadId, ownerId, ttlSeconds);
}

/**
 * Returns true if a human currently "owns" this lead in a way the AI engine
 * should respect (i.e. the lead is assigned to a human and the AI does not
 * hold the current lock). Deliberately reuses the existing `assignedTo` field
 * instead of inventing a parallel human-lock table, to minimize new state.
 */
async function isLockedByHuman(leadId) {
  const lead = await Lead.findById(leadId).select('assignedTo aiLock');
  if (!lead) return false;
  const aiHoldsIt = lead.aiLock?.lockedBy === 'ai-engine' && lead.aiLock?.expiresAt > new Date();
  return !!lead.assignedTo && !aiHoldsIt;
}

/**
 * True if the lead currently has any unexpired lock (AI or otherwise).
 */
async function isLocked(leadId) {
  const lead = await Lead.findById(leadId).select('aiLock');
  return !!(lead?.aiLock?.expiresAt && lead.aiLock.expiresAt > new Date());
}

module.exports = { acquireLock, releaseLock, renewLock, isLockedByHuman, isLocked, DEFAULT_TTL_SECONDS };
