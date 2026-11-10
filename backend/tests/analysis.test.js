const test = require('node:test');
const assert = require('node:assert/strict');
const {
  previousMonths,
  monthSummary,
  compareMonths,
  findUnusual,
} = require('../utils/analysis');
const { inc, exp, rows } = require('./fixtures');

test('previousMonths counts back across a year end', () => {
  assert.deepEqual(previousMonths('2026-01', 3), [
    '2025-12',
    '2025-11',
    '2025-10',
  ]);
});

test('monthSummary adds up a month', () => {
  const s = monthSummary(rows, '2026-10');
  assert.equal(s.income, 30000);
  assert.equal(s.spent, 24500); // needs plus lifestyle
  assert.equal(s.invested, 5000); // the SIP
  assert.equal(s.saved, 5500);
  assert.equal(s.savingsRate, 18.3);
  assert.deepEqual(s.groups, { needs: 15000, lifestyle: 9500, savings: 5000 });
});

test('monthSummary ranks the top categories and leaves savings out of spending', () => {
  const s = monthSummary(rows, '2026-10');
  assert.deepEqual(
    s.topCategories.map((c) => [c.name, c.total, c.percentOfSpending]),
    [
      ['Rent', 9000, 37],
      ['Shopping', 8500, 35],
      ['Food', 6000, 24],
    ]
  );
  assert.equal(s.categories.some((c) => c.name === 'SIP'), false);
});

test('monthSummary of an empty month has no savings rate', () => {
  const s = monthSummary(rows, '2026-06');
  assert.equal(s.income, 0);
  assert.equal(s.spent, 0);
  assert.equal(s.savingsRate, null);
});

test('monthSummary can show a negative saved amount', () => {
  const over = [
    inc('2026-10', 10000),
    exp('2026-10', 'shop', 'Shopping', 'lifestyle', 12000),
  ];
  const s = monthSummary(over, '2026-10');
  assert.equal(s.saved, -2000);
  assert.equal(s.savingsRate, -20);
});

test('compareMonths compares totals and savings rates', () => {
  const c = compareMonths(rows, '2026-10');
  assert.equal(c.previousMonth, '2026-09');
  assert.equal(c.previousHasData, true);
  assert.deepEqual(c.spending, {
    current: 24500,
    previous: 19000,
    change: 5500,
    changePercent: 28.9,
  });
  assert.deepEqual(c.savingsRate, { current: 18.3, previous: 36.7 });
});

test('compareMonths compares each category', () => {
  const c = compareMonths(rows, '2026-10');
  const byName = Object.fromEntries(c.categories.map((x) => [x.name, x]));

  assert.equal(byName.Shopping.change, 6500);
  assert.equal(byName.Shopping.changePercent, 325);
  assert.equal(byName.Travel.change, -2000);
  assert.equal(byName.Travel.changePercent, -66.7);
  assert.equal(byName.Rent.change, 0);
  assert.equal(byName.SIP, undefined); // savings are not spending
});

test('compareMonths knows when the month before has no data', () => {
  const c = compareMonths(rows, '2026-07');
  assert.equal(c.previousHasData, false);
  assert.equal(c.spending.changePercent, null);
});

test('findUnusual flags a category far above its normal level', () => {
  const alerts = findUnusual(rows, '2026-10');
  assert.equal(alerts.length, 1); // Food is up 20%, which is not unusual

  const a = alerts[0];
  assert.equal(a.name, 'Shopping');
  assert.equal(a.current, 8500);
  assert.equal(a.average, 2500);
  assert.equal(a.low, 2000);
  assert.equal(a.high, 3000);
  assert.equal(a.times, 3.4);
  assert.ok(a.message.includes('Shopping'));
  assert.ok(a.message.includes('₹8,500'));
});

test('findUnusual needs history before it flags anything', () => {
  assert.equal(findUnusual(rows, '2026-08').length, 0);
});

test('findUnusual ignores small amounts', () => {
  const small = [
    exp('2026-07', 'gym', 'Gym', 'lifestyle', 100),
    exp('2026-08', 'gym', 'Gym', 'lifestyle', 100),
    exp('2026-09', 'gym', 'Gym', 'lifestyle', 100),
    exp('2026-10', 'gym', 'Gym', 'lifestyle', 300),
  ];
  assert.equal(findUnusual(small, '2026-10').length, 0);
});