// file name: login.js
// file content begin
import { auth, db, authInitPromise } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Login function
window.login = async function() {
  const emailEl = document.getElementById('loginEmail');
  const passwordEl = document.getElementById('loginPassword');
  const loginMsg = document.getElementById('loginMsg');
  if (!emailEl || !passwordEl) {
    console.error('Login form elements not found');
    if (loginMsg) loginMsg.textContent = 'Form login tidak ditemukan';
    return;
  }

  const email = emailEl.value.trim();
  const password = passwordEl.value;

  // Reset message
  if (loginMsg) {
    loginMsg.textContent = '';
    loginMsg.className = 'text-danger';
  }

  // Validation
  if (!email || !password) {
    loginMsg.textContent = "Email dan password harus diisi";
    return;
  }

  try {
    // Show loading
    const loginBtn = document.querySelector('.btn-primary');
    const originalText = loginBtn ? loginBtn.textContent : null;
    if (loginBtn) {
      loginBtn.textContent = "Loading...";
      loginBtn.disabled = true;
    }

    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    console.log('login: signInWithEmailAndPassword success', user && user.uid);

    // Get user data from Firestore
    const userDoc = await getDoc(doc(db, "users", user.uid));
    
    if (userDoc.exists()) {
      const userData = userDoc.data();
      
      // Check if user is admin
      if (userData.role === 'admin' || userData.isAdmin === true) {
        // Admin redirect
        window.location.href = 'admin.html';
      } else {
        // Regular user redirect
        window.location.href = 'dashboard.html';
      }
    } else {
      // User document not found
      await auth.signOut();
      if (loginMsg) loginMsg.textContent = "Data user tidak ditemukan";
    }
  } catch (error) {
    console.error("Login error:", error);
    
    // Reset button
    const loginBtn = document.querySelector('.btn-primary');
    if (loginBtn) {
      loginBtn.textContent = "Login";
      loginBtn.disabled = false;
    }
    
    // Show error message
    switch(error.code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        loginMsg.textContent = "Email atau password salah";
        break;
      case 'auth/too-many-requests':
        loginMsg.textContent = "Terlalu banyak percobaan. Coba lagi nanti.";
        break;
      case 'auth/user-disabled':
        loginMsg.textContent = "Akun dinonaktifkan";
        break;
      default:
        if (loginMsg) loginMsg.textContent = "Terjadi kesalahan: " + error.message;
    }
  }
};

// Check if user is already logged in
auth.onAuthStateChanged(async (user) => {
  await authInitPromise;
  console.log('login:onAuthStateChanged', user ? user.uid : null, 'path', window.location.pathname);
  if (user) {
    // User is logged in, redirect based on current page
    const currentPage = window.location.pathname.split('/').pop();
    
    if (currentPage === 'login.html' || currentPage === 'index.html' || currentPage === 'register.html') {
      // Check if user is admin
      getDoc(doc(db, "users", user.uid))
        .then((userDoc) => {
          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData.role === 'admin' || userData.isAdmin === true) {
              window.location.href = 'admin.html';
            } else {
              window.location.href = 'dashboard.html';
            }
          }
        })
        .catch((error) => {
          console.error("Error checking user data:", error);
          const loginMsg = document.getElementById('loginMsg');
          if (loginMsg) loginMsg.textContent = "Terjadi kesalahan saat memeriksa data user";
        });
    }
  }
});

// Add Enter key support
document.addEventListener('DOMContentLoaded', () => {
  const emailEl = document.getElementById('loginEmail');
  const pwdEl = document.getElementById('loginPassword');
  if (emailEl) {
    emailEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') login();
    });
  }
  if (pwdEl) {
    pwdEl.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') login();
    });
  }
});
// file content end