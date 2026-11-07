const DAY_MS = 24 * 60 * 60 * 1000;

// A budget gets a warning once this share of it is used...
const BUDGET_WARNING_PERCENT = 80;
// ...and a goal counts as "almost there" when this share of it (or less) is left
const GOAL_NEAR_PERCENT = 10;
// A payment alert appears this many days before the due date
const BILL_DAYS_AHEAD = 3;

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

const formatMoney = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

// A date written like "6 Nov 2026"
const formatDate = (value) => {
  const d = new Date(value);
  return `${d.getUTCDate()} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
};

// The start of a date's day (UTC), as a number
const utcDay = (value) => {
  const d = new Date(value);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// Whole days from `now` until a date (negative when the date has passed)
const daysUntil = (value, now) =>
  Math.round((utcDay(value) - utcDay(now)) / DAY_MS);

// Budgets: a warning at 80% used, and an "over budget" alert once it is exceeded.
// `budgets` has one entry per budget this month:
// { categoryId, name, month, amount, spent }
const budgetAlerts = (budgets) => {
  const alerts = [];

  budgets.forEach((b) => {
    if (!(b.amount > 0)) return;

    if (b.spent > b.amount) {
      // Over budget. Only this alert is made, even if the 80% one was skipped.
      alerts.push({
        key: `budget:${b.categoryId}:${b.month}:100`,
        type: 'budget',
        severity: 'danger',
        title: `Over budget: ${b.name}`,
        message:
          `You have spent ${formatMoney(b.spent)} against your ` +
          `${formatMoney(b.amount)} ${b.name} budget, which is ` +
          `${formatMoney(b.spent - b.amount)} over.`,
        link: '/budgets',
      });
    } else if (b.spent * 100 >= b.amount * BUDGET_WARNING_PERCENT) {
      const percent = Math.round((b.spent / b.amount) * 100);
      const left = b.amount - b.spent;
      alerts.push({
        key: `budget:${b.categoryId}:${b.month}:80`,
        type: 'budget',
        severity: 'warning',
        title: `Budget alert: ${b.name}`,
        message:
          `You have used ${percent}% of your ${b.name} budget ` +
          `(${formatMoney(b.spent)} of ${formatMoney(b.amount)}).` +
          (left > 0 ? ` ${formatMoney(left)} left.` : ' Nothing left.'),
        link: '/budgets',
      });
    }
  });

  return alerts;
};

// Goals: almost there, reached, or the deadline passed. `goals` are goals as
// described by goalMath.js (with saved, remaining, completed, daysLeft ...).
const goalAlerts = (goals) => {
  const alerts = [];

  goals.forEach((g) => {
    const id = String(g._id);

    if (g.completed) {
      // A goal that was already finished when it was created is not worth
      // celebrating, so a goal needs at least one saving entry
      if (g.contributions.length > 0) {
        alerts.push({
          key: `goal:${id}:completed`,
          type: 'goal',
          severity: 'success',
          title: `Goal reached: ${g.name}`,
          message:
            `Congratulations! You reached your goal "${g.name}" ` +
            `(${formatMoney(g.targetAmount)}).`,
          link: '/goals',
        });
      }
      return;
    }

    if (g.targetDate && g.daysLeft < 0) {
      alerts.push({
        key: `goal:${id}:overdue`,
        type: 'goal',
        severity: 'warning',
        title: `Deadline passed: ${g.name}`,
        message:
          `The deadline for your goal "${g.name}" (${formatDate(g.targetDate)}) ` +
          `has passed, and ${formatMoney(g.remaining)} is still needed.`,
        link: '/goals',
      });
    }

    // Almost there: some money saved, and 10% of the target (or less) left
    if (
      g.saved > 0 &&
      g.remaining > 0 &&
      g.remaining * 100 <= g.targetAmount * GOAL_NEAR_PERCENT
    ) {
      alerts.push({
        key: `goal:${id}:near`,
        type: 'goal',
        severity: 'success',
        title: `Almost there: ${g.name}`,
        message:
          `You are only ${formatMoney(g.remaining)} away from completing ` +
          `your goal "${g.name}"!`,
        link: '/goals',
      });
    }
  });

  return alerts;
};

// Recurring payments that are due within the next 3 days. `recurring` comes
// from findRecurring in prediction.js.
const billAlerts = (recurring, now) =>
  recurring
    .filter((r) => {
      const days = daysUntil(r.nextDue, now);
      return days >= 0 && days <= BILL_DAYS_AHEAD;
    })
    .sort((a, b) => a.nextDue.localeCompare(b.nextDue))
    .map((r) => ({
      key: `bill:${r.categoryName}|${r.label}:${r.nextDue}`,
      type: 'bill',
      severity: 'info',
      title: `Payment due: ${r.label}`,
      message:
        `Your ${r.label} payment of ${formatMoney(r.typical)} is due on ` +
        `${formatDate(r.nextDue)}.`,
      link: '/dashboard',
    }));

// Every alert that applies right now
const buildAlerts = ({
  budgets = [],
  goals = [],
  recurring = [],
  now = new Date(),
}) => [
  ...budgetAlerts(budgets),
  ...goalAlerts(goals),
  ...billAlerts(recurring, now),
];

module.exports = { budgetAlerts, goalAlerts, billAlerts, buildAlerts };