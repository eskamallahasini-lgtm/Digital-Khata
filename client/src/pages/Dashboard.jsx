
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Toast, { useToast } from '../components/Toast.jsx';
import CustomerRow from '../components/CustomerRow.jsx';
import DueBadge from '../components/DueBadge.jsx';
import AddCustomerModal from '../components/AddCustomerModal.jsx';
import TransactionModal from '../components/TransactionModal.jsx';
import { formatMoney, formatDate } from '../services/format.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import MonthlyChart from '../components/MonthlyChart.jsx';


export default function Dashboard() {
  const { t } = useLanguage();
  const { user } = useAuth();
  const [summary, setSummary] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [txModal, setTxModal] = useState(null); // { customer, type }
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, showToast] = useToast();
  const [monthly, setMonthly] = useState([]);

  // Load summary + customers. Typing in search waits 300 ms before asking the server.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const [s, c, m] = await Promise.all([
          api.getSummary(),
          api.getCustomers(q.trim()),
          api.getMonthly(),
        ]);
        if (!cancelled) {
          setSummary(s);
          setCustomers(c);
          setMonthly(m);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, q ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, refreshKey]);

  const refresh = () => setRefreshKey((k) => k + 1);

  const openRecordEntry = () => {
    if (summary && summary.total_customers === 0) {
      showToast('Please add a customer first.', 'error');
      return;
    }
    setTxModal({ customer: null, type: 'credit' });
  };

  if (loading) return <Spinner text="Loading your dashboard..." />;

  return (
    <>
      <Toast toast={toast} />

           <div className="page-header">
        <div>
          <h1 className="page-title">{t('welcome')}, {user.shop_name}</h1>
          <p className="page-sub">{t('dashSub')}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={openRecordEntry}>{t('recordEntry')}</button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>{t('addCustomer')}</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {summary && (
        <div className="stats-grid">
          <div className="stat-card stat-primary">
            <div className="stat-label">Total outstanding</div>
            <div className="stat-value">{formatMoney(summary.total_outstanding)}</div>
            <div className="stat-hint">
              To collect from {summary.customers_with_balance} customer{summary.customers_with_balance === 1 ? '' : 's'}
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Customers</div>
            <div className="stat-value">{summary.total_customers}</div>
            <div className="stat-hint">Total registered</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overdue</div>
            <div className="stat-value amount-due">{summary.overdue_count}</div>
            <div className="stat-hint">{summary.upcoming_count} upcoming</div>
          </div>
        </div>
      )}
            {summary && summary.collect_today_count > 0 && (
        <div className="card" style={{ marginBottom: 20, borderLeft: '5px solid var(--amber)' }}>
          <div className="flex-between">
            <div>
              <h2 className="card-title">{t('collectToday')}</h2>
              <p className="muted">{summary.collect_today_count} {t('collectTodayHint')}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="amount-due" style={{ fontSize: 22 }}>{formatMoney(summary.collect_today_amount)}</div>
              <Link to="/reminders?filter=today" className="btn btn-primary btn-sm" style={{ marginTop: 6 }}>
                {t('viewAll')}
              </Link>
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: 20 }}>
        <h2 className="card-title" style={{ marginBottom: 12 }}>{t('monthlyTitle')}</h2>
        <MonthlyChart data={monthly} />
      </div>

      <div className="dash-grid">
        <section className="card" aria-label="Customers">
          <div className="card-header">
            <h2 className="card-title">Customers</h2>
          </div>
          <div className="toolbar">
            <input
              className="input search-box"
              type="search"
              placeholder="Search by name or phone"
              aria-label="Search customers"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>

          {customers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👥</div>
              {q ? (
                <>
                  <h3>No matching customers</h3>
                  <p>Try a different name or phone number.</p>
                </>
              ) : (
                <>
                  <h3>No customers yet</h3>
                  <p>Add your first customer to start recording credit.</p>
                  <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>
                </>
              )}
            </div>
          ) : (
            <ul className="customer-list">
              {customers.map((c) => (
                <CustomerRow key={c.id} customer={c} onEntry={(cust, type) => setTxModal({ customer: cust, type })} />
              ))}
            </ul>
          )}
        </section>

        <section className="card" aria-label="Reminders">
          <div className="card-header">
            <h2 className="card-title">Reminders</h2>
            <Link to="/reminders" className="btn btn-secondary btn-sm">View all</Link>
          </div>
          {summary && summary.reminders_preview.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">✅</div>
              <h3>All clear</h3>
              <p>No pending due dates.</p>
            </div>
          ) : (
            summary &&
            summary.reminders_preview.map((r) => (
              <div className="mini-reminder" key={r.transaction_id}>
                <div className="flex-between">
                  <Link to={`/customers/${r.customer_id}`}><strong>{r.customer_name}</strong></Link>
                  <span className="amount-due">{formatMoney(r.remaining_amount)}</span>
                </div>
                <div className="flex-between">
                  <span className="muted">Due {formatDate(r.due_date)}</span>
                  <DueBadge status={r.status} days={r.days} />
                </div>
              </div>
            ))
          )}
        </section>
      </div>

      {showAdd && (
        <AddCustomerModal
          onClose={() => setShowAdd(false)}
          onAdded={() => {
            setShowAdd(false);
            showToast('Customer added successfully.');
            refresh();
          }}
        />
      )}

      {txModal && (
        <TransactionModal
          customer={txModal.customer}
          defaultType={txModal.type}
          onClose={() => setTxModal(null)}
          onSaved={(type) => {
            setTxModal(null);
            showToast(type === 'credit' ? 'Credit entry saved.' : 'Payment saved.');
            refresh();
          }}
        />
      )}
    </>
  );
}