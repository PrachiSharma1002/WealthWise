import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import './GettingStarted.css';

// The current month as YYYY-MM, in the user's own timezone
const currentMonth = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 7);
};

export default function GettingStarted() {
  const { user } = useAuth();
  const storageKey = `hideGettingStarted:${user?.email}`;

  const [steps, setSteps] = useState(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'yes';
    } catch {
      return false;
    }
  });

  // Find out which steps are already done
  useEffect(() => {
    let ignore = false; // ignore answers that arrive late
    Promise.allSettled([
      api.get('/insights/trends', {
        params: { month: currentMonth(), months: 12 },
      }),
      api.get('/goals'),
    ]).then(([t, g]) => {
      if (ignore) return;
      // If anything could not be loaded, show nothing rather than a wrong list
      if (t.status !== 'fulfilled' || g.status !== 'fulfilled') return;

      const months = t.value.data.months;
      setSteps({
        income: months.some((m) => m.income > 0),
        expense: months.some((m) => m.spent > 0 || m.invested > 0),
        goal: g.value.data.length > 0,
      });
    });

    return () => {
      ignore = true;
    };
  }, []);

  const hide = () => {
    try {
      localStorage.setItem(storageKey, 'yes');
    } catch {
      // Nothing to do. The checklist is simply hidden until the page reloads.
    }
    setHidden(true);
  };

  if (hidden || !steps) return null;

  const items = [
    {
      key: 'income',
      done: steps.income,
      title: 'Record your income',
      hint: 'Add your salary or any money coming in, so WealthWise can work out how much you save.',
      to: '/transactions',
      action: 'Add income',
    },
    {
      key: 'expense',
      done: steps.expense,
      title: 'Record an expense',
      hint: 'Add something you spent. A budget is created for it automatically, and you can adjust it on the Budgets page.',
      to: '/transactions',
      action: 'Add expense',
    },
    {
      key: 'goal',
      done: steps.goal,
      title: 'Create a goal',
      hint: 'Pick something to save towards, like a laptop or a trip, and see if you are on track.',
      to: '/goals',
      action: 'Create goal',
    },
  ];

  const doneCount = items.filter((i) => i.done).length;
  // Everything is done, so there is nothing left to show
  if (doneCount === items.length) return null;

  return (
    <div className="gs-card">
      <div className="gs-head">
        <div>
          <h2>Getting started</h2>
          <p className="gs-sub">
            {doneCount} of {items.length} done. A few steps and your dashboard
            fills up.
          </p>
        </div>
        <button className="gs-hide" onClick={hide}>
          Hide
        </button>
      </div>

      <div className="gs-bar">
        <div
          className="gs-fill"
          style={{ width: `${(doneCount / items.length) * 100}%` }}
        />
      </div>

      <ul className="gs-list">
        {items.map((item, index) => (
          <li key={item.key} className={item.done ? 'done' : ''}>
            <span className="gs-mark">{item.done ? '✓' : index + 1}</span>
            <div className="gs-text">
              <div className="gs-title">{item.title}</div>
              <div className="gs-hint">{item.hint}</div>
            </div>
            {!item.done && (
              <Link to={item.to} className="gs-action">
                {item.action}
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}