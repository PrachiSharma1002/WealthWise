const mongoose = require('mongoose');
const Goal = require('../models/Goal');
const { describeGoal } = require('../utils/goalMath');

const PRIORITIES = ['high', 'medium', 'low'];
const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

// Reads a number, or a number written as text. Anything else gives NaN.
const toNumber = (value) =>
  typeof value === 'number' ||
  (typeof value === 'string' && value.trim() !== '')
    ? Number(value)
    : NaN;

// True when the page sent nothing for an optional field
const isEmpty = (value) =>
  value === undefined || value === null || value === '';

// Reads a date written as text. Returns null if it is not a real date.
const parseDate = (value) => {
  if (typeof value !== 'string') return null;
  const d = new Date(value);
  return isNaN(d) ? null : d;
};

// Start of today (UTC), so a deadline of "today" is still allowed
const startOfToday = () => {
  const d = new Date();
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
};

// GET: list my goals (unfinished first, then by priority, then by deadline)
const getGoals = async (req, res) => {
  try {
    const goals = await Goal.find({ user: req.user._id });

    const result = goals.map(describeGoal).sort((a, b) => {
      if (a.completed !== b.completed) return a.completed ? 1 : -1;
      if (a.priority !== b.priority) {
        return PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      }
      const aDate = a.targetDate ? new Date(a.targetDate).getTime() : Infinity;
      const bDate = b.targetDate ? new Date(b.targetDate).getTime() : Infinity;
      if (aDate !== bDate) return aDate - bDate;
      return new Date(a.createdAt) - new Date(b.createdAt);
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// POST: create a goal
const createGoal = async (req, res) => {
  try {
    const { name, targetAmount, targetDate, priority, startingAmount } =
      req.body;

    if (typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Goal name is required' });
    }

    const target = toNumber(targetAmount);
    if (!Number.isFinite(target) || target <= 0) {
      return res
        .status(400)
        .json({ message: 'Target must be a number greater than 0' });
    }

    let deadline;
    if (!isEmpty(targetDate)) {
      deadline = parseDate(targetDate);
      if (!deadline) {
        return res.status(400).json({ message: 'Invalid target date' });
      }
      if (deadline < startOfToday()) {
        return res
          .status(400)
          .json({ message: 'Target date must be today or later' });
      }
    }

    const goalPriority = isEmpty(priority) ? 'medium' : priority;
    if (!PRIORITIES.includes(goalPriority)) {
      return res
        .status(400)
        .json({ message: 'Priority must be high, medium or low' });
    }

    let starting = 0;
    if (!isEmpty(startingAmount)) {
      starting = toNumber(startingAmount);
      if (!Number.isFinite(starting) || starting < 0) {
        return res
          .status(400)
          .json({ message: 'Starting amount cannot be negative' });
      }
    }

    const goal = await Goal.create({
      user: req.user._id,
      name,
      targetAmount: target,
      targetDate: deadline,
      priority: goalPriority,
      startingAmount: starting,
    });

    res.status(201).json(describeGoal(goal));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// PUT: edit one of my goals (send only the fields you want to change)
const updateGoal = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    // Only find it if it belongs to this user
    const goal = await Goal.findOne({ _id: id, user: req.user._id });
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const { name, targetAmount, targetDate, priority, startingAmount } =
      req.body;

    if (name !== undefined) {
      if (typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ message: 'Goal name is required' });
      }
      goal.name = name;
    }

    if (targetAmount !== undefined) {
      const target = toNumber(targetAmount);
      if (!Number.isFinite(target) || target <= 0) {
        return res
          .status(400)
          .json({ message: 'Target must be a number greater than 0' });
      }
      goal.targetAmount = target;
    }

    if (targetDate !== undefined) {
      if (isEmpty(targetDate)) {
        goal.targetDate = undefined; // removes the deadline
      } else {
        const deadline = parseDate(targetDate);
        if (!deadline) {
          return res.status(400).json({ message: 'Invalid target date' });
        }
        // A deadline you are not changing is always allowed, even if it passed
        const unchanged =
          goal.targetDate &&
          goal.targetDate.toISOString().slice(0, 10) ===
            deadline.toISOString().slice(0, 10);
        if (!unchanged && deadline < startOfToday()) {
          return res
            .status(400)
            .json({ message: 'Target date must be today or later' });
        }
        goal.targetDate = deadline;
      }
    }

    if (priority !== undefined) {
      if (!PRIORITIES.includes(priority)) {
        return res
          .status(400)
          .json({ message: 'Priority must be high, medium or low' });
      }
      goal.priority = priority;
    }

    if (startingAmount !== undefined) {
      const starting = isEmpty(startingAmount) ? 0 : toNumber(startingAmount);
      if (!Number.isFinite(starting) || starting < 0) {
        return res
          .status(400)
          .json({ message: 'Starting amount cannot be negative' });
      }
      goal.startingAmount = starting;
    }

    await goal.save();
    res.json(describeGoal(goal));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE: remove one of my goals (and its history)
const deleteGoal = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const goal = await Goal.findOneAndDelete({
      _id: id,
      user: req.user._id,
    });
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    res.json({ message: 'Goal deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Latest allowed date for a contribution: the end of tomorrow (UTC). This
// leaves room for time zones that are ahead of UTC, like India.
const latestContributionDate = () =>
  new Date(startOfToday().getTime() + 2 * 24 * 60 * 60 * 1000);

// POST: put money towards one of my goals
const addContribution = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    // Only find it if it belongs to this user
    const goal = await Goal.findOne({ _id: id, user: req.user._id });
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    const { amount, date, note } = req.body;

    const numericAmount = toNumber(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res
        .status(400)
        .json({ message: 'Amount must be a number greater than 0' });
    }

    let when = new Date();
    if (!isEmpty(date)) {
      when = parseDate(date);
      if (!when) {
        return res.status(400).json({ message: 'Invalid date' });
      }
      if (when >= latestContributionDate()) {
        return res.status(400).json({ message: 'Date cannot be in the future' });
      }
    }

    goal.contributions.push({
      amount: numericAmount,
      date: when,
      note: typeof note === 'string' ? note : '',
    });

    await goal.save();
    res.status(201).json(describeGoal(goal));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// DELETE: take one entry of money out of one of my goals
const removeContribution = async (req, res) => {
  try {
    const { id, contributionId } = req.params;
    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(contributionId)
    ) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    // Only find it if it belongs to this user
    const goal = await Goal.findOne({ _id: id, user: req.user._id });
    if (!goal) {
      return res.status(404).json({ message: 'Goal not found' });
    }

    if (!goal.contributions.id(contributionId)) {
      return res.status(404).json({ message: 'Contribution not found' });
    }

    goal.contributions.pull(contributionId);
    await goal.save();
    res.json(describeGoal(goal));
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addContribution,
  removeContribution,
};