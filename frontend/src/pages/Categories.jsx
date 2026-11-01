import { useState, useEffect } from 'react';
import api from '../api/api';
import './Categories.css';

const sortCategories = (list) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name));

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [type, setType] = useState('expense');
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
      const res = await api.post('/categories', { name, type });
      setCategories((prev) => [...prev, res.data]);
      setName('');
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

  const renderList = (listType) =>
    sortCategories(categories.filter((c) => c.type === listType)).map((c) => (
      <li key={c._id}>
        <span>{c.name}</span>
        <button onClick={() => handleDelete(c._id)}>Delete</button>
      </li>
    ));

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
        <button type="submit">Add</button>
      </form>

      <div className="cat-columns">
        <div className="cat-box">
          <h2>Income</h2>
          <ul>{renderList('income')}</ul>
        </div>
        <div className="cat-box">
          <h2>Expense</h2>
          <ul>{renderList('expense')}</ul>
        </div>
      </div>
    </div>
  );
}