// file name: admin.js
// file content begin
import { auth, db, authInitPromise } from "./firebase.js";
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
    console.log('admin: checkAdminAuth start, waiting authInit...');
    // Wait for Firebase auth initialization
    await authInitPromise;

    currentAdmin = auth.currentUser;
    console.log('admin: currentAdmin after init', currentAdmin && currentAdmin.uid);

    // If no currentAdmin, wait briefly for any incoming auth state
    if (!currentAdmin) {
      await new Promise((resolve) => {
        let resolved = false;
        const timeout = setTimeout(() => {
          if (!resolved) { resolved = true; resolve(); }
        }, 1500);
        const unsub = onAuthStateChanged(auth, (u) => {
          if (u && !resolved) {
            currentAdmin = u;
            resolved = true;
            clearTimeout(timeout);
            unsub();
            resolve();
          }
        });
      });

      if (!currentAdmin) {
        // If the user just came from an admin redirect, give a bit more time before redirecting
        const lastJustRedirect = parseInt(sessionStorage.getItem('justAdminRedirect') || '0', 10);
        if (Date.now() - lastJustRedirect < 3000) {
          console.warn('admin: recent justAdminRedirect found, waiting briefly before final redirect');
          await new Promise(r => setTimeout(r, 1200));
          currentAdmin = auth.currentUser;
        }

        if (!currentAdmin) {
          // Final check failed, redirect to login-admin
          window.location.href = 'login-admin.html';
          return;
        }
      }
    }

    const adminDoc = await getDoc(doc(db, "users", currentAdmin.uid));
    if (adminDoc.exists()) {
      adminData = adminDoc.data();
      
      // Verify admin role
      if (!adminData.isAdmin && adminData.role !== 'admin') {
        // mark last admin signout to avoid immediate redirect loops
        try { sessionStorage.setItem('lastAdminSignout', Date.now().toString()); } catch (e) {}
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
      try { sessionStorage.setItem('lastAdminSignout', Date.now().toString()); } catch (e) {}
      await signOut(auth);
      window.location.href = 'login-admin.html';
    }
  } catch (error) {
    console.error("Error checking admin auth:", error);
    // do not immediately redirect when there is a transient error; show notification instead
    showNotification("Error memeriksa admin: " + (error.message || error), "error");
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
  const currentTimeEl = document.getElementById('currentTime');
  if (currentTimeEl) {
    currentTimeEl.textContent = now.toLocaleDateString('id-ID', options);
  }
}

