// file name: auth.js
// file content begin
import { auth, authInitPromise } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Check if user is authenticated
export function checkAuth() {
  // Wait for initial auth state and resolve/reject accordingly
  return authInitPromise.then(user => {
    if (user) return user;
    throw new Error("User not authenticated");
  });
}

// Get current user
export function getCurrentUser() {
  return auth.currentUser;
}

// Check if user is admin
export async function isAdmin() {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    
    const { getDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const { db } = await import("./firebase.js");
    
    const userDoc = await getDoc(doc(db, "users", user.uid));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.role === 'admin' || userData.isAdmin === true;
    }
    
    return false;
  } catch (error) {
    console.error("Error checking admin status:", error);
    return false;
  }
}

// Redirect if not authenticated
export function requireAuth(redirectTo = 'login.html') {
  onAuthStateChanged(auth, async (user) => {
    await authInitPromise;
    if (!user && !window.location.pathname.includes('login') && 
        !window.location.pathname.includes('register') &&
        !window.location.pathname.includes('index')) {
      window.location.href = redirectTo;
    }
  });
}

// Redirect if already authenticated
export function redirectIfAuthenticated(redirectTo = 'dashboard.html') {
  onAuthStateChanged(auth, async (user) => {
    await authInitPromise;
    if (user && (window.location.pathname.includes('login') || 
                 window.location.pathname.includes('register'))) {
      window.location.href = redirectTo;
    }
  });
}
// file content end