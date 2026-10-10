import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api, { TOKEN_KEY, USER_KEY } from '../services/api.js';

const AuthContext = createContext(null);

function loadStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw && localStorage.getItem(TOKEN_KEY) ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);

  const saveSession = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    setUser(data.user);
  };

  const login = async (phone, password) => {
    const data = await api.login({ phone, password });
    saveSession(data);
  };

  const register = async (form) => {
    const data = await api.register(form);
    saveSession(data);
  };

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  }, []);

  // If the backend says our token is invalid/expired, log out automatically
  useEffect(() => {
    window.addEventListener('khata-unauthorized', logout);
    return () => window.removeEventListener('khata-unauthorized', logout);
  }, [logout]);

  return (
    <AuthContext.Provider value={{ user, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}