import { useEffect, useState } from 'react';
import api from '../services/api.js';
import Spinner from '../components/Spinner.jsx';
import Toast, { useToast } from '../components/Toast.jsx';
import CustomerRow from '../components/CustomerRow.jsx';
import AddCustomerModal from '../components/AddCustomerModal.jsx';
import TransactionModal from '../components/TransactionModal.jsx';

export default function Customers() {
  const [customers, setCustomers] = useState([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [txModal, setTxModal] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, showToast] = useToast();

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const data = await api.getCustomers(q.trim());
        if (!cancelled) {
          setCustomers(data);
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

  if (loading) return <Spinner text="Loading customers..." />;

  return (
    <>
      <Toast toast={toast} />

      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-sub">Everyone who buys on credit from your shop.</p>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>+ Add Customer</button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
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
                <p>Add your first customer to start your digital khata.</p>
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