// Simple in-memory store. Good enough for a single Render instance / low volume testing.
// (For production with multiple instances, move this to Redis or MongoDB.)

const sessions = new Map();

function createSession(callSid, data) {
  sessions.set(callSid, { ...data, startedAt: Date.now() });
}

function getSession(callSid) {
  return sessions.get(callSid);
}

function updateSession(callSid, patch) {
  const existing = sessions.get(callSid) || {};
  sessions.set(callSid, { ...existing, ...patch });
}

function deleteSession(callSid) {
  sessions.delete(callSid);
}

module.exports = { createSession, getSession, updateSession, deleteSession };
