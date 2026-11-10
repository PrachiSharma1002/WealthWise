const test = require('node:test');
const assert = require('node:assert/strict');
const { describeGoal } = require('../utils/goalMath');
const {
  budgetAlerts,
  goalAlerts,
  billAlerts,
  buildAlerts,
} = require('../utils/alerts');

// A fixed "today", so the results never depend on the real date
const NOW = new Date('2026-11-06T09:00:00Z');
const d = (text) => new Date(text + 'T00:00:00Z');

// This month's budgets. Travel and Entertainment should stay quiet.
const budgets = [
  { categoryId: 'food', name: 'Food', month: '2026-11', amount: 7000, spent: 5950 },
  { categoryId: 'shop', name: 'Shopping', month: '2026-11', amount: 6000, spent: 8500 },
  { categoryId: 'trav', name: 'Travel', month: '2026-11', amount: 2000, spent: 1000 },
  { categoryId: 'rent', name: 'Rent', month: '2026-11', amount: 9000, spent: 9000 },
  { categoryId: 'ent', name: 'Entertainment', month: '2026-11', amount: 500, spent: 399 },
  { categoryId: 'bills', name: 'Bills', month: '2026-11', amount: 500, spent: 400 },
];

// Goals as they come out of the database
const rawGoals = [
  {
    _id: 'l1',
    name: 'Laptop',
    targetAmount: 80000,
    startingAmount: 60000,
    targetDate: d('2027-05-03'),
    contributions: [
      { amount: 10000, date: d('2026-10-03') },
      { amount: 8000, date: d('2026-11-03') },
    ],
  },
  {
    _id: 'l2',
    name: 'Trip',
    targetAmount: 20000,
    startingAmount: 1000,
    contributions: [{ amount: 19000, date: d('2026-10-20') }],
  },
  {
    _id: 'l3',
    name: 'Old',
    targetAmount: 10000,
    startingAmount: 2000,
    targetDate: d('2026-10-15'),
    contributions: [],
  },
  {
    _id: 'l4',
    name: 'Far',
    targetAmount: 50000,
    startingAmount: 5000,
    targetDate: d('2027-06-01'),
    contributions: [],
  },
  {
    _id: 'l5',
    name: 'Born done',
    targetAmount: 1000,
    startingAmount: 1000,
    contributions: [],
  },
  {
    _id: 'l6',
    name: 'Late but done',
    targetAmount: 3000,
    startingAmount: 0,
    targetDate: d('2026-10-01'),
    contributions: [{ amount: 3000, date: d('2026-09-25') }],
  },
  {
    _id: 'l7',
    name: 'Edge',
    targetAmount: 10000,
    startingAmount: 9000,
    contributions: [],
  },
];
const goals = rawGoals.map((g) => describeGoal(g, NOW));

// Recurring payments as findRecurring returns them
const recurring = [
  { label: 'Netflix', categoryName: 'Entertainment', group: 'lifestyle', typical: 499, months: 3, lastDate: '2026-10-07', nextDue: '2026-11-07' },
  { label: 'Rent', categoryName: 'Rent', group: 'needs', typical: 9000, months: 4, lastDate: '2026-10-06', nextDue: '2026-11-06' },
  { label: 'Electricity', categoryName: 'Electricity Bill', group: 'needs', typical: 1950, months: 3, lastDate: '2026-10-09', nextDue: '2026-11-09' },
  { label: 'Monthly SIP', categoryName: 'SIP', group: 'savings', typical: 5000, months: 4, lastDate: '2026-10-10', nextDue: '2026-11-10' },
  { label: 'Insurance', categoryName: 'Bills', group: 'needs', typical: 1200, months: 3, lastDate: '2026-10-05', nextDue: '2026-11-05' },
];

// ---------- Budgets ----------

test('a budget at 85 percent gets a warning', () => {
  const food = budgetAlerts(budgets).find((a) => a.key === 'budget:food:2026-11:80');
  assert.equal(food.severity, 'warning');
  assert.equal(food.type, 'budget');
  assert.equal(food.title, 'Budget alert: Food');
  assert.equal(
    food.message,
    'You have used 85% of your Food budget (₹5,950 of ₹7,000). ₹1,050 left.'
  );
});

