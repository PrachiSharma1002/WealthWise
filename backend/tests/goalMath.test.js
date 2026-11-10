const test = require('node:test');
const assert = require('node:assert/strict');
const { describeGoal } = require('../utils/goalMath');

// A fixed "today", so the results never depend on the real date
const NOW = new Date('2026-11-03T00:00:00Z');
const d = (text) => new Date(text + 'T00:00:00Z');

const goal = (fields) =>
  describeGoal(
    {
      _id: 'test',
      name: 'Test goal',
      priority: 'medium',
      startingAmount: 0,
      contributions: [],
      createdAt: NOW,
      ...fields,
    },
    NOW
  );

test('a goal that is behind says how much more to save', () => {
  const g = goal({
    targetAmount: 80000,
    targetDate: d('2027-05-03'),
    startingAmount: 20000,
    contributions: [
      { amount: 5000, date: d('2026-09-03') },
      { amount: 5000, date: d('2026-10-03') },
    ],
  });
  assert.equal(g.saved, 30000);
  assert.equal(g.remaining, 50000);
  assert.equal(g.percentComplete, 38);
  assert.equal(g.status, 'behind');
  assert.equal(g.monthlyNeeded, 8409);
  assert.equal(Math.round(g.pacePerMonth), 4990);
  assert.equal(g.estimatedCompletion.slice(0, 7), '2027-09');
  assert.equal(
    g.suggestions[0],
    "You're saving about ₹4,990 a month, but this goal needs about ₹8,409 " +
      'a month to finish by May 2027. Add about ₹3,419 more each month, or ' +
      'move the deadline to around Sep 2027.'
  );
});

test('a goal that is on track', () => {
  const g = goal({
    targetAmount: 12000,
    targetDate: d('2027-02-03'),
    contributions: [
      { amount: 4000, date: d('2026-09-03') },
      { amount: 4000, date: d('2026-10-03') },
    ],
  });
  assert.equal(g.saved, 8000);
  assert.equal(g.percentComplete, 67);
  assert.equal(g.status, 'on_track');
  assert.equal(g.monthlyNeeded, 1324);
  assert.equal(g.estimatedCompletion.slice(0, 7), '2026-12');
});

test('a completed goal needs nothing more', () => {
  const g = goal({ targetAmount: 1000, startingAmount: 1000 });
  assert.equal(g.completed, true);
  assert.equal(g.remaining, 0);
  assert.equal(g.percentComplete, 100);
  assert.equal(g.status, 'completed');
  assert.equal(g.monthlyNeeded, null);
});

test('a goal with no deadline can still estimate a finish date', () => {
  const g = goal({
    targetAmount: 5000,
    contributions: [{ amount: 1000, date: d('2026-10-03') }],
  });
  assert.equal(g.status, 'no_deadline');
  assert.equal(g.monthlyNeeded, null);
  assert.equal(Math.round(g.pacePerMonth), 982);
  assert.equal(g.estimatedCompletion.slice(0, 7), '2027-03');
});

test('a goal past its deadline is overdue', () => {
  const g = goal({
    targetAmount: 10000,
    targetDate: d('2026-10-15'),
    startingAmount: 2000,
  });
  assert.equal(g.status, 'overdue');
  assert.equal(g.remaining, 8000);
  assert.equal(g.monthlyNeeded, null);
  assert.ok(g.daysLeft < 0);
});

test('a goal with a deadline but no savings has not started', () => {
  const g = goal({ targetAmount: 6000, targetDate: d('2027-05-03') });
  assert.equal(g.status, 'not_started');
  assert.equal(g.monthlyNeeded, 1009);
  assert.equal(g.pacePerMonth, null);
});

test('a goal with an old entry only counts as stalled', () => {
  const g = goal({
    targetAmount: 10000,
    targetDate: d('2027-05-03'),
    contributions: [{ amount: 3000, date: d('2026-01-10') }],
  });
  assert.equal(g.saved, 3000);
  assert.equal(g.status, 'behind');
  assert.equal(g.pacePerMonth, 0);
  assert.equal(g.estimatedCompletion, null);
  assert.ok(g.suggestions[0].includes("haven't saved"));
});

test('saved is the starting amount plus every contribution', () => {
  const g = goal({
    targetAmount: 10000,
    startingAmount: 500,
    contributions: [
      { amount: 250.5, date: d('2026-10-01') },
      { amount: 100, date: d('2026-10-02') },
    ],
  });
  assert.equal(g.saved, 850.5);
});

test('saving more than the target never goes past 100 percent', () => {
  const g = goal({ targetAmount: 1000, startingAmount: 1500 });
  assert.equal(g.percentComplete, 100);
  assert.equal(g.remaining, 0);
  assert.equal(g.completed, true);
});

test('contributions are listed newest first', () => {
  const g = goal({
    targetAmount: 10000,
    contributions: [
      { amount: 1, date: d('2026-08-01') },
      { amount: 3, date: d('2026-10-01') },
      { amount: 2, date: d('2026-09-01') },
    ],
  });
  assert.deepEqual(
    g.contributions.map((c) => c.amount),
    [3, 2, 1]
  );
});

test('describeGoal ignores a map() index passed in place of a date', () => {
  // Goals are described through array.map(), which passes the index as the
  // second argument. That must not be mistaken for "today".
  const raw = {
    _id: 'test',
    name: 'Test goal',
    priority: 'medium',
    targetAmount: 1000,
    startingAmount: 0,
    contributions: [],
    createdAt: NOW,
  };
  assert.doesNotThrow(() => [raw, raw].map(describeGoal));
});