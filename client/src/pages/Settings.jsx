import { useState } from 'react';
import api from '../services/api.js';
import { useLanguage } from '../context/LanguageContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Toast, { useToast } from '../components/Toast.jsx';

export default function Settings() {
  const { t } = useLanguage();
  const [toast, showToast] = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const handlePassword = async (e) => {
    e.preventDefault();
    setError('');
    if (!current) return setError('Enter your current password.');
    if (next.length < 6) return setError('New password must be at least 6 characters.');
    if (next !== confirm) return setError('New passwords do not match.');

    setSaving(true);
    try {
      await api.changePassword({ current_password: current, new_password: next, confirm_password: confirm });
      setCurrent('');
      setNext('');
      setConfirm('');
      showToast('Password changed successfully.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await api.downloadExport();
      showToast('Export downloaded.');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <Toast toast={toast} />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings')}</h1>
          <p className="page-sub">Account security and your data.</p>
        </div>
      </div>

      <div className="card" style={{ maxWidth: 480, marginBottom: 16 }}>
        <h2 className="card-title" style={{ marginBottom: 14 }}>{t('changePassword')}</h2>
        {error && <div className="alert alert-error">{error}</div>}
        <form onSubmit={handlePassword}>
          <div className="form-group">
            <label htmlFor="pw-current">Current password</label>
            <PasswordInput id="pw-current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <div className="form-group">
            <label htmlFor="pw-new">New password</label>
            <PasswordInput id="pw-new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" />
          </div>
          <div className="form-group">
            <label htmlFor="pw-confirm">Confirm new password</label>
            <PasswordInput id="pw-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Saving...' : t('changePassword')}
          </button>
        </form>
      </div>

      <div className="card" style={{ maxWidth: 480 }}>
        <h2 className="card-title" style={{ marginBottom: 6 }}>Backup</h2>
        <p className="muted" style={{ marginBottom: 14 }}>
          Download all your customers and entries as a CSV file. It opens in Excel or Google Sheets.
        </p>
        <button className="btn btn-secondary" onClick={handleExport} disabled={exporting}>
          {exporting ? 'Preparing...' : t('exportData')}
        </button>
      </div>
    </>
  );
}