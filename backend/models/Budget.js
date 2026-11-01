const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    // Which user this budget belongs to
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    // Which expense category the limit applies to
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    // Which month, written as YYYY-MM (for example 2026-10)
    month: {
      type: String,
      required: [true, 'Month is required'],
      match: [/^\d{4}-(0[1-9]|1[0-2])$/, 'Month must look like 2026-10'],
    },
    // The spending limit for that category in that month
    amount: {
      type: Number,
      required: [true, 'Budget amount is required'],
      min: [1, 'Budget must be at least 1'],
    },
  },
  { timestamps: true }
);

// One budget per category per month for each user
budgetSchema.index({ user: 1, category: 1, month: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);