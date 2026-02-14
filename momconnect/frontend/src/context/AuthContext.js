import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('momconnect_token');
    if (token) {
      try {
        const res = await api.get('/auth/me');
        setUser(res.data);
      } catch (err) {
        localStorage.removeItem('momconnect_token');
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (email, password) => {
    try {
      setError(null);
      const res = await api.post('/auth/login', { email, password });
      localStorage.setItem('momconnect_token', res.data.token);
      setUser(res.data);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const register = async (name, email, password) => {
    try {
      setError(null);
      const res = await api.post('/auth/register', { name, email, password });
      localStorage.setItem('momconnect_token', res.data.token);
      setUser(res.data);
      return { success: true };
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    localStorage.removeItem('momconnect_token');
    setUser(null);
  };

  const updateUser = (data) => {
    setUser(prev => ({ ...prev, ...data }));
  };

  const refreshUser = async () => {
    try {
      const res = await api.get('/auth/me');
      setUser(res.data);
    } catch (err) {
      console.error('Failed to refresh user:', err);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      loading, 
      error, 
      setError, 
      login, 
      register, 
      logout, 
      updateUser,
      refreshUser 
    }}>
      {children}
    </AuthContext.Provider>
  );
};