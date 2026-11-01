import { useState, useEffect } from 'react';
import api from '../api/api';
import './Transactions.css';

// Today's date as YYYY-MM-DD, in the user's own timezone
const today = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
};

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-IN', { timeZone: 'UTC' });

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

const EMPTY_FILTERS = {
  type: '',
  category: '',
  startDate: '',
  endDate: '',
  search: '',
};

export default function Transactions() {
  const [categories, setCategories] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // The add/edit form fields
  const [type, setType] = useState('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(today());
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState(null); // null means "adding new"

  // The filter bar
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchText, setSearchText] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Fetch my categories once, when the page opens
  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => setError('Could not load your categories'));
  }, []);

  // Wait until the user stops typing, then apply the search word
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) =>
        prev.search === searchText ? prev : { ...prev, search: searchText }
      );
    }, 400);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Fetch my transactions whenever a filter changes (or after a save/delete)
  useEffect(() => {
    const params = {};
    if (filters.type) params.type = filters.type;
    if (filters.category) params.category = filters.category;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    if (filters.search.trim()) params.search = filters.search.trim();

    let ignore = false; // ignore answers that arrive late and out of order
    api
      .get('/transactions', { params })
      .then((res) => {
        if (ignore) return;
        setTransactions(res.data);
        setError('');
      })
      .catch(() => {
        if (!ignore) setError('Could not load your transactions');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [filters, reloadKey]);

  // Categories for the form: only the ones matching the chosen type
  const typeCategories = categories
    .filter((c) => c.type === type)
    .sort((a, b) => a.name.localeCompare(b.name));

  // Categories for the filter bar: matching the filter's type, if one is chosen
  const filterCategories = categories
    .filter((c) => !filters.type || c.type === filters.type)
    .sort((a, b) => a.name.localeCompare(b.name));

  const handleTypeChange = (e) => {
    setType(e.target.value);
    setCategoryId(''); // the old category may not fit the new type
  };

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleFilterType = (e) => {
    // changing the type also clears the category filter, which may not fit
    setFilters((prev) => ({ ...prev, type: e.target.value, category: '' }));
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchText('');
  };

  // Put the form back to "add new" mode
  const resetForm = () => {
    setEditingId(null);
    setAmount('');
    setNote('');
    setCategoryId('');
    setDate(today());
  };

  // Load a transaction into the form so it can be changed
  const startEdit = (t) => {
    setError('');
    setEditingId(t._id);
    setType(t.type);
    setAmount(String(t.amount));
    setCategoryId(t.category?._id || '');
    setDate(new Date(t.date).toISOString().slice(0, 10));
    setNote(t.note || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = { type, amount, category: categoryId, date, note };
      if (editingId) {
        await api.put(`/transactions/${editingId}`, payload);
        resetForm();
      } else {
        await api.post('/transactions', payload);
        setAmount('');
        setNote('');
        setCategoryId('');
      }
      setReloadKey((k) => k + 1); // fetch the list again
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (t) => {
    if (!window.confirm(`Delete this ${t.type} of ${formatMoney(t.amount)}?`)) {
      return;
    }
    setError('');
    try {
      await api.delete(`/transactions/${t._id}`);
      if (editingId === t._id) resetForm(); // don't keep editing a deleted row
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const filtersActive =
    Object.values(filters).some(Boolean) || searchText !== '';

  const totalIncome = transactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);
  const totalExpense = transactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Transactions</h1>
      <p className="tx-sub">Record the money you earn and spend.</p>

      {error && <div className="tx-error">{error}</div>}

      <form
        className={`tx-form${editingId ? ' editing' : ''}`}
        onSubmit={handleSubmit}
      >
        {editingId && (
          <div className="tx-editing-banner">Editing a transaction</div>
        )}

        <div className="tx-field">
          <label>Type</label>
          <select value={type} onChange={handleTypeChange}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>

        <div className="tx-field">
          <label>Amount (₹)</label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
        </div>

        <div className="tx-field">
          <label>Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            required
          >
            <option value="">Choose...</option>
            {typeCategories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="tx-field">
          <label>Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
          />
        </div>

        <div className="tx-field tx-note">
          <label>Note (optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Lunch with friends"
          />
        </div>

        <button type="submit" disabled={submitting}>
          {submitting ? 'Saving...' : editingId ? 'Save changes' : 'Add'}
        </button>

        {editingId && (
          <button type="button" className="tx-cancel" onClick={resetForm}>
            Cancel
          </button>
        )}
      </form>

      <h2>Your transactions</h2>

      <div className="tx-filters">
        <div className="tx-field">
          <label>Type</label>
          <select value={filters.type} onChange={handleFilterType}>
            <option value="">All</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>

        <div className="tx-field">
          <label>Category</label>
          <select
            value={filters.category}
            onChange={(e) => updateFilter('category', e.target.value)}
          >
            <option value="">All</option>
            {filterCategories.map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="tx-field">
          <label>From</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={(e) => updateFilter('startDate', e.target.value)}
          />
        </div>

        <div className="tx-field">
          <label>To</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={(e) => updateFilter('endDate', e.target.value)}
          />
        </div>

        <div className="tx-field tx-search">
          <label>Search notes</label>
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            placeholder="e.g. lunch"
          />
        </div>

        {filtersActive && (
          <button type="button" className="tx-clear" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <p className="tx-summary">
        {transactions.length} shown · Income {formatMoney(totalIncome)} ·
        Expenses {formatMoney(totalExpense)}
      </p>

      {transactions.length === 0 ? (
        <p className="tx-empty">
          {filtersActive
            ? 'No transactions match your filters.'
            : 'Nothing here yet. Add your first one above!'}
        </p>
      ) : (
        <ul className="tx-list">
          {transactions.map((t) => (
            <li key={t._id}>
              <div>
                <div className="tx-cat">{t.category?.name}</div>
                <div className="tx-meta">
                  {formatDate(t.date)}
                  {t.note ? ` · ${t.note}` : ''}
                </div>
              </div>
              <div className="tx-right">
                <div className={`tx-amount ${t.type}`}>
                  {t.type === 'income' ? '+' : '-'}
                  {formatMoney(t.amount)}
                </div>
                <div className="tx-actions">
                  <button className="tx-edit-btn" onClick={() => startEdit(t)}>
                    Edit
                  </button>
                  <button
                    className="tx-delete-btn"
                    onClick={() => handleDelete(t)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}