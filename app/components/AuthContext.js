'use client';
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate session via cookie-based GET /api/auth/me
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(result => {
        if (result.data) {
          setUser(result.data);
        }
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
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
    // Set user for all roles (needed for verify-email page to show email)
    setUser(result.data);
    return { data: result.data, requiresVerification: result.requiresVerification };
  };

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  const updateUser = (updated) => {
    setUser(updated);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, signup, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
