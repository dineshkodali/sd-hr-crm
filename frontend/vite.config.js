import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],

    base: "/",

    define: {
      'process.env.VITE_API_URL': JSON.stringify(env.VITE_API_URL || '/api'),
    },

    server: {
      host: "0.0.0.0",
      port: 3002,
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:4002",
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
