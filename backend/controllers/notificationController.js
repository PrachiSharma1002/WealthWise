const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Goal = require('../models/Goal');
const { GROUP_BY_NAME } = require('./categoryController');
const { describeGoal } = require('../utils/goalMath');
const { findRecurring } = require('../utils/prediction');
const { buildAlerts } = require('../utils/alerts');

// What a notification looks like when it is sent to the page
const FIELDS = 'type severity title message link read createdAt';

const round2 = (n) => Math.round(n * 100) / 100;

// The first day of a month. A positive `monthsBack` goes back in time, and -1
// gives the first day of the next month.
const monthStart = (month, monthsBack = 0) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1 - monthsBack, 1));
};

// Looks at your budgets, goals and recurring payments, and saves a notification
// for every alert that does not exist yet. Returns how many were created.
const syncNotifications = async (userId) => {
  const now = new Date();
  const month = now.toISOString().slice(0, 7);

  // 1. This month's budgets, each with how much was spent against it
  const budgetDocs = await Budget.find({ user: userId, month }).populate(
    'category',
    'name'
  );
  const spentRows = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        type: 'expense',
        date: { $gte: monthStart(month), $lt: monthStart(month, -1) },
      },
    },
    { $group: { _id: '$category', spent: { $sum: '$amount' } } },
  ]);
  const spentMap = new Map(spentRows.map((r) => [String(r._id), r.spent]));
  const budgets = budgetDocs
    .filter((b) => b.category)
    .map((b) => ({
      categoryId: String(b.category._id),
      name: b.category.name,
      month,
      amount: b.amount,
      spent: round2(spentMap.get(String(b.category._id)) || 0),
    }));

  // 2. Your goals
  const goalDocs = await Goal.find({ user: userId });
  const goals = goalDocs.map((g) => describeGoal(g, now));

  // 3. Your recurring payments (looking at the last 6 months)
  const categories = await Category.find({ user: userId });
  const info = new Map(
    categories.map((c) => [
      String(c._id),
      {
        name: c.name,
        group:
          c.type === 'expense'
            ? c.group || GROUP_BY_NAME.get(c.name.toLowerCase()) || 'lifestyle'
            : null,
      },
    ])
  );
  const transactions = await Transaction.find({
    user: userId,
    type: 'expense',
    date: { $gte: monthStart(month, 5), $lt: monthStart(month, -1) },
  })
    .select('date amount category note')
    .lean();
  const lines = transactions.map((t) => {
    const c = info.get(String(t.category)) || {
      name: 'Deleted category',
      group: 'lifestyle',
    };
    return {
      date: t.date,
      amount: t.amount,
      categoryId: String(t.category),
      categoryName: c.name,
      group: c.group,
      note: t.note,
    };
  });
  const recurring = findRecurring(lines, month).recurring;

  // 4. Which alerts apply right now, and which of them are new
  const alerts = buildAlerts({ budgets, goals, recurring, now });
  if (alerts.length === 0) return 0;

  const existing = await Notification.find({
    user: userId,
    key: { $in: alerts.map((a) => a.key) },
  }).select('key');
  const have = new Set(existing.map((n) => n.key));
  const fresh = alerts.filter((a) => !have.has(a.key));
  if (fresh.length === 0) return 0;

  try {
    await Notification.insertMany(
      fresh.map((a) => ({ ...a, user: userId })),
      { ordered: false }
    );
  } catch (error) {
    // If two requests arrive at once, the second one hits "duplicate" errors.
    // That's harmless, because the notifications already exist.
    if (error.code !== 11000) throw error;
  }
  return fresh.length;
};

// GET: check for new alerts, then list my notifications (newest first)
const getNotifications = async (req, res) => {
  try {
    let limit = 30;
    if (req.query.limit !== undefined) {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        return res
          .status(400)
          .json({ message: 'Limit must be a whole number from 1 to 100' });
      }
    }

    // A problem with the check must never stop the list from loading
    try {
      await syncNotifications(req.user._id);
    } catch (error) {
      console.error('Notification check failed:', error.message);
    }

    const filter = { user: req.user._id, dismissed: false };
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit)
        .select(FIELDS)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ ...filter, read: false }),
    ]);

    res.json({ unreadCount, total, notifications });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT: mark one notification as read
const markRead = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    // Only find it if it belongs to this user
    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id, dismissed: false },
      { read: true },
      { new: true }
    ).select(FIELDS);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT: mark all of my notifications as read
const markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, dismissed: false, read: false },
      { read: true }
    );
    res.json({ updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE: delete one notification (it is hidden, so it is not created again)
const dismissOne = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, user: req.user._id, dismissed: false },
      { dismissed: true, read: true }
    );
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE: clear all of my notifications
const dismissAll = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user._id, dismissed: false },
      { dismissed: true, read: true }
    );
    res.json({
      message: 'All notifications cleared',
      cleared: result.modifiedCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getNotifications,
  markRead,
  markAllRead,
  dismissOne,
  dismissAll,
};