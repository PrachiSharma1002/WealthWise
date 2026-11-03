const mongoose = require('mongoose');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');

const GROUPS = ['needs', 'lifestyle', 'savings'];

// The starter categories every user gets
const DEFAULT_CATEGORIES = [
  { name: 'Salary', type: 'income' },
  { name: 'Freelance', type: 'income' },
  { name: 'Other Income', type: 'income' },
  { name: 'Rent', type: 'expense', group: 'needs' },
  { name: 'Food', type: 'expense', group: 'needs' },
  { name: 'Bills', type: 'expense', group: 'needs' },
  { name: 'Electricity Bill', type: 'expense', group: 'needs' },
  { name: 'Health', type: 'expense', group: 'needs' },
  { name: 'Shopping', type: 'expense', group: 'lifestyle' },
  { name: 'Entertainment', type: 'expense', group: 'lifestyle' },
  { name: 'Travel', type: 'expense', group: 'lifestyle' },
  { name: 'Other', type: 'expense', group: 'lifestyle' },
  { name: 'SIP', type: 'expense', group: 'savings' },
  { name: 'Emergency Fund', type: 'expense', group: 'savings' },
  { name: 'Fixed Deposit', type: 'expense', group: 'savings' },
  { name: 'Investments', type: 'expense', group: 'savings' },
];

// Which group an older category belongs to, by name (anything else: lifestyle)
const GROUP_BY_NAME = new Map(
  DEFAULT_CATEGORIES.filter((c) => c.group).map((c) => [
    c.name.toLowerCase(),
    c.group,
  ])
);

// Starter categories that were added after the first version of the app
const ADDED_LATER = [
  'electricity bill',
  'sip',
  'emergency fund',
  'fixed deposit',
  'investments',
];

// Adds categories, ignoring "already exists" errors
const addCategories = async (userId, list) => {
  if (list.length === 0) return;
  try {
    await Category.insertMany(
      list.map((c) => ({ ...c, user: userId })),
      { ordered: false }
    );
  } catch (error) {
    // If two requests arrive at once, the second one hits "duplicate" errors.
    // That's harmless, because the categories already exist.
    if (error.code !== 11000) throw error;
  }
};

// GET: list my categories (creating or updating the starter set when needed)
const getCategories = async (req, res) => {
  try {
    let categories = await Category.find({ user: req.user._id });

    if (categories.length === 0) {
      // A brand-new account: create the starter set
      await addCategories(req.user._id, DEFAULT_CATEGORIES);
      categories = await Category.find({ user: req.user._id });
    } else if (categories.some((c) => c.type === 'expense' && !c.group)) {
      // An older account: sort its expense categories into groups (once)
      await Promise.all(
        categories
          .filter((c) => c.type === 'expense' && !c.group)
          .map((c) =>
            Category.updateOne(
              { _id: c._id },
              { group: GROUP_BY_NAME.get(c.name.toLowerCase()) || 'lifestyle' }
            )
          )
      );

      // ...and add the newer starter categories it doesn't have yet
      const have = new Set(
        categories.map((c) => `${c.type}:${c.name.toLowerCase()}`)
      );
      const missing = DEFAULT_CATEGORIES.filter(
        (c) =>
          ADDED_LATER.includes(c.name.toLowerCase()) &&
          !have.has(`expense:${c.name.toLowerCase()}`)
      );
      await addCategories(req.user._id, missing);

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

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Category name is required' });
    }
    if (!['income', 'expense'].includes(type)) {
      return res
        .status(400)
        .json({ message: 'Type must be income or expense' });
    }

    // Expense categories need a group (lifestyle if none is given).
    // Income categories have no group.
    let group;
    if (type === 'expense') {
      group = req.body.group === undefined ? 'lifestyle' : req.body.group;
      if (!GROUPS.includes(group)) {
        return res
          .status(400)
          .json({ message: 'Group must be needs, lifestyle or savings' });
      }
    }

    const category = await Category.create({
      user: req.user._id,
      name,
      type,
      group,
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

// PUT: move one of my expense categories to a different group
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Category not found' });
    }

    const { group } = req.body;
    if (!GROUPS.includes(group)) {
      return res
        .status(400)
        .json({ message: 'Group must be needs, lifestyle or savings' });
    }

    // Only find it if it belongs to this user
    const category = await Category.findOne({ _id: id, user: req.user._id });
    if (!category) {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (category.type !== 'expense') {
      return res
        .status(400)
        .json({ message: 'Only expense categories belong to a group' });
    }

    category.group = group;
    await category.save();
    res.json(category);
  } catch (error) {
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
    await Budget.deleteMany({ user: req.user._id, category: id });
    res.json({ message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  GROUP_BY_NAME,
};