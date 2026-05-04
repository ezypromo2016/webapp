/**
 * Transaction Model
 * Complete sales record with items, payment, and receipt data
 */

const mongoose = require('mongoose');

// Sub-schema for each item in a transaction
const transactionItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  // Snapshot of product at time of sale (prices may change later)
  productName: { type: String, required: true },
  productSku: { type: String },
  productBarcode: { type: String },
  unitPrice: { type: Number, required: true },
  quantity: { type: Number, required: true, min: 1 },
  discount: {
    type: { type: String, enum: ['percentage', 'fixed'], default: 'fixed' },
    value: { type: Number, default: 0 },
  },
  taxRate: { type: Number, default: 0 },
  subtotal: { type: Number, required: true }, // After item discount, before tax
  tax: { type: Number, default: 0 },
  total: { type: Number, required: true },    // subtotal + tax
}, { _id: false });

const transactionSchema = new mongoose.Schema({
  transactionNumber: {
    type: String,
    unique: true,
    required: true,
  },
  cashier: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  cashierName: { type: String }, // Snapshot

  items: [transactionItemSchema],

  // Pricing breakdown
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed', 'none'],
    default: 'none',
  },
  discountValue: {
    type: Number,
    default: 0,
    min: 0,
  },
  discountAmount: {
    // Actual ₱ amount of discount
    type: Number,
    default: 0,
  },
  taxRate: {
    type: Number,
    default: 0,
  },
  taxAmount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },

  // Payment info
  paymentMethod: {
    type: String,
    enum: ['cash', 'gcash', 'card', 'mixed'],
    required: true,
  },
  amountTendered: {
    type: Number,
    default: 0,
  },
  change: {
    type: Number,
    default: 0,
  },
  paymentReference: {
    // For GCash/Card reference numbers
    type: String,
    trim: true,
  },

  // Status
  status: {
    type: String,
    enum: ['completed', 'voided', 'refunded', 'pending'],
    default: 'completed',
  },
  voidReason: {
    type: String,
    trim: true,
  },
  voidedAt: {
    type: Date,
  },
  voidedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },

  // Customer info (optional)
  customerName: { type: String, trim: true },
  customerPhone: { type: String, trim: true },

  // Notes
  notes: { type: String, trim: true, maxlength: 500 },

  // Offline sync tracking
  isOffline: {
    type: Boolean,
    default: false,
  },
  offlineId: {
    // Temporary ID assigned when created offline
    type: String,
    sparse: true,
  },
}, {
  timestamps: true,
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
transactionSchema.index({ transactionNumber: 1 });
transactionSchema.index({ cashier: 1 });
transactionSchema.index({ createdAt: -1 });
transactionSchema.index({ status: 1 });
transactionSchema.index({ paymentMethod: 1 });

// ─── Static: Generate transaction number ──────────────────────────────────────
transactionSchema.statics.generateTransactionNumber = async function () {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

  // Count today's transactions
  const startOfDay = new Date(today.setHours(0, 0, 0, 0));
  const count = await this.countDocuments({ createdAt: { $gte: startOfDay } });

  const sequence = String(count + 1).padStart(4, '0');
  return `TXN-${dateStr}-${sequence}`;
};

// ─── Static: Daily sales summary ─────────────────────────────────────────────
transactionSchema.statics.getDailySummary = async function (date = new Date()) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  return this.aggregate([
    {
      $match: {
        createdAt: { $gte: startOfDay, $lte: endOfDay },
        status: 'completed',
      },
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$total' },
        totalTransactions: { $sum: 1 },
        totalItems: { $sum: { $sum: '$items.quantity' } },
        avgSale: { $avg: '$total' },
        cashTotal: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'cash'] }, '$total', 0] },
        },
        gcashTotal: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'gcash'] }, '$total', 0] },
        },
        cardTotal: {
          $sum: { $cond: [{ $eq: ['$paymentMethod', 'card'] }, '$total', 0] },
        },
      },
    },
  ]);
};

module.exports = mongoose.model('Transaction', transactionSchema);
