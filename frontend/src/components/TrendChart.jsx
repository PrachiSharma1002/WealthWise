import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

// Short money for the chart's side axis, like ₹30K
const formatShort = (value) =>
  value >= 1000 ? `₹${Math.round(value / 100) / 10}K`.replace('.0K', 'K') : `₹${value}`;

const monthLabel = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    timeZone: 'UTC',
  });

const monthFull = (month) =>
  new Date(`${month}-01T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });

// What shows when you hover over a month
function TrendTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const m = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{monthFull(m.month)}</div>
      {!m.hasData ? (
        <div>Nothing recorded</div>
      ) : (
        <>
          <div>Income: {formatMoney(m.income)}</div>
          <div>Spent: {formatMoney(m.spent)}</div>
          {m.invested > 0 && <div>Invested: {formatMoney(m.invested)}</div>}
          <div>
            Saved: {m.saved < 0 ? '−' : ''}
            {formatMoney(Math.abs(m.saved))}
          </div>
          <div>
            Savings rate: {m.savingsRate === null ? '–' : `${m.savingsRate}%`}
          </div>
        </>
      )}
    </div>
  );
}

// Income and spending bars for each month, with a savings rate line below
export default function TrendChart({ months }) {
  // A month with nothing recorded gets no bars, so it shows as a gap
  const data = months.map((m) => ({
    ...m,
    income: m.hasData ? m.income : null,
    spent: m.hasData ? m.spent : null,
    label: monthLabel(m.month),
  }));

  // The savings rate only exists for months that had income
  const rateData = data.map((m) => ({
    ...m,
    rate: m.savingsRate,
  }));
  const hasRates = rateData.some((m) => m.rate !== null);

  return (
    <div>
      <div className="chart-box" style={{ height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={formatShort} width={56} />
            <Tooltip content={<TrendTooltip />} cursor={{ fill: '#f3f4f6' }} />
            <Legend />
            <Bar dataKey="income" name="Income" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="spent" name="Spent" fill="#dc2626" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {hasRates && (
        <>
          <div className="chart-subtitle">Savings rate (% of income)</div>
          <div className="chart-box" style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={rateData}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" />
                <YAxis tickFormatter={(v) => `${v}%`} width={56} />
                <Tooltip content={<TrendTooltip />} />
                <Line
                  type="monotone"
                  dataKey="rate"
                  name="Savings rate"
                  stroke="#2563eb"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  connectNulls={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}