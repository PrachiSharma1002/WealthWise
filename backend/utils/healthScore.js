const { round1, monthSummary, previousMonths } = require('./analysis');

// What each part of the score is worth. Together they make 100.
const FACTORS = [
  { key: 'savings', label: 'Savings rate', max: 30 },
  { key: 'budget', label: 'Budget discipline', max: 30 },
  { key: 'stability', label: 'Expense stability', max: 25 },
  { key: 'goals', label: 'Goal progress', max: 15 },
];

// Saving 20% of your income or more earns the full savings points
const SAVINGS_RATE_FOR_FULL = 20;
// Monthly spending that swings by 50% or more earns no stability points
const VARIATION_FOR_ZERO = 0.5;
// Savings and stability look at the last 3 months
const WINDOW_MONTHS = 3;
// A score needs at least this many parts to be worked out
const MIN_FACTORS = 2;

// How much a goal's status counts, from 0 to 1
const GOAL_VALUE = {
  completed: 1,
  on_track: 1,
  behind: 0.5,
  no_deadline: 0.5,
  not_started: 0.25,
  overdue: 0,
};
// Important goals count for more
const PRIORITY_WEIGHT = { high: 3, medium: 2, low: 1 };

const clamp01 = (n) => Math.min(1, Math.max(0, n));

// strong: 75% of the points or more. ok: 50% or more. weak: below that.
const ratingOf = (ratio) =>
  ratio >= 0.75 ? 'strong' : ratio >= 0.5 ? 'ok' : 'weak';

const statusOf = (score) => {
  if (score === null) return 'Not enough data yet';
  if (score >= 80) return 'Excellent';
  if (score >= 65) return 'Good';
  if (score >= 50) return 'Fair';
  return 'Needs attention';
};

