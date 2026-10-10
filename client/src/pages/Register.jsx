import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Register() {
  const { user, register } = useAuth();
  const navigate = useNavigate();
  const [shopName, setShopName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const errs = {};
    if (!shopName.trim()) errs.shopName = 'Enter your shop name.';
    if (!/^[0-9]{10}$/.test(phone)) errs.phone = 'Phone number must be exactly 10 digits.';
    if (password.length < 6) errs.password = 'Password must be at least 6 characters.';
    if (confirm !== password) errs.confirm = 'Passwords do not match.';
    if (!confirm) errs.confirm = 'Please confirm your password.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await register({
        shop_name: shopName.trim(),
        phone,
        password,
        confirm_password: confirm,
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setServerError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand"><Logo size={48} /></div>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Start your digital credit book in a minute</p>

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="reg-shop">Shop name</label>
            <input
              id="reg-shop"
              className={`input ${errors.shopName ? 'invalid' : ''}`}
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="e.g. Sri Lakshmi Stores"
            />
            {errors.shopName && <div className="field-error">{errors.shopName}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="reg-phone">Phone number</label>
            <input
              id="reg-phone"
              className={`input ${errors.phone ? 'invalid' : ''}`}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
              inputMode="numeric"
              autoComplete="username"
              placeholder="10-digit phone number"
            />
            {errors.phone && <div className="field-error">{errors.phone}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="reg-password">Password</label>
            <PasswordInput
              id="reg-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!errors.password}
              autoComplete="new-password"
              placeholder="At least 6 characters"
            />
            {errors.password && <div className="field-error">{errors.password}</div>}
          </div>

          <div className="form-group">
            <label htmlFor="reg-confirm">Confirm password</label>
            <PasswordInput
              id="reg-confirm"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              invalid={!!errors.confirm}
              autoComplete="new-password"
              placeholder="Re-enter your password"
            />
            {errors.confirm && <div className="field-error">{errors.confirm}</div>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Creating account...' : 'Register'}
          </button>
        </form>

        <p className="auth-switch">
          Already registered? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  );
}