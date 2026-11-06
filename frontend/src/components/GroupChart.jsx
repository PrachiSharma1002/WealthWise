import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

const LABELS = { needs: 'Needs', lifestyle: 'Lifestyle', savings: 'Savings' };
const COLORS = { needs: '#2563eb', lifestyle: '#f59e0b', savings: '#16a34a' };

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

// Short money for the chart's side axis, like ₹30K
const formatShort = (value) =>
  value >= 1000 ? `₹${Math.round(value / 100) / 10}K`.replace('.0K', 'K') : `₹${value}`;

// What shows when you hover over a group
function GroupTooltip({ active, payload }) {
  if (!active || !payload || payload.length === 0) return null;
  const g = payload[0].payload;
  const isTarget = g.kind === 'target';

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{g.label}</div>
      {g.plan > 0 && (
        <div>
          Your plan: {g.percent}% of income = {formatMoney(g.plan)}
        </div>
      )}
      <div>
        {isTarget ? 'Saved' : 'Spent'}: {formatMoney(g.actual)}
      </div>
      {g.percentUsed !== null && (
        <div>
          {g.percentUsed}% of your plan {isTarget ? 'reached' : 'used'}
        </div>
      )}
    </div>
  );
}

// Your plan (grey) next to what really happened (coloured), for each group
export default function GroupChart({ groups }) {
  const data = groups.map((g) => ({
    key: g.group,
    label: LABELS[g.group],
    kind: g.kind,
    percent: g.percent,
    plan: g.allowance,
    actual: g.spent,
    percentUsed: g.percentUsed,
  }));

  // With no income there is no plan to compare with
  const hasPlan = data.some((d) => d.plan > 0);

  return (
    <div>
      <div className="chart-box" style={{ height: 260 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" />
            <YAxis tickFormatter={formatShort} width={56} />
            <Tooltip content={<GroupTooltip />} cursor={{ fill: '#f3f4f6' }} />
            {hasPlan && (
              <Bar
                dataKey="plan"
                name="Plan"
                fill="#d1d5db"
                radius={[4, 4, 0, 0]}
              />
            )}
            <Bar dataKey="actual" name="Actual" radius={[4, 4, 0, 0]}>
              {data.map((d) => (
                <Cell key={d.key} fill={COLORS[d.key]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="chart-caption">
        {hasPlan
          ? 'Grey bar = your plan. Coloured bar = what actually happened.'
          : 'No plan to compare with yet. Record some income to see one.'}
      </p>
    </div>
  );
}