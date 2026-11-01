const mongoose = require('mongoose');
const Budget = require('../models/Budget');
const Category = require('../models/Category');
const Transaction = require('../models/Transaction');
const User = require('../models/User');

const MONTH_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

// Rounds to 2 decimal places, so 0.1 + 0.2 shows as 0.3 and not 0.30000000000000004
const round2 = (n) => Math.round(n * 100) / 100;

// Turns "2026-10" into the start of October and the start of November
const monthRange = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return {
    start: new Date(Date.UTC(year, mon - 1, 1)),
    end: new Date(Date.UTC(year, mon, 1)),
  };
};

// The split used when a user hasn't chosen their own
const DEFAULT_SPLIT = { needs: 50, lifestyle: 30, savings: 20 };

// Reads a user's split, falling back to the default for any missing value
const getSplit = (user) => ({
  needs: user.budgetSplit?.needs ?? DEFAULT_SPLIT.needs,
  lifestyle: user.budgetSplit?.lifestyle ?? DEFAULT_SPLIT.lifestyle,
  savings: user.budgetSplit?.savings ?? DEFAULT_SPLIT.savings,
});

// GET: my budgets for one month, each with how much has been spent so far
const getBudgets = async (req, res) => {
  try {
    const { month } = req.query;
    if (typeof month !== 'string' || !MONTH_REGEX.test(month)) {
      return res.status(400).json({ message: 'Month must look like 2026-10' });
    }
    const { start, end } = monthRange(month);

    const budgets = await Budget.find({
      user: req.user._id,
      month,
    }).populate('category', 'name type');

    // Add up this month's expenses, grouped by category
    const spentByCategory = await Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: '$category', spent: { $sum: '$amount' } } },
    ]);
    const spentMap = new Map(
      spentByCategory.map((s) => [String(s._id), s.spent])
    );

    const result = budgets
      .filter((b) => b.category) // skip any whose category no longer exists
      .map((b) => {
        const spent = round2(spentMap.get(String(b.category._id)) || 0);
        return {
          _id: b._id,
          category: b.category,
          month: b.month,
          amount: b.amount,
          spent,
          remaining: round2(b.amount - spent),
          percentUsed: Math.round((spent / b.amount) * 100),
        };
      })
      .sort((a, b) => a.category.name.localeCompare(b.category.name));

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST: set a budget (creates it, or updates it if it already exists)
const setBudget = async (req, res) => {
  try {
    const { category, month, amount } = req.body;

    if (typeof month !== 'string' || !MONTH_REGEX.test(month)) {
      return res.status(400).json({ message: 'Month must look like 2026-10' });
    }

    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res
        .status(400)
        .json({ message: 'Budget must be a number greater than 0' });
    }

    if (typeof category !== 'string' || !mongoose.isValidObjectId(category)) {
      return res.status(400).json({ message: 'Please choose a valid category' });
    }

    // The category must be one of MY categories
    const categoryDoc = await Category.findOne({
      _id: category,
      user: req.user._id,
    });
    if (!categoryDoc) {
      return res.status(404).json({ message: 'Category not found' });
    }
    if (categoryDoc.type !== 'expense') {
      return res
        .status(400)
        .json({ message: 'Budgets can only be set for expense categories' });
    }

    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, category, month },
      { amount: numericAmount },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    await budget.populate('category', 'name type');
    res.json(budget);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE: remove one of my budgets
