// file name: firebase.js
// file content begin
// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCFV_3L0sdLHXLP41upJxUv_HXQbBwu9yg",
  authDomain: "rewardshareio.firebaseapp.com",
  projectId: "rewardshareio",
  storageBucket: "rewardshareio.appspot.com",
  messagingSenderId: "117198044906",
  appId: "1:117198044906:web:1ae2d1aae01ef2d810a193"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Create auth init promise that resolves once Firebase reports initial auth state
let _authInitResolve;
export const authInitPromise = new Promise((resolve) => { _authInitResolve = resolve; });

onAuthStateChanged(auth, (user) => {
  // Resolve the promise only once (first notification)
  if (_authInitResolve) {
    _authInitResolve(user);
    _authInitResolve = null;
  }
});

// Small utility: create an offline banner and global error handlers
(function setupGlobalErrorHandlers() {
  try {
    // Banner
    const banner = document.createElement('div');
    banner.id = 'offlineBanner';
    banner.style.position = 'fixed';
    banner.style.left = '12px';
    banner.style.bottom = '12px';
    banner.style.padding = '10px 14px';
    banner.style.background = 'rgba(239,68,68,0.95)';
    banner.style.color = '#fff';
    banner.style.borderRadius = '8px';
    banner.style.boxShadow = '0 6px 18px rgba(2,6,23,0.6)';
    banner.style.fontFamily = 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif';
    banner.style.fontSize = '13px';
    banner.style.zIndex = 99999;
    banner.style.display = 'none';
    banner.textContent = 'Offline: connection to Firestore failed. Retrying...';
    document.addEventListener('DOMContentLoaded', () => {
      document.body.appendChild(banner);
    });

    function showOffline(msg) {
      try {
        banner.textContent = msg || 'Offline: connection to Firestore failed. Retrying...';
        banner.style.display = 'block';
        if (window.appendAuthDebug) window.appendAuthDebug('global: showOffline - ' + banner.textContent);
      } catch (e) { console.error('showOffline failed', e); }
    }

    function hideOffline() {
      try {
        banner.style.display = 'none';
        if (window.appendAuthDebug) window.appendAuthDebug('global: hideOffline');
      } catch (e) { console.error('hideOffline failed', e); }
    }

    // Watch for unhandled rejections (Firestore errors often surface here)
    window.addEventListener('unhandledrejection', (ev) => {
      try {
        const reason = ev.reason;
        const m = reason && (reason.message || reason.code || String(reason));
        if (m && (m.includes('Could not reach Cloud Firestore') || m.includes('[code=unavailable]') || m.includes('Firestore'))) {
          showOffline(m);
          // attempt to hide after a while (let Firestore reconnect)
          setTimeout(() => { hideOffline(); }, 5000);
        } else {
          if (window.appendAuthDebug) window.appendAuthDebug('global: unhandledrejection: ' + m);
          console.warn('unhandledrejection:', ev);
        }
      } catch (e) { console.error('unhandledrejection handler failed', e); }
    });

    // Global error handler
    window.addEventListener('error', (ev) => {
      try {
        const message = ev && ev.message ? ev.message : String(ev);
        if (message && (message.includes('Could not reach Cloud Firestore') || message.includes('[code=unavailable]') || message.includes('Firestore'))) {
          showOffline(message);
          setTimeout(() => { hideOffline(); }, 5000);
        } else {
          if (window.appendAuthDebug) window.appendAuthDebug('global:error: ' + message);
        }
      } catch (e) { console.error('error handler failed', e); }
    });

    // Provide methods to programmatically show/hide for tests
    window.__showOffline = showOffline;
    window.__hideOffline = hideOffline;
  } catch (e) {
    console.error('setupGlobalErrorHandlers failed', e);
  }
})();

// Set persistence
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

// Export for use in other files
export { auth, db };
// file content end