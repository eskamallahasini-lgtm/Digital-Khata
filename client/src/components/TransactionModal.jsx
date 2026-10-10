import { useEffect, useState } from 'react';
import api from '../services/api.js';
import { todayISO } from '../services/format.js';

// Props:
//   customer    - fixed customer {id, name}. If null, a customer dropdown is shown.
//   defaultType - 'credit' (You Gave) or 'payment' (You Got)
//   onClose()   - close without saving
//   onSaved(type) - called after a successful save
 export default function TransactionModal({ customer, transaction = null, defaultType = 'credit', onClose, onSaved }) {
  const [options, setOptions] = useState([]);
  const [customerId, setCustomerId] = useState(customer ? String(customer.id) : '');
    const [type, setType] = useState(transaction ? transaction.type : defaultType);
  const [amount, setAmount] = useState(transaction ? String(transaction.amount) : '');
  const [note, setNote] = useState(transaction ? transaction.note || '' : '');
  const [entryDate, setEntryDate] = useState(transaction ? transaction.entry_date : todayISO());
  const [dueDate, setDueDate] = useState(transaction ? transaction.due_date || '' : '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // When no fixed customer is given, load all customers for the dropdown
  useEffect(() => {
    if (customer) return;
    api.getCustomers('').then(setOptions).catch((err) => setError(err.message));
  }, [customer]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!customerId) return setError('Please choose a customer.');
    const amt = Number(amount);
    if (!amount || !Number.isFinite(amt) || amt <= 0) return setError('Enter an amount greater than zero.');
    if (!entryDate) return setError('Please choose the entry date.');
    if (type === 'credit' && dueDate && dueDate < entryDate) {
      return setError('Due date cannot be before the entry date.');
    }

    setSaving(true);
    try {
  const payload = {
    type,
    amount: amt,
    note: note.trim(),
    entry_date: entryDate,
    due_date: type === 'credit' && dueDate ? dueDate : null,
  };

  if (transaction) {
    await api.updateTransaction(transaction.id, payload);
  } else {
    await api.addTransaction(customerId, payload);
  }

  onSaved?.();
  onClose();
} catch (err) {
  setError(err.message || 'Something went wrong.');
} finally {
  setSaving(false);
}
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Add entry">
      <div className="modal">
        <div className="modal-header">
        <h2>{transaction ? 'Edit Entry' : 'Add Entry'}{customer ? ` - ${customer.name}` : ''}</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}

            {!customer && (
              <div className="form-group">
                <label htmlFor="tx-customer">Customer</label>
                <select
                  id="tx-customer"
                  className="input"
                  value={customerId}
                  onChange={(e) => setCustomerId(e.target.value)}
                >
                  <option value="">Select a customer</option>
                  {options.map((c) => (
                    <option key={c.id} value={c.id}>{c.name} ({c.phone})</option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Transaction type</label>
              <div className="segmented">
                <button
                  type="button"
                  disabled={!transaction}
                  className={`seg-btn gave ${type === 'credit' ? 'active' : ''}`}
                  onClick={() => setType('credit')}
                >
                  You Gave
                </button>
                <button
                  type="button"
                  disabled={!transaction}
                  className={`seg-btn got ${type === 'payment' ? 'active' : ''}`}
                  onClick={() => setType('payment')}
                >
                  You Got
                </button>
              </div>
              <div className="field-hint">
                {type === 'credit' ? 'Goods or money given on credit.' : 'Payment received from the customer.'}
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="tx-amount">Amount (₹)</label>
              <input
                id="tx-amount"
                className="input"
                type="number"
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                autoFocus
              />
            </div>

            <div className="form-group">
              <label htmlFor="tx-note">Note (optional)</label>
              <input
                id="tx-note"
                className="input"
                value={note}
                maxLength={200}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Groceries, rice and oil"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="tx-date">Entry date</label>
                <input
                  id="tx-date"
                  className="input"
                  type="date"
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="tx-due">Due date</label>
                <input
                  id="tx-due"
                  className="input"
                  type="date"
                  value={type === 'credit' ? dueDate : ''}
                  min={entryDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  disabled={type !== 'credit'}
                />
              </div>
            </div>
            {type !== 'credit' && <div className="field-hint">Due date applies to "You Gave" entries only.</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}