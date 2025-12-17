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

// Set persistence
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

// Export for use in other files
export { auth, db };
// file content end