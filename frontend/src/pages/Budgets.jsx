import { useState, useEffect } from 'react';
import api from '../api/api';
import './Budgets.css';

// The current month as YYYY-MM, in the user's own timezone
const currentMonth = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 7);
};

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [recs, setRecs] = useState(null);

  // The "set a budget" form
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch my expense categories once, when the page opens
  useEffect(() => {
    api
      .get('/categories')
      .then((res) =>
        setCategories(
          res.data
            .filter((c) => c.type === 'expense')
            .sort((a, b) => a.name.localeCompare(b.name))
        )
      )
      .catch(() => setError('Could not load your categories'));
  }, []);

  // Fetch the budgets whenever the month changes (or after a save/delete)
  useEffect(() => {
    if (!month) return; // the month box was cleared, so wait for a new one

    let ignore = false; // ignore answers that arrive late and out of order
    api
      .get('/budgets', { params: { month } })
      .then((res) => {
        if (ignore) return;
        setBudgets(res.data);
        setError('');
      })
      .catch(() => {
        if (!ignore) setError('Could not load your budgets');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [month, reloadKey]);

  // Fetch the suggestions whenever the month changes
  useEffect(() => {
    if (!month) return;

    let ignore = false;
    api
      .get('/budgets/recommendations', { params: { month } })
      .then((res) => {
        if (!ignore) setRecs(res.data);
      })
      .catch(() => {
        if (!ignore) setRecs(null);
      });

    return () => {
      ignore = true;
    };
  }, [month]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/budgets', { category: categoryId, month, amount });
      setAmount('');
      setCategoryId('');
      setReloadKey((k) => k + 1); // fetch the list again
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  // Put an existing budget's details into the form so it can be changed
  const startEdit = (b) => {
    setCategoryId(b.category._id);
    setAmount(String(b.amount));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Put a suggestion into the form (the user still has to click save)
  const useSuggestion = (r) => {
    setCategoryId(r.category._id);
    setAmount(String(r.suggested));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (b) => {
    if (!window.confirm(`Delete the ${b.category.name} budget?`)) return;
    setError('');
    try {
      await api.delete(`/budgets/${b._id}`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  // Is the chosen category already budgeted this month?
  const alreadySet = budgets.some((b) => b.category._id === categoryId);

  // Which categories already have a budget this month
  const budgetedIds = new Set(budgets.map((b) => b.category._id));

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Budgets</h1>
      <p className="bud-sub">Set a spending limit for each category.</p>

      {error && <div className="bud-error">{error}</div>}

      <div className="bud-month">
        <label>Month</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
      </div>

      <form className="bud-form" onSubmit={handleSubmit}>
        <div className="bud-field">
          <label>Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Choose...</option>
            {categories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="bud-field">
          <label>Budget (₹)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={submitting || !month}>
          {submitting ? 'Saving...' : alreadySet ? 'Update budget' : 'Set budget'}
        </button>
      </form>

      {budgets.length > 0 && (
        <p className="bud-summary">
          Total budgeted {formatMoney(totalBudget)} · Spent{' '}
          {formatMoney(totalSpent)}
        </p>
      )}

      {budgets.length === 0 ? (
        <p className="bud-empty">
          No budgets for this month yet. Set your first one above!
        </p>
      ) : (
        <ul className="bud-list">
          {budgets.map((b) => {
            const level =
              b.percentUsed >= 100 ? 'over' : b.percentUsed >= 80 ? 'warn' : 'ok';
            return (
              <li key={b._id}>
                <div className="bud-row">
                  <span className="bud-name">{b.category.name}</span>
                  <span className="bud-numbers">
                    {formatMoney(b.spent)} of {formatMoney(b.amount)}
                  </span>
                </div>

                <div className="bud-bar">
                  <div
                    className={`bud-fill ${level}`}
                    style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                  />
                </div>

                <div className="bud-row">
                  <span className={`bud-status ${level}`}>
                    {level === 'over'
                      ? `Over budget by ${formatMoney(Math.abs(b.remaining))}`
                      : level === 'warn'
                      ? `${b.percentUsed}% used, ${formatMoney(b.remaining)} left`
                      : `${formatMoney(b.remaining)} left`}
                  </span>
                  <span className="bud-actions">
                    <button className="bud-edit" onClick={() => startEdit(b)}>
                      Edit
                    </button>
                    <button
                      className="bud-delete"
                      onClick={() => handleDelete(b)}
                    >
                      Delete
                    </button>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <h2 className="bud-rec-title">Suggested budgets</h2>

      {!recs || recs.basedOnMonths === 0 ? (
        <p className="bud-empty">
          Add some transactions in the 3 months before this month, and
          suggestions will appear here.
        </p>
      ) : (
        <div>
          <p className="bud-sub">
            Based on your average of the last {recs.basedOnMonths}{' '}
            {recs.basedOnMonths === 1 ? 'month' : 'months'} of data: income{' '}
            {formatMoney(recs.avgIncome)}, spending{' '}
            {formatMoney(recs.avgExpense)} per month.
          </p>

          {recs.plan && (
            <div className="bud-plan">
              <div className="bud-plan-box">
                <div className="bud-plan-label">Needs (50%)</div>
                <div className="bud-plan-value">{formatMoney(recs.plan.needs)}</div>
              </div>
              <div className="bud-plan-box">
                <div className="bud-plan-label">Lifestyle (30%)</div>
                <div className="bud-plan-value">
                  {formatMoney(recs.plan.lifestyle)}
                </div>
              </div>
              <div className="bud-plan-box">
                <div className="bud-plan-label">Savings (20%)</div>
                <div className="bud-plan-value">
                  {formatMoney(recs.plan.savings)}
                </div>
              </div>
            </div>
          )}

          <ul className="bud-rec-list">
            {recs.recommendations.map((r) => (
              <li key={r.category._id}>
                <div className="bud-rec-info">
                  <div className="bud-name">{r.category.name}</div>
                  <div className="bud-numbers">
                    You spend about {formatMoney(r.avgSpent)} a month ·
                    Suggested {formatMoney(r.suggested)}
                  </div>
                  <div className="bud-rec-msg">{r.message}</div>
                </div>
                {budgetedIds.has(r.category._id) ? (
                  <span className="bud-rec-done">Already set</span>
                ) : (
                  <button
                    className="bud-rec-use"
                    onClick={() => useSuggestion(r)}
                  >
                    Use this
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}