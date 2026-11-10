// Sample data shared by the tests: one line per month, type and category,
// like the database gives the math files

const inc = (month, total) => ({
  month,
  type: 'income',
  categoryId: 'sal',
  categoryName: 'Salary',
  total,
});

const exp = (month, id, name, group, total) => ({
  month,
  type: 'expense',
  categoryId: id,
  categoryName: name,
  group,
  total,
});

// July to October 2026. Shopping jumps in October.
const rows = [
  inc('2026-10', 30000),
  inc('2026-09', 30000),
  inc('2026-08', 30000),
  inc('2026-07', 30000),

  exp('2026-10', 'food', 'Food', 'needs', 6000),
  exp('2026-10', 'rent', 'Rent', 'needs', 9000),
  exp('2026-10', 'shop', 'Shopping', 'lifestyle', 8500),
  exp('2026-10', 'trav', 'Travel', 'lifestyle', 1000),
  exp('2026-10', 'sip', 'SIP', 'savings', 5000),

  exp('2026-09', 'food', 'Food', 'needs', 5000),
  exp('2026-09', 'rent', 'Rent', 'needs', 9000),
  exp('2026-09', 'shop', 'Shopping', 'lifestyle', 2000),
  exp('2026-09', 'trav', 'Travel', 'lifestyle', 3000),
  exp('2026-09', 'sip', 'SIP', 'savings', 5000),

  exp('2026-08', 'food', 'Food', 'needs', 5200),
  exp('2026-08', 'rent', 'Rent', 'needs', 9000),
  exp('2026-08', 'shop', 'Shopping', 'lifestyle', 3000),
  exp('2026-08', 'sip', 'SIP', 'savings', 5000),

  exp('2026-07', 'food', 'Food', 'needs', 4800),
  exp('2026-07', 'rent', 'Rent', 'needs', 9000),
  exp('2026-07', 'shop', 'Shopping', 'lifestyle', 2500),
  exp('2026-07', 'sip', 'SIP', 'savings', 5000),
];

module.exports = { inc, exp, rows };