// Works out the Financial Health Score.
//   rows:          one line per month, type and category (see analysis.js)
//   month:         the month being viewed, like "2026-10"
//   monthComplete: true when that month is over. When it is still in progress,
//                  it is left out of the savings and stability parts.
//   budgets:       this month's budgets: { name, amount, spent }
//   goals:         the user's goals: { status, priority }
const healthScore = ({
  rows,
  month,
  monthComplete = false,
  budgets = [],
  goals = [],
}) => {
  const windowMonths = monthComplete
    ? [month, ...previousMonths(month, WINDOW_MONTHS - 1)]
    : previousMonths(month, WINDOW_MONTHS);
  const summaries = windowMonths.map((m) => monthSummary(rows, m));

  // Each part is { factor, ratio, message }. A ratio of null means no data.
  const parts = [];

  // 1. Savings rate
  {
    const factor = FACTORS[0];
    const withIncome = summaries.filter((s) => s.income > 0);
    if (withIncome.length === 0) {
      parts.push({
        factor,
        ratio: null,
        message: 'Record some income to include this.',
      });
    } else {
      const income = withIncome.reduce((sum, s) => sum + s.income, 0);
      const spent = withIncome.reduce((sum, s) => sum + s.spent, 0);
      const rate = ((income - spent) / income) * 100;
      const ratio = clamp01(rate / SAVINGS_RATE_FOR_FULL);
      const rating = ratingOf(ratio);

      let message;
      if (rating === 'strong') {
        message = `You save about ${round1(rate)}% of your income, which is a strong habit.`;
      } else if (rating === 'ok') {
        message =
          `You save about ${round1(rate)}% of your income. ` +
          `Aiming for ${SAVINGS_RATE_FOR_FULL}% or more would make this a strength.`;
      } else if (rate <= 0) {
        message =
          'You spent more than you earned over this period. ' +
          'Try to cut spending so something is left to save.';
      } else {
        message =
          `You save only about ${round1(rate)}% of your income. ` +
          `Aiming for ${SAVINGS_RATE_FOR_FULL}% would be a big step up.`;
      }
      parts.push({ factor, ratio, message });
    }
  }

  // 2. Budget discipline
  {
    const factor = FACTORS[1];
    if (budgets.length === 0) {
      parts.push({
        factor,
        ratio: null,
        message: 'Set a budget for this month to include this.',
      });
    } else {
      // A budget kept earns 1. Going over loses points in proportion.
      const scores = budgets.map((b) =>
        b.spent <= b.amount ? 1 : clamp01(1 - (b.spent - b.amount) / b.amount)
      );
      const ratio = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      const over = budgets
        .filter((b) => b.spent > b.amount)
        .sort((a, b) => b.spent - b.amount - (a.spent - a.amount))
        .map((b) => b.name);

      const message =
        ratingOf(ratio) === 'strong'
          ? 'You mostly stick to your budgets.' +
            (over.length > 0 ? ` Over budget: ${over.join(', ')}.` : '')
          : `You went over budget in ${over.join(', ')}.`;
      parts.push({ factor, ratio, message });
    }
  }

  // 3. Expense stability
  {
    const factor = FACTORS[2];
    const spends = summaries.map((s) => s.spent).filter((x) => x > 0);
    if (spends.length < 2) {
      parts.push({
        factor,
        ratio: null,
        message: 'Needs spending in at least 2 months to include this.',
      });
    } else {
      const mean = spends.reduce((sum, x) => sum + x, 0) / spends.length;
      const variance =
        spends.reduce((sum, x) => sum + (x - mean) ** 2, 0) / spends.length;
      const variation = Math.sqrt(variance) / mean;
      const ratio = clamp01(1 - variation / VARIATION_FOR_ZERO);
      const rating = ratingOf(ratio);
      const percent = Math.round(variation * 100);

      let message;
      if (rating === 'strong') {
        message = 'Your monthly spending is steady, so it is easy to plan around.';
      } else if (rating === 'ok') {
        message = `Your monthly spending moves around a bit (about ${percent}% from month to month).`;
      } else {
        message =
          `Your monthly spending swings a lot (about ${percent}% from month to month), ` +
          'which makes planning hard.';
      }
      parts.push({ factor, ratio, message });
    }
  }

  // 4. Goal progress
  {
    const factor = FACTORS[3];
    if (goals.length === 0) {
      parts.push({
        factor,
        ratio: null,
        message: 'Create a goal to include this.',
      });
    } else {
      let earned = 0;
      let weights = 0;
      goals.forEach((g) => {
        const weight = PRIORITY_WEIGHT[g.priority] || 2;
        earned += weight * (GOAL_VALUE[g.status] ?? 0.5);
        weights += weight;
      });
      const ratio = earned / weights;
      const rating = ratingOf(ratio);

      const message =
        rating === 'strong'
          ? 'Your goals are on track.'
          : rating === 'ok'
          ? 'Some goals need attention. Check the ones marked behind or overdue.'
          : 'Most of your goals are behind. Add money to them, or move the deadlines.';
      parts.push({ factor, ratio, message });
    }
  }

  const factors = parts.map(({ factor, ratio, message }) => ({
    key: factor.key,
    label: factor.label,
    max: factor.max,
    available: ratio !== null,
    points: ratio === null ? null : round1(factor.max * ratio),
    rating: ratio === null ? null : ratingOf(ratio),
    message,
  }));

  // The score comes from the parts that have data
  const used = parts.filter((p) => p.ratio !== null);
  const earned = used.reduce((sum, p) => sum + p.factor.max * p.ratio, 0);
  const possible = used.reduce((sum, p) => sum + p.factor.max, 0);
  const score =
    used.length >= MIN_FACTORS ? Math.round((earned / possible) * 100) : null;

  const describe = (f) => ({ label: f.label, message: f.message });

  return {
    month,
    monthComplete,
    windowMonths,
    score,
    status: statusOf(score),
    factorsUsed: used.length,
    complete: used.length === FACTORS.length,
    factors,
    strengths: factors.filter((f) => f.rating === 'strong').map(describe),
    improvements: factors
      .filter((f) => f.rating === 'ok' || f.rating === 'weak')
      .map(describe),
  };
};

module.exports = { healthScore };