import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react-swc";
import compression from "vite-plugin-compression";
import { ViteImageOptimizer } from "vite-plugin-image-optimizer";

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
    plugins: [
      react(),
      // Auto-compress images during build using sharp (Alpine-compatible)
      ViteImageOptimizer({
        png: { quality: 70 },
        jpeg: { quality: 80 },
        jpg: { quality: 80 },
        gif: {},
        webp: { lossless: true },
        avif: { lossless: true },
        cache: false,
        cacheLocation: undefined,
      }),
      // Pre-compress all assets with gzip at build time (served by nginx/express)
      compression({
        algorithm: "gzip",
        ext: ".gz",
        threshold: 1024, // only compress files > 1KB
        deleteOriginFile: false,
      }),
      // Also generate brotli for modern browsers
      compression({
        algorithm: "brotliCompress",
        ext: ".br",
        threshold: 1024,
        deleteOriginFile: false,
      }),
    ],

    base: "/",

    define: {
      'process.env.VITE_API_URL': JSON.stringify(
        env.VITE_API_URL || (env.NODE_ENV === 'production' ? '/api' : 'http://localhost:4000')
      ),
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

    build: {
      outDir: "dist",
      sourcemap: false,
      // Target modern browsers — avoids unnecessary transpilation overhead
      target: "es2020",
      // esbuild is the default and fastest minifier
      minify: "esbuild",
      // Raise warning limit — we're deliberately splitting large pages
      chunkSizeWarningLimit: 800,
      rollupOptions: {
        output: {
          // Smart chunk splitting: group by library category
          manualChunks(id) {
            // Core React runtime
            if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
              return "react-core";
            }
            // Router
            if (id.includes("node_modules/react-router-dom/") || id.includes("node_modules/react-router/")) {
              return "router";
            }
            // Charts — loaded only when chart pages open
            if (id.includes("node_modules/recharts/")) {
              return "recharts";
            }
            // Maps — loaded only when map pages open
            if (id.includes("node_modules/leaflet/") || id.includes("node_modules/react-leaflet/")) {
              return "leaflet";
            }
            // PDF generation — loaded only when report pages open
            if (id.includes("node_modules/jspdf") || id.includes("node_modules/jspdf-autotable")) {
              return "jspdf";
            }
            // Icons — large library, keep separate
            if (id.includes("node_modules/lucide-react/")) {
              return "icons";
            }
            // Axios + dayjs utilities
            if (id.includes("node_modules/axios/") || id.includes("node_modules/dayjs/")) {
              return "utils";
            }
          },
        },
      },
      // Enable parallel esbuild workers for faster minification
      esbuildOptions: {
        target: "es2020",
        legalComments: "none",
      },
    },

    // Optimize Vite's dep pre-bundling — only scan what's used
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-router-dom",
        "axios",
        "dayjs",
      ],
      // Exclude heavy libs so they're only loaded when actually needed
      exclude: ["leaflet", "jspdf", "jspdf-autotable"],
    },
  };
});
