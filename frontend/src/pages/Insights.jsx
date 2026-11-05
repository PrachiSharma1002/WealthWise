import { useState, useEffect } from 'react';
import api from '../api/api';
import './Insights.css';

// The month before the current one, as YYYY-MM (the most recent complete month)
const lastMonth = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
    .toISOString()
    .slice(0, 7);
};

// The month after "2026-06" is "2026-07"
const nextMonthOf = (month) => {
  const [year, mon] = month.split('-').map(Number);
  return new Date(Date.UTC(year, mon, 1)).toISOString().slice(0, 7);
};

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

// A signed money amount, like "+₹6,500" or "−₹2,000"
const formatChange = (value) =>
  value === 0
    ? '₹0'
    : `${value > 0 ? '+' : '−'}${formatMoney(Math.abs(value))}`;

// A signed percent, like "+325%". When the earlier amount was zero there is no percent.
const formatPercent = (value) =>
  value === null ? '' : `${value > 0 ? '+' : value < 0 ? '−' : ''}${Math.abs(value)}%`;

const formatMonthName = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

const formatDay = (value) =>
  new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

const GROUP_LABELS = {
  needs: 'Needs',
  lifestyle: 'Lifestyle',
  savings: 'Savings',
};

const TRENDS = {
  rising: { text: '↑ Rising', cls: 'up' },
  falling: { text: '↓ Falling', cls: 'down' },
  steady: { text: 'Steady', cls: '' },
  new: { text: 'New', cls: '' },
};

const CONFIDENCE_LABELS = {
  low: 'Low confidence',
  fair: 'Fair confidence',
  good: 'Good confidence',
};

// Colour of the big score: 65 and over is good, 50 to 64 is fair
const scoreLevel = (score) => (score >= 65 ? 'good' : score >= 50 ? 'fair' : 'poor');

