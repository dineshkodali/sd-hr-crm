// Frontend/src/utils/axiosConfig.js
// Central axios configuration with token management and interceptors

import axios from 'axios';

const DEFAULT_GET_CACHE_TTL_MS = 30_000;
const getCache = new Map();
const inFlight = new Map();

function safeJson(value) {
  try { return JSON.stringify(value ?? null); } catch { return String(value); }
}

function buildCacheKey(config) {
  const method = String(config.method || 'get').toLowerCase();
  const baseURL = typeof config.baseURL === 'string' ? config.baseURL.replace(/\/+$/, '') : '';
  const url = typeof config.url === 'string' ? config.url : '';
  const params = config.params;
  return `${method} ${baseURL}${url} params=${safeJson(params)}`;
}

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

    // ------------------------------------------
    // GET caching + in-flight de-duplication
    // ------------------------------------------
    const method = String(config.method || 'get').toLowerCase();
    const noCache = !!config.noCache;
    if (method === 'get' && !noCache) {
      const cacheKey = buildCacheKey(config);
      config.__cacheKey = cacheKey;

      const now = Date.now();
      const cached = getCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        config.adapter = async () => ({
          data: cached.data,
          status: cached.status,
          statusText: cached.statusText,
          headers: cached.headers,
          config,
          request: null,
        });
        return config;
      }

      const existing = inFlight.get(cacheKey);
      if (existing) {
        config.adapter = () => existing;
        return config;
      }

      const originalAdapter = config.adapter;
      if (typeof originalAdapter === 'function') {
        config.adapter = (cfg) => {
          const p = originalAdapter(cfg);
          inFlight.set(cacheKey, p);
          return p;
        };
      }
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

    // Cache successful GET responses
    const cfg = response?.config;
    const method = String(cfg?.method || 'get').toLowerCase();
    const cacheKey = cfg?.__cacheKey;
    if (method === 'get' && cacheKey && !cfg?.noCache) {
      const ttl = Number.isFinite(cfg?.cacheTtlMs) ? cfg.cacheTtlMs : DEFAULT_GET_CACHE_TTL_MS;
      getCache.set(cacheKey, {
        expiresAt: Date.now() + Math.max(0, ttl),
        data: response.data,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
      inFlight.delete(cacheKey);
    }

    return response;
  },
  (error) => {
    try {
      const cfg = error?.config;
      const cacheKey = cfg?.__cacheKey;
      if (cacheKey) inFlight.delete(cacheKey);
    } catch { }
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

