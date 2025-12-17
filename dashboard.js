// file name: dashboard.js
// file content begin
import { auth, db, authInitPromise } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, updateDoc, increment, setDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global variables
let currentUser = null;
let userData = null;

// Load user data
async function loadUserData() {
  try {
    currentUser = auth.currentUser;
    if (!currentUser) {
      // Wait briefly for Firebase auth to initialize (avoid redirect loop on page navigation)
      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
          currentUser = u;
          unsub();
          resolve();
        });
        // fallback timeout
        setTimeout(resolve, 1000);
      });
      if (!currentUser) {
        window.location.href = 'login.html';
        return;
      }
    }

    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (userDoc.exists()) {
      userData = userDoc.data();
      updateDashboardUI();
      checkCheckinStatus();
    } else {
      await signOut(auth);
      window.location.href = 'login.html';
    }
  } catch (error) {
    console.error("Error loading user data:", error);
    showNotification("Error memuat data", "error");
  }
}

// Update dashboard UI
function updateDashboardUI() {
  // Update balances
  document.getElementById('mainBalance').textContent = formatCurrency(userData.mainBalance || 0);
  document.getElementById('referralBalance').textContent = formatCurrency(userData.referralBalance || 0);
  document.getElementById('footerBalance').textContent = formatCurrency(userData.mainBalance || 0);
  
  // Update referral code
  document.getElementById('userReferralCode').textContent = userData.referralCode || '-';
  document.getElementById('modalReferralCode').textContent = userData.referralCode || '-';
  
  // Update referral link
  const referralLink = `${window.location.origin}/register.html?ref=${userData.referralCode}`;
  document.getElementById('referralLink').value = referralLink;
  
  // Update header
  const userRefCodeElement = document.getElementById('userRefCode');
  if (userRefCodeElement && userData.referralCode) {
    userRefCodeElement.querySelector('span:nth-child(2)').textContent = userData.referralCode;
  }
  
  // Load latest data
  loadLatestTasks();
  loadLatestReferrals();
  loadReferralStats();
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Check-in function
window.handleCheckIn = async function() {
  try {
    const today = new Date().toLocaleDateString('id-ID');
    
    // Check if already checked in today
    const checkinQuery = query(
      collection(db, "checkins"),
      where("userId", "==", currentUser.uid),
      where("date", "==", today)
    );
    
    const checkinSnapshot = await getDocs(checkinQuery);
    
    if (!checkinSnapshot.empty) {
      document.getElementById('checkinMessage').innerHTML = 'Kamu sudah <span class="text-success">check-in</span> hari ini!';
      document.getElementById('confirmCheckinBtn').style.display = 'none';
    } else {
      document.getElementById('checkinMessage').innerHTML = 'Kamu mendapatkan <span class="text-success">Rp150</span> hari ini!';
      document.getElementById('confirmCheckinBtn').style.display = 'block';
    }
    
    showModal('checkinModal');
  } catch (error) {
    console.error("Error checking check-in status:", error);
    showNotification("Error memeriksa check-in", "error");
  }
};

// Confirm check-in
async function confirmCheckIn() {
  try {
    const today = new Date().toLocaleDateString('id-ID');
    
    // Update user balance
    await updateDoc(doc(db, "users", currentUser.uid), {
      mainBalance: increment(150),
      totalEarned: increment(150)
    });
    
    // Create check-in record
    await setDoc(doc(collection(db, "checkins")), {
      userId: currentUser.uid,
      date: today,
      reward: 150,
      timestamp: new Date()
    });
    
    // Update local data
    userData.mainBalance = (userData.mainBalance || 0) + 150;
    userData.totalEarned = (userData.totalEarned || 0) + 150;
    
    // Update UI
    updateDashboardUI();
    
    // Show success
    showNotification("Check-in berhasil! +Rp150", "success");
    closeModal('checkinModal');
    
    // Update check-in status
    document.getElementById('checkinStatus').textContent = "✓ Check-in hari ini";
    
  } catch (error) {
    console.error("Error confirming check-in:", error);
    showNotification("Error melakukan check-in", "error");
  }
}

// Check check-in status
async function checkCheckinStatus() {
  try {
    const today = new Date().toLocaleDateString('id-ID');
    const checkinQuery = query(
      collection(db, "checkins"),
      where("userId", "==", currentUser.uid),
      where("date", "==", today)
    );
    
    const checkinSnapshot = await getDocs(checkinQuery);
    
    if (checkinSnapshot.empty) {
      document.getElementById('checkinStatus').textContent = "Belum check-in";
    } else {
      document.getElementById('checkinStatus').textContent = "✓ Check-in hari ini";
    }
  } catch (error) {
    console.error("Error checking check-in status:", error);
  }
}

// Load latest tasks
async function loadLatestTasks() {
  try {
    const tasksQuery = query(
      collection(db, "tasks"),
      where("status", "==", "active"),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    
    const tasksSnapshot = await getDocs(tasksQuery);
    const container = document.getElementById('latestTasks');
    
    if (tasksSnapshot.empty) {
      container.innerHTML = '<p class="text-muted">Belum ada task tersedia</p>';
      return;
    }
    
    let html = '<div style="display: grid; gap: 10px;">';
    tasksSnapshot.forEach(doc => {
      const task = doc.data();
      html += `
        <div style="padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid #0ea5e9;">
          <strong>${task.title}</strong>
          <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 5px;">
            Reward: Rp${task.reward || 0} • Slot: ${task.availableSlots || 0}/${task.slots || 0}
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    console.error("Error loading tasks:", error);
  }
}

// Load latest referrals
async function loadLatestReferrals() {
  try {
    const referralsQuery = query(
      collection(db, "referrals"),
      where("referrerId", "==", currentUser.uid),
      orderBy("date", "desc"),
      limit(3)
    );
    
    const referralsSnapshot = await getDocs(referralsQuery);
    const container = document.getElementById('latestReferrals');
    
    if (referralsSnapshot.empty) {
      container.innerHTML = '<p class="text-muted">Belum ada referral</p>';
      return;
    }
    
    let html = '<div style="display: grid; gap: 10px;">';
    referralsSnapshot.forEach(doc => {
      const referral = doc.data();
      html += `
        <div style="padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; border-left: 4px solid #10b981;">
          <strong>${referral.referredEmail}</strong>
          <div style="font-size: 0.85rem; color: #94a3b8; margin-top: 5px;">
            +Rp250 • ${referral.date ? new Date(referral.date).toLocaleDateString('id-ID') : '-'}
          </div>
        </div>
      `;
    });
    html += '</div>';
    container.innerHTML = html;
  } catch (error) {
    console.error("Error loading referrals:", error);
  }
}

// Load referral stats
async function loadReferralStats() {
  try {
    const referralsQuery = query(
      collection(db, "referrals"),
      where("referrerId", "==", currentUser.uid)
    );
    
    const referralsSnapshot = await getDocs(referralsQuery);
    
    // Update stats
    document.getElementById('totalReferrals').textContent = referralsSnapshot.size;
    document.getElementById('referralEarnings').textContent = formatCurrency(referralsSnapshot.size * 250);
    
  } catch (error) {
    console.error("Error loading referral stats:", error);
  }
}

// Copy referral code
window.copyReferral = function() {
  const referralCode = userData?.referralCode;
  if (referralCode) {
    navigator.clipboard.writeText(referralCode)
      .then(() => showNotification("Kode referral disalin!", "success"))
      .catch(() => showNotification("Gagal menyalin", "error"));
  }
};

// Copy referral link
window.copyReferralLink = function() {
  const referralLink = document.getElementById('referralLink').value;
  if (referralLink) {
    navigator.clipboard.writeText(referralLink)
      .then(() => showNotification("Link referral disalin!", "success"))
      .catch(() => showNotification("Gagal menyalin", "error"));
  }
};

// Copy referral from header
window.copyReferralFromHeader = function() {
  copyReferral();
};

// Check advertiser eligibility
window.checkAdvertiserEligibility = function() {
  if (userData) {
    if (userData.totalDeposit >= 50000) {
      window.location.href = 'create-task.html';
    } else {
      showNotification("Minimal deposit Rp50.000 untuk menjadi advertiser", "warning");
      setTimeout(() => window.location.href = 'deposit.html', 2000);
    }
  }
};

// Modal functions
window.showModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'flex';
};

window.closeModal = function(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.style.display = 'none';
};

// Show notification
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  // Auto remove after 3 seconds
  setTimeout(() => notification.remove(), 3000);
}

// Logout function
window.logout = async function() {
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Error saat logout", "error");
  }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Load user data
  loadUserData();
  
  // Setup check-in confirm button
  const confirmCheckinBtn = document.getElementById('confirmCheckinBtn');
  if (confirmCheckinBtn) {
    confirmCheckinBtn.onclick = confirmCheckIn;
  }
  
  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
  
  // Close modal when clicking outside
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
});

// Monitor auth state (with debug logs)
onAuthStateChanged(auth, async (user) => {
  await authInitPromise;
  console.log('dashboard:onAuthStateChanged', user ? user.uid : null, 'path', window.location.pathname);
  if (!user && window.location.pathname.includes('dashboard.html')) {
    window.location.href = 'login.html';
  }
});
// file content end