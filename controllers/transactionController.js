/**
 * Transaction Controller
 * Create sales, void, refund, history
 * Automatically deducts stock on sale
 */

const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Product = require('../models/Product');

/**
 * POST /api/transactions
 * Create a new transaction (complete a sale)
 */
exports.createTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      items, discountType, discountValue, paymentMethod,
      amountTendered, paymentReference, customerName, customerPhone,
      notes, taxRate: transactionTaxRate, isOffline, offlineId,
    } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in transaction.' });
    }

    // ── Validate and build item records ───────────────────────────────────────
    const processedItems = [];
    let subtotal = 0;

    for (const item of items) {
      const product = await Product.findById(item.product).session(session);

      if (!product || !product.isActive) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Product ${item.product} not found or inactive.`,
        });
      }

      if (product.stock < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for "${product.name}". Available: ${product.stock}`,
        });
      }

      // Calculate item pricing
      const itemTaxRate = product.isTaxable
        ? (product.taxRate ?? parseFloat(transactionTaxRate ?? process.env.TAX_RATE ?? 0))
        : 0;

      const itemSubtotal = product.price * item.quantity;

      // Apply item-level discount
      let itemDiscountAmount = 0;
      if (item.discount && item.discount.value > 0) {
        itemDiscountAmount = item.discount.type === 'percentage'
          ? itemSubtotal * (item.discount.value / 100)
          : item.discount.value;
      }
      const discountedSubtotal = itemSubtotal - itemDiscountAmount;
      const itemTax = discountedSubtotal * itemTaxRate;
      const itemTotal = discountedSubtotal + itemTax;

      processedItems.push({
        product: product._id,
        productName: product.name,
        productSku: product.sku,
        productBarcode: product.barcode,
        unitPrice: product.price,
        quantity: item.quantity,
        discount: item.discount || { type: 'fixed', value: 0 },
        taxRate: itemTaxRate,
        subtotal: discountedSubtotal,
        tax: itemTax,
        total: itemTotal,
      });

      subtotal += discountedSubtotal;

      // Deduct stock
      product.stock -= item.quantity;
      await product.save({ session });
    }

    // ── Calculate transaction totals ──────────────────────────────────────────
    let discountAmount = 0;
    if (discountType !== 'none' && discountValue > 0) {
      discountAmount = discountType === 'percentage'
        ? subtotal * (discountValue / 100)
        : discountValue;
    }

    const taxableAmount = subtotal - discountAmount;
    const taxRate = parseFloat(transactionTaxRate ?? process.env.TAX_RATE ?? 0);
    const taxAmount = processedItems.reduce((sum, i) => sum + i.tax, 0);
    const total = subtotal - discountAmount + taxAmount;
    const change = paymentMethod === 'cash' ? (amountTendered || 0) - total : 0;

    // ── Generate unique transaction number ────────────────────────────────────
    const transactionNumber = await Transaction.generateTransactionNumber();

    const transaction = await Transaction.create([{
      transactionNumber,
      cashier: req.user._id,
      cashierName: req.user.name,
      items: processedItems,
      subtotal,
      discountType: discountType || 'none',
      discountValue: discountValue || 0,
      discountAmount,
      taxRate,
      taxAmount,
      total,
      paymentMethod,
      amountTendered: amountTendered || total,
      change: Math.max(0, change),
      paymentReference,
      customerName,
      customerPhone,
      notes,
      isOffline: isOffline || false,
      offlineId,
      status: 'completed',
    }], { session });

    await session.commitTransaction();

    // Populate for response
    const populated = await Transaction.findById(transaction[0]._id)
      .populate('cashier', 'name email');

    res.status(201).json({
      success: true,
      data: populated,
      message: 'Transaction completed successfully.',
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Create transaction error:', err);
    res.status(500).json({ success: false, message: err.message || 'Transaction failed.' });
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/transactions
 * List transactions with filters
 */
exports.getTransactions = async (req, res) => {
  try {
    const {
      page = 1, limit = 20, startDate, endDate,
      status, paymentMethod, cashier, search,
    } = req.query;

    const query = {};

    if (status) query.status = status;
    if (paymentMethod) query.paymentMethod = paymentMethod;
    if (cashier) query.cashier = cashier;

    // Non-admin cashiers can only see their own transactions
    if (req.user.role === 'cashier') {
      query.cashier = req.user._id;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    if (search) {
      query.$or = [
        { transactionNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { paymentReference: { $regex: search, $options: 'i' } },
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [transactions, total] = await Promise.all([
      Transaction.find(query)
        .populate('cashier', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Transaction.countDocuments(query),
    ]);

    res.json({
      success: true,
      data: transactions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch transactions.' });
  }
};

/**
 * GET /api/transactions/:id
 */
exports.getTransaction = async (req, res) => {
  try {
    const transaction = await Transaction.findById(req.params.id)
      .populate('cashier', 'name email')
      .populate('items.product', 'name sku barcode');

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    res.json({ success: true, data: transaction });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch transaction.' });
  }
};

/**
 * PATCH /api/transactions/:id/void
 * Void a transaction and restore stock
 */
exports.voidTransaction = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reason } = req.body;
    const transaction = await Transaction.findById(req.params.id).session(session);

    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found.' });
    }

    if (transaction.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'Only completed transactions can be voided.' });
    }

    // Restore stock for each item
    for (const item of transaction.items) {
      await Product.findByIdAndUpdate(
        item.product,
        { $inc: { stock: item.quantity } },
        { session }
      );
    }

    transaction.status = 'voided';
    transaction.voidReason = reason;
    transaction.voidedAt = new Date();
    transaction.voidedBy = req.user._id;
    await transaction.save({ session });

    await session.commitTransaction();
    res.json({ success: true, data: transaction, message: 'Transaction voided. Stock restored.' });
  } catch (err) {
    await session.abortTransaction();
    res.status(500).json({ success: false, message: 'Failed to void transaction.' });
  } finally {
    session.endSession();
  }
};

/**
 * GET /api/transactions/summary/sales-chart
 * Sales data for chart (last 7 or 30 days)
 */
exports.getSalesChart = async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    startDate.setHours(0, 0, 0, 0);

    const data = await Transaction.aggregate([
      {
        $match: {
          createdAt: { $gte: startDate },
          status: 'completed',
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
          },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch chart data.' });
  }
};
