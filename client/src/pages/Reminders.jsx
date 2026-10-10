import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import DueBadge from '../components/DueBadge.jsx';
import { formatMoney, formatDate } from '../services/format.js';

const cardClass = { overdue: 'overdue', due_today: 'today', upcoming: 'upcoming' };

// Opens WhatsApp with a ready message (works on phone and WhatsApp Web)
function whatsappLink(r, shopName) {
  const text =
    `Hello ${r.customer_name}, this is a reminder from ${shopName}. ` +
    `${formatMoney(r.remaining_amount)} is due on ${formatDate(r.due_date)}. ` +
    `Please pay at your earliest convenience. Thank you.`;
  return `https://wa.me/91${r.customer_phone}?text=${encodeURIComponent(text)}`;
}

export default function Reminders() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [params] = useSearchParams();
  const [reminders, setReminders] = useState([]);
  const [filter, setFilter] = useState(params.get('filter') === 'today' ? 'today' : 'all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .getReminders()
      .then(setReminders)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner text="Loading reminders..." />;

  const visible =
    filter === 'today' ? reminders.filter((r) => r.status === 'overdue' || r.status === 'due_today') : reminders;

  // Customer-wise totals
  const byCustomer = Object.values(
    visible.reduce((acc, r) => {
      const c = acc[r.customer_id] || { id: r.customer_id, name: r.customer_name, total: 0, count: 0 };
      c.total += r.remaining_amount;
      c.count += 1;
      acc[r.customer_id] = c;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('reminders')}</h1>
          <p className="page-sub">Unpaid credit with a due date, nearest due date first.</p>
        </div>
        <div className="page-actions">
          <button
            className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('all')}
          >
            {t('allReminders')}
          </button>
          <button
            className={`btn btn-sm ${filter === 'today' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setFilter('today')}
          >
            {t('collectToday')}
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {!error && visible.length === 0 ? (
        <div className="card empty-state">
          <div className="empty-icon">🎉</div>
          <h3>No pending reminders</h3>
          <p>Credit entries with a due date will appear here until they are paid.</p>
        </div>
      ) : (
        <>
          {byCustomer.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h2 className="card-title" style={{ marginBottom: 8 }}>{t('byCustomer')}</h2>
              {byCustomer.map((c) => (
                <div className="mini-reminder flex-between" key={c.id}>
                  <Link to={`/customers/${c.id}`}><strong>{c.name}</strong></Link>
                  <span>
                    <span className="muted">{c.count} entr{c.count === 1 ? 'y' : 'ies'} · </span>
                    <span className="amount-due">{formatMoney(c.total)}</span>
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="reminder-list">
            {visible.map((r) => (
              <div key={r.transaction_id} className={`reminder-card ${cardClass[r.status]}`}>
                <div className="reminder-top">
                  <div>
                    <strong>{r.customer_name}</strong>
                    <div className="muted">📞 {r.customer_phone}</div>
                  </div>
                  <DueBadge status={r.status} days={r.days} />
                </div>

                <div className="reminder-meta">
                  <div><span>Original credit</span>{formatMoney(r.original_amount)}</div>
                  <div><span>{t('remainingUnpaid')}</span><strong className="amount-due">{formatMoney(r.remaining_amount)}</strong></div>
                  <div><span>Due date</span>{formatDate(r.due_date)}</div>
                  <div><span>Note</span>{r.note || '-'}</div>
                </div>

                <div className="reminder-footer">
                  <span className="muted">Given on {formatDate(r.entry_date)}</span>
                  <div className="row-actions">
                    <a
                      className="btn btn-primary btn-sm"
                      href={whatsappLink(r, user.shop_name)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {t('sendReminder')}
                    </a>
                    <Link className="btn btn-secondary btn-sm" to={`/customers/${r.customer_id}`}>{t('openLedger')}</Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}