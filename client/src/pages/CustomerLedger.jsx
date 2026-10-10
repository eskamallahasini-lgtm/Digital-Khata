import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import Spinner from '../components/Spinner.jsx';
import Toast, { useToast } from '../components/Toast.jsx';
import TransactionModal from '../components/TransactionModal.jsx';
import EditCustomerModal from '../components/EditCustomerModal.jsx';
import RiskBadge from '../components/RiskBadge.jsx';
import { formatMoney, formatDate, balanceClass, balanceLabel, todayISO } from '../services/format.js';

const UNDO_SECONDS = 6;

export default function CustomerLedger() {
  const { id } = useParams();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showTx, setShowTx] = useState(false);
  const [editTx, setEditTx] = useState(null);
  const [showEditCustomer, setShowEditCustomer] = useState(false);
  const [hiddenIds, setHiddenIds] = useState([]); // rows waiting for the undo window to end
  const [undoTx, setUndoTx] = useState(null);
  const [toast, showToast] = useToast();
  const timerRef = useRef(null);
  const pendingRef = useRef(null);

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

  // ----- Delete with Undo: the row is hidden first and deleted for real after 6 seconds -----
  const commitDelete = async (tx) => {
    try {
      await api.deleteTransaction(tx.id);
    } catch (err) {
      showToast(err.message, 'error');
    }
    await load();
    setHiddenIds((h) => h.filter((x) => x !== tx.id));
  };

  const startDelete = (tx) => {
    // If another delete is still waiting, finish it now
    if (pendingRef.current) {
      clearTimeout(timerRef.current);
      commitDelete(pendingRef.current);
    }
    pendingRef.current = tx;
    setHiddenIds((h) => [...h, tx.id]);
    setUndoTx(tx);
    timerRef.current = setTimeout(() => {
      const waiting = pendingRef.current;
      pendingRef.current = null;
      setUndoTx(null);
      if (waiting) commitDelete(waiting);
    }, UNDO_SECONDS * 1000);
  };

  const undoDelete = () => {
    clearTimeout(timerRef.current);
    const waiting = pendingRef.current;
    pendingRef.current = null;
    setUndoTx(null);
    if (waiting) setHiddenIds((h) => h.filter((x) => x !== waiting.id));
  };

  // If the user leaves the page during the undo window, finish the delete
  useEffect(
    () => () => {
      clearTimeout(timerRef.current);
      if (pendingRef.current) api.deleteTransaction(pendingRef.current.id).catch(() => {});
    },
    []
  );

  if (loading) return <Spinner text="Loading ledger..." />;

  if (error || !data) {
    return (
      <>
        <Link to="/customers" className="back-link">← Back to customers</Link>
        <div className="alert alert-error">{error || 'Could not load this ledger.'}</div>
      </>
    );
  }

  const { customer } = data;
  const transactions = data.transactions.filter((tx) => !hiddenIds.includes(tx.id));

  return (
    <>
      <Toast toast={toast} />
      <Link to="/customers" className="back-link">← Back to customers</Link>

      {/* Only visible when printing / saving as PDF */}
      <div className="print-only print-header">
        <h2>{user.shop_name}</h2>
        <p>Statement for {customer.name} ({customer.phone}) - printed on {formatDate(todayISO())}</p>
      </div>

      <div className="page-header">
        <div>
          <h1 className="page-title">{customer.name}</h1>
          <p className="page-sub">
            📞 {customer.phone} <RiskBadge risk={data.risk} />
          </p>
        </div>
        <div className="page-actions">
          <button className="btn btn-secondary" onClick={() => setShowEditCustomer(true)}>{t('edit')}</button>
          <button className="btn btn-secondary" onClick={() => window.print()}>{t('downloadStatement')}</button>
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
          <div className="stat-label">Total credit ({t('youGave')})</div>
          <div className="stat-value">{formatMoney(data.total_credit)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total payments ({t('youGot')})</div>
          <div className="stat-value">{formatMoney(data.total_payments)}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Transaction history</h2>
          <span className="muted no-print">Newest first</span>
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
                  <th className="num no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td>{formatDate(tx.entry_date)}</td>
                    <td className="tx-note">{tx.note || '-'}</td>
                    <td>
                      {tx.type === 'credit' ? (
                        <span className="badge badge-red">{t('youGave')}</span>
                      ) : (
                        <span className="badge badge-green">{t('youGot')}</span>
                      )}
                    </td>
                    <td>
                      {tx.type === 'credit' ? (
                        <>
                          {tx.due_date ? formatDate(tx.due_date) : 'No due date'}
                          <br />
                          <small className="muted">
                            {tx.remaining > 0 ? `${formatMoney(tx.remaining)} unpaid` : 'Fully paid'}
                          </small>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={`num ${tx.type === 'credit' ? 'tx-gave' : 'tx-got'}`}>{formatMoney(tx.amount)}</td>
                    <td className={`num ${balanceClass(tx.running_balance)}`}>{formatMoney(tx.running_balance)}</td>
                    <td className="num no-print">
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditTx(tx)}>{t('edit')}</button>{' '}
                      <button className="btn btn-ghost btn-sm" onClick={() => startDelete(tx)}>{t('delete')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {undoTx && (
        <div className="undo-bar no-print" role="status">
          <span>
            {t('youGave') && (undoTx.type === 'credit' ? t('youGave') : t('youGot'))} entry of{' '}
            {formatMoney(undoTx.amount)} deleted.
          </span>
          <button className="btn btn-sm btn-secondary" onClick={undoDelete}>{t('undo')}</button>
        </div>
      )}

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

      {editTx && (
        <TransactionModal
          customer={customer}
          transaction={editTx}
          onClose={() => setEditTx(null)}
          onSaved={() => {
            setEditTx(null);
            showToast('Entry updated.');
            load();
          }}
        />
      )}

      {showEditCustomer && (
        <EditCustomerModal
          customer={customer}
          onClose={() => setShowEditCustomer(false)}
          onSaved={() => {
            setShowEditCustomer(false);
            showToast('Customer updated.');
            load();
          }}
        />
      )}
    </>
  );
}