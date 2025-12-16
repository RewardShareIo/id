// file name: admin.js
// file content begin
import { auth, db } from "./firebase.js";
import { signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
  collection, query, where, getDocs, getDoc, doc, updateDoc, 
  addDoc, deleteDoc, orderBy, limit, increment, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentAdmin = null;
let adminData = null;

// Check admin authentication
async function checkAdminAuth() {
  try {
    currentAdmin = auth.currentUser;
    if (!currentAdmin) {
      window.location.href = 'login-admin.html';
      return;
    }

    const adminDoc = await getDoc(doc(db, "users", currentAdmin.uid));
    if (adminDoc.exists()) {
      adminData = adminDoc.data();
      
      // Verify admin role
      if (!adminData.isAdmin && adminData.role !== 'admin') {
        await signOut(auth);
        window.location.href = 'login-admin.html';
        return;
      }
      
      // Update UI
      updateAdminUI();
      
      // Load dashboard data
      loadDashboardData();
      
      // Load initial tab
      loadTab('dashboard');
      
    } else {
      await signOut(auth);
      window.location.href = 'login-admin.html';
    }
  } catch (error) {
    console.error("Error checking admin auth:", error);
    window.location.href = 'login-admin.html';
  }
}

// Update admin UI
function updateAdminUI() {
  // Update admin email
  const adminEmailElement = document.getElementById('adminEmail');
  if (adminEmailElement && adminData) {
    adminEmailElement.textContent = adminData.email || currentAdmin.email;
  }
  
  // Update current time
  updateCurrentTime();
  setInterval(updateCurrentTime, 60000); // Update every minute
}

// Update current time
function updateCurrentTime() {
  const now = new Date();
  const options = { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  };
  document.getElementById('currentTime').textContent = 
    now.toLocaleDateString('id-ID', options);
}

// Show specific tab
async function showTab(tabId) {
  // Update active tab UI
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.nav-btn[onclick*="${tabId}"]`).classList.add('active');
  
  // Hide all tab content
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.classList.remove('active');
  });
  
  // Show selected tab
  document.getElementById(tabId).classList.add('active');
  
  // Load tab data
  await loadTab(tabId);
}

// Load tab data
async function loadTab(tabId) {
  switch (tabId) {
    case 'dashboard':
      await loadDashboardData();
      break;
    case 'payment-methods':
      await loadPaymentMethods();
      break;
    case 'approve-deposits':
      await loadPendingDeposits();
      break;
    case 'approve-advertiser-tasks':
      await loadAdvertiserTasks();
      break;
    case 'create-admin-task':
      await loadRecentAdminTasks();
      break;
    case 'approve-user-proofs':
      await loadPendingUserProofs();
      break;
    case 'approve-withdraw':
      await loadPendingWithdrawals();
      break;
    case 'user-management':
      await loadUsers();
      break;
    case 'system-logs':
      await loadSystemLogs();
      break;
  }
}

// Load dashboard data
async function loadDashboardData() {
  try {
    // Load users count
    const usersSnapshot = await getDocs(collection(db, "users"));
    const totalUsers = usersSnapshot.size;
    const activeUsers = usersSnapshot.docs.filter(doc => 
      doc.data().isActive !== false
    ).length;
    
    document.getElementById('totalUsers').textContent = totalUsers.toLocaleString('id-ID');
    document.getElementById('activeUsers').textContent = activeUsers.toLocaleString('id-ID');
    
    // Calculate total balance
    let totalBalance = 0;
    let lockedBalance = 0;
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      totalBalance += (user.mainBalance || 0) + (user.referralBalance || 0);
      lockedBalance += (user.lockedBalance || 0);
    });
    
    document.getElementById('totalBalance').textContent = formatCurrency(totalBalance);
    document.getElementById('lockedBalance').textContent = formatCurrency(lockedBalance);
    
    // Load tasks count
    const tasksSnapshot = await getDocs(collection(db, "tasks"));
    const totalTasks = tasksSnapshot.size;
    const activeTasks = tasksSnapshot.docs.filter(doc => 
      doc.data().status === 'active'
    ).length;
    
    document.getElementById('totalTasksAdmin').textContent = totalTasks.toLocaleString('id-ID');
    document.getElementById('activeTasks').textContent = activeTasks.toLocaleString('id-ID');
    
    // Load pending counts
    await loadPendingCounts();
    
    // Load quick views
    await loadQuickViews();
    
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    showNotification("Error memuat dashboard", "error");
  }
}

// Load pending counts
async function loadPendingCounts() {
  try {
    // Pending deposits
    const pendingDepositsQuery = query(
      collection(db, "deposits"),
      where("status", "==", "pending")
    );
    const pendingDepositsSnapshot = await getDocs(pendingDepositsQuery);
    const pendingDepositsCount = pendingDepositsSnapshot.size;
    
    // Update badge and total
    const depositBadge = document.getElementById('depositBadge');
    if (depositBadge) {
      depositBadge.textContent = pendingDepositsCount;
      depositBadge.style.display = pendingDepositsCount > 0 ? 'block' : 'none';
    }
    
    // Pending advertiser tasks
    const pendingAdvertiserTasksQuery = query(
      collection(db, "tasks"),
      where("status", "==", "pending"),
      where("isAdminTask", "==", false)
    );
    const pendingAdvertiserTasksSnapshot = await getDocs(pendingAdvertiserTasksQuery);
    const pendingAdvertiserTasksCount = pendingAdvertiserTasksSnapshot.size;
    
    const advertiserTaskBadge = document.getElementById('advertiserTaskBadge');
    if (advertiserTaskBadge) {
      advertiserTaskBadge.textContent = pendingAdvertiserTasksCount;
      advertiserTaskBadge.style.display = pendingAdvertiserTasksCount > 0 ? 'block' : 'none';
    }
    
    // Pending user proofs
    const pendingUserProofsQuery = query(
      collection(db, "taskProofs"),
      where("status", "==", "pending")
    );
    const pendingUserProofsSnapshot = await getDocs(pendingUserProofsQuery);
    const pendingUserProofsCount = pendingUserProofsSnapshot.size;
    
    const userProofBadge = document.getElementById('userProofBadge');
    if (userProofBadge) {
      userProofBadge.textContent = pendingUserProofsCount;
      userProofBadge.style.display = pendingUserProofsCount > 0 ? 'block' : 'none';
    }
    
    // Pending withdrawals
    const pendingWithdrawalsQuery = query(
      collection(db, "withdrawals"),
      where("status", "==", "pending")
    );
    const pendingWithdrawalsSnapshot = await getDocs(pendingWithdrawalsQuery);
    const pendingWithdrawalsCount = pendingWithdrawalsSnapshot.size;
    
    const withdrawBadge = document.getElementById('withdrawBadge');
    if (withdrawBadge) {
      withdrawBadge.textContent = pendingWithdrawalsCount;
      withdrawBadge.style.display = pendingWithdrawalsCount > 0 ? 'block' : 'none';
    }
    
    // Update total pending
    const totalPending = pendingDepositsCount + pendingAdvertiserTasksCount + 
                        pendingUserProofsCount + pendingWithdrawalsCount;
    document.getElementById('totalPending').textContent = totalPending.toLocaleString('id-ID');
    
    // Update counts in dashboard
    document.getElementById('pendingDepositsCount').textContent = pendingDepositsCount;
    document.getElementById('pendingAdvertiserTasksCount').textContent = pendingAdvertiserTasksCount;
    document.getElementById('pendingUserProofsCount').textContent = pendingUserProofsCount;
    
  } catch (error) {
    console.error("Error loading pending counts:", error);
  }
}

// Load quick views
async function loadQuickViews() {
  try {
    // Quick view for pending deposits
    const pendingDepositsQuery = query(
      collection(db, "deposits"),
      where("status", "==", "pending"),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    
    const pendingDepositsSnapshot = await getDocs(pendingDepositsQuery);
    const pendingDepositsContainer = document.getElementById('pendingDepositsQuick');
    
    if (pendingDepositsSnapshot.empty) {
      pendingDepositsContainer.innerHTML = '<p class="text-muted">Tidak ada deposit pending</p>';
    } else {
      let html = '<div style="display: grid; gap: 8px;">';
      pendingDepositsSnapshot.forEach(doc => {
        const deposit = doc.data();
        html += `
          <div style="font-size: 0.9rem;">
            <strong>${deposit.userName || deposit.userEmail}</strong>
            <div style="color: var(--text-muted);">Rp${deposit.amount?.toLocaleString('id-ID') || '0'}</div>
          </div>
        `;
      });
      html += '</div>';
      pendingDepositsContainer.innerHTML = html;
    }
    
    // Quick view for pending advertiser tasks
    const pendingAdvertiserTasksQuery = query(
      collection(db, "tasks"),
      where("status", "==", "pending"),
      where("isAdminTask", "==", false),
      orderBy("createdAt", "desc"),
      limit(3)
    );
    
    const pendingAdvertiserTasksSnapshot = await getDocs(pendingAdvertiserTasksQuery);
    const pendingAdvertiserTasksContainer = document.getElementById('pendingAdvertiserTasksQuick');
    
    if (pendingAdvertiserTasksSnapshot.empty) {
      pendingAdvertiserTasksContainer.innerHTML = '<p class="text-muted">Tidak ada task pending</p>';
    } else {
      let html = '<div style="display: grid; gap: 8px;">';
      pendingAdvertiserTasksSnapshot.forEach(doc => {
        const task = doc.data();
        html += `
          <div style="font-size: 0.9rem;">
            <strong>${task.title?.substring(0, 30) || 'Untitled'}...</strong>
            <div style="color: var(--text-muted);">${task.advertiserName || task.advertiserEmail}</div>
          </div>
        `;
      });
      html += '</div>';
      pendingAdvertiserTasksContainer.innerHTML = html;
    }
    
    // Quick view for pending user proofs
    const pendingUserProofsQuery = query(
      collection(db, "taskProofs"),
      where("status", "==", "pending"),
      orderBy("submittedAt", "desc"),
      limit(3)
    );
    
    const pendingUserProofsSnapshot = await getDocs(pendingUserProofsQuery);
    const pendingUserProofsContainer = document.getElementById('pendingUserProofsQuick');
    
    if (pendingUserProofsSnapshot.empty) {
      pendingUserProofsContainer.innerHTML = '<p class="text-muted">Tidak ada bukti pending</p>';
    } else {
      let html = '<div style="display: grid; gap: 8px;">';
      pendingUserProofsSnapshot.forEach(doc => {
        const proof = doc.data();
        html += `
          <div style="font-size: 0.9rem;">
            <strong>${proof.userName || proof.userEmail}</strong>
            <div style="color: var(--text-muted);">Task: ${proof.taskId?.substring(0, 8)}...</div>
          </div>
        `;
      });
      html += '</div>';
      pendingUserProofsContainer.innerHTML = html;
    }
    
  } catch (error) {
    console.error("Error loading quick views:", error);
  }
}

// Format currency
function formatCurrency(amount) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(amount);
}

// Show notification
function showNotification(message, type = 'info') {
  // Remove old notification
  const oldNotification = document.querySelector('.notification');
  if (oldNotification) {
    oldNotification.remove();
  }

  // Create new notification
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto remove after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Modal functions
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
  }
}

// Logout function
async function logout() {
  try {
    await signOut(auth);
    window.location.href = 'login-admin.html';
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Error saat logout", "error");
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check admin auth
  checkAdminAuth();
  
  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
  
  // Close modal dengan klik di luar
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.style.display = 'none';
      }
    });
  });
});

// Monitor auth state
onAuthStateChanged(auth, (user) => {
  if (!user && window.location.pathname.includes('admin.html')) {
    window.location.href = 'login-admin.html';
  }
});

// Export fungsi ke window object
window.showTab = showTab;
window.showModal = showModal;
window.closeModal = closeModal;
window.logout = logout;

// Note: Fungsi-fungsi spesifik untuk setiap tab (loadPaymentMethods, loadPendingDeposits, dll)
// akan diimplementasikan sesuai kebutuhan masing-masing tab.
// Untuk menjaga agar file tidak terlalu panjang, implementasi lengkap setiap fungsi
// dapat ditambahkan sesuai kebutuhan.

// Contoh implementasi loadPaymentMethods:
async function loadPaymentMethods() {
  // Implementasi loading payment methods
  console.log("Loading payment methods...");
}

async function loadPendingDeposits() {
  // Implementasi loading pending deposits
  console.log("Loading pending deposits...");
}

// ... dan seterusnya untuk fungsi-fungsi lainnya
// file content end