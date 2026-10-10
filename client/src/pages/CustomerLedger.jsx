import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api.js';
import Spinner from '../components/Spinner.jsx';
import Toast, { useToast } from '../components/Toast.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import ReverseDialog from '../components/ReverseDialog.jsx';
import TransactionModal from '../components/TransactionModal.jsx';
import { formatMoney, formatDate, balanceClass, balanceLabel } from '../services/format.js';

export default function CustomerLedger() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTx, setShowTx] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [reverseTarget, setReverseTarget] = useState(null);
  const [reversing, setReversing] = useState(false);
  const [toast, showToast] = useToast();

  const load = useCallback(async () => {
    try {
      const result = await api.getLedger(id);
      setData(result);
      setError('');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await api.deleteTransaction(deleteTarget.id);
      setDeleteTarget(null);
      showToast('Transaction deleted.');
      await load();
    } catch (err) {
      setDeleteTarget(null);
      showToast(err.message, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const confirmReverse = async (reason) => {
    setReversing(true);
    try {
      await api.reverseTransaction(reverseTarget.id, reason);
      setReverseTarget(null);
      showToast('Transaction reversed.');
      await load();
    } catch (err) {
      setReverseTarget(null);
      showToast(err.message, 'error');
    } finally {
      setReversing(false);
    }
  };

  if (loading) return <Spinner text="Loading ledger..." />;

  if (error || !data) {
    return (
      <>
        <Link to="/customers" className="back-link">← Back to customers</Link>
        <div className="alert alert-error">{error || 'Could not load this ledger.'}</div>
      </>
    );
  }

  const { customer, transactions } = data;

  return (
    <>
      <Toast toast={toast} />
      <Link to="/customers" className="back-link">← Back to customers</Link>

      <div className="page-header">
        <div>
          <h1 className="page-title">{customer.name}</h1>
          <p className="page-sub">📞 {customer.phone}</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowTx(true)}>+ Add Entry</button>
        </div>
      </div>

      <div className="summary-grid">
        <div className="stat-card">
          <div className="stat-label">Current balance</div>
          <div className={`stat-value ${balanceClass(data.balance)}`}>{formatMoney(data.balance)}</div>
          <div className="stat-hint">{balanceLabel(data.balance)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total credit (You Gave)</div>
          <div className="stat-value">{formatMoney(data.total_credit)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total payments (You Got)</div>
          <div className="stat-value">{formatMoney(data.total_payments)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Transaction history</h2>
          <span className="muted">Newest first</span>
        </div>

        {transactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📒</div>
            <h3>No entries yet</h3>
            <p>Record the first credit or payment for this customer.</p>
            <button className="btn btn-primary" onClick={() => setShowTx(true)}>+ Add Entry</button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Note</th>
                  <th>Type</th>
                  <th>Due date</th>
                  <th className="num">Amount</th>
                  <th className="num">Balance</th>
                  <th className="num">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const isActive = t.status === 'active';
                  return (
                    <tr
                      key={t.id}
                      className={t.status === 'reversed' ? 'row-reversed' : t.status === 'reversal' ? 'row-reversal' : ''}
                    >
                      <td>{formatDate(t.entry_date)}</td>
                      <td className="tx-note">
                        {t.note || '-'}
                        {t.status === 'reversed' && <><br /><span className="badge badge-gray">Reversed</span></>}
                        {t.status === 'reversal' && <><br /><span className="badge badge-amber">Reversal</span></>}
                        {t.reversal_reason && (
                          <>
                            <br />
                            <small className="muted">Reason: {t.reversal_reason}</small>
                          </>
                        )}
                      </td>
                      <td>
                        {t.type === 'credit' ? (
                          <span className="badge badge-red">You Gave</span>
                        ) : (
                          <span className="badge badge-green">You Got</span>
                        )}
                      </td>
                      <td>
                        {isActive && t.type === 'credit' ? (
                          <>
                            {t.due_date ? formatDate(t.due_date) : 'No due date'}
                            <br />
                            <small className="muted">
                              {t.remaining > 0 ? `${formatMoney(t.remaining)} unpaid` : 'Fully paid'}
                            </small>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className={`num ${t.type === 'credit' ? 'tx-gave' : 'tx-got'}`}>{formatMoney(t.amount)}</td>
                      <td className={`num ${t.running_balance === null ? '' : balanceClass(t.running_balance)}`}>
                        {t.running_balance === null ? '-' : formatMoney(t.running_balance)}
                      </td>
                      <td className="num">
                        {isActive && (
                          <>
                            <button className="btn btn-secondary btn-sm" onClick={() => setReverseTarget(t)}>Reverse</button>{' '}
                            <button className="btn btn-ghost btn-sm" onClick={() => setDeleteTarget(t)}>Delete</button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showTx && (
        <TransactionModal
          customer={customer}
          defaultType="credit"
          onClose={() => setShowTx(false)}
          onSaved={(type) => {
            setShowTx(false);
            showToast(type === 'credit' ? 'Credit entry saved.' : 'Payment saved.');
            load();
          }}
        />
      )}

      {reverseTarget && (
        <ReverseDialog
          transaction={{ ...reverseTarget, customer_name: customer.name }}
          loading={reversing}
          onConfirm={confirmReverse}
          onCancel={() => setReverseTarget(null)}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete transaction?"
          message={`This will permanently delete the ${
            deleteTarget.type === 'credit' ? 'You Gave' : 'You Got'
          } entry of ${formatMoney(deleteTarget.amount)} dated ${formatDate(deleteTarget.entry_date)}. To keep a record of the mistake, use Reverse instead.`}
          loading={deleting}
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </>
  );
}