import { useState } from 'react';
import api from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import Toast, { useToast } from '../components/Toast.jsx';

export default function Settings() {
  const { user, updateUser } = useAuth();
  const { t, lang, setLang, languages } = useLanguage();
  const [toast, showToast] = useToast();

  const [shopName, setShopName] = useState(user.shop_name);
  const [profileError, setProfileError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [savingPw, setSavingPw] = useState(false);

  const saveProfile = async (e) => {
    e.preventDefault();
    setProfileError('');
    if (!shopName.trim()) return setProfileError('Please enter your shop name.');
    setSavingProfile(true);
    try {
      const updated = await api.updateProfile(shopName.trim());
      updateUser({ shop_name: updated.shop_name });
      showToast(t('saved'));
    } catch (err) {
      setProfileError(err.message);
    } finally {
      setSavingProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    setPwError('');
    if (!current || !next || !confirm) return setPwError('Please fill all password fields.');
    if (next.length < 6) return setPwError('New password must be at least 6 characters.');
    if (next !== confirm) return setPwError('New passwords do not match.');
    setSavingPw(true);
    try {
      await api.changePassword({ current_password: current, new_password: next, confirm_password: confirm });
      setCurrent('');
      setNext('');
      setConfirm('');
      showToast(t('password_changed'));
    } catch (err) {
      setPwError(err.message);
    } finally {
      setSavingPw(false);
    }
  };

  return (
    <>
      <Toast toast={toast} />

      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings_title')}</h1>
          <p className="page-sub">{t('settings_sub')}</p>
        </div>
      </div>

      <div className="settings-grid">
        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 14 }}>{t('profile')}</h2>
          {profileError && <div className="alert alert-error">{profileError}</div>}
          <form onSubmit={saveProfile}>
            <div className="form-group">
              <label htmlFor="set-shop">{t('shop_name')}</label>
              <input
                id="set-shop"
                className="input"
                value={shopName}
                maxLength={80}
                onChange={(e) => setShopName(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="set-phone">{t('phone')}</label>
              <input id="set-phone" className="input" value={user.phone} disabled />
              <div className="field-hint">{t('phone_note')}</div>
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingProfile}>
              {savingProfile ? '...' : t('save_changes')}
            </button>
          </form>
        </section>

        <section className="card">
          <h2 className="card-title">{t('language')}</h2>
          <p className="muted" style={{ margin: '4px 0 14px' }}>{t('language_sub')}</p>
          <div className="lang-grid" role="radiogroup" aria-label={t('language')}>
            {languages.map((l) => (
              <button
                key={l.code}
                type="button"
                role="radio"
                aria-checked={lang === l.code}
                className={`lang-btn ${lang === l.code ? 'active' : ''}`}
                onClick={() => setLang(l.code)}
              >
                {lang === l.code ? '✓ ' : ''}{l.name}
              </button>
            ))}
          </div>
        </section>

        <section className="card">
          <h2 className="card-title" style={{ marginBottom: 14 }}>{t('change_password')}</h2>
          {pwError && <div className="alert alert-error">{pwError}</div>}
          <form onSubmit={savePassword}>
            <div className="form-group">
              <label htmlFor="pw-current">{t('current_password')}</label>
              <PasswordInput id="pw-current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
            </div>
            <div className="form-group">
              <label htmlFor="pw-new">{t('new_password')}</label>
              <PasswordInput id="pw-new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" placeholder="At least 6 characters" />
            </div>
            <div className="form-group">
              <label htmlFor="pw-confirm">{t('confirm_password')}</label>
              <PasswordInput id="pw-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={savingPw}>
              {savingPw ? '...' : t('update_password')}
            </button>
          </form>
        </section>
      </div>
    </>
  );
}