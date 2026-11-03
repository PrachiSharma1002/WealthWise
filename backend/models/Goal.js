const mongoose = require('mongoose');

// One entry of money put towards a goal
const contributionSchema = new mongoose.Schema({
  amount: {
    type: Number,
    required: [true, 'Amount is required'],
    min: [0.01, 'Amount must be greater than 0'],
  },
  date: {
    type: Date,
    default: Date.now,
  },
  note: {
    type: String,
    trim: true,
    default: '',
  },
});

const goalSchema = new mongoose.Schema(
  {
    // Which user this goal belongs to
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    name: {
      type: String,
      required: [true, 'Goal name is required'],
      trim: true,
    },
    // How much money the goal needs in total
    targetAmount: {
      type: Number,
      required: [true, 'Target amount is required'],
      min: [1, 'Target must be at least 1'],
    },
    // Optional deadline
    targetDate: {
      type: Date,
    },
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium',
    },
    // Money already saved before the goal was added to the app
    startingAmount: {
      type: Number,
      default: 0,
      min: [0, 'Starting amount cannot be negative'],
    },
    // Every time money was put towards this goal
    contributions: {
      type: [contributionSchema],
      default: [],
    },
  },
  { timestamps: true }
);

goalSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Goal', goalSchema);