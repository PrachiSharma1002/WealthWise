const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');

// Makes a search word safe to use inside a database search
const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Checks the category exists, belongs to this user, and matches the type
const checkCategory = async (categoryId, type, userId) => {
  if (!mongoose.isValidObjectId(categoryId)) {
    return 'Please choose a valid category';
  }
  const category = await Category.findOne({ _id: categoryId, user: userId });
  if (!category) {
    return 'Category not found';
  }
  if (category.type !== type) {
    return `This category is for ${category.type}, not ${type}`;
  }
  return null; // no problem found
};

// GET: list my transactions, with optional filters
const getTransactions = async (req, res) => {
  try {
    const { type, category, startDate, endDate, search } = req.query;
    const filter = { user: req.user._id };

    if (typeof type === 'string' && type) {
      filter.type = type;
    }
    if (typeof category === 'string' && mongoose.isValidObjectId(category)) {
      filter.category = category;
    }
    if (typeof startDate === 'string' || typeof endDate === 'string') {
      filter.date = {};
      if (startDate) {
        const start = new Date(startDate);
        if (isNaN(start)) {
          return res.status(400).json({ message: 'Invalid start date' });
        }
        filter.date.$gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        if (isNaN(end)) {
          return res.status(400).json({ message: 'Invalid end date' });
        }
        end.setUTCHours(23, 59, 59, 999); // include the whole last day
        filter.date.$lte = end;
      }
    }
    if (typeof search === 'string' && search.trim()) {
      filter.note = { $regex: escapeRegex(search.trim()), $options: 'i' };
    }

    const transactions = await Transaction.find(filter)
      .populate('category', 'name type')
      .sort({ date: -1, createdAt: -1 });

    res.json(transactions);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST: add a transaction
const createTransaction = async (req, res) => {
  try {
    const { type, amount, category, date, note } = req.body;

    if (!['income', 'expense'].includes(type)) {
      return res
        .status(400)
        .json({ message: 'Type must be income or expense' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res
        .status(400)
        .json({ message: 'Amount must be a number greater than 0' });
    }

    const categoryError = await checkCategory(category, type, req.user._id);
    if (categoryError) {
      return res.status(400).json({ message: categoryError });
    }

    const transactionDate = date ? new Date(date) : new Date();
    if (isNaN(transactionDate)) {
      return res.status(400).json({ message: 'Invalid date' });
    }

    const transaction = await Transaction.create({
      user: req.user._id,
      type,
      amount: numericAmount,
      category,
      date: transactionDate,
      note: typeof note === 'string' ? note : '',
    });

    await transaction.populate('category', 'name type');
    res.status(201).json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT: edit one of my transactions (send only the fields you want to change)
const updateTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Only find it if it belongs to this user
    const transaction = await Transaction.findOne({
      _id: id,
      user: req.user._id,
    });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const { type, amount, category, date, note } = req.body;

    const newType = type !== undefined ? type : transaction.type;
    const newCategory = category !== undefined ? category : transaction.category;

    if (!['income', 'expense'].includes(newType)) {
      return res
        .status(400)
        .json({ message: 'Type must be income or expense' });
    }

    const categoryError = await checkCategory(newCategory, newType, req.user._id);
    if (categoryError) {
      return res.status(400).json({ message: categoryError });
    }

    if (amount !== undefined) {
      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res
          .status(400)
          .json({ message: 'Amount must be a number greater than 0' });
      }
      transaction.amount = numericAmount;
    }

    if (date !== undefined) {
      const newDate = new Date(date);
      if (isNaN(newDate)) {
        return res.status(400).json({ message: 'Invalid date' });
      }
      transaction.date = newDate;
    }

    if (note !== undefined) {
      transaction.note = typeof note === 'string' ? note : '';
    }

    transaction.type = newType;
    transaction.category = newCategory;

    await transaction.save();
    await transaction.populate('category', 'name type');
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE: remove one of my transactions
const deleteTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    const transaction = await Transaction.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });
    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
};