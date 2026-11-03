const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema(
  {
    // Which user this category belongs to
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
    },
    // Is this category for money coming in or going out?
    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true,
    },
    // For expense categories: which main group it belongs to
    group: {
      type: String,
      enum: ['needs', 'lifestyle', 'savings'],
    },
  },
  { timestamps: true }
);

// A user can't have two categories with the same name and type
categorySchema.index({ user: 1, name: 1, type: 1 }, { unique: true });

module.exports = mongoose.model('Category', categorySchema);