// Rounds to 1 and 2 decimal places
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;

const formatMoney = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

const GROUP_KEYS = ['needs', 'lifestyle', 'savings'];

// "Unusual spending" looks back over the 3 months before the chosen month
const BASELINE_MONTHS = 3;
// A category needs spending in at least 2 of those months to have a "normal"
const MIN_HISTORY_MONTHS = 2;
// This month must be at least 1.5 times the normal...
const UNUSUAL_FACTOR = 1.5;
// ...and at least this many rupees above it, so small amounts never trigger alerts
const UNUSUAL_MIN_EXTRA = 500;

// The months before "2026-10": ["2026-09", "2026-08", "2026-07"]
const previousMonths = (month, count) => {
  const [year, mon] = month.split('-').map(Number);
  const result = [];
  for (let i = 1; i <= count; i++) {
    result.push(
      new Date(Date.UTC(year, mon - 1 - i, 1)).toISOString().slice(0, 7)
    );
  }
  return result;
};

// How much something changed, as a percent. Null when there was nothing before.
const percentChange = (now, before) =>
  before > 0 ? round1(((now - before) / before) * 100) : null;

// Adds up one month. `rows` has one line per month, type and category:
// { month, type, categoryId, categoryName, group, total }
const monthSummary = (rows, month) => {
  let income = 0;
  const groups = { needs: 0, lifestyle: 0, savings: 0 };
  const byCategory = new Map();

  rows
    .filter((r) => r.month === month)
    .forEach((r) => {
      if (r.type === 'income') {
        income += r.total;
        return;
      }

      const group = GROUP_KEYS.includes(r.group) ? r.group : 'lifestyle';
      groups[group] += r.total;

      // Money put into savings is not "spending", so it is left out of the lists
      if (group === 'savings') return;

      const key = String(r.categoryId);
      const existing = byCategory.get(key);
      if (existing) {
        existing.total += r.total;
      } else {
        byCategory.set(key, {
          categoryId: key,
          name: r.categoryName,
          group,
          total: r.total,
        });
      }
    });

  const categories = [...byCategory.values()]
    .map((c) => ({ ...c, total: round2(c.total) }))
    .sort((a, b) => b.total - a.total);

  // Spending is needs plus lifestyle. Savings-group money counts as saved.
  const spent = groups.needs + groups.lifestyle;
  const saved = income - spent;

  return {
    month,
    income: round2(income),
    spent: round2(spent),
    invested: round2(groups.savings),
    saved: round2(saved),
    savingsRate: income > 0 ? round1((saved / income) * 100) : null,
    groups: {
      needs: round2(groups.needs),
      lifestyle: round2(groups.lifestyle),
      savings: round2(groups.savings),
    },
    categories,
    topCategories: categories.slice(0, 3).map((c) => ({
      ...c,
      percentOfSpending: spent > 0 ? Math.round((c.total / spent) * 100) : 0,
    })),
  };
};

// This month against the month before, in total and for each category
const compareMonths = (rows, month) => {
  const previousMonth = previousMonths(month, 1)[0];
  const current = monthSummary(rows, month);
  const previous = monthSummary(rows, previousMonth);

  const ids = new Set(
    [...current.categories, ...previous.categories].map((c) => c.categoryId)
  );

  const categories = [...ids]
    .map((id) => {
      const now = current.categories.find((c) => c.categoryId === id);
      const before = previous.categories.find((c) => c.categoryId === id);
      const currentTotal = now ? now.total : 0;
      const previousTotal = before ? before.total : 0;
      const info = now || before;
      return {
        categoryId: id,
        name: info.name,
        group: info.group,
        current: currentTotal,
        previous: previousTotal,
        change: round2(currentTotal - previousTotal),
        changePercent: percentChange(currentTotal, previousTotal),
      };
    })
    .sort((a, b) => b.current - a.current || b.previous - a.previous);

  return {
    month,
    previousMonth,
    previousHasData: rows.some((r) => r.month === previousMonth),
    spending: {
      current: current.spent,
      previous: previous.spent,
      change: round2(current.spent - previous.spent),
      changePercent: percentChange(current.spent, previous.spent),
    },
    savingsRate: {
      current: current.savingsRate,
      previous: previous.savingsRate,
    },
    categories,
  };
};

// Categories where this month is far above what is normal for you
const findUnusual = (rows, month) => {
  const current = monthSummary(rows, month);
  const history = previousMonths(month, BASELINE_MONTHS).map((m) =>
    monthSummary(rows, m)
  );

  const alerts = [];
  current.categories.forEach((c) => {
    // What you spent here in each earlier month that had any spending
    const past = history
      .map((s) => s.categories.find((x) => x.categoryId === c.categoryId))
      .filter((x) => x && x.total > 0)
      .map((x) => x.total);
    if (past.length < MIN_HISTORY_MONTHS) return;

    const average = past.reduce((sum, t) => sum + t, 0) / past.length;
    const extra = c.total - average;
    if (c.total < average * UNUSUAL_FACTOR || extra < UNUSUAL_MIN_EXTRA) return;

    const low = Math.min(...past);
    const high = Math.max(...past);
    const normal =
      low === high
        ? formatMoney(low)
        : `${formatMoney(low)}–${formatMoney(high)}`;

    alerts.push({
      categoryId: c.categoryId,
      name: c.name,
      group: c.group,
      current: c.total,
      average: round2(average),
      low,
      high,
      times: round1(c.total / average),
      extra: round2(extra),
      message:
        `You normally spend ${normal} on ${c.name}, ` +
        `but this month you spent ${formatMoney(c.total)}.`,
    });
  });

  return alerts.sort((a, b) => b.extra - a.extra);
};

module.exports = {
  round1,
  round2,
  formatMoney,
  previousMonths,
  percentChange,
  monthSummary,
  compareMonths,
  findUnusual,
};