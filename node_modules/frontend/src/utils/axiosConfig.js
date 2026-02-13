// Frontend/src/utils/axiosConfig.js
// Central axios configuration with token management and interceptors

import axios from 'axios';

const attachInterceptors = (instance) => {
  instance.interceptors.request.use(
    (config) => {
      const base = String(config.baseURL || "");
      const url = typeof config.url === "string" ? config.url : "";

      if (!base && axios.defaults.baseURL) {
        config.baseURL = axios.defaults.baseURL;
      }

      const normalizedBase =
        typeof config.baseURL === "string" ? config.baseURL.replace(/\/+$/, "") : "";

      if (
        normalizedBase.endsWith("/api") &&
        typeof config.url === "string" &&
        (config.url.startsWith("/api/") || config.url === "/api")
      ) {
        config.url = config.url === "/api" ? "/" : config.url.slice(4);
      }

      if (typeof config.url === "string") {
        config.url = config.url.replace(/\/api\/api\//g, "/api/");
      }

      const token = localStorage.getItem('authToken');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  instance.interceptors.response.use(
    (response) => {
      if (response.data?.token) {
        localStorage.setItem('authToken', response.data.token);
        axios.defaults.headers.common['Authorization'] = `Bearer ${response.data.token}`;
      }
      return response;
    },
    (error) => {
      if (error.response?.status === 401) {
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
      }
      return Promise.reject(error);
    }
  );

  return instance;
};

const originalCreate = axios.create.bind(axios);
axios.create = (...args) => attachInterceptors(originalCreate(...args));

// ==========================================
// Global Interceptors (for all axios instances)
// ==========================================

// Request interceptor: add Authorization header with token
axios.interceptors.request.use(
  (config) => {
    const base = String(config.baseURL || "");
    const url = typeof config.url === "string" ? config.url : "";

    if (!base && axios.defaults.baseURL) {
      config.baseURL = axios.defaults.baseURL;
    }

    if (
      typeof config.baseURL === "string" &&
      config.baseURL.replace(/\/+$/, "").endsWith("/api") &&
      typeof config.url === "string" &&
      config.url.startsWith("/api/")
    ) {
      config.url = config.url.slice(4);
    }

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

// In Docker / production we typically serve the API under the same origin at `/api`.
// Many pages create their own axios instances using `import.meta.env.VITE_API_URL || axios.defaults.baseURL || ""`.
// If `VITE_API_URL` is not set, ensure `axios.defaults.baseURL` points to the working `/api` prefix.
const resolvedApiBase = import.meta.env.VITE_API_URL || `${window.location.origin}/api`;
axios.defaults.baseURL = resolvedApiBase;

// Set Authorization header from stored token on initialization
const token = localStorage.getItem('authToken');
if (token) {
  axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
}

// ==========================================
// Pre-configured API Instance (recommended for new code)
// ==========================================

export const api = axios.create({
  baseURL: resolvedApiBase,
  withCredentials: true,
  timeout: 15000,
});

// The api instance will inherit the global interceptors since they're
// registered on axios (the constructor function)

export default api;

