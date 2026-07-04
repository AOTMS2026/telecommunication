const crypto = require('crypto');
const McpConnection = require('../models/McpConnection');

// Validates the mcp_xxx bearer token issued at approval time (see routes/mcp.js
// PATCH /:id/approve) against the stored hash. Attaches req.mcpConnection.
async function protectMcp(req, res, next) {
  const id = req.body?.id ?? null;
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ jsonrpc: '2.0', id, error: { code: -32001, message: 'Missing bearer token' } });
  }
  const raw = header.slice(7).trim();
  if (!raw.startsWith('mcp_')) {
    return res.status(401).json({ jsonrpc: '2.0', id, error: { code: -32001, message: 'Invalid token format' } });
  }
  try {
    const tokenHash = crypto.createHash('sha256').update(raw).digest('hex');
    const conn = await McpConnection.findOne({ tokenHash, status: 'approved' });
    if (!conn) {
      return res.status(401).json({ jsonrpc: '2.0', id, error: { code: -32001, message: 'Token revoked or not found' } });
    }
    conn.lastUsedAt = new Date();
    conn.save().catch(() => {});
    req.mcpConnection = conn;
    next();
  } catch (err) {
    res.status(500).json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
  }
}

module.exports = { protectMcp };