export default function Insights() {
  const [month, setMonth] = useState(lastMonth());
  const [analysis, setAnalysis] = useState(null);
  const [health, setHealth] = useState(null);
  const [forecast, setForecast] = useState(null);
  const [recurring, setRecurring] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // The forecast is for the month after the one picked
  const nextMonth = month ? nextMonthOf(month) : '';

  // Fetch everything whenever the month changes
  useEffect(() => {
    if (!month) return; // the month box was cleared, so wait for a new one

    let ignore = false; // ignore answers that arrive late and out of order
    Promise.allSettled([
      api.get('/insights/analysis', { params: { month } }),
      api.get('/insights/health', { params: { month } }),
      api.get('/insights/prediction', { params: { month: nextMonthOf(month) } }),
      api.get('/insights/recurring', { params: { month } }),
    ]).then(([a, h, p, r]) => {
      if (ignore) return;
      setAnalysis(a.status === 'fulfilled' ? a.value.data : null);
      setHealth(h.status === 'fulfilled' ? h.value.data : null);
      setForecast(p.status === 'fulfilled' ? p.value.data : null);
      setRecurring(r.status === 'fulfilled' ? r.value.data : null);
      setError(
        [a, h, p, r].some((x) => x.status === 'rejected')
          ? 'Some of your insights could not be loaded. Try refreshing the page.'
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
  const comparison = analysis?.comparison;
  const hasData = summary && (summary.income > 0 || summary.spent > 0);

  return (
    <div>
      <h1>Insights</h1>
      <p className="ins-sub">
        See how your money behaved, and what is out of the ordinary.
      </p>

      {error && <div className="ins-error">{error}</div>}

      <div className="ins-month">
        <label>Month</label>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
        />
        {analysis && !analysis.monthComplete && (
          <span className="ins-note">
            This month is still in progress, so the numbers so far may change.
          </span>
        )}
      </div>

      {health && (
        <div className="ins-card">
          <h3>Financial Health Score</h3>

          {health.score === null ? (
            <>
              <div className="ins-score-none">Not enough data yet</div>
              <p className="ins-sub">
                The score needs at least 2 of its 4 parts. Here is what each
                part still needs:
              </p>
            </>
          ) : (
            <div className="ins-score-row">
              <div className={`ins-score ${scoreLevel(health.score)}`}>
                {health.score}
                <span> / 100</span>
              </div>
              <div>
                <div className={`ins-score-status ${scoreLevel(health.score)}`}>
                  {health.status}
                </div>
                <div className="ins-box-hint">
                  Based on {health.factorsUsed} of 4 parts
                </div>
              </div>
            </div>
          )}

          {health.score !== null && !health.monthComplete && (
            <p className="ins-note">
              This month is still in progress, so the score leaves it out of
              the savings and stability parts.
            </p>
          )}

          <ul className="ins-factors">
            {health.factors.map((f) => (
              <li key={f.key}>
                <div className="ins-top-row">
                  <span>{f.label}</span>
                  <span>
                    {f.available ? `${f.points} / ${f.max}` : 'Not included'}
                  </span>
                </div>
                <div className="ins-bar">
                  <div
                    className={`ins-fill ${f.rating || ''}`}
                    style={{
                      width: f.available ? `${(f.points / f.max) * 100}%` : '0%',
                    }}
                  />
                </div>
                <div className="ins-factor-msg">{f.message}</div>
              </li>
            ))}
          </ul>

          {(health.strengths.length > 0 || health.improvements.length > 0) && (
            <div className="ins-two-col">
              {health.strengths.length > 0 && (
                <div className="ins-list-box strengths">
                  <h4>✓ Strengths</h4>
                  <ul>
                    {health.strengths.map((s) => (
                      <li key={s.label}>{s.message}</li>
                    ))}
                  </ul>
                </div>
              )}
              {health.improvements.length > 0 && (
                <div className="ins-list-box improve">
                  <h4>⚠ Needs improvement</h4>
                  <ul>
                    {health.improvements.map((s) => (
                      <li key={s.label}>{s.message}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <p className="ins-footnote">
            Savings rate 30 points · Budget discipline 30 · Expense stability 25
            · Goal progress 15. Parts without data are left out, not counted as
            zero.
          </p>
        </div>
      )}

      {analysis && !hasData && (
        <p className="ins-empty">
          Nothing recorded in {formatMonthName(month)}. Pick another month, or
          add some transactions.
        </p>
      )}

      {analysis && hasData && (
        <>
          <h2>Summary for {formatMonthName(month)}</h2>
          <div className="ins-boxes">
            <div className="ins-box">
              <div className="ins-box-label">Income</div>
              <div className="ins-box-value">{formatMoney(summary.income)}</div>
            </div>
            <div className="ins-box">
              <div className="ins-box-label">Spent</div>
              <div className="ins-box-value">{formatMoney(summary.spent)}</div>
              <div className="ins-box-hint">Needs and lifestyle</div>
            </div>
            <div className="ins-box">
              <div className="ins-box-label">Invested</div>
              <div className="ins-box-value">
                {formatMoney(summary.invested)}
              </div>
              <div className="ins-box-hint">In savings categories</div>
            </div>
            <div className="ins-box">
              <div className="ins-box-label">Saved</div>
              <div
                className={`ins-box-value ${
                  summary.saved < 0 ? 'negative' : ''
                }`}
              >
                {summary.saved < 0 ? '−' : ''}
                {formatMoney(Math.abs(summary.saved))}
              </div>
              <div className="ins-box-hint">
                {summary.savingsRate === null
                  ? 'No income recorded'
                  : `${summary.savingsRate}% of income`}
              </div>
            </div>
          </div>

          {summary.topCategories.length > 0 && (
            <div className="ins-card">
              <h3>Where most of your spending went</h3>
              <ul className="ins-top">
                {summary.topCategories.map((c) => (
                  <li key={c.categoryId}>
                    <div className="ins-top-row">
                      <span>
                        {c.name}
                        <span className={`ins-group ${c.group}`}>
                          {GROUP_LABELS[c.group]}
                        </span>
                      </span>
                      <span>
                        {formatMoney(c.total)} · {c.percentOfSpending}%
                      </span>
                    </div>
                    <div className="ins-bar">
                      <div
                        className="ins-fill"
                        style={{ width: `${c.percentOfSpending}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <h2>Unusual spending</h2>
          {analysis.unusual.length === 0 ? (
            <p className="ins-good">
              Nothing unusual this month. Your spending looks in line with your
              usual habits.
            </p>
          ) : (
            <ul className="ins-alerts">
              {analysis.unusual.map((a) => (
                <li key={a.categoryId}>
                  <div className="ins-alert-title">
                    ⚠️ Unusual spending in {a.name}
                  </div>
                  <div>{a.message}</div>
                  <div className="ins-alert-meta">
                    That is {a.times} times your usual amount, or{' '}
                    {formatMoney(a.extra)} more than normal.
                  </div>
                </li>
              ))}
            </ul>
          )}

          <h2>Compared with {formatMonthName(comparison.previousMonth)}</h2>
          {!comparison.previousHasData ? (
            <p className="ins-empty">
              Nothing was recorded in {formatMonthName(comparison.previousMonth)}
              , so there is nothing to compare with.
            </p>
          ) : (
            <div className="ins-card">
              <div className="ins-compare-head">
                <div>
                  <div className="ins-box-label">Total spending</div>
                  <div className="ins-compare-value">
                    {formatMoney(comparison.spending.current)}
                  </div>
                  <div
                    className={`ins-change ${
                      comparison.spending.change > 0
                        ? 'up'
                        : comparison.spending.change < 0
                        ? 'down'
                        : ''
                    }`}
                  >
                    {formatChange(comparison.spending.change)}{' '}
                    {comparison.spending.changePercent !== null &&
                      `(${formatPercent(comparison.spending.changePercent)})`}{' '}
                    vs {formatMoney(comparison.spending.previous)}
                  </div>
                </div>
                <div>
                  <div className="ins-box-label">Savings rate</div>
                  <div className="ins-compare-value">
                    {comparison.savingsRate.current === null
                      ? '–'
                      : `${comparison.savingsRate.current}%`}
                  </div>
                  <div className="ins-change">
                    {comparison.savingsRate.previous === null
                      ? 'No income last month'
                      : `vs ${comparison.savingsRate.previous}% last month`}
                  </div>
                </div>
              </div>

              <table className="ins-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>This month</th>
                    <th>Last month</th>
                    <th>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.categories.map((c) => (
                    <tr key={c.categoryId}>
                      <td>{c.name}</td>
                      <td>{formatMoney(c.current)}</td>
                      <td>{formatMoney(c.previous)}</td>
                      <td
                        className={`ins-change ${
                          c.change > 0 ? 'up' : c.change < 0 ? 'down' : ''
                        }`}
                      >
                        {formatChange(c.change)}{' '}
                        {c.changePercent !== null &&
                          `(${formatPercent(c.changePercent)})`}
                        {c.previous === 0 && c.current > 0 && ' new'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="ins-footnote">
                Money you put into savings categories (like a SIP) isn't counted
                as spending here.
              </p>
            </div>
          )}
        </>
      )}

      {nextMonth && (
        <>
          <h2>Forecast for {formatMonthName(nextMonth)}</h2>
          {!forecast || forecast.basedOnMonths === 0 ? (
            <p className="ins-empty">
              Not enough history yet. Record spending in the 3 months before{' '}
              {formatMonthName(nextMonth)}, and a forecast will appear here.
            </p>
          ) : (
            <div className="ins-card">
              <p className="ins-sub">
                Based on your last {forecast.basedOnMonths}{' '}
                {forecast.basedOnMonths === 1 ? 'month' : 'months'} of
                spending, with recent months counting more.{' '}
                <span className={`ins-confidence ${forecast.confidence}`}>
                  {CONFIDENCE_LABELS[forecast.confidence]}
                </span>
              </p>
              {forecast.confidence === 'low' && (
                <p className="ins-note">
                  This forecast comes from a single month, so treat it as a
                  rough guess.
                </p>
              )}

              <div className="ins-boxes">
                <div className="ins-box">
                  <div className="ins-box-label">Expected income</div>
                  <div className="ins-box-value">
                    {forecast.income > 0 ? formatMoney(forecast.income) : '–'}
                  </div>
                </div>
                <div className="ins-box">
                  <div className="ins-box-label">Expected spending</div>
                  <div className="ins-box-value">
                    {formatMoney(forecast.spending)}
                  </div>
                  <div className="ins-box-hint">Needs and lifestyle</div>
                </div>
                <div className="ins-box">
                  <div className="ins-box-label">Expected to save</div>
                  <div
                    className={`ins-box-value ${
                      forecast.saved !== null && forecast.saved < 0
                        ? 'negative'
                        : ''
                    }`}
                  >
                    {forecast.saved === null
                      ? '–'
                      : `${forecast.saved < 0 ? '−' : ''}${formatMoney(
                          Math.abs(forecast.saved)
                        )}`}
                  </div>
                  <div className="ins-box-hint">
                    {forecast.savingsRate === null
                      ? 'No income to compare with'
                      : `${forecast.savingsRate}% of income`}
                  </div>
                </div>
              </div>

              <table className="ins-table">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th>Predicted</th>
                    <th>Latest month</th>
                    <th>Trend</th>
                  </tr>
                </thead>
                <tbody>
                  {forecast.categories.map((c) => (
                    <tr key={c.categoryId}>
                      <td>
                        {c.name}
                        <span className={`ins-group ${c.group}`}>
                          {GROUP_LABELS[c.group]}
                        </span>
                      </td>
                      <td>{formatMoney(c.predicted)}</td>
                      <td>{formatMoney(c.latest)}</td>
                      <td
                        className={`ins-change ${
                          c.trend && TRENDS[c.trend] ? TRENDS[c.trend].cls : ''
                        }`}
                      >
                        {c.trend && TRENDS[c.trend] ? TRENDS[c.trend].text : '–'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="ins-footnote">
                A forecast is an estimate, not a promise. One big one-off
                purchase can throw it off. Money going into savings categories
                is counted as saved, not spent.
              </p>
            </div>
          )}
        </>
      )}

      <h2>Recurring expenses</h2>
      {!recurring || recurring.count === 0 ? (
        <p className="ins-empty">
          No recurring expenses found yet. A payment counts as recurring when it
          shows up in at least 3 of the last 6 months, once or twice a month,
          for a steady amount.
        </p>
      ) : (
        <div className="ins-card">
          <p className="ins-sub">
            {recurring.count}{' '}
            {recurring.count === 1 ? 'payment repeats' : 'payments repeat'}{' '}
            every month, about {formatMoney(recurring.monthlyTotal)} a month in
            total.
          </p>
          <ul className="ins-recurring">
            {recurring.recurring.map((r) => (
              <li key={`${r.categoryName}-${r.label}`}>
                <div>
                  <div className="ins-recurring-name">{r.label}</div>
                  <div className="ins-recurring-meta">
                    {r.categoryName}
                    <span className={`ins-group ${r.group}`}>
                      {GROUP_LABELS[r.group]}
                    </span>
                    · seen in {r.months} of the last 6 months
                  </div>
                </div>
                <div className="ins-recurring-right">
                  <div className="ins-recurring-amount">
                    {formatMoney(r.typical)}
                  </div>
                  <div className="ins-recurring-meta">
                    Next due {formatDay(r.nextDue)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}