import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';

// How many of the latest transactions to show
const MAX_ROWS = 5;

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });

const formatMonthName = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

// The last day of a month, as YYYY-MM-DD ("2026-10" gives "2026-10-31")
const lastDayOf = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
};

export default function RecentTransactions({ month }) {
  const [transactions, setTransactions] = useState(null);
  const [failed, setFailed] = useState(false);

  // Fetch the month's transactions whenever the month changes
  useEffect(() => {
    if (!month) return; // the month box was cleared, so wait for a new one

    let ignore = false; // ignore answers that arrive late and out of order
    api
      .get('/transactions', {
        params: { startDate: `${month}-01`, endDate: lastDayOf(month) },
      })
      .then((res) => {
        if (ignore) return;
        setTransactions(res.data);
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

  return (
    <div className="dash-panel">
      <h2>Recent transactions</h2>

      {failed ? (
        <p className="dash-empty">Could not load your transactions.</p>
      ) : transactions === null ? (
        <p className="dash-empty">Loading...</p>
      ) : transactions.length === 0 ? (
        <p className="dash-empty">
          No transactions in {formatMonthName(month)}.{' '}
          <Link to="/transactions">Add one</Link>
        </p>
      ) : (
        <>
          <ul className="dash-recent">
            {transactions.slice(0, MAX_ROWS).map((t) => (
              <li key={t._id}>
                <div>
                  <div className="dash-recent-cat">{t.category?.name}</div>
                  <div className="dash-recent-meta">
                    {formatDate(t.date)}
                    {t.note ? ` · ${t.note}` : ''}
                  </div>
                </div>
                <div className={`dash-recent-amount ${t.type}`}>
                  {t.type === 'income' ? '+' : '−'}
                  {formatMoney(t.amount)}
                </div>
              </li>
            ))}
          </ul>
          <Link to="/transactions" className="dash-link">
            {transactions.length > MAX_ROWS
              ? `See all ${transactions.length} transactions in ${formatMonthName(month)}`
              : 'See all transactions'}
          </Link>
        </>
      )}
    </div>
  );
}