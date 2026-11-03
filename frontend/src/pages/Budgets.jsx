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

const GROUP_LABELS = {
  needs: 'Needs',
  lifestyle: 'Lifestyle',
  savings: 'Savings',
};

export default function Budgets() {
  const [month, setMonth] = useState(currentMonth());
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [unbudgeted, setUnbudgeted] = useState([]);
  const [recs, setRecs] = useState(null);
  const [groups, setGroups] = useState(null);

  // The "set a budget" form
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState('');

  // The split editor (kept as text so the boxes can be cleared while typing)
  const [splitForm, setSplitForm] = useState({
    needs: '50',
    lifestyle: '30',
    savings: '20',
  });
  const [splitMessage, setSplitMessage] = useState('');
  const [splitSaving, setSplitSaving] = useState(false);

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
            .filter((c) => c.type === 'expense' && c.group !== 'savings')
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
      .then(async (res) => {
        if (ignore) return;
        setBudgets(res.data);
        setError('');

        // Fetch this only after the budgets, so the two requests never race
        // each other to copy last month's budgets into a new month
        try {
          const unb = await api.get('/budgets/unbudgeted', { params: { month } });
          if (!ignore) setUnbudgeted(unb.data);
        } catch {
          if (!ignore) setUnbudgeted([]);
        }
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

  // Fetch the suggestions whenever the month changes (or the split is saved)
  useEffect(() => {
    if (!month) return;

    let ignore = false;
    api
      .get('/budgets/recommendations', { params: { month } })
      .then((res) => {
        if (ignore) return;
        setRecs(res.data);
      })
      .catch(() => {
        if (!ignore) setRecs(null);
      });

    return () => {
      ignore = true;
    };
  }, [month, reloadKey]);

  // Fetch the needs / lifestyle / savings cards
  useEffect(() => {
    if (!month) return;

    let ignore = false;
    api
      .get('/budgets/groups', { params: { month } })
      .then((res) => {
        if (!ignore) setGroups(res.data);
      })
      .catch(() => {
        if (!ignore) setGroups(null);
      });

    return () => {
      ignore = true;
    };
  }, [month, reloadKey]);

  // The first time the suggestions arrive, fill the editor with the saved split
  const [splitLoaded, setSplitLoaded] = useState(false);
  useEffect(() => {
    if (recs?.split && !splitLoaded) {
      setSplitForm({
        needs: String(recs.split.needs),
        lifestyle: String(recs.split.lifestyle),
        savings: String(recs.split.savings),
      });
      setSplitLoaded(true);
    }
  }, [recs, splitLoaded]);

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

  // Save a budget for an unbudgeted category at its suggested limit
  const setAtSuggestion = async (u) => {
    setError('');
    try {
      await api.post('/budgets', {
        category: u.category._id,
        month,
        amount: u.suggested,
      });
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
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

  const updateSplitField = (field, value) => {
    setSplitMessage('');
    setSplitForm((prev) => ({ ...prev, [field]: value }));
  };

  // The three shares as numbers, and whether they are valid
  const splitNumbers = {
    needs: Number(splitForm.needs),
    lifestyle: Number(splitForm.lifestyle),
    savings: Number(splitForm.savings),
  };
  const splitTotal =
    splitNumbers.needs + splitNumbers.lifestyle + splitNumbers.savings;
  const splitValid =
    Object.values(splitForm).every((v) => v !== '') &&
    Object.values(splitNumbers).every(
      (n) => Number.isInteger(n) && n >= 0 && n <= 100
    ) &&
    splitTotal === 100;

  const saveSplit = async (e) => {
    e.preventDefault();
    setError('');
    setSplitMessage('');
    setSplitSaving(true);
    try {
      await api.put('/budgets/split', splitNumbers);
      setSplitMessage('Saved!');
      setReloadKey((k) => k + 1); // refresh the plan boxes and the group cards
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSplitSaving(false);
    }
  };

  const resetSplit = () => {
    setSplitMessage('');
    setSplitForm({ needs: '50', lifestyle: '30', savings: '20' });
  };

  const totalBudget = budgets.reduce((sum, b) => sum + b.amount, 0);
  const totalSpent = budgets.reduce((sum, b) => sum + b.spent, 0);

  // Is the chosen category already budgeted this month?
  const alreadySet = budgets.some((b) => b.category._id === categoryId);

  // Which categories already have a budget this month
  const budgetedIds = new Set(budgets.map((b) => b.category._id));

  // One card for needs, lifestyle or savings
  const renderGroupCard = (g) => {
    const isTarget = g.kind === 'target';
    const hasAllowance = g.allowance > 0;
    const pct = g.percentUsed ?? 0;

    let level;
    if (isTarget) {
      level = pct >= 100 ? 'done' : 'save';
    } else {
      level = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'ok';
    }

    let status;
    if (!hasAllowance) {
      status = 'No allowance yet';
    } else if (isTarget) {
      status =
        g.remaining > 0
          ? `${formatMoney(g.remaining)} left to save`
          : 'Target reached! 🎉';
    } else {
      status =
        g.remaining >= 0
          ? `${formatMoney(g.remaining)} left`
          : `Over by ${formatMoney(Math.abs(g.remaining))}`;
    }

    return (
      <div className="bud-group-card" key={g.group}>
        <div className="bud-group-head">
          <span className="bud-group-name">{GROUP_LABELS[g.group]}</span>
          <span className="bud-group-share">
            {g.percent}% · {formatMoney(g.allowance)}
          </span>
        </div>

        <div className="bud-bar">
          <div
            className={`bud-fill ${level}`}
            style={{ width: `${Math.min(pct, 100)}%` }}
          />
        </div>

        <div className="bud-group-numbers">
          {isTarget
            ? `${formatMoney(g.spent)} saved of ${formatMoney(g.allowance)}`
            : `${formatMoney(g.spent)} of ${formatMoney(g.allowance)} used`}
          {hasAllowance && <strong> · {pct}%</strong>}
        </div>

        <div className={`bud-status ${level}`}>{status}</div>

        {g.categories.length > 0 ? (
          <ul className="bud-group-subs">
            {g.categories.map((c) => (
              <li key={c._id}>
                <span>{c.name}</span>
                <span>{formatMoney(c.spent)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="bud-group-none">Nothing recorded yet</p>
        )}
      </div>
    );
  };

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

      {groups && (
        <div className="bud-plan-section">
          <h2 className="bud-plan-title">Your monthly plan</h2>
          <p className="bud-sub">
            {groups.incomeSource === 'none'
              ? 'No income recorded yet. Add your income on the Transactions page, and your allowances will appear here.'
              : groups.incomeSource === 'this month'
              ? `Based on the income you recorded this month: ${formatMoney(groups.income)}.`
              : `No income recorded this month yet, so this uses your recent monthly average: ${formatMoney(groups.income)}.`}
          </p>
          <div className="bud-groups">{groups.groups.map(renderGroupCard)}</div>
        </div>
      )}

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
                  <span className="bud-name">
                    {b.category.name}
                    {b.auto && (
                      <span
                        className="bud-auto"
                        title="Created automatically. Edit it to set your own limit."
                      >
                        Auto
                      </span>
                    )}
                  </span>
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

      {unbudgeted.length > 0 && (
        <div className="bud-unb">
          <h2 className="bud-unb-title">Spending without a budget</h2>
          <p className="bud-sub">
            You spent money in these categories this month, but they have no
            budget yet.
          </p>
          <ul className="bud-unb-list">
            {unbudgeted.map((u) => (
              <li key={u.category._id}>
                <div>
                  <div className="bud-name">{u.category.name}</div>
                  <div className="bud-numbers">
                    Spent {formatMoney(u.spent)} · Suggested limit{' '}
                    {formatMoney(u.suggested)}
                  </div>
                </div>
                <button
                  className="bud-rec-use"
                  onClick={() => setAtSuggestion(u)}
                >
                  Set budget at {formatMoney(u.suggested)}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="bud-rec-title">Suggested budgets</h2>

      <form className="bud-split" onSubmit={saveSplit}>
        <div className="bud-split-title">Your income split</div>
        <p className="bud-split-help">
          Decide how to divide your income. The three must add up to 100.
        </p>

        <div className="bud-split-fields">
          <div className="bud-field">
            <label>Needs (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={splitForm.needs}
              onChange={(e) => updateSplitField('needs', e.target.value)}
            />
          </div>
          <div className="bud-field">
            <label>Lifestyle (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={splitForm.lifestyle}
              onChange={(e) => updateSplitField('lifestyle', e.target.value)}
            />
          </div>
          <div className="bud-field">
            <label>Savings (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              value={splitForm.savings}
              onChange={(e) => updateSplitField('savings', e.target.value)}
            />
          </div>
        </div>

        <div className="bud-split-footer">
          <span className={`bud-split-total ${splitValid ? 'good' : 'bad'}`}>
            Total: {Number.isNaN(splitTotal) ? '?' : splitTotal}% of 100%
          </span>
          <span className="bud-split-buttons">
            {splitMessage && <span className="bud-split-saved">{splitMessage}</span>}
            <button type="button" className="bud-split-reset" onClick={resetSplit}>
              Reset to 50/30/20
            </button>
            <button type="submit" disabled={!splitValid || splitSaving}>
              {splitSaving ? 'Saving...' : 'Save split'}
            </button>
          </span>
        </div>
      </form>

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
                <div className="bud-plan-label">
                  Needs ({recs.split.needs}%)
                </div>
                <div className="bud-plan-value">{formatMoney(recs.plan.needs)}</div>
              </div>
              <div className="bud-plan-box">
                <div className="bud-plan-label">
                  Lifestyle ({recs.split.lifestyle}%)
                </div>
                <div className="bud-plan-value">
                  {formatMoney(recs.plan.lifestyle)}
                </div>
              </div>
              <div className="bud-plan-box">
                <div className="bud-plan-label">
                  Savings ({recs.split.savings}%)
                </div>
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