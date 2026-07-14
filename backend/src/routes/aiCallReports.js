// backend/src/routes/aiCallReports.js
//
// ====================== NEW (AI Call Reports extension) ======================
// Read-only reporting surface over the AiCallReport collection populated by
// services/aiCaller/aiCallReportService.js. Does not touch the AI calling
// flow itself — it only reads what that flow has already written.

const express = require('express');
const AiCallReport = require('../models/AiCallReport');
const { protect, authorize } = require('../middleware/auth');
const router = express.Router();

function dateRangeFilter(req) {
  const filter = {};
  if (req.query.startDate || req.query.endDate) {
    filter.createdAt = {};
    if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
    if (req.query.endDate) {
      const end = new Date(req.query.endDate);
      end.setHours(23, 59, 59, 999);
      filter.createdAt.$lte = end;
    }
  }
  return filter;
}

// GET /api/ai-call-reports
// Query: page, limit, campaign, interestStatus, search, startDate, endDate
router.get('/', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);

    const query = { ...dateRangeFilter(req) };
    if (req.query.campaign) query.campaign = req.query.campaign;
    if (req.query.interestStatus) query.interestStatus = req.query.interestStatus;
    if (req.query.demoScheduled === 'true') query.demoScheduled = true;
    if (req.query.search) {
      const re = new RegExp(req.query.search.trim(), 'i');
      query.$or = [{ studentName: re }, { mobileNumber: re }, { campaignName: re }];
    }

    const [reports, total] = await Promise.all([
      AiCallReport.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('lead', 'name phone'),
      AiCallReport.countDocuments(query),
    ]);

    res.json({ reports, total, page, pages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error('[aiCallReports] list error:', err.message);
    res.status(500).json({ message: 'Failed to load AI call reports' });
  }
});

// GET /api/ai-call-reports/dashboard
router.get('/dashboard', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      overallCalls,
      interested,
      demoScheduled,
      followUp,
      notInterested,
      todayDemoCount,
    ] = await Promise.all([
      AiCallReport.countDocuments({}),
      AiCallReport.countDocuments({ interestStatus: 'Interested' }),
      AiCallReport.countDocuments({ demoScheduled: true }),
      AiCallReport.countDocuments({ interestStatus: 'Follow-up' }),
      AiCallReport.countDocuments({ interestStatus: 'Not Interested' }),
      AiCallReport.countDocuments({ demoDate: { $gte: todayStart, $lte: todayEnd } }),
    ]);

    res.json({
      overallCalls,
      interested,
      demoScheduled,
      followUp,
      notInterested,
      todayDemoCount,
    });
  } catch (err) {
    console.error('[aiCallReports] dashboard error:', err.message);
    res.status(500).json({ message: 'Failed to load AI call reports dashboard' });
  }
});

// GET /api/ai-call-reports/analytics?days=7|30
router.get('/analytics', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const days = [7, 30].includes(parseInt(req.query.days)) ? parseInt(req.query.days) : 7;
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const [
      campaignVsInterested,
      campaignVsDemo,
      dailyCalls,
      pieDistribution,
    ] = await Promise.all([
      AiCallReport.aggregate([
        { $match: { interestStatus: 'Interested' } },
        { $group: { _id: { $ifNull: ['$campaignName', 'Unassigned'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      AiCallReport.aggregate([
        { $match: { demoScheduled: true } },
        { $group: { _id: { $ifNull: ['$campaignName', 'Unassigned'] }, count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 15 },
      ]),
      AiCallReport.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'Asia/Kolkata' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      AiCallReport.aggregate([
        { $group: { _id: '$interestStatus', count: { $sum: 1 } } },
      ]),
    ]);

    res.json({
      campaignVsInterested: campaignVsInterested.map(d => ({ campaign: d._id, count: d.count })),
      campaignVsDemo: campaignVsDemo.map(d => ({ campaign: d._id, count: d.count })),
      dailyCalls: dailyCalls.map(d => ({ date: d._id, count: d.count })),
      pieDistribution: pieDistribution.map(d => ({ status: d._id, count: d.count })),
    });
  } catch (err) {
    console.error('[aiCallReports] analytics error:', err.message);
    res.status(500).json({ message: 'Failed to load AI call reports analytics' });
  }
});

// GET /api/ai-call-reports/:id
router.get('/:id', protect, authorize('manager', 'admin'), async (req, res) => {
  try {
    const report = await AiCallReport.findById(req.params.id).populate('lead', 'name phone');
    if (!report) return res.status(404).json({ message: 'Report not found' });
    res.json({ report });
  } catch (err) {
    console.error('[aiCallReports] get one error:', err.message);
    res.status(500).json({ message: 'Failed to load report' });
  }
});

module.exports = router;
