// file name: register.js
// file content begin
import { auth, db } from "./firebase.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, setDoc, getDocs, collection, query, where, updateDoc, arrayUnion, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Generate random referral code
function generateReferralCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Register function
window.register = async function() {
  const emailEl = document.getElementById('regEmail');
  const usernameEl = document.getElementById('regUsername');
  const passwordEl = document.getElementById('regPassword');
  const confirmEl = document.getElementById('regConfirm');
  const referralEl = document.getElementById('regReferral');
  const regMsg = document.getElementById('regMsg');

  if (!emailEl || !usernameEl || !passwordEl || !confirmEl) {
    if (regMsg) regMsg.textContent = 'Form registrasi tidak ditemukan';
    return;
  }

  const email = emailEl.value.trim();
  const username = usernameEl.value.trim();
  const password = passwordEl.value;
  const confirmPassword = confirmEl.value;
  const referralCode = referralEl ? referralEl.value.trim().toUpperCase() : '';

  // Reset message
  regMsg.textContent = '';
  regMsg.className = 'text-danger';

  // Validation
  if (!email || !username || !password || !confirmPassword) {
    regMsg.textContent = "Semua field wajib diisi";
    return;
  }

  if (password.length < 6) {
    regMsg.textContent = "Password minimal 6 karakter";
    return;
  }

  if (password !== confirmPassword) {
    regMsg.textContent = "Password tidak cocok";
    return;
  }

  if (username.length < 3) {
    regMsg.textContent = "Username minimal 3 karakter";
    return;
  }

  try {
    // Show loading
    const registerBtn = document.querySelector('.btn-primary');
    const originalText = registerBtn ? registerBtn.textContent : null;
    if (registerBtn) {
      registerBtn.textContent = "Mendaftar...";
      registerBtn.disabled = true;
    }

    // Check if email already exists
    const emailQuery = query(collection(db, "users"), where("email", "==", email));
    const emailSnapshot = await getDocs(emailQuery);
    
    if (!emailSnapshot.empty) {
      regMsg.textContent = "Email sudah terdaftar";
      registerBtn.textContent = originalText;
      registerBtn.disabled = false;
      return;
    }

    // Check if username already exists
    const usernameQuery = query(collection(db, "users"), where("username", "==", username));
    const usernameSnapshot = await getDocs(usernameQuery);
    
    if (!usernameSnapshot.empty) {
      regMsg.textContent = "Username sudah digunakan";
      registerBtn.textContent = originalText;
      registerBtn.disabled = false;
      return;
    }

    // Device restriction: one device one account
    try {
      const deviceQuery = query(collection(db, 'users'), where('deviceInfo.userAgent', '==', navigator.userAgent));
      const deviceSnap = await getDocs(deviceQuery);
      if (!deviceSnap.empty) {
        regMsg.textContent = 'Satu device hanya boleh satu akun';
        if (registerBtn) {
          registerBtn.textContent = originalText;
          registerBtn.disabled = false;
        }
        return;
      }
    } catch (deviceErr) {
      // ignore device check errors
      console.warn('Device check failed', deviceErr);
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Generate referral code
    const userReferralCode = generateReferralCode();

    // Create user document in Firestore
    const userData = {
      uid: user.uid,
      email: email,
      username: username,
      referralCode: userReferralCode,
      role: 'user',
      isAdmin: false,
      mainBalance: 0,
      referralBalance: 0,
      lockedBalance: 0,
      totalEarned: 0,
      totalWithdrawn: 0,
      totalDeposit: 0,
      referralCount: 0,
      referrals: [],
      isActive: true,
      createdAt: new Date(),
      lastLogin: new Date(),
      deviceInfo: {
        userAgent: navigator.userAgent,
        platform: navigator.platform
      }
    };

    await setDoc(doc(db, "users", user.uid), userData);

    // Process referral if provided
    if (referralCode) {
      try {
        // Find referrer by referral code
        const referrerQuery = query(collection(db, "users"), where("referralCode", "==", referralCode));
        const referrerSnapshot = await getDocs(referrerQuery);
        
        if (!referrerSnapshot.empty) {
          const referrerDoc = referrerSnapshot.docs[0];
          const referrerId = referrerDoc.id;
          const referrerData = referrerDoc.data();
          
          // Update referrer's data
          await updateDoc(doc(db, "users", referrerId), {
            referralBalance: increment(250),
            referralCount: increment(1),
            referrals: arrayUnion({
              userId: user.uid,
              email: email,
              username: username,
              date: new Date(),
              reward: 250
            })
          });

          // Create referral record
          await setDoc(doc(collection(db, "referrals")), {
            referrerId: referrerId,
            referrerEmail: referrerData.email,
            referrerName: referrerData.username,
            referredUserId: user.uid,
            referredEmail: email,
            referredUsername: username,
            reward: 250,
            date: new Date(),
            status: 'completed'
          });
        }
      } catch (referralError) {
        console.error("Referral error:", referralError);
        // Continue registration even if referral fails
      }
    }

    // Show success message
    regMsg.textContent = "Registrasi berhasil! Mengarahkan ke dashboard...";
    regMsg.className = 'text-success';

    // Redirect to dashboard after 2 seconds
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2000);

  } catch (error) {
    console.error("Registration error:", error);
    
    // Reset button
    const registerBtn = document.querySelector('.btn-primary');
    if (registerBtn) {
      registerBtn.textContent = "Daftar";
      registerBtn.disabled = false;
    }
    
    // Show error message
    switch(error.code) {
      case 'auth/email-already-in-use':
        regMsg.textContent = "Email sudah terdaftar";
        break;
      case 'auth/invalid-email':
        regMsg.textContent = "Format email tidak valid";
        break;
      case 'auth/weak-password':
        regMsg.textContent = "Password terlalu lemah";
        break;
      case 'auth/operation-not-allowed':
        regMsg.textContent = "Registrasi dinonaktifkan sementara";
        break;
      default:
        regMsg.textContent = "Terjadi kesalahan: " + error.message;
    }
  }
};

// Add Enter key support
document.addEventListener('DOMContentLoaded', () => {
  const inputs = ['regEmail', 'regUsername', 'regPassword', 'regConfirm', 'regReferral'];
  
  inputs.forEach(inputId => {
    document.getElementById(inputId).addEventListener('keypress', (e) => {
      if (e.key === 'Enter') register();
    });
  });
});
// file content end