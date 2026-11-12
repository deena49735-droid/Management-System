import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';
import { TOKEN_KEY, USER_KEY } from '../utils/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Read token from localStorage on app start
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);

  // Read saved user profile from localStorage on app start (if available)
  const [user, setUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem(USER_KEY);
      return savedUser ? JSON.parse(savedUser) : null;
    } catch {
      return null;
    }
  });

  // Loading state remains true until restore session call completes
  const [loading, setLoading] = useState(true);

  // Restore user session on app start if token exists
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = localStorage.getItem(TOKEN_KEY);

      if (!storedToken) {
        // No token found, finish loading immediately
        setLoading(false);
        return;
      }

      try {
        // Validate token and fetch fresh user profile
        const response = await api.get('/auth/me');

        if (response.data?.user) {
          setUser(response.data.user);
          localStorage.setItem(USER_KEY, JSON.stringify(response.data.user));
          setToken(storedToken);
        } else {
          logout();
        }
      } catch (error) {
        console.error('Failed to restore session:', error?.response?.data?.message || error.message);
        // Only log out if backend explicitly rejected credentials with 401
        if (error.response?.status === 401) {
          logout();
        }
      } finally {
        // Always set loading to false after check completes (success or failure)
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // Login handler
  const login = async (phone, password) => {
    const response = await api.post('/auth/login', { phone, password });
    const { token: receivedToken, user: receivedUser } = response.data;

    // Save token and user to localStorage with consistent keys
    localStorage.setItem(TOKEN_KEY, receivedToken);
    localStorage.setItem(USER_KEY, JSON.stringify(receivedUser));

    setToken(receivedToken);
    setUser(receivedUser);

    return receivedUser;
  };

  // Logout handler
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!token && !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
