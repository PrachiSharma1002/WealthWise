const Transaction = require('../models/Transaction');
const Category = require('../models/Category');
const Budget = require('../models/Budget');
const Goal = require('../models/Goal');
const { GROUP_BY_NAME } = require('./categoryController');
const { describeGoal } = require('../utils/goalMath');
const {
  monthSummary,
  compareMonths,
  findUnusual,
} = require('../utils/analysis');
const { predictNextMonth, findRecurring } = require('../utils/prediction');
const { healthScore } = require('../utils/healthScore');

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// What to show for a category that no longer exists
const UNKNOWN_CATEGORY = { name: 'Deleted category', group: 'lifestyle' };

// The first day of a month. A positive `monthsBack` goes back in time, and -1
// gives the first day of the next month.
const monthStart = (month, monthsBack = 0) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon - 1 - monthsBack, 1));
};

// The month we are in right now, like "2026-11"
const thisMonth = () => new Date().toISOString().slice(0, 7);

// Reads ?month=2026-10 from the address. If it is wrong, an error is sent and
// null comes back.
const readMonth = (req, res) => {
  const { month } = req.query;
  if (typeof month !== 'string' || !MONTH_REGEX.test(month)) {
    res.status(400).json({ message: 'Month must look like 2026-10' });
    return null;
  }
  return month;
};

// What each of my categories is called, and which group it is in
const loadCategoryInfo = async (userId) => {
  const categories = await Category.find({ user: userId });
  const info = new Map();
  categories.forEach((c) => {
    info.set(String(c._id), {
      name: c.name,
      group:
        c.type === 'expense'
          ? c.group || GROUP_BY_NAME.get(c.name.toLowerCase()) || 'lifestyle'
          : null,
    });
  });
  return info;
};

// One line per month, type and category, for the chosen month and the 3 before it
const loadRows = async (userId, month, categoryInfo) => {
  const grouped = await Transaction.aggregate([
    {
      $match: {
        user: userId,
        date: { $gte: monthStart(month, 3), $lt: monthStart(month, -1) },
      },
    },
    {
      $group: {
        _id: {
          month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          type: '$type',
          category: '$category',
        },
        total: { $sum: '$amount' },
      },
    },
  ]);

  return grouped.map((r) => {
    const info = categoryInfo.get(String(r._id.category)) || UNKNOWN_CATEGORY;
    return {
      month: r._id.month,
      type: r._id.type,
      categoryId: String(r._id.category),
      categoryName: info.name,
      group: info.group,
      total: r.total,
    };
  });
};

// GET: this month's summary, the comparison with last month, unusual spending
const getAnalysis = async (req, res) => {
  try {
    const month = readMonth(req, res);
    if (!month) return;

    const categoryInfo = await loadCategoryInfo(req.user._id);
    const rows = await loadRows(req.user._id, month, categoryInfo);

    res.json({
      month,
      monthComplete: month < thisMonth(),
      summary: monthSummary(rows, month),
      comparison: compareMonths(rows, month),
      unusual: findUnusual(rows, month),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET: a forecast for the month you ask about, from the 3 months before it
const getPrediction = async (req, res) => {
  try {
    const month = readMonth(req, res);
    if (!month) return;

    const categoryInfo = await loadCategoryInfo(req.user._id);
    const rows = await loadRows(req.user._id, month, categoryInfo);

    res.json(predictNextMonth(rows, month));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET: expenses that repeat every month, looking at the last 6 months
const getRecurring = async (req, res) => {
  try {
    const month = readMonth(req, res);
    if (!month) return;

    const categoryInfo = await loadCategoryInfo(req.user._id);
    const transactions = await Transaction.find({
      user: req.user._id,
      type: 'expense',
      date: { $gte: monthStart(month, 5), $lt: monthStart(month, -1) },
    })
      .select('date amount category note')
      .lean();

    const lines = transactions.map((t) => {
      const info = categoryInfo.get(String(t.category)) || UNKNOWN_CATEGORY;
      return {
        date: t.date,
        amount: t.amount,
        categoryId: String(t.category),
        categoryName: info.name,
        group: info.group,
        note: t.note,
      };
    });

    res.json(findRecurring(lines, month));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// GET: the Financial Health Score
const getHealth = async (req, res) => {
  try {
    const month = readMonth(req, res);
    if (!month) return;

    const categoryInfo = await loadCategoryInfo(req.user._id);
    const rows = await loadRows(req.user._id, month, categoryInfo);

    // How much was spent in each category this month
    const spentByCategory = new Map();
    rows
      .filter((r) => r.month === month && r.type === 'expense')
      .forEach((r) => {
        spentByCategory.set(
          r.categoryId,
          (spentByCategory.get(r.categoryId) || 0) + r.total
        );
      });

    // This month's budgets, each with how much was spent against it
    const budgetDocs = await Budget.find({
      user: req.user._id,
      month,
    }).populate('category', 'name');
    const budgets = budgetDocs
      .filter((b) => b.category)
      .map((b) => ({
        name: b.category.name,
        amount: b.amount,
        spent: spentByCategory.get(String(b.category._id)) || 0,
      }));

    // The status and priority of each goal
    const goalDocs = await Goal.find({ user: req.user._id });
    const goals = goalDocs.map((g) => {
      const described = describeGoal(g);
      return { status: described.status, priority: described.priority };
    });

    res.json(
      healthScore({
        rows,
        month,
        monthComplete: month < thisMonth(),
        budgets,
        goals,
      })
    );
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { getAnalysis, getPrediction, getRecurring, getHealth };