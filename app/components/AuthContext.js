'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('tcg_user');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Validate session against server
        fetch('/api/auth/me', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: parsed.id }),
        })
          .then(res => res.json())
          .then(result => {
            if (result.data) {
              setUser(result.data);
              localStorage.setItem('tcg_user', JSON.stringify(result.data));
            } else {
              // Session invalid — clear
              localStorage.removeItem('tcg_user');
            }
            setLoading(false);
          })
          .catch(() => {
            // Network error — use cached data as fallback
            setUser(parsed);
            setLoading(false);
          });
      } catch(e) {
        localStorage.removeItem('tcg_user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const result = await res.json();
    if (result.error) return { error: result.error };
    setUser(result.data);
    localStorage.setItem('tcg_user', JSON.stringify(result.data));
    return { data: result.data };
  };

  const signup = async (userData) => {
    const { email, password, ...rest } = userData;
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, ...rest }),
    });
    const result = await res.json();
    if (result.error) return { error: result.error };
    if (result.data.role === 'client') {
      setUser(result.data);
      localStorage.setItem('tcg_user', JSON.stringify(result.data));
    }
    return { data: result.data };
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('tcg_user');
  };

  const updateUser = (updated) => {
    setUser(updated);
    localStorage.setItem('tcg_user', JSON.stringify(updated));
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
