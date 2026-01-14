import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],

  base: "/",

  server: {
    host: "0.0.0.0",
    port: 443,
    proxy: {
      "/api": {
        target: process.env.VITE_API_URL || "http://localhost:4002",
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
});
