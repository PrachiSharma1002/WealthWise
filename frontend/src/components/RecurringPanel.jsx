import { useState, useEffect } from 'react';
import api from '../api/api';

const DAY_MS = 24 * 60 * 60 * 1000;
// A payment due within this many days is marked "Due soon"
const SOON_DAYS = 7;

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

const GROUP_LABELS = {
  needs: 'Needs',
  lifestyle: 'Lifestyle',
  savings: 'Savings',
};

// Today as YYYY-MM-DD, in the user's own timezone
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

// Whole days from today until a YYYY-MM-DD date (negative when it has passed)
const daysUntil = (date) =>
  Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) /
      DAY_MS
  );

const formatDay = (date) =>
  new Date(`${date}T00:00:00Z`).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

// What to say about when a payment is due. Only for the current month or a
// later one: for a month in the past, "not recorded yet" would be misleading.
const dueInfo = (nextDue, live) => {
  const plain = { kind: '', text: `Next due ${formatDay(nextDue)}` };
  if (!live) return plain;

  const days = daysUntil(nextDue);
  if (days < 0) {
    return {
      kind: 'expected',
      text: `Expected ${formatDay(nextDue)}, not recorded yet`,
    };
  }
  if (days === 0) return { kind: 'soon', text: 'Due today' };
  if (days <= SOON_DAYS) {
    return {
      kind: 'soon',
      text: `Due ${formatDay(nextDue)} (in ${days} ${days === 1 ? 'day' : 'days'})`,
    };
  }
  return plain;
};

export default function RecurringPanel({ month }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  // Fetch the recurring payments whenever the month changes
  useEffect(() => {
    if (!month) return; // the month box was cleared, so wait for a new one

    let ignore = false; // ignore answers that arrive late and out of order
    api
      .get('/insights/recurring', { params: { month } })
      .then((res) => {
        if (ignore) return;
        setData(res.data);
        setFailed(false);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });

    return () => {
      ignore = true;
    };
  }, [month]);

  if (!month) return null;

  // Is this the current month or a later one?
  const live = month >= today().slice(0, 7);

  const items =
    data === null
      ? []
      : data.recurring
          .map((r) => ({ ...r, due: dueInfo(r.nextDue, live) }))
          // The ones due soonest come first
          .sort((a, b) => a.nextDue.localeCompare(b.nextDue));

  const soon = items.filter((r) => r.due.kind === 'soon');
  const soonTotal = soon.reduce((sum, r) => sum + r.typical, 0);

  return (
    <div className="dash-panel">
      <h2>Recurring payments</h2>

      {failed ? (
        <p className="dash-empty">Could not load your recurring payments.</p>
      ) : data === null ? (
        <p className="dash-empty">Loading...</p>
      ) : data.count === 0 ? (
        <p className="dash-empty">
          No recurring payments found yet. A payment counts as recurring when it
          shows up in at least 3 of the last 6 months, once or twice a month,
          for a steady amount.
        </p>
      ) : (
        <>
          <p className="dash-bill-summary">
            {data.count} {data.count === 1 ? 'payment repeats' : 'payments repeat'}{' '}
            every month, about {formatMoney(data.monthlyTotal)} in total.
          </p>
          {soon.length > 0 && (
            <p className="dash-bill-summary dash-bill-soon-note">
              {soon.length} due in the next {SOON_DAYS} days, about{' '}
              {formatMoney(soonTotal)}.
            </p>
          )}

          <ul className="dash-bill-list">
            {items.map((r) => (
              <li key={`${r.categoryName}-${r.label}`}>
                <div>
                  <div className="dash-bill-name">{r.label}</div>
                  <div className="dash-bill-meta">
                    {r.categoryName}
                    <span className={`dash-group ${r.group}`}>
                      {GROUP_LABELS[r.group]}
                    </span>
                  </div>
                </div>
                <div className="dash-bill-right">
                  <div className="dash-bill-amount">{formatMoney(r.typical)}</div>
                  <div className={`dash-due ${r.due.kind}`}>{r.due.text}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}