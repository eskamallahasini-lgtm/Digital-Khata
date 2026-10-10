import { useState } from 'react';
import api from '../services/api.js';

export default function EditCustomerModal({ customer, onClose, onSaved }) {
  const [name, setName] = useState(customer.name);
  const [phone, setPhone] = useState(customer.phone);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) return setError('Please enter the customer name.');
    if (!/^[0-9]{10}$/.test(phone)) return setError('Phone number must be exactly 10 digits.');

    setSaving(true);
    try {
      await api.updateCustomer(customer.id, { name: name.trim(), phone });
      onSaved();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-label="Edit customer">
      <div className="modal">
        <div className="modal-header">
          <h2>Edit Customer</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-group">
              <label htmlFor="edit-name">Customer name</label>
              <input id="edit-name" className="input" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label htmlFor="edit-phone">Phone number</label>
              <input
                id="edit-phone"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                inputMode="numeric"
              />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}