/**
 * Dashboard Controller
 * KPIs, charts, and summary data
 */

const Transaction = require('../models/Transaction');
const Product = require('../models/Product');
const User = require('../models/User');

/**
 * GET /api/dashboard/summary
 * Today's and overall summary
 */
exports.getSummary = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));

    // Today's summary
    const [todaySummary] = await Transaction.getDailySummary();

    // This week
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const [weekData] = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfWeek }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]);

    // This month
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const [monthData] = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
    ]);

    // Product stats
    const [totalProducts, lowStockProducts, outOfStockProducts] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, $expr: { $and: [{ $lte: ['$stock', '$lowStockThreshold'] }, { $gt: ['$stock', 0] }] } }),
      Product.countDocuments({ isActive: true, stock: 0 }),
    ]);

    // Recent transactions
    const recentTransactions = await Transaction.find({ status: 'completed' })
      .populate('cashier', 'name')
      .sort({ createdAt: -1 })
      .limit(5);

    // Top selling products (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topProducts = await Transaction.aggregate([
      { $match: { createdAt: { $gte: thirtyDaysAgo }, status: 'completed' } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.product',
          name: { $first: '$items.productName' },
          totalQty: { $sum: '$items.quantity' },
          totalRevenue: { $sum: '$items.total' },
        },
      },
      { $sort: { totalQty: -1 } },
      { $limit: 5 },
    ]);

    res.json({
      success: true,
      data: {
        today: todaySummary || { totalSales: 0, totalTransactions: 0, cashTotal: 0, gcashTotal: 0, cardTotal: 0 },
        week: weekData || { total: 0, count: 0 },
        month: monthData || { total: 0, count: 0 },
        inventory: { totalProducts, lowStockProducts, outOfStockProducts },
        recentTransactions,
        topProducts,
      },
    });
  } catch (err) {
    console.error('Dashboard summary error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch dashboard data.' });
  }
};

/**
 * GET /api/dashboard/chart
 * Sales chart data
 */
exports.getChartData = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (days - 1));
    startDate.setHours(0, 0, 0, 0);

    const rawData = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startDate }, status: 'completed' } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Fill in missing days with 0
    const filled = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(startDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const found = rawData.find(r => r._id === key);
      filled.push({
        date: key,
        total: found ? found.total : 0,
        count: found ? found.count : 0,
      });
    }

    res.json({ success: true, data: filled });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch chart data.' });
  }
};

/**
 * GET /api/dashboard/payment-breakdown
 */
exports.getPaymentBreakdown = async (req, res) => {
  try {
    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    const data = await Transaction.aggregate([
      { $match: { createdAt: { $gte: startOfMonth }, status: 'completed' } },
      {
        $group: {
          _id: '$paymentMethod',
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch payment data.' });
  }
};
