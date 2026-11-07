import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/api';
import './NotificationBell.css';

// How often the bell checks for new notifications while the app is open
const REFRESH_MS = 5 * 60 * 1000;
// How many notifications the dropdown shows
const DROPDOWN_LIMIT = 8;

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

export default function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ unreadCount: 0, total: 0, notifications: [] });
  const [failed, setFailed] = useState(false);
  const wrapRef = useRef(null);

  // Fetch the latest notifications (this also checks for new alerts)
  const load = useCallback(() => {
    return api
      .get('/notifications', { params: { limit: DROPDOWN_LIMIT } })
      .then((res) => {
        setData(res.data);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  // Check when the app opens, then every few minutes
  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  // Close the dropdown when you click outside it or press Esc
  useEffect(() => {
    if (!open) return;

    const onClick = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = () => {
    // Opening the dropdown also refreshes it
    if (!open) load();
    setOpen(!open);
  };

  // Clicking a notification marks it as read and opens the page it points to
  const handleClick = async (n) => {
    setOpen(false);
    if (!n.read) {
      try {
        await api.put(`/notifications/${n._id}/read`);
        setData((prev) => ({
          ...prev,
          unreadCount: Math.max(0, prev.unreadCount - 1),
          notifications: prev.notifications.map((x) =>
            x._id === n._id ? { ...x, read: true } : x
          ),
        }));
      } catch {
        // The page still opens, even if marking it as read did not work
      }
    }
    if (n.link) navigate(n.link);
  };

  const handleDelete = async (e, n) => {
    e.stopPropagation(); // do not also open the notification
    try {
      await api.delete(`/notifications/${n._id}`);
      load();
    } catch {
      setFailed(true);
    }
  };

  const handleMarkAll = async () => {
    try {
      await api.put('/notifications/read-all');
      load();
    } catch {
      setFailed(true);
    }
  };

  const badge = data.unreadCount > 9 ? '9+' : data.unreadCount;

  return (
    <div className="bell" ref={wrapRef}>
      <button
        className="bell-button"
        onClick={toggle}
        aria-label={`Notifications, ${data.unreadCount} unread`}
        aria-expanded={open}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {data.unreadCount > 0 && <span className="bell-badge">{badge}</span>}
      </button>

      {open && (
        <div className="bell-dropdown">
          <div className="bell-head">
            <span className="bell-title">Notifications</span>
            {data.unreadCount > 0 && (
              <button className="bell-link" onClick={handleMarkAll}>
                Mark all as read
              </button>
            )}
          </div>

          {failed && (
            <div className="bell-empty">Could not load your notifications.</div>
          )}

          {!failed && data.notifications.length === 0 && (
            <div className="bell-empty">
              You're all caught up. Alerts about your budgets, goals and
              payments will show up here.
            </div>
          )}

          <ul className="bell-list">
            {data.notifications.map((n) => (
              <li
                key={n._id}
                className={`bell-item ${n.severity} ${n.read ? '' : 'unread'}`}
                onClick={() => handleClick(n)}
              >
                <div className="bell-item-body">
                  <div className="bell-item-title">{n.title}</div>
                  <div className="bell-item-message">{n.message}</div>
                  <div className="bell-item-time">{timeAgo(n.createdAt)}</div>
                </div>
                <button
                  className="bell-delete"
                  onClick={(e) => handleDelete(e, n)}
                  aria-label="Delete this notification"
                  title="Delete"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>

          <div className="bell-foot">
            <Link
              to="/notifications"
              className="bell-link"
              onClick={() => setOpen(false)}
            >
              {data.total > data.notifications.length
                ? `View all ${data.total} notifications`
                : 'View all notifications'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}