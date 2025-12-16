// file name: login.js
// file content begin
import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Login function
window.login = async function() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const loginMsg = document.getElementById('loginMsg');

  // Reset message
  loginMsg.textContent = '';
  loginMsg.className = 'text-danger';

  // Validation
  if (!email || !password) {
    loginMsg.textContent = "Email dan password harus diisi";
    return;
  }

  try {
    // Show loading
    const loginBtn = document.querySelector('.btn-primary');
    const originalText = loginBtn.textContent;
    loginBtn.textContent = "Loading...";
    loginBtn.disabled = true;

    // Sign in with Firebase Auth
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

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
      loginMsg.textContent = "Data user tidak ditemukan";
    }
  } catch (error) {
    console.error("Login error:", error);
    
    // Reset button
    const loginBtn = document.querySelector('.btn-primary');
    loginBtn.textContent = "Login";
    loginBtn.disabled = false;
    
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
        loginMsg.textContent = "Terjadi kesalahan: " + error.message;
    }
  }
};

// Check if user is already logged in
auth.onAuthStateChanged((user) => {
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
        });
    }
  }
});

// Add Enter key support
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('loginEmail').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
  
  document.getElementById('loginPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') login();
  });
});
// file content end