// Show specific tab
async function showTab(tabId) {
  // Update active tab UI
  document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
  const activeNavBtn = document.querySelector(`.nav-btn[onclick*="${tabId}"]`);
  if (activeNavBtn) activeNavBtn.classList.add('active');
  
  // Hide all tab content
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  
  // Show selected tab (guard)
  const tabEl = document.getElementById(tabId);
  if (tabEl) tabEl.classList.add('active');
  
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
    
    const totalUsersEl = document.getElementById('totalUsers');
    if (totalUsersEl) totalUsersEl.textContent = totalUsers.toLocaleString('id-ID');
    const activeUsersEl = document.getElementById('activeUsers');
    if (activeUsersEl) activeUsersEl.textContent = activeUsers.toLocaleString('id-ID');
    
    // Calculate total balance
    let totalBalance = 0;
    let lockedBalance = 0;
    usersSnapshot.forEach(doc => {
      const user = doc.data();
      totalBalance += (user.mainBalance || 0) + (user.referralBalance || 0);
      lockedBalance += (user.lockedBalance || 0);
    });
    
    const totalBalanceEl = document.getElementById('totalBalance');
    if (totalBalanceEl) totalBalanceEl.textContent = formatCurrency(totalBalance);
    const lockedBalanceEl = document.getElementById('lockedBalance');
    if (lockedBalanceEl) lockedBalanceEl.textContent = formatCurrency(lockedBalance);
    
    // Load tasks count
    const tasksSnapshot = await getDocs(collection(db, "tasks"));
    const totalTasks = tasksSnapshot.size;
    const activeTasks = tasksSnapshot.docs.filter(doc => 
      doc.data().status === 'active'
    ).length;
    
    const totalTasksAdminEl = document.getElementById('totalTasksAdmin');
    if (totalTasksAdminEl) totalTasksAdminEl.textContent = totalTasks.toLocaleString('id-ID');
    const activeTasksEl = document.getElementById('activeTasks');
    if (activeTasksEl) activeTasksEl.textContent = activeTasks.toLocaleString('id-ID');
    
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
    const totalPendingEl = document.getElementById('totalPending');
    if (totalPendingEl) totalPendingEl.textContent = totalPending.toLocaleString('id-ID');
    
    // Update counts in dashboard
    const pendingDepositsCountEl = document.getElementById('pendingDepositsCount');
    if (pendingDepositsCountEl) pendingDepositsCountEl.textContent = pendingDepositsCount;
    const pendingAdvertiserTasksCountEl = document.getElementById('pendingAdvertiserTasksCount');
    if (pendingAdvertiserTasksCountEl) pendingAdvertiserTasksCountEl.textContent = pendingAdvertiserTasksCount;
    const pendingUserProofsCountEl = document.getElementById('pendingUserProofsCount');
    if (pendingUserProofsCountEl) pendingUserProofsCountEl.textContent = pendingUserProofsCount;
    
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
onAuthStateChanged(auth, async (user) => {
  await authInitPromise;
  if (!user && window.location.pathname.includes('admin.html')) {
    window.location.href = 'login-admin.html';
  }
});

// Export fungsi ke window object
window.showTab = showTab;
window.showModal = showModal;
window.closeModal = closeModal;
window.logout = logout;

// Expose admin actions to window for UI
window.approveDeposit = approveDeposit;
window.rejectDeposit = rejectDeposit;
window.approveWithdraw = approveWithdraw;
window.approveTaskProof = approveTaskProof;
window.rejectTaskProof = rejectTaskProof;

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

// Approve a deposit (admin)
async function approveDeposit(depositId) {
  try {
    if (!confirm('Approve deposit ini?')) return;
    const depositRef = doc(db, 'deposits', depositId);
    const depSnap = await getDoc(depositRef);
    if (!depSnap.exists()) throw new Error('Deposit tidak ditemukan');
    const deposit = depSnap.data();

    // Update deposit status
    await updateDoc(depositRef, {
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: currentAdmin.uid,
      lockedUntil: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    });

    // Add to user's locked balance
    const userRef = doc(db, 'users', deposit.userId);
    await updateDoc(userRef, {
      lockedBalance: increment(deposit.amount),
      totalDeposit: increment(deposit.amount)
    });

    showNotification('Deposit disetujui dan saldo dikunci selama 3 hari', 'success');
    await loadPendingDeposits();
  } catch (error) {
    console.error('Error approving deposit:', error);
    showNotification('Gagal approve deposit: ' + error.message, 'error');
  }
}

// Reject a deposit
async function rejectDeposit(depositId, reason = '') {
  try {
    if (!confirm('Reject deposit ini?')) return;
    const depositRef = doc(db, 'deposits', depositId);
    await updateDoc(depositRef, {
      status: 'rejected',
      rejectedAt: new Date(),
      rejectedBy: currentAdmin.uid,
      rejectedReason: reason
    });
    showNotification('Deposit ditolak', 'success');
    await loadPendingDeposits();
  } catch (error) {
    console.error('Error rejecting deposit:', error);
    showNotification('Gagal reject deposit: ' + error.message, 'error');
  }
}

// Approve a withdrawal
async function approveWithdraw(withdrawId) {
  try {
    if (!confirm('Approve withdrawal ini?')) return;
    const wRef = doc(db, 'withdrawals', withdrawId);
    const wSnap = await getDoc(wRef);
    if (!wSnap.exists()) throw new Error('Withdraw tidak ditemukan');
    const withdraw = wSnap.data();

    const userRef = doc(db, 'users', withdraw.userId);
    const userSnap = await getDoc(userRef);
    const user = userSnap.exists() ? userSnap.data() : null;

    if (!user || (user.mainBalance || 0) < withdraw.amount) {
      throw new Error('Saldo user tidak mencukupi');
    }

    // Deduct user balance and mark withdraw approved
    await updateDoc(userRef, {
      mainBalance: increment(-withdraw.amount),
      totalWithdrawn: increment(withdraw.amount)
    });

    await updateDoc(wRef, {
      status: 'approved',
      approvedAt: new Date(),
      approvedBy: currentAdmin.uid
    });

    showNotification('Withdraw disetujui', 'success');
    await loadPendingWithdrawals();
  } catch (error) {
    console.error('Error approving withdraw:', error);
    showNotification('Gagal approve withdraw: ' + error.message, 'error');
  }
}

// Approve task proof (reward worker)
async function approveTaskProof(proofId) {
  try {
    if (!confirm('Approve bukti task ini?')) return;
    const proofRef = doc(db, 'taskProofs', proofId);
    const pSnap = await getDoc(proofRef);
    if (!pSnap.exists()) throw new Error('Proof tidak ditemukan');
    const proof = pSnap.data();

    // Get task to know reward
    const taskRef = doc(db, 'tasks', proof.taskId);
    const tSnap = await getDoc(taskRef);
    const task = tSnap.exists() ? tSnap.data() : null;
    const reward = task ? (task.reward || 0) : 0;

    // Update proof
    await updateDoc(proofRef, {
      status: 'approved',
      reward: reward,
      reviewedAt: new Date(),
      reviewedBy: currentAdmin.uid
    });

    // Credit user
    const userRef = doc(db, 'users', proof.userId);
    await updateDoc(userRef, {
      mainBalance: increment(reward),
      totalEarned: increment(reward)
    });

    showNotification('Bukti task disetujui dan reward diberikan', 'success');
    await loadPendingUserProofs();
  } catch (error) {
    console.error('Error approving proof:', error);
    showNotification('Gagal approve proof: ' + error.message, 'error');
  }
}

// Reject task proof
async function rejectTaskProof(proofId, reason = '') {
  try {
    if (!confirm('Reject bukti task ini?')) return;
    const proofRef = doc(db, 'taskProofs', proofId);
    await updateDoc(proofRef, {
      status: 'rejected',
      reviewedAt: new Date(),
      reviewedBy: currentAdmin.uid,
      rejectReason: reason
    });
    showNotification('Bukti task ditolak', 'success');
    await loadPendingUserProofs();
  } catch (error) {
    console.error('Error rejecting proof:', error);
    showNotification('Gagal reject proof: ' + error.message, 'error');
  }
}

// Index helper functions for admin
function openIndexConsole() {
  try {
    const url = 'https://console.firebase.google.com/project/_/firestore/indexes';
    window.open(url, '_blank');
  } catch (e) {
    console.error('Failed to open Firebase Console:', e);
    showNotification('Gagal membuka Firebase Console', 'error');
  }
}

function copyIndexSpec(name) {
  const specs = {
    deposits: JSON.stringify({
      collectionId: 'deposits',
      fields: [{fieldPath: 'userId', order: null}, {fieldPath: 'createdAt', order: 'desc'}]
    }, null, 2),
    withdrawals: JSON.stringify({
      collectionId: 'withdrawals',
      fields: [{fieldPath: 'userId', order: null}, {fieldPath: 'createdAt', order: 'desc'}]
    }, null, 2),
    taskProofs: JSON.stringify({
      collectionId: 'taskProofs',
      fields: [{fieldPath: 'userId', order: null}, {fieldPath: 'submittedAt', order: 'desc'}]
    }, null, 2),
    referrals: JSON.stringify({
      collectionId: 'referrals',
      fields: [{fieldPath: 'referrerId', order: null}, {fieldPath: 'date', order: 'desc'}]
    }, null, 2)
  };

  const text = specs[name] || '';
  if (!text) {
    showNotification('Spec index tidak ditemukan', 'error');
    return;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('Spec index disalin ke clipboard', 'success');
    }).catch((err) => {
      console.error('Clipboard write failed:', err);
      showNotification('Gagal menyalin ke clipboard', 'error');
    });
  } else {
    // Fallback
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      showNotification('Spec index disalin ke clipboard', 'success');
    } catch (e) {
      console.error('Fallback copy failed:', e);
      showNotification('Gagal menyalin spec index', 'error');
    }
    ta.remove();
  }
}

// Expose index helpers to window for buttons
window.openIndexConsole = openIndexConsole;
window.copyIndexSpec = copyIndexSpec;

// ... dan seterusnya untuk fungsi-fungsi lainnya
// file content end