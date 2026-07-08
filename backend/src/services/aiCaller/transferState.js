// backend/src/services/aiCaller/transferState.js
//
// Bridges orchestrator.js (WebSocket, closes the call when the AI decides to
// hand off) and routes/aiCaller.js's /passthru endpoint (plain HTTP, called
// by Exotel's Passthru applet right after the WS stream ends). Both run in
// the same Node process on Render, so a simple in-memory Map keyed by
// CallSid is enough — no Redis/DB round-trip needed for this handoff.
//
// Entries are short-lived (a call's Passthru hit always lands within a few
// seconds of the WS closing) but we TTL-clean anyway so a crashed/never-read
// entry doesn't sit in memory forever.

const TTL_MS = 10 * 60 * 1000; // 10 minutes
const pending = new Map(); // callSid -> { transfer: boolean, ts: number }

function cleanup() {
  const now = Date.now();
  for (const [callSid, entry] of pending) {
    if (now - entry.ts > TTL_MS) pending.delete(callSid);
  }
}

/** Call this from orchestrator.js right before closing the WS when the AI decides to hand the call to HR. */
function markForTransfer(callSid) {
  if (!callSid) return;
  cleanup();
  pending.set(callSid, { transfer: true, ts: Date.now() });
}

/** Call this from the /passthru route. Consumes (deletes) the entry so a retry doesn't double-transfer. */
function consumeTransfer(callSid) {
  if (!callSid) return false;
  cleanup();
  const entry = pending.get(callSid);
  pending.delete(callSid);
  return !!(entry && entry.transfer);
}

module.exports = { markForTransfer, consumeTransfer };