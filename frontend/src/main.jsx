import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'


// Add this to the TOP of src/main.jsx or src/index.js
if (typeof crypto === 'undefined') self.crypto = {};
if (typeof crypto.randomUUID === 'undefined') {
  crypto.randomUUID = function () {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };
}


// Polyfill for crypto.randomUUID for environments/browsers that don't support it
// This prevents third-party libs (e.g., Grammarly or other bundles) from throwing
// when they call crypto.randomUUID(). It prefers a crypto.getRandomValues-based
// UUID v4 and falls back to a Math.random implementation if necessary.
; (function polyfillRandomUUID() {
  try {
    const globalCrypto = typeof window !== 'undefined' ? window.crypto || window.msCrypto : (typeof crypto !== 'undefined' ? crypto : null);
    if (!globalCrypto) {
      // nothing we can do
      return;
    }

    if (typeof globalCrypto.randomUUID === 'function') return;

    const getRandomValues = globalCrypto.getRandomValues && typeof globalCrypto.getRandomValues === 'function'
      ? (arr) => globalCrypto.getRandomValues(arr)
      : null;

    if (getRandomValues) {
      globalCrypto.randomUUID = function randomUUID() {
        const bytes = new Uint8Array(16);
        getRandomValues(bytes);
        // Per RFC4122 v4
        bytes[6] = (bytes[6] & 0x0f) | 0x40;
        bytes[8] = (bytes[8] & 0x3f) | 0x80;
        const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        return `${hex.substring(0, 8)}-${hex.substring(8, 12)}-${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20, 32)}`;
      };
    } else {
      // Fallback using Math.random (not cryptographically secure)
      globalCrypto.randomUUID = function randomUUIDFallback() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
          const r = Math.random() * 16 | 0;
          const v = c === 'x' ? r : (r & 0x3 | 0x8);
          return v.toString(16);
        });
      };
    }
  } catch {
    // swallow errors — polyfill best-effort only
  }
})();


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
