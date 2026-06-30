const crypto = require('crypto');
const AccessToken = require('../models/accessToken');

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Middleware that authenticates requests using AOTMS access tokens (atms_...).
 * Attaches req.accessToken with the matched token document.
 * Use this on public API routes that external scripts/websites call.
 */
const protectWithAccessToken = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access token required' });
  }

  const raw = header.split(' ')[1];
  if (!raw.startsWith('atms_')) {
    return res.status(401).json({ message: 'Invalid token format' });
  }

  try {
    const tokenHash = hashToken(raw);
    const token = await AccessToken.findOne({ tokenHash, status: 'active' });
    if (!token) {
      return res.status(401).json({ message: 'Token not found or revoked' });
    }

    // Update usage stats (non-blocking)
    AccessToken.findByIdAndUpdate(token._id, {
      lastUsedAt: new Date(),
      $inc: { requestCount: 1 },
    }).catch(() => {});

    req.accessToken = token;
    next();
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { protectWithAccessToken };