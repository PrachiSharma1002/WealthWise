import axios from 'axios';

// One place that knows where the backend lives
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Before every request, attach the token (if the user is logged in)
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// The login and sign-up pages handle their own errors
const PUBLIC_PATHS = ['/login', '/register'];

// After every answer: if the login has expired or is no longer valid, sign out
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url || '';
    const isAuthForm = url.includes('/auth/login') || url.includes('/auth/register');

    // A 401 on any other request means the saved token no longer works
    if (status === 401 && !isAuthForm && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      if (!PUBLIC_PATHS.includes(window.location.pathname)) {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;