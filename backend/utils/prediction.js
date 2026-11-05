const { round1, round2, previousMonths } = require('./analysis');

const GROUP_KEYS = ['needs', 'lifestyle', 'savings'];

// ---------- Next-month prediction ----------

// The latest month counts 3 times, the one before 2 times, the oldest once
const WEIGHTS = [3, 2, 1];
const PREDICTION_MONTHS = 3;
// "Rising" or "falling" means the latest month is this far from the earlier ones
const TREND_PERCENT = 15;
const CONFIDENCE = { 1: 'low', 2: 'fair', 3: 'good' };

const roundToTen = (n) => Math.round(n / 10) * 10;

// Predicts the spending of `month` from the 3 months before it. `rows` has one
// line per month, type and category: { month, type, categoryId, categoryName,
// group, total }
const predictNextMonth = (rows, month) => {
  // Only months where something was recorded count (most recent first)
  const activeMonths = previousMonths(month, PREDICTION_MONTHS).filter((m) =>
    rows.some((r) => r.month === m)
  );

  if (activeMonths.length === 0) {
    return {
      month,
      basedOnMonths: 0,
      confidence: 'none',
      income: 0,
      spending: 0,
      saved: null,
      savingsRate: null,
      groups: { needs: 0, lifestyle: 0, savings: 0 },
      categories: [],
    };
  }

  const weights = WEIGHTS.slice(0, activeMonths.length);
  const weightTotal = weights.reduce((sum, w) => sum + w, 0);

  // Each category's spending, month by month
  const categories = new Map();
  rows
    .filter((r) => r.type === 'expense' && activeMonths.includes(r.month))
    .forEach((r) => {
      const key = String(r.categoryId);
      if (!categories.has(key)) {
        categories.set(key, {
          categoryId: key,
          name: r.categoryName,
          group: GROUP_KEYS.includes(r.group) ? r.group : 'lifestyle',
          byMonth: {},
        });
      }
      const c = categories.get(key);
      c.byMonth[r.month] = (c.byMonth[r.month] || 0) + r.total;
    });

  const predictions = [];
  categories.forEach((c) => {
    // Spending in each active month, most recent first (0 when there was none)
    const values = activeMonths.map((m) => c.byMonth[m] || 0);
    const weighted =
      values.reduce((sum, v, i) => sum + v * weights[i], 0) / weightTotal;
    const predicted = roundToTen(weighted);
    if (predicted <= 0) return;

    // Is the latest month well above or below the earlier ones?
    let trend = null;
    if (values.length >= 2) {
      const earlier = values.slice(1);
      const earlierAverage =
        earlier.reduce((sum, v) => sum + v, 0) / earlier.length;
      if (earlierAverage > 0) {
        const change = ((values[0] - earlierAverage) / earlierAverage) * 100;
        trend =
          change >= TREND_PERCENT
            ? 'rising'
            : change <= -TREND_PERCENT
            ? 'falling'
            : 'steady';
      } else {
        trend = values[0] > 0 ? 'new' : 'steady';
      }
    }

    predictions.push({
      categoryId: c.categoryId,
      name: c.name,
      group: c.group,
      predicted,
      latest: round2(values[0]),
      trend,
    });
  });

  predictions.sort((a, b) => b.predicted - a.predicted);

  const groups = { needs: 0, lifestyle: 0, savings: 0 };
  predictions.forEach((p) => {
    groups[p.group] += p.predicted;
  });
  // Spending is needs plus lifestyle. Savings-group money counts as saved.
  const spending = groups.needs + groups.lifestyle;

  // Expected income: the average of the active months that had any income
  const incomeByMonth = activeMonths
    .map((m) =>
      rows
        .filter((r) => r.month === m && r.type === 'income')
        .reduce((sum, r) => sum + r.total, 0)
    )
    .filter((total) => total > 0);
  const income =
    incomeByMonth.length > 0
      ? round2(incomeByMonth.reduce((sum, t) => sum + t, 0) / incomeByMonth.length)
      : 0;

  const saved = income > 0 ? round2(income - spending) : null;

  return {
    month,
    basedOnMonths: activeMonths.length,
    confidence: CONFIDENCE[activeMonths.length],
    income,
    spending,
    saved,
    savingsRate: income > 0 ? round1((saved / income) * 100) : null,
    groups,
    categories: predictions,
  };
};

