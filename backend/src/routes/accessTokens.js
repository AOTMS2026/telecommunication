const express = require('express');
const crypto = require('crypto');
const AccessToken = require('../models/AccessToken');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

const MAX_TOKENS = 6; // matches the "Access Tokens (0/6)" cap shown in the reference UI

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

router.get('/', protect, async (req, res) => {
  try {
    const tokens = await AccessToken.find()
      .select('-tokenHash')
      .populate('createdBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ tokens, max: MAX_TOKENS, used: tokens.length });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create a token. The raw token value is returned ONCE here and never stored.
router.post('/', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const count = await AccessToken.countDocuments({ status: 'active' });
    if (count >= MAX_TOKENS) {
      return res.status(400).json({ message: `Token limit reached (${MAX_TOKENS}). Revoke one first.` });
    }
    const { name, apiType, recapturePreference } = req.body;
    if (!name) return res.status(400).json({ message: 'Token name is required' });

    const rawToken = `atms_${crypto.randomBytes(24).toString('hex')}`;
    const token = await AccessToken.create({
      name,
      apiType: apiType || 'async',
      recapturePreference: recapturePreference || 'once_a_day',
      tokenHash: hashToken(rawToken),
      tokenPrefix: rawToken.slice(0, 10),
      createdBy: req.user._id,
    });

    res.status(201).json({
      token: { ...token.toObject(), tokenHash: undefined },
      rawToken, // show once — client must copy/download immediately
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.patch('/:id/revoke', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const token = await AccessToken.findByIdAndUpdate(req.params.id, { status: 'revoked' }, { new: true }).select('-tokenHash');
    if (!token) return res.status(404).json({ message: 'Token not found' });
    res.json({ token });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.delete('/:id', protect, authorize('admin', 'super admin'), async (req, res) => {
  try {
    const token = await AccessToken.findByIdAndDelete(req.params.id);
    if (!token) return res.status(404).json({ message: 'Token not found' });
    res.json({ message: 'Token deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
module.exports.hashToken = hashToken;