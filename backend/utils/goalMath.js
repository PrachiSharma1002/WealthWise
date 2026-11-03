// Rounds to 2 decimal places, so 0.1 + 0.2 shows as 0.3
const round2 = (n) => Math.round(n * 100) / 100;

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTH_DAYS = 30.4375; // the average length of a month
const MONTH_MS = MONTH_DAYS * DAY_MS;

// Saving pace is measured over the last 6 months, so old habits fade out
const PACE_WINDOW_MONTHS = 6;

const formatMoney = (n) => '₹' + Math.round(n).toLocaleString('en-IN');

const formatMonth = (date) =>
  new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

// The start of a date's day (UTC), as a number
const utcDay = (date) => {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
};

// Adds up all the money saved towards a goal so far
const totalSaved = (goal) =>
  round2(
    (goal.startingAmount || 0) +
      goal.contributions.reduce((sum, c) => sum + c.amount, 0)
  );

// How much the user really saves per month, measured over the last 6 months.
// Returns null when there are no entries at all.
const savingPace = (goal, now) => {
  const entries = goal.contributions.filter(
    (c) => new Date(c.date).getTime() <= now.getTime()
  );
  if (entries.length === 0) return null;

  const earliest = Math.min(...entries.map((c) => new Date(c.date).getTime()));
  const windowStart = Math.max(
    earliest,
    now.getTime() - PACE_WINDOW_MONTHS * MONTH_MS
  );

  // At least one month, so a single recent entry is not blown up
  const months = Math.max(1, (now.getTime() - windowStart) / MONTH_MS);
  const total = entries
    .filter((c) => new Date(c.date).getTime() >= windowStart)
    .reduce((sum, c) => sum + c.amount, 0);

  return total / months;
};

// Turns a goal from the database into everything the page needs
const describeGoal = (goal, nowArg) => {
  // (map() passes an index as the second argument, so only trust real dates)
  const now = nowArg instanceof Date ? nowArg : new Date();

  const saved = totalSaved(goal);
  const remaining = round2(Math.max(0, goal.targetAmount - saved));
  const percentComplete = Math.min(
    100,
    Math.round((saved / goal.targetAmount) * 100)
  );
  const completed = saved >= goal.targetAmount;

  const pace = savingPace(goal, now);

  // Deadline numbers
  let daysLeft = null;
  let monthsLeft = null;
  let monthlyNeeded = null;
  if (goal.targetDate) {
    daysLeft = Math.round((utcDay(goal.targetDate) - utcDay(now)) / DAY_MS);
    monthsLeft = daysLeft / MONTH_DAYS;
    if (!completed && daysLeft >= 0) {
      monthlyNeeded = Math.ceil(remaining / Math.max(1, monthsLeft));
    }
  }

  // When will it be done at the current pace?
  let estimatedCompletion = null;
  if (!completed && pace !== null && pace > 0) {
    const monthsToGo = remaining / pace;
    if (monthsToGo <= 1200) {
      estimatedCompletion = new Date(
        now.getTime() + monthsToGo * MONTH_MS
      ).toISOString();
    }
  }

  // The status
  let status;
  if (completed) {
    status = 'completed';
  } else if (!goal.targetDate) {
    status = 'no_deadline';
  } else if (daysLeft < 0) {
    status = 'overdue';
  } else if (pace === null) {
    status = 'not_started';
  } else if (
    estimatedCompletion &&
    new Date(estimatedCompletion).getTime() <=
      utcDay(goal.targetDate) + DAY_MS
  ) {
    status = 'on_track';
  } else {
    status = 'behind';
  }

  // Plain-English advice
  const suggestions = [];
  if (status === 'completed') {
    suggestions.push('You reached this goal! 🎉');
  } else if (status === 'overdue') {
    suggestions.push(
      `The deadline has passed and ${formatMoney(remaining)} is still needed. ` +
        'Move the deadline, or keep saving to finish it.'
    );
  } else if (status === 'not_started') {
    suggestions.push(
      `Start with about ${formatMoney(monthlyNeeded)} a month to reach this ` +
        `goal by ${formatMonth(goal.targetDate)}.`
    );
  } else if (status === 'on_track') {
    suggestions.push(
      `You're on track. Keep saving about ${formatMoney(pace)} a month, and ` +
        `you should finish around ${formatMonth(estimatedCompletion)}.`
    );
  } else if (status === 'behind') {
    if (pace > 0) {
      const extra = monthlyNeeded - Math.round(pace);
      if (extra > 0) {
        suggestions.push(
          `You're saving about ${formatMoney(pace)} a month, but this goal ` +
            `needs about ${formatMoney(monthlyNeeded)} a month to finish by ` +
            `${formatMonth(goal.targetDate)}. Add about ${formatMoney(extra)} ` +
            'more each month' +
            (estimatedCompletion
              ? `, or move the deadline to around ${formatMonth(estimatedCompletion)}.`
              : '.')
        );
      } else {
        suggestions.push(
          `At about ${formatMoney(pace)} a month, you'd finish around ` +
            `${formatMonth(estimatedCompletion)}, after your deadline of ` +
            `${formatMonth(goal.targetDate)}. Try adding a little extra, or ` +
            'move the deadline.'
        );
      }
    } else {
      suggestions.push(
        "You haven't saved towards this goal recently. Putting aside about " +
          `${formatMoney(monthlyNeeded)} a month would get you there by ` +
          `${formatMonth(goal.targetDate)}.`
      );
    }
  } else if (status === 'no_deadline') {
    suggestions.push(
      'Add a deadline to see how much you need to save each month.'
    );
    if (estimatedCompletion) {
      suggestions.push(
        `At about ${formatMoney(pace)} a month, you'd reach this goal around ` +
          `${formatMonth(estimatedCompletion)}.`
      );
    }
  }

  return {
    _id: goal._id,
    name: goal.name,
    targetAmount: goal.targetAmount,
    targetDate: goal.targetDate || null,
    priority: goal.priority,
    startingAmount: goal.startingAmount || 0,
    saved,
    remaining,
    percentComplete,
    completed,
    daysLeft,
    monthsLeft: monthsLeft === null ? null : Math.round(monthsLeft * 10) / 10,
    monthlyNeeded,
    pacePerMonth: pace === null ? null : round2(pace),
    estimatedCompletion,
    status,
    suggestions,
    // Newest contribution first
    contributions: [...goal.contributions].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    ),
    createdAt: goal.createdAt,
  };
};

module.exports = { round2, totalSaved, describeGoal };