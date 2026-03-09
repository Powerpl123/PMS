import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('pms_token'));
  const [loading, setLoading] = useState(true);

  /* On mount or token change, fetch current user */
  useEffect(() => {
    if (!token) { setLoading(false); return; }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => { setUser(d.data); setLoading(false); })
      .catch(() => { logout(); setLoading(false); });
  }, [token]);

  function login(tok, userData) {
    localStorage.setItem('pms_token', tok);
    setToken(tok);
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('pms_token');
    setToken(null);
    setUser(null);
  }

  /* Helper for authenticated API calls */
  async function authFetch(path, options = {}) {
    const res = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
    });
    if (res.status === 401) { logout(); throw new Error('Session expired'); }
    if (res.status === 204) return null;
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Request failed');
    return data;
  }

  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'admin' || user?.role === 'manager';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, authFetch, isAdmin, isManager }}>
      {children}
    </AuthContext.Provider>
  );
}
