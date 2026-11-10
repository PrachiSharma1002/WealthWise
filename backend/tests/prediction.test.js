const test = require('node:test');
const assert = require('node:assert/strict');
const { predictNextMonth, findRecurring } = require('../utils/prediction');
const { inc, exp, rows } = require('./fixtures');

// ---------- Next-month prediction ----------

test('predictNextMonth builds a weighted forecast from the last 3 months', () => {
  const p = predictNextMonth(rows, '2026-11');
  assert.equal(p.basedOnMonths, 3);
  assert.equal(p.confidence, 'good');
  assert.equal(p.income, 30000);
  assert.equal(p.spending, 21450);
  assert.equal(p.saved, 8550);
  assert.equal(p.savingsRate, 28.5);
  assert.deepEqual(p.groups, { needs: 14530, lifestyle: 6920, savings: 5000 });
});

test('predictNextMonth predicts each category and its trend', () => {
  const p = predictNextMonth(rows, '2026-11');
  const by = Object.fromEntries(p.categories.map((c) => [c.name, c]));

  // The latest month counts 3 times, the one before 2 times, the oldest once
  assert.equal(by.Food.predicted, 5530);
  assert.equal(by.Food.trend, 'rising');
  assert.equal(by.Shopping.predicted, 5420); // one spike is smoothed out
  assert.equal(by.Shopping.trend, 'rising');
  assert.equal(by.Travel.predicted, 1500);
  assert.equal(by.Travel.trend, 'falling');
  assert.equal(by.Rent.predicted, 9000);
  assert.equal(by.Rent.trend, 'steady');
  assert.equal(by.SIP.group, 'savings');
});

test('predictNextMonth lists the biggest categories first', () => {
  const p = predictNextMonth(rows, '2026-11');
  const predicted = p.categories.map((c) => c.predicted);
  assert.deepEqual(
    predicted,
    [...predicted].sort((a, b) => b - a)
  );
});

test('predictNextMonth is cautious with only one month of history', () => {
  const p = predictNextMonth(rows, '2026-08');
  const food = p.categories.find((c) => c.name === 'Food');
  assert.equal(p.basedOnMonths, 1);
  assert.equal(p.confidence, 'low');
  assert.equal(p.spending, 16300);
  assert.equal(p.savingsRate, 45.7);
  assert.equal(food.trend, null); // nothing earlier to compare with
});

test('predictNextMonth skips months where nothing was recorded', () => {
  const gap = predictNextMonth(
    [
      exp('2026-10', 'food', 'Food', 'needs', 1000),
      exp('2026-08', 'food', 'Food', 'needs', 2000),
    ],
    '2026-11'
  );
  assert.equal(gap.basedOnMonths, 2);
  assert.equal(gap.confidence, 'fair');
  assert.equal(gap.categories[0].predicted, 1400);
  assert.equal(gap.categories[0].trend, 'falling');
  assert.equal(gap.income, 0);
  assert.equal(gap.savingsRate, null);
});

test('predictNextMonth with no history gives an empty forecast', () => {
  const none = predictNextMonth(rows, '2026-03');
  assert.equal(none.basedOnMonths, 0);
  assert.equal(none.confidence, 'none');
  assert.equal(none.categories.length, 0);
});

// ---------- Recurring expenses ----------

const tx = (date, id, name, group, amount, note = '') => ({
  date,
  categoryId: id,
  categoryName: name,
  group,
  amount,
  note,
});

const txs = [];

// Rent: the 1st of every month, no note
['2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'].forEach((d) =>
  txs.push(tx(d, 'rent', 'Rent', 'needs', 9000))
);

// Netflix: the same note written three different ways
txs.push(tx('2026-08-05', 'ent', 'Entertainment', 'lifestyle', 499, 'netflix'));
txs.push(tx('2026-09-05', 'ent', 'Entertainment', 'lifestyle', 499, 'Netflix '));
txs.push(tx('2026-10-05', 'ent', 'Entertainment', 'lifestyle', 499, 'Netflix'));

// Electricity: the amount changes a little each month
txs.push(tx('2026-08-12', 'elec', 'Electricity Bill', 'needs', 1800));
txs.push(tx('2026-09-12', 'elec', 'Electricity Bill', 'needs', 2100));
txs.push(tx('2026-10-12', 'elec', 'Electricity Bill', 'needs', 1950));

