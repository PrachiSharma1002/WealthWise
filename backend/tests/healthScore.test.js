const test = require('node:test');
const assert = require('node:assert/strict');
const { healthScore } = require('../utils/healthScore');
const { inc, exp, rows } = require('./fixtures');

// October's budgets: Shopping is the only one that went over
const budgets = [
  { name: 'Food', amount: 7000, spent: 6000 },
  { name: 'Shopping', amount: 6000, spent: 8500 },
  { name: 'Travel', amount: 2000, spent: 1000 },
  { name: 'Rent', amount: 9000, spent: 9000 },
];

const goals = [
  { status: 'on_track', priority: 'high' },
  { status: 'behind', priority: 'medium' },
  { status: 'overdue', priority: 'low' },
];

test('a complete month scores all four parts', () => {
  const h = healthScore({
    rows,
    month: '2026-10',
    monthComplete: true,
    budgets,
    goals,
  });
  assert.equal(h.score, 84);
  assert.equal(h.status, 'Excellent');
  assert.equal(h.factorsUsed, 4);
  assert.equal(h.complete, true);

  const points = Object.fromEntries(h.factors.map((f) => [f.key, f.points]));
  assert.deepEqual(points, {
    savings: 30,
    budget: 26.9,
    stability: 17.3,
    goals: 10,
  });
});

test('strengths and improvements come from how each part rates', () => {
  const h = healthScore({
    rows,
    month: '2026-10',
    monthComplete: true,
    budgets,
    goals,
  });
  assert.equal(h.strengths.length, 2);
  assert.equal(h.improvements.length, 2);
  assert.ok(h.strengths[0].message.includes('32.6%'));
  assert.ok(h.strengths[1].message.includes('Shopping'));
});

test('a month in progress is left out of the savings and stability parts', () => {
  const withNov = [
    ...rows,
    inc('2026-11', 30000),
    exp('2026-11', 'food', 'Food', 'needs', 500),
  ];
  const h = healthScore({
    rows: withNov,
    month: '2026-11',
    monthComplete: false,
  });
  assert.deepEqual(h.windowMonths, ['2026-10', '2026-09', '2026-08']);
  assert.equal(h.factorsUsed, 2); // no budgets or goals were given
  assert.equal(h.complete, false);
  assert.equal(h.score, 86);

  const budget = h.factors.find((f) => f.key === 'budget');
  assert.equal(budget.available, false);
  assert.equal(budget.points, null);
});

test('counting a half-finished month would wreck the stability part', () => {
  const withNov = [
    ...rows,
    inc('2026-11', 30000),
    exp('2026-11', 'food', 'Food', 'needs', 500),
  ];
  const h = healthScore({
    rows: withNov,
    month: '2026-11',
    monthComplete: true, // wrongly treated as finished
  });
  const stability = h.factors.find((f) => f.key === 'stability');
  assert.equal(stability.points, 0);
  assert.equal(h.score, 55);
});

test('with fewer than 2 parts there is no score', () => {
  const h = healthScore({
    rows: [inc('2026-10', 30000), exp('2026-10', 'food', 'Food', 'needs', 6000)],
    month: '2026-10',
    monthComplete: true,
  });
  assert.equal(h.score, null);
  assert.equal(h.status, 'Not enough data yet');
  assert.equal(h.factorsUsed, 1);
});

test('a weak month scores 0 and says what to fix', () => {
  const h = healthScore({
    rows: [
      inc('2026-10', 10000),
      exp('2026-10', 'shop', 'Shopping', 'lifestyle', 12000),
    ],
    month: '2026-10',
    monthComplete: true,
    budgets: [{ name: 'Shopping', amount: 5000, spent: 12000 }],
    goals: [{ status: 'overdue', priority: 'high' }],
  });
  assert.equal(h.score, 0);
  assert.equal(h.status, 'Needs attention');
  assert.equal(h.factorsUsed, 3);
  assert.equal(h.strengths.length, 0);
  assert.equal(h.improvements.length, 3);
});

test('the four parts are worth 100 points together', () => {
  const h = healthScore({ rows, month: '2026-10', monthComplete: true });
  const max = h.factors.reduce((sum, f) => sum + f.max, 0);
  assert.equal(max, 100);
});