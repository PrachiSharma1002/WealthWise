const test = require('node:test');
const assert = require('node:assert/strict');
const { monthlyTrend } = require('../utils/trends');
const { inc, exp } = require('./fixtures');

// May: an expense but no income. July: nothing at all.
const rows = [
  exp('2026-05', 'rent', 'Rent', 'needs', 9000),

  inc('2026-06', 30000),
  exp('2026-06', 'rent', 'Rent', 'needs', 9000),
  exp('2026-06', 'food', 'Food', 'needs', 4800),
  exp('2026-06', 'shop', 'Shopping', 'lifestyle', 2500),
  exp('2026-06', 'sip', 'SIP', 'savings', 5000),

  inc('2026-08', 30000),
  exp('2026-08', 'rent', 'Rent', 'needs', 9000),
  exp('2026-08', 'food', 'Food', 'needs', 5200),
  exp('2026-08', 'shop', 'Shopping', 'lifestyle', 3000),
  exp('2026-08', 'sip', 'SIP', 'savings', 5000),

  inc('2026-09', 30000),
  exp('2026-09', 'rent', 'Rent', 'needs', 9000),
  exp('2026-09', 'food', 'Food', 'needs', 5000),
  exp('2026-09', 'shop', 'Shopping', 'lifestyle', 2000),
  exp('2026-09', 'trav', 'Travel', 'lifestyle', 3000),
  exp('2026-09', 'sip', 'SIP', 'savings', 5000),

  inc('2026-10', 30000),
  exp('2026-10', 'rent', 'Rent', 'needs', 9000),
  exp('2026-10', 'food', 'Food', 'needs', 6000),
  exp('2026-10', 'shop', 'Shopping', 'lifestyle', 8500),
  exp('2026-10', 'trav', 'Travel', 'lifestyle', 1000),
  exp('2026-10', 'sip', 'SIP', 'savings', 5000),
];

test('monthlyTrend ends on the chosen month, oldest first, and flags a gap', () => {
  const t = monthlyTrend(rows, '2026-10', 6);
  assert.deepEqual(
    t.months.map((m) => m.month),
    ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']
  );
  assert.deepEqual(
    t.months.map((m) => m.hasData),
    [true, true, false, true, true, true]
  );
});

test('monthlyTrend works out each month', () => {
  const t = monthlyTrend(rows, '2026-10', 6);
  const byMonth = Object.fromEntries(t.months.map((m) => [m.month, m]));

  // May had an expense but no income, so it has no savings rate
  assert.equal(byMonth['2026-05'].spent, 9000);
  assert.equal(byMonth['2026-05'].saved, -9000);
  assert.equal(byMonth['2026-05'].savingsRate, null);

  assert.equal(byMonth['2026-06'].spent, 16300);
  assert.equal(byMonth['2026-06'].invested, 5000);
  assert.equal(byMonth['2026-06'].saved, 13700);
  assert.equal(byMonth['2026-06'].savingsRate, 45.7);

  // July has nothing recorded
  assert.equal(byMonth['2026-07'].income, 0);
  assert.equal(byMonth['2026-07'].savingsRate, null);

  assert.equal(byMonth['2026-10'].saved, 5500);
  assert.equal(byMonth['2026-10'].savingsRate, 18.3);
});

test('monthlyTrend works out the overall stats', () => {
  const { stats } = monthlyTrend(rows, '2026-10', 6);
  assert.equal(stats.monthsWithData, 5);
  assert.equal(stats.averageSpent, 17200);
  assert.equal(stats.averageIncome, 30000);
  assert.equal(stats.overallSavingsRate, 35.8); // adds up first, then divides once
  assert.deepEqual(stats.highestSpend, { month: '2026-10', spent: 24500 });
});

test('monthlyTrend copes with no data at all', () => {
  const t = monthlyTrend([], '2026-01', 3);
  assert.deepEqual(
    t.months.map((m) => m.month),
    ['2025-11', '2025-12', '2026-01']
  );
  assert.equal(t.stats.monthsWithData, 0);
  assert.equal(t.stats.averageSpent, null);
  assert.equal(t.stats.averageIncome, null);
  assert.equal(t.stats.overallSavingsRate, null);
  assert.equal(t.stats.highestSpend, null);
});

test('monthlyTrend can show a single month', () => {
  const t = monthlyTrend(rows, '2026-10', 1);
  assert.equal(t.months.length, 1);
  assert.equal(t.months[0].month, '2026-10');
  assert.equal(t.months[0].spent, 24500);
});

test('monthlyTrend copes with income only', () => {
  const { stats } = monthlyTrend([inc('2026-10', 30000)], '2026-10', 3);
  assert.equal(stats.monthsWithData, 1);
  assert.equal(stats.averageSpent, 0);
  assert.equal(stats.overallSavingsRate, 100);
  assert.equal(stats.highestSpend, null);
});