import { useState } from 'react';
import { formatMoney, formatDate } from '../services/format.js';

// Asks for an optional reason, then calls onConfirm(reason)
export default function ReverseDialog({ transaction, loading, onConfirm, onCancel }) {
  const [reason, setReason] = useState('');
  const label = transaction.type === 'credit' ? 'You Gave' : 'You Got';

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Reverse transaction">
      <div className="modal">
        <div className="modal-header">
          <h2>Reverse transaction?</h2>
          <button className="close-btn" onClick={onCancel} aria-label="Close">×</button>
        </div>
        <div className="modal-body">
          <p>
            <strong>{label} {formatMoney(transaction.amount)}</strong> on {formatDate(transaction.entry_date)}
            {transaction.customer_name ? ` (${transaction.customer_name})` : ''}.
          </p>
          <p className="muted" style={{ margin: '8px 0 16px' }}>
            The entry stays in the history marked as reversed, and the balance is corrected automatically.
          </p>
          <div className="form-group">
            <label htmlFor="reverse-reason">Reason (optional)</label>
            <input
              id="reverse-reason"
              className="input"
              value={reason}
              maxLength={200}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Wrong amount entered"
              autoFocus
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className="btn btn-danger" onClick={() => onConfirm(reason.trim())} disabled={loading}>
            {loading ? 'Please wait...' : 'Reverse'}
          </button>
        </div>
      </div>
    </div>
  );
}