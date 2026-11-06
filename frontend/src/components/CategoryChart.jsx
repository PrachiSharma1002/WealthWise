import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';

const COLORS = [
  '#2563eb',
  '#f59e0b',
  '#16a34a',
  '#dc2626',
  '#8b5cf6',
  '#0891b2',
  '#9ca3af',
];

// This many categories get their own slice. The rest are grouped together.
const MAX_SLICES = 6;

const formatMoney = (value) => '₹' + Number(value).toLocaleString('en-IN');

// What shows when you hover over a slice
function CategoryTooltip({ active, payload, total }) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0].payload;

  return (
    <div className="chart-tooltip">
      <div className="chart-tooltip-title">{slice.name}</div>
      <div>{formatMoney(slice.value)}</div>
      <div>{Math.round((slice.value / total) * 100)}% of your spending</div>
    </div>
  );
}

// A donut chart of where the month's spending went
export default function CategoryChart({ categories }) {
  const total = categories.reduce((sum, c) => sum + c.total, 0);
  if (total <= 0) return null;

  const top = categories.slice(0, MAX_SLICES);
  const rest = categories.slice(MAX_SLICES);

  const data = top.map((c) => ({ name: c.name, value: c.total }));
  if (rest.length > 0) {
    data.push({
      name: `${rest.length} other ${rest.length === 1 ? 'category' : 'categories'}`,
      value: Math.round(rest.reduce((sum, c) => sum + c.total, 0) * 100) / 100,
    });
  }

  return (
    <div>
      <div className="chart-total">Total spent: {formatMoney(total)}</div>
      <div className="chart-donut-wrap">
        <div
          className="chart-box"
          style={{ height: 220, flex: '1 1 220px', minWidth: 200 }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
              >
                {data.map((d, i) => (
                  <Cell key={`cell-${i}`} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip content={<CategoryTooltip total={total} />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <ul className="chart-legend">
          {data.map((d, i) => (
            <li key={`legend-${i}`}>
              <span className="chart-legend-name">
                <span
                  className="chart-dot"
                  style={{ background: COLORS[i % COLORS.length] }}
                />
                {d.name}
              </span>
              <span className="chart-legend-amount">
                {formatMoney(d.value)} · {Math.round((d.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}