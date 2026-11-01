const mongoose = require('mongoose');

// The blueprint for one user in the database
const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    // How the user wants to split their income (the three must add up to 100)
    budgetSplit: {
      needs: { type: Number, default: 50 },
      lifestyle: { type: Number, default: 30 },
      savings: { type: Number, default: 20 },
    },
    // Months whose budgets were already copied from the month before
    copiedMonths: {
      type: [String],
      default: [],
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('User', userSchema);