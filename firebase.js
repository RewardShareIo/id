// file name: firebase.js
// file content begin
// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
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

// Set persistence
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Error setting persistence:", error);
  });

// Export for use in other files
export { auth, db };
// file content end