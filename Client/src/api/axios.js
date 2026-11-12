import axios from 'axios';
import { TOKEN_KEY, USER_KEY } from '../utils/constants';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Attach Authorization token from localStorage if present
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle global 401 unauthorized errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Only handle HTTP 401 responses
    if (error.response && error.response.status === 401) {
      const url = error.config?.url || '';
      // Exclude /auth/login so bad credentials can display error toast on the login form
      const isLoginRequest = url.includes('/auth/login') || url.includes('/login');

      if (!isLoginRequest) {
        // Token is actually invalid or expired: clear session and redirect
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);

        if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
