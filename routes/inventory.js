const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

router.get('/low-stock', async (req, res) => {
  try {
    const products = await Product.findLowStock();
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch low stock products.' });
  }
});

router.get('/out-of-stock', async (req, res) => {
  try {
    const products = await Product.find({ isActive: true, stock: 0 }).populate('category', 'name');
    res.json({ success: true, data: products });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed.' });
  }
});

router.get('/summary', async (req, res) => {
  try {
    const [total, lowStock, outOfStock, valueData] = await Promise.all([
      Product.countDocuments({ isActive: true }),
      Product.countDocuments({ isActive: true, $expr: { $and: [{ $lte: ['$stock', '$lowStockThreshold'] }, { $gt: ['$stock', 0] }] } }),
      Product.countDocuments({ isActive: true, stock: 0 }),
      Product.aggregate([
        { $match: { isActive: true } },
        { $group: { _id: null, costValue: { $sum: { $multiply: ['$stock', '$cost'] } }, retailValue: { $sum: { $multiply: ['$stock', '$price'] } } } },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        totalProducts: total,
        lowStockCount: lowStock,
        outOfStockCount: outOfStock,
        totalCostValue: valueData[0]?.costValue || 0,
        totalRetailValue: valueData[0]?.retailValue || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch inventory summary.' });
  }
});

module.exports = router;
