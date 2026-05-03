const express = require('express');
const router = express.Router();
const { getSummary, getChartData, getPaymentBreakdown } = require('../controllers/dashboardController');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/summary', getSummary);
router.get('/chart', getChartData);
router.get('/payment-breakdown', getPaymentBreakdown);

module.exports = router;
