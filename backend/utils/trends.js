const { round1, round2, monthSummary, previousMonths } = require('./analysis');

// Builds the month-by-month picture, oldest month first, ending on `endMonth`.
// `rows` has one line per month, type and category (see analysis.js).
const monthlyTrend = (rows, endMonth, count) => {
  const months = [endMonth, ...previousMonths(endMonth, count - 1)]
    .reverse()
    .map((m) => {
      const s = monthSummary(rows, m);
      return {
        month: m,
        // false when nothing at all was recorded that month
        hasData: rows.some((r) => r.month === m),
        income: s.income,
        spent: s.spent,
        invested: s.invested,
        saved: s.saved,
        savingsRate: s.savingsRate,
      };
    });

  const withData = months.filter((m) => m.hasData);
  const withIncome = months.filter((m) => m.income > 0);

  const average = (list, key) =>
    list.length > 0
      ? round2(list.reduce((sum, m) => sum + m[key], 0) / list.length)
      : null;

  // The overall savings rate counts only months that had income
  const incomeTotal = withIncome.reduce((sum, m) => sum + m.income, 0);
  const savedTotal = withIncome.reduce((sum, m) => sum + m.saved, 0);

  // The month with the most spending (ties go to the earlier month)
  const highest =
    withData.length > 0
      ? withData.reduce((best, m) => (m.spent > best.spent ? m : best))
      : null;

  return {
    months,
    stats: {
      monthsWithData: withData.length,
      averageSpent: average(withData, 'spent'),
      averageIncome: average(withIncome, 'income'),
      overallSavingsRate:
        incomeTotal > 0 ? round1((savedTotal / incomeTotal) * 100) : null,
      highestSpend:
        highest && highest.spent > 0
          ? { month: highest.month, spent: highest.spent }
          : null,
    },
  };
};

module.exports = { monthlyTrend };