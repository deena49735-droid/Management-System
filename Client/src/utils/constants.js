/**
 * Storage keys used consistently across AuthContext and Axios interceptors
 */
export const TOKEN_KEY = 'token';
export const USER_KEY = 'user';

/**
 * Retrieve the active auth token from sessionStorage (tab session) or localStorage (remembered session)
 * @returns {string|null}
 */
export const getStoredToken = () => {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
};

/**
 * Store the auth token according to remember preference:
 * - remember = false: sessionStorage (survives reload, ends on tab close)
 * - remember = true: localStorage (persistent across browser restarts)
 * Stores ONLY the token. User object is never stored.
 * @param {string} token
 * @param {boolean} remember
 */
export const setStoredToken = (token, remember = false) => {
  if (typeof window === 'undefined') return;
  try {
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
      sessionStorage.removeItem(TOKEN_KEY);
    } else {
      sessionStorage.setItem(TOKEN_KEY, token);
      localStorage.removeItem(TOKEN_KEY);
    }
    // Clean up any legacy saved user object
    localStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to set stored token:', err);
  }
};

/**
 * Clear auth tokens and legacy state from BOTH sessionStorage and localStorage
 */
export const clearStoredAuth = () => {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch (err) {
    console.error('Failed to clear stored auth:', err);
  }
};

