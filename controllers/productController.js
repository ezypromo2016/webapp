/**
 * Products Controller
 * Full CRUD + search + barcode lookup + stock management
 */

const { validationResult } = require('express-validator');
const Product = require('../models/Product');
const Category = require('../models/Category');

/**
 * GET /api/products
 * List products with filtering, search, pagination
 */
exports.getProducts = async (req, res) => {
  try {
    const {
      search, category, isActive = 'true',
      page = 1, limit = 50, sortBy = 'name', order = 'asc',
      lowStock, outOfStock,
    } = req.query;

    const query = {};

    // Filter by active status
    if (isActive !== 'all') query.isActive = isActive === 'true';

    // Filter by category
    if (category) query.category = category;

    // Low stock filter
    if (lowStock === 'true') {
      query.$expr = { $lte: ['$stock', '$lowStockThreshold'] };
    }

    // Out of stock filter
    if (outOfStock === 'true') {
      query.stock = 0;
    }

    // Full text search
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { tags: { $in: [new RegExp(search, 'i')] } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOrder = order === 'desc' ? -1 : 1;

    const [products, total] = await Promise.all([
      Product.find(query)
        .populate('category', 'name color icon')
        .sort({ [sortBy]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit)),
      Product.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: products,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    console.error('Get products error:', err);
    res.status(500).json({ success: false, message: 'Failed to fetch products.' });
  }
};

/**
 * GET /api/products/barcode/:barcode
 * Lookup product by barcode
 */
exports.getByBarcode = async (req, res) => {
  try {
    const product = await Product.findOne({
      barcode: req.params.barcode,
      isActive: true,
    }).populate('category', 'name color icon');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found with this barcode.',
      });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Barcode lookup failed.' });
  }
};

/**
 * GET /api/products/:id
 */
exports.getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('category', 'name color icon')
      .populate('createdBy', 'name');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, data: product });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch product.' });
  }
};

/**
 * POST /api/products
 * Create product (Admin only)
 */
exports.createProduct = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    const productData = { ...req.body, createdBy: req.user._id };

    // Validate category exists
    const category = await Category.findById(req.body.category);
    if (!category) {
      return res.status(400).json({ success: false, message: 'Category not found.' });
    }

    const product = await Product.create(productData);
    await product.populate('category', 'name color icon');

    res.status(201).json({ success: true, data: product, message: 'Product created.' });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      return res.status(400).json({
        success: false,
        message: `${field} already exists.`,
      });
    }
    console.error('Create product error:', err);
    res.status(500).json({ success: false, message: 'Failed to create product.' });
  }
};

/**
 * PUT /api/products/:id
 * Update product (Admin only)
 */
exports.updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { ...req.body },
      { new: true, runValidators: true }
    ).populate('category', 'name color icon');

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, data: product, message: 'Product updated.' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Barcode or SKU already exists.' });
    }
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
};

/**
 * PATCH /api/products/:id/stock
 * Adjust stock (Admin only)
 */
exports.adjustStock = async (req, res) => {
  try {
    const { adjustment, reason } = req.body;
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    const newStock = product.stock + parseInt(adjustment);
    if (newStock < 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot reduce stock below 0. Current: ${product.stock}`,
      });
    }

    product.stock = newStock;
    await product.save();

    res.json({
      success: true,
      data: product,
      message: `Stock adjusted by ${adjustment}. New stock: ${newStock}`,
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Stock adjustment failed.' });
  }
};

/**
 * DELETE /api/products/:id
 * Soft delete (deactivate) - Admin only
 */
exports.deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ success: false, message: 'Product not found.' });
    }

    res.json({ success: true, message: 'Product deactivated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
};
