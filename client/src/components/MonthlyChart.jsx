import { formatMoney } from '../services/format.js';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Simple bar chart drawn with CSS (no extra library). data = [{ month: '2026-10', credit, payment }]
export default function MonthlyChart({ data }) {
  if (!data || data.length === 0) {
    return <p className="muted">No entries yet. The chart appears after you record some.</p>;
  }
  const max = Math.max(1, ...data.flatMap((d) => [d.credit, d.payment]));

  return (
    <>
      <div className="chart" role="img" aria-label="Monthly credit given and payments received">
        {data.map((d) => (
          <div className="chart-col" key={d.month}>
            <div className="chart-bars">
              <div
                className="chart-bar gave"
                style={{ height: `${(d.credit / max) * 100}%` }}
                title={`Gave ${formatMoney(d.credit)}`}
              />
              <div
                className="chart-bar got"
                style={{ height: `${(d.payment / max) * 100}%` }}
                title={`Got ${formatMoney(d.payment)}`}
              />
            </div>
            <div className="chart-label">{MONTHS[Number(d.month.slice(5, 7)) - 1]}</div>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span><i className="dot gave" /> You Gave</span>
        <span><i className="dot got" /> You Got</span>
      </div>
    </>
  );
}