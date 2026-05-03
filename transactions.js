const express = require('express');
const router = express.Router();
const {
  createTransaction, getTransactions, getTransaction,
  voidTransaction, getSalesChart,
} = require('../controllers/transactionController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.post('/', createTransaction);
router.get('/', getTransactions);
router.get('/summary/chart', getSalesChart);
router.get('/:id', getTransaction);
router.patch('/:id/void', authorize('admin'), voidTransaction);

module.exports = router;