// A SIP
['2026-08-16', '2026-09-16', '2026-10-16'].forEach((d) =>
  txs.push(tx(d, 'sip', 'SIP', 'savings', 5000, 'Monthly SIP'))
);

// Insurance due at the end of the month (tests short months)
txs.push(tx('2026-08-31', 'bills', 'Bills', 'needs', 1200, 'Insurance'));
txs.push(tx('2026-09-30', 'bills', 'Bills', 'needs', 1200, 'Insurance'));
txs.push(tx('2026-10-31', 'bills', 'Bills', 'needs', 1200, 'Insurance'));

// NOT recurring: Food, with three purchases every month
['2026-08', '2026-09', '2026-10'].forEach((m) =>
  ['02', '10', '20'].forEach((day) =>
    txs.push(tx(`${m}-${day}`, 'food', 'Food', 'needs', 200))
  )
);

// NOT recurring: a subscription that was cancelled (last paid in July)
['2026-05-10', '2026-06-10', '2026-07-10'].forEach((d) =>
  txs.push(tx(d, 'ent', 'Entertainment', 'lifestyle', 300, 'Hotstar'))
);

// NOT recurring: the amount jumps around
txs.push(tx('2026-08-20', 'shop', 'Shopping', 'lifestyle', 500, 'Gift'));
txs.push(tx('2026-09-20', 'shop', 'Shopping', 'lifestyle', 3000, 'Gift'));
txs.push(tx('2026-10-20', 'shop', 'Shopping', 'lifestyle', 800, 'Gift'));

// NOT recurring: a one-off
txs.push(tx('2026-10-03', 'shop', 'Shopping', 'lifestyle', 1500, 'Laptop bag'));

test('findRecurring finds the payments that repeat every month', () => {
  const r = findRecurring(txs, '2026-10');
  assert.equal(r.count, 5);
  assert.equal(r.monthlyTotal, 17649);
  assert.deepEqual(
    r.recurring.map((x) => x.label),
    ['Rent', 'Monthly SIP', 'Electricity Bill', 'Insurance', 'Netflix']
  );
});

test('findRecurring leaves out everyday spending, cancelled and jumpy payments', () => {
  const labels = findRecurring(txs, '2026-10').recurring.map((x) => x.label);
  ['Food', 'Hotstar', 'Gift', 'Laptop bag'].forEach((name) =>
    assert.equal(labels.includes(name), false, `${name} should not be recurring`)
  );
});

test('findRecurring works out typical amounts and the next due date', () => {
  const by = Object.fromEntries(
    findRecurring(txs, '2026-10').recurring.map((x) => [x.label, x])
  );
  assert.equal(by.Rent.typical, 9000);
  assert.equal(by.Rent.months, 4);
  assert.equal(by.Rent.nextDue, '2026-11-01');
  assert.equal(by['Electricity Bill'].typical, 1950); // the middle of 1800, 2100, 1950
  assert.equal(by['Monthly SIP'].group, 'savings');
  // Insurance was paid on the 31st, and November only has 30 days
  assert.equal(by.Insurance.nextDue, '2026-11-30');
});

test('findRecurring treats Netflix, netflix and "Netflix " as one payment', () => {
  const netflix = findRecurring(txs, '2026-10').recurring.find(
    (x) => x.label === 'Netflix'
  );
  assert.equal(netflix.months, 3);
  assert.equal(netflix.typical, 499);
});

test('findRecurring copes with no transactions', () => {
  const empty = findRecurring([], '2026-10');
  assert.equal(empty.count, 0);
  assert.equal(empty.monthlyTotal, 0);
});

test('findRecurring needs at least 3 months', () => {
  const two = [
    tx('2026-09-05', 'ent', 'Entertainment', 'lifestyle', 499, 'Netflix'),
    tx('2026-10-05', 'ent', 'Entertainment', 'lifestyle', 499, 'Netflix'),
  ];
  assert.equal(findRecurring(two, '2026-10').count, 0);
});

// Keeps the helper used by the other test files from looking unused here
test('the shared sample data is available', () => {
  assert.equal(typeof inc, 'function');
});