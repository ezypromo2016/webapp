/**
 * Database Seeder
 * Creates initial admin user, categories, and sample products
 * Run: npm run seed
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB for seeding...');

    // Clear existing data
    await Promise.all([
      User.deleteMany({}),
      Category.deleteMany({}),
      Product.deleteMany({}),
    ]);
    console.log('Cleared existing data');

    // Create admin user
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@pos.com',
      password: 'Admin@123',
      role: 'admin',
    });
    console.log('✅ Admin created: admin@pos.com / Admin@123');

    // Create cashier user
    await User.create({
      name: 'Cashier One',
      email: 'cashier@pos.com',
      password: 'Cashier@123',
      role: 'cashier',
    });
    console.log('✅ Cashier created: cashier@pos.com / Cashier@123');

    // Create categories
    const categories = await Category.insertMany([
      { name: 'School Supplies', icon: '🍔', color: '#f97316', createdBy: admin._id },
      { name: 'Party Needs', icon: '☕', color: '#8b5cf6', createdBy: admin._id },
      { name: 'Computer Products', icon: '📱', color: '#3b82f6', createdBy: admin._id },
      
    ]);
    console.log('✅ Categories created:', categories.length);

    // Create sample products
    const products = await Product.insertMany([
      // Food
      { name: 'Burger Meal', price: 129, cost: 60, stock: 50, category: categories[0]._id, sku: 'FOOD-001', barcode: '1234567890', unit: 'pcs', createdBy: admin._id },
      { name: 'Fries Large', price: 69, cost: 20, stock: 80, category: categories[0]._id, sku: 'FOOD-002', barcode: '1234567891', unit: 'pcs', createdBy: admin._id },
      { name: 'Hotdog Sandwich', price: 45, cost: 18, stock: 30, category: categories[0]._id, sku: 'FOOD-003', unit: 'pcs', createdBy: admin._id },
      { name: 'Rice Meal', price: 89, cost: 35, stock: 5, category: categories[0]._id, sku: 'FOOD-004', lowStockThreshold: 10, unit: 'pcs', createdBy: admin._id },

      // Beverages
      { name: 'Brewed Coffee', price: 55, cost: 15, stock: 100, category: categories[1]._id, sku: 'BEV-001', unit: 'cup', createdBy: admin._id },
      { name: 'Iced Tea 16oz', price: 45, cost: 12, stock: 150, category: categories[1]._id, sku: 'BEV-002', unit: 'cup', createdBy: admin._id },
      { name: 'Mineral Water', price: 20, cost: 8, stock: 200, category: categories[1]._id, sku: 'BEV-003', barcode: '9876543210', unit: 'bottle', createdBy: admin._id },
      { name: 'Soda 12oz', price: 35, cost: 15, stock: 0, category: categories[1]._id, sku: 'BEV-004', unit: 'can', createdBy: admin._id },

      // Electronics
      { name: 'USB-C Cable 1m', price: 199, cost: 80, stock: 25, category: categories[2]._id, sku: 'ELEC-001', barcode: '5555555555', unit: 'pcs', createdBy: admin._id },
      { name: 'Phone Charger 20W', price: 549, cost: 200, stock: 15, category: categories[2]._id, sku: 'ELEC-002', unit: 'pcs', createdBy: admin._id },
      { name: 'Earphones Wired', price: 299, cost: 100, stock: 8, category: categories[2]._id, sku: 'ELEC-003', lowStockThreshold: 10, unit: 'pcs', createdBy: admin._id },
    ]);
    console.log('✅ Products created:', products.length);

    console.log('\n🎉 Seed completed successfully!');
    console.log('─────────────────────────────────');
    console.log('Admin:   admin@pos.com / Admin@123');
    console.log('Cashier: cashier@pos.com / Cashier@123');
    console.log('─────────────────────────────────');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seed();
