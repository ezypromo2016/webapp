/**
 * Product Model
 * Supports barcode, categories, stock tracking, and pricing
 */

const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters'],
  },
  sku: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
    uppercase: true,
  },
  barcode: {
    type: String,
    unique: true,
    sparse: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters'],
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required'],
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative'],
  },
  cost: {
    // Purchase cost (for profit calculation)
    type: Number,
    default: 0,
    min: [0, 'Cost cannot be negative'],
  },
  stock: {
    type: Number,
    default: 0,
    min: [0, 'Stock cannot be negative'],
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
    min: [0, 'Low stock threshold cannot be negative'],
  },
  unit: {
    // e.g., "pcs", "kg", "L", "box"
    type: String,
    default: 'pcs',
    trim: true,
  },
  image: {
    type: String,
    default: null,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isTaxable: {
    type: Boolean,
    default: true,
  },
  taxRate: {
    // Override global tax rate per product if needed
    type: Number,
    default: null,
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true,
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true },
});

// ─── Virtuals ─────────────────────────────────────────────────────────────────
productSchema.virtual('isLowStock').get(function () {
  return this.stock <= this.lowStockThreshold && this.stock > 0;
});

productSchema.virtual('isOutOfStock').get(function () {
  return this.stock <= 0;
});

productSchema.virtual('profit').get(function () {
  return this.price - this.cost;
});

productSchema.virtual('profitMargin').get(function () {
  if (this.price === 0) return 0;
  return ((this.price - this.cost) / this.price * 100).toFixed(2);
});

// ─── Indexes ──────────────────────────────────────────────────────────────────
productSchema.index({ name: 'text', description: 'text', tags: 'text' }); // Full-text search
productSchema.index({ barcode: 1 });
productSchema.index({ sku: 1 });
productSchema.index({ category: 1 });
productSchema.index({ isActive: 1 });
productSchema.index({ stock: 1 });

// ─── Static: Find active products ────────────────────────────────────────────
productSchema.statics.findActive = function () {
  return this.find({ isActive: true }).populate('category', 'name color icon');
};

// ─── Static: Find low stock products ─────────────────────────────────────────
productSchema.statics.findLowStock = function () {
  return this.find({
    isActive: true,
    $expr: { $lte: ['$stock', '$lowStockThreshold'] },
  }).populate('category', 'name');
};

// ─── Method: Deduct stock ─────────────────────────────────────────────────────
productSchema.methods.deductStock = async function (quantity) {
  if (this.stock < quantity) {
    throw new Error(`Insufficient stock for ${this.name}. Available: ${this.stock}`);
  }
  this.stock -= quantity;
  return this.save();
};

// ─── Method: Restore stock (for refunds/cancellations) ───────────────────────
productSchema.methods.restoreStock = async function (quantity) {
  this.stock += quantity;
  return this.save();
};

module.exports = mongoose.model('Product', productSchema);
