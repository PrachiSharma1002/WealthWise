const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const User = require('../models/User');

const roundUp100 = (n) => Math.ceil(n / 100) * 100;
const roundUp1000 = (n) => Math.max(1000, Math.ceil(n / 1000) * 1000);

// The month a date falls in, as "2026-10" (using UTC, like the rest of the app)
const monthOf = (date) => new Date(date).toISOString().slice(0, 7);

// The month before "2026-11" is "2026-10"
const previousMonth = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 2, 1)).toISOString().slice(0, 7);
};

// The month after "2026-11" is "2026-12"
const nextMonth = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7);
};

// Picks a starting limit for a category in a month, from the most to the
// least informed guess
const suggestLimit = async (userId, categoryId, month, spentThisMonth) => {
  // 1. This category's budget last month
  const last = await Budget.findOne({
    user: userId,
    category: categoryId,
    month: previousMonth(month),
  });
  if (last) return last.amount;

  // 2. Average monthly spending here over the 3 months before
  const [year, mon] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, mon - 4, 1));
  const end = new Date(Date.UTC(year, mon - 1, 1));
  const past = await Transaction.find({
    user: userId,
    category: categoryId,
    type: 'expense',
    date: { $gte: start, $lt: end },
  }).select('amount date');

  if (past.length > 0) {
    const monthsWithData = new Set(past.map((t) => monthOf(t.date))).size;
    const total = past.reduce((sum, t) => sum + t.amount, 0);
    return roundUp100(total / monthsWithData);
  }

  // 3. No history at all, so round the spending up to the next 1,000
  return roundUp1000(spentThisMonth);
};

// After an expense is saved: if its category has no budget for that month,
// create one. Any problem here is logged and ignored, so it can never stop
// the transaction itself from being saved.
const ensureBudget = async (userId, transaction) => {
  try {
    if (transaction.type !== 'expense') return;

    const categoryId = transaction.category;

    // Savings categories have a target, not a spending limit, so no budget
    const category = await Category.findById(categoryId).select('group');
    if (!category || category.group === 'savings') return;

    const month = monthOf(transaction.date);

    // Already budgeted? Then leave it alone.
    const existing = await Budget.exists({
      user: userId,
      category: categoryId,
      month,
    });
    if (existing) return;

    const amount = await suggestLimit(
      userId,
      categoryId,
      month,
      transaction.amount
    );

    await Budget.create({
      user: userId,
      category: categoryId,
      month,
      amount,
      auto: true,
    });
  } catch (error) {
    // 11000 means a budget appeared a moment ago, which is fine
    if (error.code !== 11000) {
      console.error('Auto-budget failed:', error.message);
    }
  }
};

// When a month is opened: copy last month's budgets into it, once, for any
// category that has no budget yet. Only the current and next month are filled.
const copyLastMonth = async (userId, month) => {
  try {
    const thisMonth = new Date().toISOString().slice(0, 7);
    if (month !== thisMonth && month !== nextMonth(thisMonth)) return;

    // Is there anything to copy?
    const previous = await Budget.find({
      user: userId,
      month: previousMonth(month),
    });
    if (previous.length === 0) return;

    // Claim this month, so the copy only ever happens once. If two requests
    // arrive at the same moment, only one of them gets past this line.
    const claimed = await User.updateOne(
      { _id: userId, copiedMonths: { $ne: month } },
      { $addToSet: { copiedMonths: month } }
    );
    if (claimed.modifiedCount !== 1) return;

    // Skip categories that already have a budget this month
    const existing = await Budget.find({ user: userId, month }).select(
      'category'
    );
    const have = new Set(existing.map((b) => String(b.category)));

    // Skip categories that no longer exist, and savings categories
    const stillExist = await Category.find({
      user: userId,
      type: 'expense',
      group: { $ne: 'savings' },
      _id: { $in: previous.map((b) => b.category) },
    }).select('_id');
    const ok = new Set(stillExist.map((c) => String(c._id)));

    const toCreate = previous
      .filter((b) => ok.has(String(b.category)) && !have.has(String(b.category)))
      .map((b) => ({
        user: userId,
        category: b.category,
        month,
        amount: b.amount,
        auto: true,
      }));

    if (toCreate.length > 0) {
      await Budget.insertMany(toCreate, { ordered: false });
    }
  } catch (error) {
    // 11000 means a budget appeared a moment ago, which is fine
    if (error.code !== 11000) {
      console.error('Copy-last-month failed:', error.message);
    }
  }
};

module.exports = { ensureBudget, copyLastMonth, suggestLimit };