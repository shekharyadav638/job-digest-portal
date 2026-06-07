'use client';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const TOKEN_KEY = 'job_portal_token';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchMe = useCallback(async (savedToken) => {
    try {
      const res = await fetch(`${API}/api/auth/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (!res.ok) throw new Error('Invalid token');
      return await res.json();
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem(TOKEN_KEY);
    if (!savedToken) { setLoading(false); return; }

    fetchMe(savedToken).then(userData => {
      if (userData) {
        setUser(userData);
        setToken(savedToken);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
      setLoading(false);
    });
  }, [fetchMe]);

  async function signup(name, email, password) {
    const res = await fetch(`${API}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Signup failed');
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function login(email, password) {
    const res = await fetch(`${API}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    localStorage.setItem(TOKEN_KEY, data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }

  function refreshUser(updatedUser) {
    setUser(updatedUser);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, signup, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export { API };
