import { useState, useEffect } from 'react';
import api from '../api/api';
import './Goals.css';

// Today's date as YYYY-MM-DD, in the user's own timezone
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });

const formatMonth = (value) =>
  new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

// A date from the backend as YYYY-MM-DD, for a date box
const toInputDate = (value) => new Date(value).toISOString().slice(0, 10);

const STATUS_LABELS = {
  completed: 'Completed',
  on_track: 'On track',
  behind: 'Behind',
  overdue: 'Overdue',
  not_started: 'Not started',
  no_deadline: 'No deadline',
};

const PRIORITY_LABELS = { high: 'High', medium: 'Medium', low: 'Low' };

// A short line about the deadline, like "Deadline 03/05/2027 · 181 days left"
const deadlineText = (g) => {
  if (!g.targetDate) return 'No deadline set';
  const base = `Deadline ${formatDate(g.targetDate)}`;
  if (g.completed) return base;
  if (g.daysLeft < 0) return `${base} · ${Math.abs(g.daysLeft)} days past`;
  if (g.daysLeft === 0) return `${base} · due today`;
  return `${base} · ${g.daysLeft} ${g.daysLeft === 1 ? 'day' : 'days'} left`;
};

export default function Goals() {
  const [goals, setGoals] = useState([]);

  // The "create a goal" form
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [startingAmount, setStartingAmount] = useState('');

  // Which card has a panel open: { id, mode } where mode is add, edit or history
  const [active, setActive] = useState(null);
  const [addForm, setAddForm] = useState({
    amount: '',
    date: today(),
    note: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    targetAmount: '',
    targetDate: '',
    priority: 'medium',
    startingAmount: '',
  });
  const [panelSaving, setPanelSaving] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch my goals when the page opens (and after any change)
  useEffect(() => {
    let ignore = false; // ignore answers that arrive late and out of order
    api
      .get('/goals')
      .then((res) => {
        if (ignore) return;
        setGoals(res.data);
        setError('');
      })
      .catch(() => {
        if (!ignore) setError('Could not load your goals');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [reloadKey]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await api.post('/goals', {
        name,
        targetAmount,
        targetDate,
        priority,
        startingAmount,
      });
      setName('');
      setTargetAmount('');
      setTargetDate('');
      setPriority('medium');
      setStartingAmount('');
      setReloadKey((k) => k + 1); // fetch the list again
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (g) => {
    if (
      !window.confirm(
        `Delete the goal "${g.name}"? Its saving history will be deleted too.`
      )
    ) {
      return;
    }
    setError('');
    try {
      await api.delete(`/goals/${g._id}`);
      if (active && active.id === g._id) setActive(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  // Open a panel on a card, or close it if it is already open
  const togglePanel = (g, mode) => {
    setError('');
    if (active && active.id === g._id && active.mode === mode) {
      setActive(null);
      return;
    }
    if (mode === 'add') {
      setAddForm({ amount: '', date: today(), note: '' });
    }
    if (mode === 'edit') {
      setEditForm({
        name: g.name,
        targetAmount: String(g.targetAmount),
        targetDate: g.targetDate ? toInputDate(g.targetDate) : '',
        priority: g.priority,
        startingAmount: g.startingAmount ? String(g.startingAmount) : '',
      });
    }
    setActive({ id: g._id, mode });
  };

  const handleAddMoney = async (e, g) => {
    e.preventDefault();
    setError('');
    setPanelSaving(true);
    try {
      await api.post(`/goals/${g._id}/contributions`, addForm);
      setActive(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setPanelSaving(false);
    }
  };

  const handleSaveEdit = async (e, g) => {
    e.preventDefault();
    setError('');
    setPanelSaving(true);
    try {
      await api.put(`/goals/${g._id}`, editForm);
      setActive(null);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setPanelSaving(false);
    }
  };

  const handleRemoveContribution = async (g, c) => {
    if (
      !window.confirm(`Remove ${formatMoney(c.amount)} from "${g.name}"?`)
    ) {
      return;
    }
    setError('');
    try {
      await api.delete(`/goals/${g._id}/contributions/${c._id}`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const renderAddForm = (g) => (
    <form className="goal-panel" onSubmit={(e) => handleAddMoney(e, g)}>
      <div className="goal-panel-title">Add money to "{g.name}"</div>
      <div className="goal-panel-fields">
        <div className="goal-field">
          <label>Amount (₹)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={addForm.amount}
            onChange={(e) => setAddForm({ ...addForm, amount: e.target.value })}
            required
          />
        </div>
        <div className="goal-field">
          <label>Date</label>
          <input
            type="date"
            max={today()}
            value={addForm.date}
            onChange={(e) => setAddForm({ ...addForm, date: e.target.value })}
            required
          />
        </div>
        <div className="goal-field goal-field-wide">
          <label>Note (optional)</label>
          <input
            type="text"
            value={addForm.note}
            onChange={(e) => setAddForm({ ...addForm, note: e.target.value })}
            placeholder="e.g. Bonus"
          />
        </div>
      </div>
      <div className="goal-panel-buttons">
        <button type="submit" disabled={panelSaving}>
          {panelSaving ? 'Saving...' : 'Add'}
        </button>
        <button
          type="button"
          className="goal-panel-cancel"
          onClick={() => setActive(null)}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  const renderEditForm = (g) => {
    // A deadline that has already passed can stay as it is, so let it through
    const original = g.targetDate ? toInputDate(g.targetDate) : null;
    const minDeadline = original && original < today() ? original : today();

    return (
      <form className="goal-panel" onSubmit={(e) => handleSaveEdit(e, g)}>
        <div className="goal-panel-title">Edit "{g.name}"</div>
        <div className="goal-panel-fields">
          <div className="goal-field goal-field-wide">
            <label>Goal name</label>
            <input
              type="text"
              value={editForm.name}
              onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
              required
            />
          </div>
          <div className="goal-field">
            <label>Target (₹)</label>
            <input
              type="number"
              min="1"
              step="0.01"
              value={editForm.targetAmount}
              onChange={(e) =>
                setEditForm({ ...editForm, targetAmount: e.target.value })
              }
              required
            />
          </div>
          <div className="goal-field">
            <label>Deadline (clear it to remove)</label>
            <input
              type="date"
              min={minDeadline}
              value={editForm.targetDate}
              onChange={(e) =>
                setEditForm({ ...editForm, targetDate: e.target.value })
              }
            />
          </div>
          <div className="goal-field">
            <label>Already saved (₹)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={editForm.startingAmount}
              onChange={(e) =>
                setEditForm({ ...editForm, startingAmount: e.target.value })
              }
              placeholder="0"
            />
          </div>
          <div className="goal-field">
            <label>Priority</label>
            <select
              value={editForm.priority}
              onChange={(e) =>
                setEditForm({ ...editForm, priority: e.target.value })
              }
            >
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        </div>
        <div className="goal-panel-buttons">
          <button type="submit" disabled={panelSaving}>
            {panelSaving ? 'Saving...' : 'Save changes'}
          </button>
          <button
            type="button"
            className="goal-panel-cancel"
            onClick={() => setActive(null)}
          >
            Cancel
          </button>
        </div>
      </form>
    );
  };

  const renderHistory = (g) => (
    <div className="goal-panel">
      <div className="goal-panel-title">Saving history</div>
      <ul className="goal-history">
        {g.contributions.map((c) => (
          <li key={c._id}>
            <div>
              <div>{formatMoney(c.amount)}</div>
              <div className="goal-history-meta">
                {formatDate(c.date)}
                {c.note ? ` · ${c.note}` : ''}
              </div>
            </div>
            <button
              className="goal-remove"
              onClick={() => handleRemoveContribution(g, c)}
            >
              Remove
            </button>
          </li>
        ))}
        {g.startingAmount > 0 && (
          <li>
            <div>
              <div>{formatMoney(g.startingAmount)}</div>
              <div className="goal-history-meta">
                Already saved when the goal was created
              </div>
            </div>
            <span className="goal-history-meta">Change it with Edit</span>
          </li>
        )}
        {g.contributions.length === 0 && !(g.startingAmount > 0) && (
          <li className="goal-history-empty">
            No entries yet. Use Add money to record your first one.
          </li>
        )}
      </ul>
    </div>
  );

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Goals</h1>
      <p className="goal-sub">
        Save towards the things you want, and see if you're on track.
      </p>

      {error && <div className="goal-error">{error}</div>}

      <form className="goal-form" onSubmit={handleCreate}>
        <div className="goal-field goal-field-wide">
          <label>Goal name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Buy a laptop"
            required
          />
        </div>

        <div className="goal-field">
          <label>Target (₹)</label>
          <input
            type="number"
            min="1"
            step="0.01"
            value={targetAmount}
            onChange={(e) => setTargetAmount(e.target.value)}
            required
          />
        </div>

        <div className="goal-field">
          <label>Deadline (optional)</label>
          <input
            type="date"
            min={today()}
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
          />
        </div>

        <div className="goal-field">
          <label>Already saved (₹)</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={startingAmount}
            onChange={(e) => setStartingAmount(e.target.value)}
            placeholder="0"
          />
        </div>

        <div className="goal-field">
          <label>Priority</label>
          <select value={priority} onChange={(e) => setPriority(e.target.value)}>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : 'Create goal'}
        </button>
      </form>

      {goals.length === 0 ? (
        <p className="goal-empty">No goals yet. Create your first one above!</p>
      ) : (
        <ul className="goal-list">
          {goals.map((g) => (
            <li key={g._id} className="goal-card">
              <div className="goal-head">
                <div>
                  <span className="goal-name">{g.name}</span>
                  <span className={`goal-priority ${g.priority}`}>
                    {PRIORITY_LABELS[g.priority]}
                  </span>
                </div>
                <span className={`goal-status ${g.status}`}>
                  {STATUS_LABELS[g.status]}
                </span>
              </div>

              <div className="goal-bar">
                <div
                  className={`goal-fill ${g.status}`}
                  style={{ width: `${g.percentComplete}%` }}
                />
              </div>

              <div className="goal-numbers">
                <span>
                  {formatMoney(g.saved)} of {formatMoney(g.targetAmount)}
                  <strong> · {g.percentComplete}%</strong>
                </span>
                <span>
                  {g.completed
                    ? 'Goal reached!'
                    : `${formatMoney(g.remaining)} to go`}
                </span>
              </div>

              <ul className="goal-facts">
                <li>{deadlineText(g)}</li>
                {g.monthlyNeeded !== null && (
                  <li>Needs about {formatMoney(g.monthlyNeeded)} a month</li>
                )}
                {g.pacePerMonth !== null && (
                  <li>
                    You save about {formatMoney(Math.round(g.pacePerMonth))} a
                    month
                  </li>
                )}
                {g.estimatedCompletion && (
                  <li>
                    Estimated finish: {formatMonth(g.estimatedCompletion)}
                  </li>
                )}
              </ul>

              {g.suggestions.length > 0 && (
                <div className="goal-advice">
                  {g.suggestions.map((s) => (
                    <p key={s}>{s}</p>
                  ))}
                </div>
              )}

              <div className="goal-actions">
                <button
                  className="goal-link"
                  onClick={() => togglePanel(g, 'add')}
                >
                  Add money
                </button>
                <button
                  className="goal-link"
                  onClick={() => togglePanel(g, 'history')}
                >
                  History ({g.contributions.length})
                </button>
                <button
                  className="goal-link"
                  onClick={() => togglePanel(g, 'edit')}
                >
                  Edit
                </button>
                <button className="goal-delete" onClick={() => handleDelete(g)}>
                  Delete
                </button>
              </div>

              {active && active.id === g._id && active.mode === 'add' &&
                renderAddForm(g)}
              {active && active.id === g._id && active.mode === 'edit' &&
                renderEditForm(g)}
              {active && active.id === g._id && active.mode === 'history' &&
                renderHistory(g)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}