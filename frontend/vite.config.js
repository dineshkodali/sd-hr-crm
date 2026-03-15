import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  const resolveProxyTarget = () => {
    const candidate = (env.VITE_API_URL || '').trim();
    // Vite proxy target must be an absolute URL. If env provides a relative
    // path like "/api" (common for production), fall back to local backend.
    if (/^https?:\/\//i.test(candidate)) return candidate;
    return 'http://localhost:4000';
  };

  const proxyTarget = resolveProxyTarget();

  return {
    plugins: [react()],

    base: "/",

    define: {
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || (env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000')),
    },

    server: {
      host: "0.0.0.0",
      port: parseInt(env.VITE_PORT) || 3002,
      proxy: {
        "/api": {
          target: proxyTarget,
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Production build optimizations
    build: {
      outDir: "dist",
      sourcemap: false,
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            utils: ['axios', 'dayjs'],
          },
        },
      },
    },
  };
});
