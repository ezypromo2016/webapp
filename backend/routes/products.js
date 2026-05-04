const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const {
  getProducts, getProduct, getByBarcode,
  createProduct, updateProduct, deleteProduct, adjustStock,
} = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');

const productValidation = [
  body('name').trim().notEmpty().withMessage('Product name required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price required'),
  body('category').isMongoId().withMessage('Valid category required'),
  body('stock').optional().isInt({ min: 0 }).withMessage('Stock must be non-negative'),
];

// All routes require authentication
router.use(authenticate);

router.get('/', getProducts);
router.get('/barcode/:barcode', getByBarcode);
router.get('/:id', getProduct);
router.post('/', authorize('admin'), productValidation, createProduct);
router.put('/:id', authorize('admin'), updateProduct);
router.patch('/:id/stock', authorize('admin'), adjustStock);
router.delete('/:id', authorize('admin'), deleteProduct);

module.exports = router;
