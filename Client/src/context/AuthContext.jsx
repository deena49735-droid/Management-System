import React, { createContext, useContext, useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { TOKEN_KEY, getStoredToken, setStoredToken, clearStoredAuth } from '../utils/constants';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  // Read token from storage (sessionStorage or localStorage) on app start
  const [token, setToken] = useState(() => getStoredToken());

  // User object is NEVER trusted or restored from storage; always verified via /auth/me
  const [user, setUser] = useState(null);

  // Loading state remains true until restore session call completes
  const [loading, setLoading] = useState(true);

  // 1. Restore and verify user session on app start via GET /auth/me
  useEffect(() => {
    const restoreSession = async () => {
      const storedToken = getStoredToken();

      if (!storedToken) {
        // No token found, finish loading immediately
        setLoading(false);
        return;
      }

      try {
        // Validate token with server and fetch fresh user profile
        const response = await api.get('/auth/me');

        if (response.data?.user) {
          setUser(response.data.user);
          setToken(storedToken);
        } else {
          clearStoredAuth();
          setToken(null);
          setUser(null);
        }
      } catch (error) {
        clearStoredAuth();
        setToken(null);
        setUser(null);

        // If backend explicitly returned 401 (expired session or inactive account)
        if (error.response?.status === 401) {
          const msg = error.response?.data?.message || 'Session expired. Please sign in again.';
          toast.error(msg);
        }
      } finally {
        setLoading(false);
      }
    };

    restoreSession();
  }, []);

  // 2. Multi-tab sync: Listen to storage events to log out this tab if logged out in another
  useEffect(() => {
    const handleStorageChange = (e) => {
      if (e.key === TOKEN_KEY && !e.newValue) {
        clearStoredAuth();
        setToken(null);
        setUser(null);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // Login handler accepting email/username and optional remember boolean
  const login = async (identifier, password, remember = false) => {
    const cleanIdentifier = identifier ? identifier.trim().toLowerCase() : '';
    // For legacy/remote backends that only look up by username:
    // If identifier is an email (e.g. admin@gmail.com), also extract the prefix before '@' (e.g. admin)
    // so both email-based and username-based backends can resolve the user seamlessly.
    const fallbackUsername = cleanIdentifier.includes('@')
      ? cleanIdentifier.split('@')[0]
      : cleanIdentifier;

    const response = await api.post('/auth/login', {
      email: cleanIdentifier,
      username: fallbackUsername,
      password,
      remember: Boolean(remember),
    });
    const { token: receivedToken, user: receivedUser } = response.data;

    // Store ONLY the token according to remember preference (sessionStorage or localStorage)
    setStoredToken(receivedToken, remember);

    setToken(receivedToken);
    setUser(receivedUser);

    return receivedUser;
  };

  // Refresh user data from /auth/me
  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data?.user) {
        setUser(response.data.user);
      }
    } catch (e) {
      // Ignore background refresh failure
    }
  };

  // Logout handler clearing both storages
  const logout = () => {
    clearStoredAuth();
    setToken(null);
    setUser(null);
  };

  const value = {
    user,
    token,
    loading,
    login,
    logout,
    refreshUser,
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
