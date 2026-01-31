// Frontend/src/utils/axiosConfig.js
// Central axios configuration with token management and interceptors

import axios from 'axios';

// ==========================================
// Global Interceptors (for all axios instances)
// ==========================================

// Request interceptor: add Authorization header with token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: handle auth errors and store token
axios.interceptors.response.use(
  (response) => {
    // If response contains a token, store it for future requests
    if (response.data?.token) {
      localStorage.setItem('authToken', response.data.token);
      // Update global headers for all future requests
      axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
    }
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors
    if (error.response?.status === 401) {
      // Clear stored token and redirect to login
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      delete axios.defaults.headers.common['Authorization'];
      // Redirect to login if not already there
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// ==========================================
// Global Configuration
// ==========================================

// Enable credentials for all axios instances
axios.defaults.withCredentials = true;

// Set Authorization header from stored token on initialization
const token = localStorage.getItem('authToken');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// ==========================================
// Pre-configured API Instance (recommended for new code)
// ==========================================

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || window.location.origin,
  withCredentials: true,
  timeout: 15000,
});

// The api instance will inherit the global interceptors since they're
// registered on axios (the constructor function)

export default api;

