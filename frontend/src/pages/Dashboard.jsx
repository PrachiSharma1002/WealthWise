import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import { useAuth } from '../context/AuthContext';
import TrendChart from '../components/TrendChart';
import CategoryChart from '../components/CategoryChart';
import GroupChart from '../components/GroupChart';
import GoalsPanel from '../components/GoalsPanel';
import RecurringPanel from '../components/RecurringPanel';
import RecentTransactions from '../components/RecentTransactions';
import './Dashboard.css';

// The current month as YYYY-MM, in the user's own timezone
const currentMonth = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 7);
};

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

const formatMonthName = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

// Colour of the health score: 65 and over is good, 50 to 64 is fair
const scoreLevel = (score) => (score >= 65 ? 'good' : score >= 50 ? 'fair' : 'poor');

// A sentence saying where the plan's income figure comes from
const planNote = (g) => {
  const split = `${g.split.needs} / ${g.split.lifestyle} / ${g.split.savings}`;
  if (g.incomeSource === 'none') {
    return 'No income recorded yet, so there is no plan to compare with.';
  }
  if (g.incomeSource === 'this month') {
    return `The plan uses your income this month (${formatMoney(g.income)}), split ${split}.`;
  }
  return `No income recorded this month yet, so the plan uses your recent monthly average (${formatMoney(g.income)}), split ${split}.`;
};

export default function Dashboard() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [analysis, setAnalysis] = useState(null);
  const [health, setHealth] = useState(null);
  const [trends, setTrends] = useState(null);
  const [plan, setPlan] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch everything whenever the month changes
  useEffect(() => {
    if (!month) return; // the month box was cleared, so wait for a new one

    let ignore = false; // ignore answers that arrive late and out of order
    Promise.allSettled([
      api.get('/insights/analysis', { params: { month } }),
      api.get('/insights/health', { params: { month } }),
      api.get('/insights/trends', { params: { month, months: 6 } }),
      api.get('/budgets/groups', { params: { month } }),
    ]).then(([a, h, t, p]) => {
      if (ignore) return;
      setAnalysis(a.status === 'fulfilled' ? a.value.data : null);
      setHealth(h.status === 'fulfilled' ? h.value.data : null);
      setTrends(t.status === 'fulfilled' ? t.value.data : null);
      setPlan(p.status === 'fulfilled' ? p.value.data : null);
      setError(
        [a, h, t, p].some((x) => x.status === 'rejected')
          ? 'Some of your dashboard could not be loaded. Try refreshing the page.'
          : ''
      );
      setLoading(false);
    });

    return () => {
      ignore = true;
    };
  }, [month]);

  if (loading) return <p>Loading...</p>;

  const summary = analysis?.summary;
  const hasData = summary && (summary.income > 0 || summary.spent > 0);
  const inProgress = analysis && !analysis.monthComplete;

  const showCategories = summary && summary.categories.length > 0;
  const showPlan =
    plan && plan.groups.some((g) => g.allowance > 0 || g.spent > 0);

  return (
    <div>
      <h1>Welcome back, {user?.name}! 👋</h1>
      <p className="dash-sub">Here is how your money looks.</p>

      {error && <div className="dash-error">{error}</div>}

      <div className="dash-month">
        <label>Month</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        {inProgress && (
          <span className="dash-note">
            This month is still in progress, so the numbers so far may change.
          </span>
        )}
      </div>

      {analysis && !hasData && (
        <p className="dash-empty">
          Nothing recorded in {formatMonthName(month)} yet.{' '}
          <Link to="/transactions">Add a transaction</Link> to get started, or
          pick another month.
        </p>
      )}

      {analysis && hasData && (
        <div className="dash-cards">
          <div className="dash-card">
            <div className="dash-card-label">Income</div>
            <div className="dash-card-value">{formatMoney(summary.income)}</div>
            <div className="dash-card-hint">{formatMonthName(month)}</div>
          </div>

          <div className="dash-card">
            <div className="dash-card-label">Spent</div>
            <div className="dash-card-value">{formatMoney(summary.spent)}</div>
            <div className="dash-card-hint">Needs and lifestyle</div>
          </div>

          <div className="dash-card">
            <div className="dash-card-label">Saved</div>
            <div
              className={`dash-card-value ${summary.saved < 0 ? 'negative' : ''}`}
            >
              {summary.saved < 0 ? '−' : ''}
              {formatMoney(Math.abs(summary.saved))}
            </div>
            <div className="dash-card-hint">
              {summary.savingsRate === null
                ? 'No income recorded'
                : `${summary.savingsRate}% of income`}
              {summary.invested > 0 &&
                ` · includes ${formatMoney(summary.invested)} invested`}
            </div>
          </div>

          <Link to="/insights" className="dash-card dash-card-link">
            <div className="dash-card-label">Health Score</div>
            {health && health.score !== null ? (
              <>
                <div
                  className={`dash-card-value score ${scoreLevel(health.score)}`}
                >
                  {health.score}
                  <span> / 100</span>
                </div>
                <div className="dash-card-hint">{health.status}</div>
              </>
            ) : (
              <>
                <div className="dash-card-value none">–</div>
                <div className="dash-card-hint">Not enough data yet</div>
              </>
            )}
          </Link>
        </div>
      )}

      {(showCategories || showPlan) && (
        <div className="dash-row">
          {showCategories && (
            <div className="dash-panel">
              <h2>Where your spending went</h2>
              <CategoryChart categories={summary.categories} />
              <p className="dash-footnote">
                Money you put into savings categories (like a SIP) isn't counted
                as spending here.
              </p>
            </div>
          )}

          {showPlan && (
            <div className="dash-panel">
              <h2>Your plan vs what happened</h2>
              <GroupChart groups={plan.groups} />
              <p className="dash-footnote">
                {planNote(plan)} <Link to="/budgets">See details on Budgets</Link>
              </p>
            </div>
          )}
        </div>
      )}

      {trends && trends.stats.monthsWithData > 0 && (
        <div className="dash-panel">
          <h2>The last 6 months</h2>
          <TrendChart months={trends.months} />
          <p className="dash-footnote">
            Average spending {formatMoney(trends.stats.averageSpent)} a month
            {trends.stats.overallSavingsRate !== null &&
              ` · you saved ${trends.stats.overallSavingsRate}% of your income overall`}
            {trends.stats.highestSpend &&
              ` · highest spending was ${formatMonthName(
                trends.stats.highestSpend.month
              )} (${formatMoney(trends.stats.highestSpend.spent)})`}
            . Hover over a month for details.
          </p>
        </div>
      )}
      
      <div className="dash-row">
        <GoalsPanel />
        <RecurringPanel month={month} />
      </div>

      <RecentTransactions month={month} />
    </div>
  );
}