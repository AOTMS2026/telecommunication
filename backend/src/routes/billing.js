const express = require('express');
const { BillingInfo, Transaction, License } = require('../models/Billing');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /api/billing/info
router.get('/info', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const info = await BillingInfo.findOne().sort({ createdAt: -1 });
    res.json({ info: info || null, hasBilling: !!info });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/billing/info
router.post('/info', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { country, companyName, address, address2, pincode, email, phone } = req.body;
    if (!companyName || !address || !pincode || !email || !phone) {
      return res.status(400).json({ message: 'All required fields must be filled.' });
    }
    let info = await BillingInfo.findOne().sort({ createdAt: -1 });
    if (info) {
      Object.assign(info, { country, companyName, address, address2, pincode, email, phone });
      await info.save();
    } else {
      info = await BillingInfo.create({
        country, companyName, address, address2, pincode, email, phone,
        createdBy: req.user._id,
      });
    }
    res.json({ info });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/billing/transactions
router.get('/transactions', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { status, cycle, page = 1, limit = 20 } = req.query;
    const query = {};
    if (status) {
      const statuses = Array.isArray(status) ? status : status.split(',');
      query.status = { $in: statuses };
    }
    if (cycle) query.cycle = cycle;
    const total = await Transaction.countDocuments(query);
    const transactions = await Transaction.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));
    res.json({ transactions, total, page: Number(page), pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/billing/licenses
router.get('/licenses', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const license = await License.findOne().sort({ createdAt: -1 });
    res.json({ license: license || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/billing/buy
router.post('/buy', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const { plan, licenses = 1, cycle = 'Monthly' } = req.body;
    if (!plan) return res.status(400).json({ message: 'Plan is required' });

    const PRICES = { Starter: 999, Growth: 1999, Pro: 3999 };
    const CYCLE_MULT = { Monthly: 1, Quarterly: 2.7, Annually: 10 };
    const unitPrice = PRICES[plan] || 999;
    const amount = Math.round(unitPrice * licenses * (CYCLE_MULT[cycle] || 1));

    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const transaction = await Transaction.create({
      orderId, plan, licenses, amount, cycle,
      status: 'Pending Payment',
      createdBy: req.user._id,
    });

    res.json({
      transaction,
      orderId,
      amount,
      currency: 'INR',
      message: 'Order created. Complete payment to activate.',
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;