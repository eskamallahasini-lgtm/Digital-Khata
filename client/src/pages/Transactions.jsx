import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api.js';
import Spinner from '../components/Spinner.jsx';
import Toast, { useToast } from '../components/Toast.jsx';
import ReverseDialog from '../components/ReverseDialog.jsx';
import { formatMoney, formatDate } from '../services/format.js';

export default function Transactions() {
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ q: '', type: '', status: '', from: '', to: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [target, setTarget] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, showToast] = useToast();

  const setFilter = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api.getTransactions({ ...filters, q: filters.q.trim() });
        if (!cancelled) {
          setRows(data);
          setError('');
        }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, filters.q ? 300 : 0);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filters, refreshKey]);

  const doReverse = async (reason) => {
    setReversing(true);
    try {
      await api.reverseTransaction(target.id, reason);
      setTarget(null);
      showToast('Transaction reversed.');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setTarget(null);
      showToast(err.message, 'error');
    } finally {
      setReversing(false);
    }
  };

  if (loading) return <Spinner text="Loading transactions..." />;

  const active = rows.filter((r) => r.status === 'active');
  const gave = active.filter((r) => r.type === 'credit').reduce((s, r) => s + r.amount, 0);
  const got = active.filter((r) => r.type === 'payment').reduce((s, r) => s + r.amount, 0);

  return (
    <>
      <Toast toast={toast} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Transactions</h1>
          <p className="page-sub">Every credit and payment across all your customers.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="filters">
          <input
            className="input"
            type="search"
            placeholder="Search name, phone or note"
            aria-label="Search transactions"
            value={filters.q}
            onChange={setFilter('q')}
          />
          <select className="input" value={filters.type} onChange={setFilter('type')} aria-label="Type">
            <option value="">All types</option>
            <option value="credit">You Gave</option>
            <option value="payment">You Got</option>
          </select>
          <select className="input" value={filters.status} onChange={setFilter('status')} aria-label="Status">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="reversed">Reversed</option>
          </select>
          <input className="input" type="date" value={filters.from} onChange={setFilter('from')} aria-label="From date" />
          <input className="input" type="date" value={filters.to} onChange={setFilter('to')} aria-label="To date" />
        </div>

        {rows.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🧾</div>
            <h3>No transactions found</h3>
            <p>Try changing the filters, or record an entry from a customer's ledger.</p>
          </div>
        ) : (
          <>
            <p className="muted" style={{ marginBottom: 10 }}>
              Showing {rows.length} entries. Active: <span className="tx-gave">{formatMoney(gave)} given</span> ·{' '}
              <span className="tx-got">{formatMoney(got)} received</span>
            </p>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Type</th>
                    <th>Note</th>
                    <th className="num">Amount</th>
                    <th>Status</th>
                    <th className="num">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t) => (
                    <tr
                      key={t.id}
                      className={t.status === 'reversed' ? 'row-reversed' : t.status === 'reversal' ? 'row-reversal' : ''}
                    >
                      <td>{formatDate(t.entry_date)}</td>
                      <td>
                        <Link to={`/customers/${t.customer_id}`}>{t.customer_name}</Link>
                        <br />
                        <small className="muted">{t.customer_phone}</small>
                      </td>
                      <td>
                        {t.type === 'credit' ? (
                          <span className="badge badge-red">You Gave</span>
                        ) : (
                          <span className="badge badge-green">You Got</span>
                        )}
                      </td>
                      <td className="tx-note">
                        {t.note || '-'}
                        {t.reversal_reason && (
                          <>
                            <br />
                            <small className="muted">Reason: {t.reversal_reason}</small>
                          </>
                        )}
                      </td>
                      <td className={`num ${t.type === 'credit' ? 'tx-gave' : 'tx-got'}`}>{formatMoney(t.amount)}</td>
                      <td>
                        {t.status === 'active' && <span className="badge badge-blue">Active</span>}
                        {t.status === 'reversed' && <span className="badge badge-gray">Reversed</span>}
                        {t.status === 'reversal' && <span className="badge badge-amber">Reversal</span>}
                      </td>
                      <td className="num">
                        {t.status === 'active' && (
                          <button className="btn btn-ghost btn-sm" onClick={() => setTarget(t)}>Reverse</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {target && (
        <ReverseDialog
          transaction={target}
          loading={reversing}
          onConfirm={doReverse}
          onCancel={() => setTarget(null)}
        />
      )}
    </>
  );
}