import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

const STATUS_LABELS = {
  completed: 'Completed',
  on_track: 'On track',
  behind: 'Behind',
  overdue: 'Overdue',
  not_started: 'Not started',
  no_deadline: 'No deadline',
};

// How many goals to show here (the Goals page shows all of them)
const MAX_GOALS = 3;

export default function GoalsPanel() {
  const [goals, setGoals] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let ignore = false;
    api
      .get('/goals')
      .then((res) => {
        if (!ignore) setGoals(res.data);
      })
      .catch(() => {
        if (!ignore) setFailed(true);
      });

    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="dash-panel">
      <h2>Your goals</h2>

      {failed ? (
        <p className="dash-empty">Could not load your goals.</p>
      ) : goals === null ? (
        <p className="dash-empty">Loading...</p>
      ) : goals.length === 0 ? (
        <p className="dash-empty">
          No goals yet. <Link to="/goals">Create your first goal</Link> and see
          if you're on track.
        </p>
      ) : (
        <>
          <ul className="dash-goal-list">
            {goals.slice(0, MAX_GOALS).map((g) => (
              <li key={g._id}>
                <div className="dash-goal-head">
                  <span className="dash-goal-name">{g.name}</span>
                  <span className={`dash-goal-status ${g.status}`}>
                    {STATUS_LABELS[g.status]}
                  </span>
                </div>

                <div className="dash-goal-bar">
                  <div
                    className={`dash-goal-fill ${g.status}`}
                    style={{ width: `${g.percentComplete}%` }}
                  />
                </div>

                <div className="dash-goal-numbers">
                  <span>
                    {formatMoney(g.saved)} of {formatMoney(g.targetAmount)} ·{' '}
                    {g.percentComplete}%
                  </span>
                  <span>
                    {g.completed
                      ? 'Goal reached!'
                      : `${formatMoney(g.remaining)} to go`}
                  </span>
                </div>

                {g.monthlyNeeded !== null && (
                  <div className="dash-goal-note">
                    Needs about {formatMoney(g.monthlyNeeded)} a month
                  </div>
                )}
              </li>
            ))}
          </ul>

          <Link to="/goals" className="dash-link">
            {goals.length > MAX_GOALS
              ? `See all ${goals.length} goals`
              : 'Manage your goals'}
          </Link>
        </>
      )}
    </div>
  );
}