import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import Logo from '../components/Logo.jsx';
import PasswordInput from '../components/PasswordInput.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [loading, setLoading] = useState(false);
  const { t } = useLanguage();

  if (user) return <Navigate to="/dashboard" replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    const errs = {};
    if (!/^[0-9]{10}$/.test(phone)) errs.phone = 'Enter your 10-digit phone number.';
    if (!password) errs.password = 'Enter your password.';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setLoading(true);
    try {
      await login(phone, password);
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
        <h1 className="auth-title">Welcome back</h1>
        <p className="auth-sub">Log in to manage your shop's credit book</p>

        {serverError && <div className="alert alert-error">{serverError}</div>}

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-group">
            <label htmlFor="login-phone">Phone number</label>
            <input
              id="login-phone"
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
            <label htmlFor="login-password">Password</label>
            <PasswordInput
              id="login-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              invalid={!!errors.password}
              autoComplete="current-password"
              placeholder="Your password"
            />
            {errors.password && <div className="field-error">{errors.password}</div>}
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <p className="auth-switch">
          New shopkeeper? <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  );
}