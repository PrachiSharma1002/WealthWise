import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/api';
import './Notifications.css';

// How many notifications to load at a time
const PAGE_SIZE = 30;
// The most the backend will send in one go
const MAX_LIMIT = 100;

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'budget', label: 'Budgets' },
  { key: 'goal', label: 'Goals' },
  { key: 'bill', label: 'Payments' },
];

const EMPTY_TEXT = {
  all: "You're all caught up. Alerts about your budgets, goals and payments will show up here.",
  unread: "Nothing unread. You're all caught up.",
  budget: 'No budget alerts yet.',
  goal: 'No goal alerts yet.',
  bill: 'No payment alerts yet.',
};

// A short "how long ago" text, like "5 min ago"
const timeAgo = (value) => {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value)) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  return new Date(value).toLocaleDateString('en-IN');
};

const formatDate = (value) => new Date(value).toLocaleDateString('en-IN');

export default function Notifications() {
  const navigate = useNavigate();
  const [data, setData] = useState({ unreadCount: 0, total: 0, notifications: [] });
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch the notifications (this also checks for new alerts)
  const load = useCallback(() => {
    return api
      .get('/notifications', { params: { limit } })
      .then((res) => {
        setData(res.data);
        setError('');
      })
      .catch(() => setError('Could not load your notifications'))
      .finally(() => setLoading(false));
  }, [limit]);

  useEffect(() => {
    load();
  }, [load]);

  // Count what each tab would show
  const counts = {
    all: data.notifications.length,
    unread: data.notifications.filter((n) => !n.read).length,
    budget: data.notifications.filter((n) => n.type === 'budget').length,
    goal: data.notifications.filter((n) => n.type === 'goal').length,
    bill: data.notifications.filter((n) => n.type === 'bill').length,
  };

  const shown = data.notifications.filter((n) => {
    if (filter === 'all') return true;
    if (filter === 'unread') return !n.read;
    return n.type === filter;
  });

  const markRead = async (n) => {
    setError('');
    try {
      await api.put(`/notifications/${n._id}/read`);
      await load();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  // Open a notification: mark it as read, then go to the page it points to
  const openNotification = async (n) => {
    if (!n.read) {
      try {
        await api.put(`/notifications/${n._id}/read`);
      } catch {
        // The page still opens, even if marking it as read did not work
      }
    }
    if (n.link) navigate(n.link);
    else load();
  };

  const remove = async (n) => {
    setError('');
    try {
      await api.delete(`/notifications/${n._id}`);
      await load();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const markAll = async () => {
    setError('');
    try {
      await api.put('/notifications/read-all');
      await load();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  const clearAll = async () => {
    if (!window.confirm('Clear all your notifications?')) return;
    setError('');
    try {
      await api.delete('/notifications');
      await load();
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  if (loading) return <p>Loading...</p>;

  const canLoadMore = data.total > data.notifications.length && limit < MAX_LIMIT;
  // Past 100, the backend sends no more, so say so instead of showing a dead button
  const cappedOut = data.total > data.notifications.length && limit >= MAX_LIMIT;

  return (
    <div>
      <h1>Notifications</h1>
      <p className="notif-sub">
        Alerts about your budgets, goals and recurring payments.
      </p>

      {error && <div className="notif-error">{error}</div>}

      <div className="notif-toolbar">
        <div className="notif-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              className={`notif-tab ${filter === f.key ? 'active' : ''}`}
              onClick={() => setFilter(f.key)}
            >
              {f.label}
              <span className="notif-tab-count">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        <div className="notif-bulk">
          {data.unreadCount > 0 && (
            <button className="notif-link" onClick={markAll}>
              Mark all as read
            </button>
          )}
          {data.total > 0 && (
            <button className="notif-link danger" onClick={clearAll}>
              Clear all
            </button>
          )}
        </div>
      </div>

      {shown.length === 0 ? (
        <p className="notif-empty">{EMPTY_TEXT[filter]}</p>
      ) : (
        <ul className="notif-list">
          {shown.map((n) => (
            <li
              key={n._id}
              className={`notif-item ${n.severity} ${n.read ? 'read' : 'unread'}`}
            >
              <div className="notif-body">
                <div className="notif-title">
                  {n.title}
                  {!n.read && <span className="notif-new">New</span>}
                </div>
                <div className="notif-message">{n.message}</div>
                <div className="notif-time">
                  {timeAgo(n.createdAt)} · {formatDate(n.createdAt)}
                </div>
              </div>

              <div className="notif-actions">
                {n.link && (
                  <button className="notif-link" onClick={() => openNotification(n)}>
                    Open
                  </button>
                )}
                {!n.read && (
                  <button className="notif-link" onClick={() => markRead(n)}>
                    Mark read
                  </button>
                )}
                <button className="notif-link danger" onClick={() => remove(n)}>
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canLoadMore && (
        <button
          className="notif-more"
          onClick={() => setLimit((l) => Math.min(l + PAGE_SIZE, MAX_LIMIT))}
        >
          Show more ({data.total - data.notifications.length} older)
        </button>
      )}

      {cappedOut && (
        <p className="notif-footnote">
          Showing your latest {data.notifications.length} notifications. Delete
          some to see older ones.
        </p>
      )}

      <p className="notif-footnote">
        New alerts appear automatically. You get one for each situation, such as
        a budget reaching 80% or a payment coming due.
      </p>
    </div>
  );
}