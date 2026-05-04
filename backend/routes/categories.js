/**
 * Categories Routes
 */
const express = require('express');
const router = express.Router();
const Category = require('../models/Category');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const categories = await Category.find({ isActive: true })
      .sort({ sortOrder: 1, name: 1 });
    res.json({ success: true, data: categories });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
  }
});

router.post('/', authorize('admin'), async (req, res) => {
  try {
    const category = await Category.create({ ...req.body, createdBy: req.user._id });
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    if (err.code === 11000) return res.status(400).json({ success: false, message: 'Category already exists.' });
    res.status(500).json({ success: false, message: 'Failed to create category.' });
  }
});

router.put('/:id', authorize('admin'), async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!category) return res.status(404).json({ success: false, message: 'Category not found.' });
    res.json({ success: true, data: category });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update category.' });
  }
});

router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    await Category.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Category deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to delete category.' });
  }
});

module.exports = router;
