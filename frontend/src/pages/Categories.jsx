import { useState, useEffect } from 'react';
import api from '../api/api';
import './Categories.css';

const GROUPS = [
  {
    key: 'needs',
    label: 'Needs',
    hint: 'Things you must pay for, like rent, food and bills',
  },
  {
    key: 'lifestyle',
    label: 'Lifestyle',
    hint: 'Things you choose, like shopping, travel and fun',
  },
  {
    key: 'savings',
    label: 'Savings',
    hint: 'Money you set aside, like SIP and emergency fund',
  },
];

const sortCategories = (list) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
  const [group, setGroup] = useState('needs');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // When the page opens, fetch my categories
  useEffect(() => {
    api
      .get('/categories')
      .then((res) => setCategories(res.data))
      .catch(() => setError('Could not load categories'))
      .finally(() => setLoading(false));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const payload = { name, type };
      if (type === 'expense') payload.group = group; // income has no group
      const res = await api.post('/categories', payload);
      setCategories((prev) => [...prev, res.data]);
      setName('');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  // Move an expense category to another group
  const handleMove = async (category, newGroup) => {
    setError('');
    try {
      const res = await api.put(`/categories/${category._id}`, {
        group: newGroup,
      });
      setCategories((prev) =>
        prev.map((c) => (c._id === category._id ? res.data : c))
      );
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const handleDelete = async (id) => {
    setError('');
    try {
      await api.delete(`/categories/${id}`);
      setCategories((prev) => prev.filter((c) => c._id !== id));
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong');
    }
  };

  const incomeCategories = sortCategories(
    categories.filter((c) => c.type === 'income')
  );

  // The expense categories that belong to one group
  const expenseIn = (key) =>
    sortCategories(
      categories.filter(
        (c) => c.type === 'expense' && (c.group || 'lifestyle') === key
      )
    );

  if (loading) return <p>Loading...</p>;

  return (
    <div>
      <h1>Categories</h1>
      <p className="cat-sub">Organize your money into groups.</p>

      {error && <div className="cat-error">{error}</div>}

      <form className="cat-form" onSubmit={handleAdd}>
        <input
          type="text"
          placeholder="New category name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="expense">Expense</option>
          <option value="income">Income</option>
        </select>
        {type === 'expense' && (
          <select value={group} onChange={(e) => setGroup(e.target.value)}>
            {GROUPS.map((g) => (
              <option key={g.key} value={g.key}>
                {g.label}
              </option>
            ))}
          </select>
        )}
        <button type="submit">Add</button>
      </form>

      <div className="cat-columns">
        <div className="cat-box">
          <h2>Income</h2>
          <ul>
            {incomeCategories.map((c) => (
              <li key={c._id}>
                <span>{c.name}</span>
                <button onClick={() => handleDelete(c._id)}>Delete</button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <h2 className="cat-section-title">Expense groups</h2>
      <p className="cat-sub">
        Every expense category belongs to one group. Use the small menu on a
        category to move it.
      </p>

      <div className="cat-columns">
        {GROUPS.map((g) => {
          const items = expenseIn(g.key);
          return (
            <div className="cat-box" key={g.key}>
              <h2>{g.label}</h2>
              <p className="cat-hint">{g.hint}</p>
              <ul>
                {items.length === 0 && (
                  <li className="cat-empty">Nothing here yet</li>
                )}
                {items.map((c) => (
                  <li key={c._id}>
                    <span>{c.name}</span>
                    <span className="cat-item-actions">
                      <select
                        className="cat-move"
                        value={g.key}
                        title="Move to another group"
                        onChange={(e) => handleMove(c, e.target.value)}
                      >
                        {GROUPS.map((opt) => (
                          <option key={opt.key} value={opt.key}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                      <button onClick={() => handleDelete(c._id)}>Delete</button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}