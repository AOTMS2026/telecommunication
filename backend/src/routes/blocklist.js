const express = require('express');
const Blocklist = require('../models/Blocklist');
const Lead = require('../models/Lead');
const { protect } = require('../middleware/auth');
const router = express.Router();

const restoreLeadStatus = async (phone) => {
  try {
    const cleanPhone = String(phone || '').replace(/\D/g, '');
    if (!cleanPhone) return;

    const leads = await Lead.find({ phone: cleanPhone });
    for (const lead of leads) {
      if (lead.status === 'Blocked') {
        const previousStatus = lead.status;
        lead.status = 'Fresh';
        lead.activities.unshift({
          type: 'status_change',
          description: `Status changed from ${previousStatus} to Fresh after unblocking`,
          performedBy: null,
        });
        await lead.save();
      }
    }
  } catch (err) {
    console.error('Failed to restore lead status after unblocking:', err);
  }
};

// GET /api/blocklist
router.get('/', protect, async (req, res) => {
  try {
    const { search } = req.query;
    const query = {};
    if (search) {
      query.$or = [
        { phone: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    const list = await Blocklist.find(query)
      .populate('blockedBy', 'name')
      .sort({ createdAt: -1 });
    res.json({ blocklist: list });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/blocklist
router.post('/', protect, async (req, res) => {
  try {
    const { phone, name, reason } = req.body;
    if (!phone) return res.status(400).json({ message: 'Phone number is required' });
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 10) return res.status(400).json({ message: 'Invalid phone number' });

    const existing = await Blocklist.findOne({ phone: cleanPhone });
    if (existing) return res.status(400).json({ message: 'This number is already blocked', entry: existing });

    const entry = await Blocklist.create({
      phone: cleanPhone,
      name: name || 'Anonymous',
      reason: reason || 'Spam Lead',
      blockedBy: req.user._id,
    });
    await entry.populate('blockedBy', 'name');
    res.status(201).json({ entry });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/blocklist/:id  (by MongoDB _id)
router.delete('/:id', protect, async (req, res) => {
  try {
    const entry = await Blocklist.findById(req.params.id);
    if (!entry) return res.status(404).json({ message: 'Blocklist entry not found' });

    await Blocklist.findByIdAndDelete(req.params.id);
    await restoreLeadStatus(entry.phone);

    res.json({ message: 'Unblocked successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE /api/blocklist/phone/:phone  (by phone number — used from lead view)
router.delete('/phone/:phone', protect, async (req, res) => {
  try {
    const cleanPhone = req.params.phone.replace(/[^0-9]/g, '');
    const result = await Blocklist.findOneAndDelete({ phone: cleanPhone });
    if (!result) return res.status(404).json({ message: 'Number not found in blocklist' });

    await restoreLeadStatus(cleanPhone);

    res.json({ message: 'Unblocked successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/blocklist/check/:phone — check if a phone is blocked
router.get('/check/:phone', protect, async (req, res) => {
  try {
    const phone = req.params.phone.replace(/[^0-9]/g, '');
    const entry = await Blocklist.findOne({ phone });
    res.json({ blocked: !!entry, entry: entry || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;