// ---------- Recurring expenses ----------

// Look at the last 6 months, including the chosen one
const RECURRING_WINDOW = 6;
// It must show up in at least this many different months
const RECURRING_MIN_MONTHS = 3;
// ...at most this many times a month (so everyday spending never counts)
const RECURRING_MAX_PER_MONTH = 2;
// ...and the monthly amount must stay within 25% of the usual amount
const RECURRING_TOLERANCE = 0.25;

// "Netflix ", "netflix" and "NETFLIX" all count as the same note
const normalizeNote = (note) =>
  typeof note === 'string'
    ? note.trim().toLowerCase().replace(/\s+/g, ' ')
    : '';

const monthOfDate = (date) => new Date(date).toISOString().slice(0, 7);

const median = (numbers) => {
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

// The same day next month, or the last day if next month is shorter
const nextMonthlyDate = (date) => {
  const d = new Date(date);
  const year = d.getUTCFullYear();
  const next = d.getUTCMonth() + 1;
  const daysInNext = new Date(Date.UTC(year, next + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, next, Math.min(d.getUTCDate(), daysInNext)))
    .toISOString()
    .slice(0, 10);
};

// Finds the expenses that repeat every month. `transactions` has one line per
// expense: { date, amount, categoryId, categoryName, group, note }
const findRecurring = (transactions, month) => {
  const windowMonths = [month, ...previousMonths(month, RECURRING_WINDOW - 1)];
  const groups = new Map();

  transactions.forEach((t) => {
    const m = monthOfDate(t.date);
    if (!windowMonths.includes(m)) return;

    // Same category and same note means the same payment
    const key = `${t.categoryId}|${normalizeNote(t.note)}`;
    if (!groups.has(key)) {
      groups.set(key, {
        categoryName: t.categoryName,
        group: GROUP_KEYS.includes(t.group) ? t.group : 'lifestyle',
        byMonth: new Map(),
        lastDate: null,
        latestNote: '',
      });
    }
    const g = groups.get(key);
    const entry = g.byMonth.get(m) || { count: 0, total: 0 };
    entry.count += 1;
    entry.total += t.amount;
    g.byMonth.set(m, entry);

    const when = new Date(t.date);
    if (!g.lastDate || when > g.lastDate) {
      g.lastDate = when;
      g.latestNote = typeof t.note === 'string' ? t.note.trim() : '';
    }
  });

  const recurring = [];
  groups.forEach((g) => {
    const entries = [...g.byMonth.values()];
    if (entries.length < RECURRING_MIN_MONTHS) return;
    if (entries.some((e) => e.count > RECURRING_MAX_PER_MONTH)) return;

    // The amount must be steady from month to month
    const totals = entries.map((e) => e.total);
    const typical = median(totals);
    if (totals.some((x) => Math.abs(x - typical) > typical * RECURRING_TOLERANCE)) {
      return;
    }

    // It must still be happening: paid this month or last month
    const lastMonth = monthOfDate(g.lastDate);
    if (lastMonth !== windowMonths[0] && lastMonth !== windowMonths[1]) return;

    recurring.push({
      label: g.latestNote || g.categoryName,
      categoryName: g.categoryName,
      group: g.group,
      typical: round2(typical),
      months: entries.length,
      lastDate: g.lastDate.toISOString().slice(0, 10),
      nextDue: nextMonthlyDate(g.lastDate),
    });
  });

  recurring.sort((a, b) => b.typical - a.typical);

  return {
    month,
    count: recurring.length,
    monthlyTotal: round2(recurring.reduce((sum, r) => sum + r.typical, 0)),
    recurring,
  };
};

module.exports = { predictNextMonth, findRecurring };