test('a budget over its limit gets only the "over budget" alert', () => {
  const alerts = budgetAlerts(budgets).filter((a) => a.key.includes(':shop:'));
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].key, 'budget:shop:2026-11:100');
  assert.equal(alerts[0].severity, 'danger');
  assert.ok(alerts[0].message.includes('₹2,500 over'));
});

test('a budget used exactly 100 percent is a warning, not "over"', () => {
  const rent = budgetAlerts(budgets).find((a) => a.key.includes(':rent:'));
  assert.equal(rent.key, 'budget:rent:2026-11:80');
  assert.equal(rent.severity, 'warning');
  assert.ok(rent.message.includes('Nothing left'));
});

test('a budget just under the line stays quiet, and exactly on it alerts', () => {
  const keys = budgetAlerts(budgets).map((a) => a.key);
  assert.equal(keys.some((k) => k.includes(':ent:')), false); // 79.8 percent
  assert.equal(keys.some((k) => k.includes(':bills:')), true); // exactly 80 percent
  assert.equal(keys.some((k) => k.includes(':trav:')), false); // 50 percent
});

// ---------- Goals ----------

test('goals get the right alerts', () => {
  const keys = goalAlerts(goals).map((a) => a.key);
  assert.deepEqual(keys, [
    'goal:l1:near',
    'goal:l2:completed',
    'goal:l3:overdue',
    'goal:l6:completed',
    'goal:l7:near',
  ]);
});

test('a goal within 10 percent of its target is "almost there"', () => {
  const laptop = goalAlerts(goals).find((a) => a.key === 'goal:l1:near');
  assert.equal(laptop.severity, 'success');
  assert.equal(
    laptop.message,
    'You are only ₹2,000 away from completing your goal "Laptop"!'
  );
});

test('a goal created already finished is not celebrated', () => {
  const keys = goalAlerts(goals).map((a) => a.key);
  assert.equal(keys.some((k) => k.includes(':l5:')), false);
});

test('a goal finished after its deadline is celebrated, not flagged overdue', () => {
  const keys = goalAlerts(goals).map((a) => a.key);
  assert.equal(keys.includes('goal:l6:completed'), true);
  assert.equal(keys.includes('goal:l6:overdue'), false);
});

test('a goal that has not reached any line stays quiet', () => {
  const keys = goalAlerts(goals).map((a) => a.key);
  assert.equal(keys.some((k) => k.includes(':l4:')), false);
});

// ---------- Payments ----------

test('payments due within 3 days get an alert, soonest first', () => {
  const alerts = billAlerts(recurring, NOW);
  assert.deepEqual(
    alerts.map((a) => a.title),
    ['Payment due: Rent', 'Payment due: Netflix', 'Payment due: Electricity']
  );
  assert.equal(alerts[0].message, 'Your Rent payment of ₹9,000 is due on 6 Nov 2026.');
});

test('payments further away or already past get no alert', () => {
  const titles = billAlerts(recurring, NOW).map((a) => a.title);
  assert.equal(titles.includes('Payment due: Monthly SIP'), false); // 4 days away
  assert.equal(titles.includes('Payment due: Insurance'), false); // was yesterday
});

// ---------- Everything together ----------

test('buildAlerts gathers every alert, each with its own key', () => {
  const all = buildAlerts({ budgets, goals, recurring, now: NOW });
  const keys = all.map((a) => a.key);
  assert.equal(all.length, 12);
  assert.equal(new Set(keys).size, 12);
});

test('buildAlerts gives the same keys every time, so nothing is repeated', () => {
  const first = buildAlerts({ budgets, goals, recurring, now: NOW }).map((a) => a.key);
  const second = buildAlerts({ budgets, goals, recurring, now: NOW }).map((a) => a.key);
  assert.deepEqual(first, second);
});

test('buildAlerts with nothing to report gives no alerts', () => {
  assert.equal(buildAlerts({ now: NOW }).length, 0);
});