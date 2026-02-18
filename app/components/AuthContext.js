'use client';
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('tcg_user');
    if (saved) {
      try { setUser(JSON.parse(saved)); } catch(e) {}
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    const { data, error } = await supabase
      .from('express_users')
      .select('*')
      .eq('email', email)
      .single();
    if (error || !data) return { error: 'Invalid email or password' };
    if (data.password_hash !== password) return { error: 'Invalid email or password' };
    if (!data.is_active) return { error: 'Account is deactivated' };
    if (data.role === 'driver' && data.driver_status !== 'approved') return { error: 'Driver account pending approval' };
    setUser(data);
    localStorage.setItem('tcg_user', JSON.stringify(data));
    return { data };
  };

  const signup = async (userData) => {
    const { email, password, ...rest } = userData;
    const existing = await supabase.from('express_users').select('id').eq('email', email).single();
    if (existing.data) return { error: 'Email already registered' };
    const { data, error } = await supabase.from('express_users').insert([{
      email, password_hash: password, ...rest
    }]).select().single();
    if (error) return { error: error.message };
    if (data.role === 'client') {
      setUser(data);
      localStorage.setItem('tcg_user', JSON.stringify(data));
    }
    return { data };
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
