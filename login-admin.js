// file name: login-admin.js
// file content begin
import { auth, db, authInitPromise } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Fungsi login admin
async function adminLogin() {
  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const loginMsg = document.getElementById('adminLoginMsg');

  if (!email || !password) {
    loginMsg.textContent = "Email dan password harus diisi";
    return;
  }

  try {
    // Login dengan Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Cek role user di Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Verifikasi bahwa user adalah admin
      if (userData.role === 'admin' || userData.isAdmin === true) {
        // Redirect ke admin panel
        try { sessionStorage.setItem('justAdminRedirect', Date.now().toString()); } catch (e) {}
        window.location.href = 'admin.html';
      } else {
        await auth.signOut();
        loginMsg.textContent = "Akses ditolak. Hanya untuk admin.";
      }
    } else {
      // Jika data user tidak ditemukan
      await auth.signOut();
      loginMsg.textContent = "Akun admin tidak ditemukan.";
    }
  } catch (error) {
    console.error("Admin login error:", error);
    
    if (error.code === 'auth/invalid-credential') {
      loginMsg.textContent = "Email atau password admin salah";
    } else if (error.code === 'auth/too-many-requests') {
      loginMsg.textContent = "Terlalu banyak percobaan gagal. Coba lagi nanti.";
    } else {
      loginMsg.textContent = "Terjadi kesalahan: " + error.message;
    }
  }
}

// Export fungsi adminLogin ke window object
window.adminLogin = adminLogin;

// Cek jika admin sudah login
auth.onAuthStateChanged(async (user) => {
  // Wait for Firebase auth to initialize to avoid acting on intermediate states
  await authInitPromise;

  // If we were recently signed out by admin check, do not automatically redirect to admin immediately
  const lastAdminSignout = parseInt(sessionStorage.getItem('lastAdminSignout') || '0', 10);
  const now = Date.now();
  const skipRedirectWindow = 3000; // ms

  if (user && window.location.pathname.includes('login-admin.html')) {
    try {
      const userDoc = await getDoc(doc(db, "users", user.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin' || userData.isAdmin === true) {
          // Only redirect if we weren't just signed out by the admin check (avoid loops)
          if (now - lastAdminSignout > skipRedirectWindow) {
            window.location.href = 'admin.html';
          } else {
            console.warn('Skipping immediate admin redirect due to recent signout');
          }
        }
      }
    } catch (error) {
      console.error("Error checking admin status:", error);
    }
  }
});
// file content end