const deleteBudget = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    const budget = await Budget.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    res.json({ message: 'Budget deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Rough guideline: the share of income each kind of spending should stay under
const GUIDELINE_PERCENT = {
  rent: 30,
  food: 15,
  travel: 10,
  shopping: 10,
  bills: 10,
  health: 5,
  entertainment: 5,
  other: 5,
};
const DEFAULT_GUIDELINE_PERCENT = 10;

const roundUp100 = (n) => Math.ceil(n / 100) * 100;

// GET: suggested budgets for a month, based on the 3 months before it
const getRecommendations = async (req, res) => {
  try {
    const { month } = req.query;
    if (typeof month !== 'string' || !MONTH_REGEX.test(month)) {
      return res.status(400).json({ message: 'Month must look like 2026-10' });
    }

    // The user's own needs / lifestyle / savings split
    const split = getSplit(req.user);

    // The 3 full months before the chosen month
    const [year, mon] = month.split('-').map(Number);
    const start = new Date(Date.UTC(year, mon - 4, 1));
    const end = new Date(Date.UTC(year, mon - 1, 1));

    // Add up income and expenses, grouped by type, category and month
    const rows = await Transaction.aggregate([
      { $match: { user: req.user._id, date: { $gte: start, $lt: end } } },
      {
        $group: {
          _id: {
            type: '$type',
            category: '$category',
            month: { $dateToString: { format: '%Y-%m', date: '$date' } },
          },
          total: { $sum: '$amount' },
        },
      },
    ]);

    // No history yet, so nothing to base a suggestion on
    if (rows.length === 0) {
      return res.json({
        basedOnMonths: 0,
        avgIncome: 0,
        avgExpense: 0,
        split,
        plan: null,
        recommendations: [],
      });
    }

    // How many of those 3 months actually have data
    const monthsWithData = new Set(rows.map((r) => r._id.month)).size;

    let incomeTotal = 0;
    let expenseTotal = 0;
    const expenseByCategory = new Map();
    rows.forEach((r) => {
      if (r._id.type === 'income') {
        incomeTotal += r.total;
      } else {
        expenseTotal += r.total;
        const key = String(r._id.category);
        expenseByCategory.set(key, (expenseByCategory.get(key) || 0) + r.total);
      }
    });

    const avgIncome = round2(incomeTotal / monthsWithData);
    const avgExpense = round2(expenseTotal / monthsWithData);

    const categories = await Category.find({
      user: req.user._id,
      type: 'expense',
    });

    const recommendations = [];
    categories.forEach((c) => {
      const total = expenseByCategory.get(String(c._id));
      if (!total) return; // never spent anything here, so nothing to suggest

      const avgSpent = round2(total / monthsWithData);
      let suggested = roundUp100(avgSpent);
      let message = 'In line with your usual spending.';

      // Rule 1: compare against the guideline share of income
      if (avgIncome > 0) {
        const percent =
          GUIDELINE_PERCENT[c.name.toLowerCase()] ?? DEFAULT_GUIDELINE_PERCENT;
        const cap = Math.max(
          100,
          Math.floor((avgIncome * percent) / 100 / 100) * 100
        );

        if (avgSpent > cap) {
          const actualPercent = Math.round((avgSpent / avgIncome) * 100);
          suggested = cap;
          message =
            `You usually spend about ${actualPercent}% of your income here. ` +
            `A common guideline is ${percent}%, so try ₹${cap.toLocaleString('en-IN')}.`;
        }
      }

      recommendations.push({
        category: { _id: c._id, name: c.name },
        avgSpent,
        suggested,
        message,
      });
    });

    recommendations.sort((a, b) => b.avgSpent - a.avgSpent);

    // The plan: needs, lifestyle, savings, using the user's own split
    const plan =
      avgIncome > 0
        ? {
            needs: round2((avgIncome * split.needs) / 100),
            lifestyle: round2((avgIncome * split.lifestyle) / 100),
            savings: round2((avgIncome * split.savings) / 100),
          }
        : null;

    res.json({
      basedOnMonths: monthsWithData,
      avgIncome,
      avgExpense,
      split,
      plan,
      recommendations,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT: change my needs / lifestyle / savings split
const updateSplit = async (req, res) => {
  try {
    const { needs, lifestyle, savings } = req.body;
    const values = [needs, lifestyle, savings];

    // Each share must be a whole number from 0 to 100
    const valid = values.every(
      (v) => typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 100
    );
    if (!valid) {
      return res
        .status(400)
        .json({ message: 'Each share must be a whole number from 0 to 100' });
    }

    // Together they must make exactly 100
    if (needs + lifestyle + savings !== 100) {
      return res
        .status(400)
        .json({ message: 'The three shares must add up to 100' });
    }

    await User.findByIdAndUpdate(req.user._id, {
      budgetSplit: { needs, lifestyle, savings },
    });

    res.json({ needs, lifestyle, savings });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getBudgets,
  setBudget,
  deleteBudget,
  getRecommendations,
  updateSplit,
};