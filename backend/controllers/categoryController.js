const mongoose = require('mongoose');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');

// The starter categories every user gets
const DEFAULT_CATEGORIES = [
  { name: 'Salary', type: 'income' },
  { name: 'Freelance', type: 'income' },
  { name: 'Other Income', type: 'income' },
  { name: 'Food', type: 'expense' },
  { name: 'Rent', type: 'expense' },
  { name: 'Travel', type: 'expense' },
  { name: 'Shopping', type: 'expense' },
  { name: 'Bills', type: 'expense' },
  { name: 'Health', type: 'expense' },
  { name: 'Entertainment', type: 'expense' },
  { name: 'Other', type: 'expense' },
];

// GET: list my categories (creating the starter set the first time)
const getCategories = async (req, res) => {
  try {
    let categories = await Category.find({ user: req.user._id });

    if (categories.length === 0) {
      try {
        await Category.insertMany(
          DEFAULT_CATEGORIES.map((c) => ({ ...c, user: req.user._id })),
          { ordered: false }
        );
      } catch (error) {
        // If two requests arrive at once, the second one hits "duplicate" errors.
        // That's harmless, because the categories already exist.
        if (error.code !== 11000) throw error;
      }
      categories = await Category.find({ user: req.user._id });
    }

    categories.sort(
      (a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name)
    );
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST: add a new category
const createCategory = async (req, res) => {
  try {
    const { name, type } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    if (!['income', 'expense'].includes(type)) {
      return res
        .status(400)
        .json({ message: 'Type must be income or expense' });
    }

    const category = await Category.create({
      user: req.user._id,
      name,
      type,
    });
    res.status(201).json(category);
  } catch (error) {
    if (error.code === 11000) {
      return res
        .status(400)
        .json({ message: 'You already have this category' });
    }
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE: remove one of my categories (unless transactions use it)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Category not found' });
    }

    // Only find it if it belongs to this user
    const category = await Category.findOne({ _id: id, user: req.user._id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const inUse = await Transaction.exists({ category: id });
    if (inUse) {
      return res.status(400).json({
        message: 'This category has transactions, so it cannot be deleted',
      });
    }

    await category.deleteOne();
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getCategories, createCategory, deleteCategory };