// Small coloured label for a reminder: overdue (red), due today (amber), upcoming (blue)
export default function DueBadge({ status, days }) {
  const plural = days === 1 ? 'day' : 'days';
  if (status === 'overdue') return <span className="badge badge-red">{days} {plural} overdue</span>;
  if (status === 'due_today') return <span className="badge badge-amber">Due today</span>;
  return <span className="badge badge-blue">{days} {plural} left</span>;
}