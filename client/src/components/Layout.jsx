import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import Logo, { LogoIcon } from './Logo.jsx';
import CopilotPanel from './CopilotPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLanguage } from '../context/LanguageContext.jsx';

const links = [
  { to: '/dashboard', key: 'nav_dashboard', icon: '🏠' },
  { to: '/customers', key: 'nav_customers', icon: '👥' },
  { to: '/transactions', key: 'nav_transactions', icon: '🧾' },
  { to: '/reminders', key: 'nav_reminders', icon: '🔔' },
  { to: '/settings', key: 'nav_settings', icon: '⚙️' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [dataVersion, setDataVersion] = useState(0);
  const location = useLocation();

  // Close the mobile menu whenever the page changes
  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <>
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <Logo light />
        <nav className="sidebar-nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon" aria-hidden="true">{l.icon}</span>
              {t(l.key)}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="sidebar-user">
            {t('logged_in_as')}
            <strong>{user.shop_name}</strong>
          </div>
          <button className="btn sidebar-logout" onClick={logout}>{t('logout')}</button>
        </div>
      </aside>

      <div className={`overlay ${open ? 'show' : ''}`} onClick={() => setOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button className="menu-btn" onClick={() => setOpen(true)} aria-label="Open menu">☰</button>
          <div className="topbar-brand">
            <div className="logo">
              <LogoIcon size={30} />
              <span className="logo-name">Digital Khata</span>
            </div>
          </div>
          <div className="topbar-user">{user.shop_name}</div>
        </header>
        <main className="content">
          <Outlet key={dataVersion} />
        </main>
      </div>

      <CopilotPanel onDataChanged={() => setDataVersion((v) => v + 1)} />
    </>
  );
}