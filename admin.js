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
    if (window.appendAuthDebug) window.appendAuthDebug('admin: checkAdminAuth start');
    // Wait for Firebase auth initialization
    await authInitPromise;

    currentAdmin = auth.currentUser;
    console.log('admin: currentAdmin after init', currentAdmin && currentAdmin.uid);
    if (window.appendAuthDebug) window.appendAuthDebug('admin: currentAdmin after init: ' + (currentAdmin && currentAdmin.uid));

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
          if (window.appendAuthDebug) window.appendAuthDebug('admin: recent justAdminRedirect detected, sleeping briefly');
          await new Promise(r => setTimeout(r, 1200));
          currentAdmin = auth.currentUser;
        }

        if (!currentAdmin) {
          // Final check failed, redirect to login-admin
          if (window.appendAuthDebug) window.appendAuthDebug('admin: final no-currentAdmin, redirecting to login-admin');
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
        if (window.appendAuthDebug) window.appendAuthDebug('admin: signing out non-admin user: ' + currentAdmin.uid);
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
window.loadPendingDeposits = loadPendingDeposits;

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
  try {
    const searchText = (document.getElementById('searchDeposit')?.value || '').toLowerCase().trim();
    const statusFilter = document.getElementById('filterDepositStatus')?.value || 'pending';

    // Build query
    let depositsQuery;
    if (statusFilter === 'all') {
      depositsQuery = query(collection(db, 'deposits'), orderBy('createdAt', 'desc'), limit(100));
    } else {
      depositsQuery = query(collection(db, 'deposits'), where('status', '==', statusFilter), orderBy('createdAt', 'desc'), limit(100));
    }

    const snapshot = await getDocs(depositsQuery);
    const deposits = [];
    snapshot.forEach(d => deposits.push({ id: d.id, ...d.data() }));

    // Client-side search filtering
    const filtered = deposits.filter(dep => {
      if (!searchText) return true;
      const code = String(dep.depositCode || '').toLowerCase();
      const email = String(dep.userEmail || '').toLowerCase();
      const name = String(dep.userName || '').toLowerCase();
      return code.includes(searchText) || email.includes(searchText) || name.includes(searchText);
    });

    const container = document.getElementById('depositsContainer');
    if (!container) return;

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: var(--space-2xl);">
          <div style="font-size: 3rem; margin-bottom: var(--space-md);">✅</div>
          <h3>Tidak ada deposit sesuai filter</h3>
          <p class="text-muted">Gunakan kata kunci lain atau periksa filter status</p>
        </div>
      `;
      return;
    }

    let html = '<div style="display: grid; gap: 12px;">';
    for (const dep of filtered) {
      const date = dep.createdAt?.toDate ? dep.createdAt.toDate().toLocaleString('id-ID') : (dep.createdAt || '-');
      const statusClass = dep.status === 'approved' ? 'status-approved' : dep.status === 'rejected' ? 'status-rejected' : 'status-pending';
      html += `
        <div class="pending-item" style="align-items: center;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="font-weight:700;">${dep.depositCode || '-'} <span class="badge ${statusClass}">${dep.status}</span></div>
              <div style="color:var(--text-muted);">${date}</div>
            </div>
            <div style="margin-top:6px; color:var(--text-muted);">
              <div><strong>Pengirim:</strong> ${dep.userName || dep.userEmail || '-'}</div>
              <div><strong>Jumlah:</strong> Rp${(dep.amount || 0).toLocaleString('id-ID')}</div>
              <div><strong>Metode:</strong> ${dep.method || '-'}</div>
            </div>
          </div>
          <div style="display:flex; gap:8px; align-items:center;">
            ${dep.proofUrl ? `<a href="${dep.proofUrl}" target="_blank" class="btn btn-sm btn-outline">👁️ Lihat Bukti</a>` : ''}
            <button class="btn btn-sm btn-success" onclick="approveDeposit('${dep.id}')">Approve</button>
            <button class="btn btn-sm btn-danger" onclick="(function(){ const reason = prompt('Alasan reject (opsional):'); window.rejectDeposit('${dep.id}', reason); })()">Reject</button>
          </div>
        </div>
      `;
    }
    html += '</div>';
    container.innerHTML = html;

    if (window.appendAuthDebug) window.appendAuthDebug('loadPendingDeposits: loaded ' + filtered.length + ' items');
  } catch (error) {
    console.error('Error loading pending deposits:', error);
    showNotification('Gagal memuat deposits: ' + (error.message || error), 'error');
  }
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

    // Log admin action
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'approveDeposit',
        targetId: depositId,
        details: { userId: deposit.userId, amount: deposit.amount },
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

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

    // Log admin action
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'rejectDeposit',
        targetId: depositId,
        details: { reason },
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

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

// Implementations for tabs and admin actions (basic functionality)
// These provide a minimal, useful admin UX and can be extended later

async function loadAdvertiserTasks() {
  try {
    const tasksSnapshot = await getDocs(query(collection(db, 'tasks'), orderBy('createdAt', 'desc'), limit(100)));
    const tasks = [];
    tasksSnapshot.forEach(d => tasks.push({ id: d.id, ...d.data() }));
    const container = document.getElementById('approve-advertiser-tasks') || document.getElementById('approve-advertiser-tasks');
    // For now, show a quick list in recentAdminTasks area if specific container not found
    const target = document.getElementById('recentAdminTasks') || container;
    if (!target) return;
    if (tasks.length === 0) {
      target.innerHTML = `<div class="empty-state" style="text-align:center; padding:var(--space-2xl);">
        <div style="font-size:3rem; margin-bottom:var(--space-md);">📭</div>
        <h3>Tidak ada task advertiser</h3>
        <p class="text-muted">Tidak ditemukan task dari advertiser saat ini</p>
      </div>`;
      return;
    }
    let html = '<div style="display:grid; gap:12px;">';
    for (const t of tasks.slice(0, 30)) {
      const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('id-ID') : (t.createdAt || '-');
      html += `<div class="pending-item">
        <div style="flex:1;">
          <div style="font-weight:700;">${escapeHtml(t.title || '(no title)')}</div>
          <div style="color:var(--text-muted);">${date} • ${t.userEmail || t.userId || ''}</div>
        </div>
      </div>`;
    }
    html += '</div>';
    target.innerHTML = html;
    if (window.appendAuthDebug) window.appendAuthDebug('loadAdvertiserTasks: loaded ' + tasks.length + ' items');
  } catch (error) {
    console.error('Error loading advertiser tasks:', error);
    showNotification('Gagal memuat advertiser tasks', 'error');
  }
}

async function loadRecentAdminTasks() {
  try {
    const q = query(collection(db, 'adminTasks'), orderBy('createdAt', 'desc'), limit(30));
    const snapshot = await getDocs(q);
    const tasks = [];
    snapshot.forEach(d => tasks.push({ id: d.id, ...d.data() }));
    const target = document.getElementById('recentAdminTasks');
    if (!target) return;
    if (tasks.length === 0) {
      target.innerHTML = `<div class="text-muted">Belum ada task admin terbaru</div>`;
      return;
    }
    let html = '<div style="display:grid; gap:12px;">';
    for (const t of tasks) {
      const date = t.createdAt?.toDate ? t.createdAt.toDate().toLocaleString('id-ID') : (t.createdAt || '-');
      html += `<div class="pending-item">
        <div style="flex:1;">
          <div style="font-weight:700;">${escapeHtml(t.title || '(no title)')}</div>
          <div style="color:var(--text-muted);">${date}</div>
        </div>
      </div>`;
    }
    html += '</div>';
    target.innerHTML = html;
    if (window.appendAuthDebug) window.appendAuthDebug('loadRecentAdminTasks: loaded ' + tasks.length + ' items');
  } catch (error) {
    console.error('Error loading recent admin tasks:', error);
  }
}

async function loadPendingUserProofs() {
  try {
    const proofType = document.getElementById('filterProofType')?.value || '';
    const statusFilter = document.getElementById('filterProofStatus')?.value || 'pending';
    let q;
    if (statusFilter === 'all') {
      q = query(collection(db, 'taskProofs'), orderBy('submittedAt', 'desc'), limit(100));
    } else {
      q = query(collection(db, 'taskProofs'), where('status', '==', statusFilter), orderBy('submittedAt', 'desc'), limit(100));
    }
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
    // Client-side proof type filter
    const filtered = proofType ? items.filter(i => i.taskType === proofType) : items;
    const container = document.getElementById('userProofsContainer');
    if (!container) return;
    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state" style="text-align:center; padding:var(--space-2xl);">
        <div style="font-size:3rem; margin-bottom:var(--space-md);">📝</div>
        <h3>Tidak ada bukti task sesuai filter</h3>
        <p class="text-muted">Gunakan filter atau coba lagi nanti</p>
      </div>`;
      return;
    }
    let html = '<div style="display:grid; gap:12px;">';
    for (const it of filtered) {
      const date = it.submittedAt?.toDate ? it.submittedAt.toDate().toLocaleString('id-ID') : (it.submittedAt || '-');
      html += `<div class="pending-item" style="align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:700;">${escapeHtml(it.taskTitle || it.taskType || 'Task')}</div>
          <div style="color:var(--text-muted);">${it.userEmail || it.userId || '-'} • ${date}</div>
          ${it.proofUrl ? `<div style="margin-top:6px;"><a href="${it.proofUrl}" target="_blank">Lihat bukti</a></div>` : ''}
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm btn-success" onclick="approveProof('${it.id}')">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="(function(){ const reason = prompt('Alasan reject (opsional):'); window.rejectProof('${it.id}', reason); })()">Reject</button>
        </div>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    if (window.appendAuthDebug) window.appendAuthDebug('loadPendingUserProofs: loaded ' + filtered.length + ' items');
  } catch (error) {
    console.error('Error loading user proofs:', error);
    showNotification('Gagal memuat bukti task', 'error');
  }
}

async function approveProof(proofId) {
  try {
    if (!confirm('Approve bukti task ini?')) return;
    const proofRef = doc(db, 'taskProofs', proofId);
    const snap = await getDoc(proofRef);
    if (!snap.exists()) throw new Error('Proof tidak ditemukan');
    await updateDoc(proofRef, { status: 'approved', approvedAt: new Date(), approvedBy: currentAdmin.uid });

    // Log admin action
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'approveProof',
        targetId: proofId,
        details: { proofId },
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

    showNotification('Proof disetujui', 'success');
    await loadPendingUserProofs();
  } catch (error) {
    console.error('Error approving proof:', error);
    showNotification('Gagal approve proof: ' + (error.message || error), 'error');
  }
}

async function rejectProof(proofId, reason = '') {
  try {
    if (!confirm('Reject bukti task ini?')) return;
    const proofRef = doc(db, 'taskProofs', proofId);
    await updateDoc(proofRef, { status: 'rejected', rejectedAt: new Date(), rejectedBy: currentAdmin.uid, rejectedReason: reason });

    // Log admin action
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'rejectProof',
        targetId: proofId,
        details: { reason },
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

    showNotification('Proof ditolak', 'success');
    await loadPendingUserProofs();
  } catch (error) {
    console.error('Error rejecting proof:', error);
    showNotification('Gagal reject proof: ' + (error.message || error), 'error');
  }
}

async function loadPendingWithdrawals() {
  try {
    const q = query(collection(db, 'withdrawals'), where('status', '==', 'pending'), orderBy('createdAt', 'desc'), limit(100));
    const snapshot = await getDocs(q);
    const items = [];
    snapshot.forEach(d => items.push({ id: d.id, ...d.data() }));
    const container = document.getElementById('withdrawalsContainer');
    if (!container) return;
    if (items.length === 0) {
      container.innerHTML = `<div class="empty-state" style="text-align:center; padding:var(--space-2xl);">
        <div style="font-size:3rem; margin-bottom:var(--space-md);">💰</div>
        <h3>Tidak ada withdraw pending</h3>
        <p class="text-muted">Semua permintaan penarikan sudah diproses</p>
      </div>`;
      return;
    }
    let html = '<div style="display:grid; gap:12px;">';
    for (const w of items) {
      const date = w.createdAt?.toDate ? w.createdAt.toDate().toLocaleString('id-ID') : (w.createdAt || '-');
      html += `<div class="pending-item" style="align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:700;">${w.userEmail || w.userId || '-'} <span class="badge status-pending">${w.status}</span></div>
          <div style="color:var(--text-muted);">${date}</div>
          <div style="margin-top:6px; color:var(--text-muted);">Jumlah: Rp${(w.amount || 0).toLocaleString('id-ID')}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          <button class="btn btn-sm btn-success" onclick="approveWithdraw('${w.id}')">Approve</button>
          <button class="btn btn-sm btn-danger" onclick="(function(){ const reason = prompt('Alasan reject (opsional):'); window.rejectWithdraw('${w.id}', reason); })()">Reject</button>
        </div>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    if (window.appendAuthDebug) window.appendAuthDebug('loadPendingWithdrawals: loaded ' + items.length + ' items');
  } catch (error) {
    console.error('Error loading pending withdrawals:', error);
    showNotification('Gagal memuat withdrawals', 'error');
  }
}

async function approveWithdraw(withdrawId) {
  try {
    if (!confirm('Approve permintaan withdraw ini?')) return;
    const wRef = doc(db, 'withdrawals', withdrawId);
    const wSnap = await getDoc(wRef);
    if (!wSnap.exists()) throw new Error('Withdrawal not found');
    const w = wSnap.data();

    // Mark approved
    await updateDoc(wRef, { status: 'approved', approvedAt: new Date(), approvedBy: currentAdmin.uid });

    // Deduct user balance
    const userRef = doc(db, 'users', w.userId);
    await updateDoc(userRef, { mainBalance: increment((w.amount || 0) * -1), totalWithdraw: increment(w.amount || 0) });

    // Log admin action
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'approveWithdraw',
        targetId: withdrawId,
        details: { userId: w.userId, amount: w.amount },
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

    showNotification('Withdrawal disetujui', 'success');
    await loadPendingWithdrawals();
  } catch (error) {
    console.error('Error approving withdrawal:', error);
    showNotification('Gagal approve withdrawal: ' + (error.message || error), 'error');
  }
}

async function rejectWithdraw(withdrawId, reason = '') {
  try {
    if (!confirm('Reject permintaan withdraw ini?')) return;
    const wRef = doc(db, 'withdrawals', withdrawId);
    await updateDoc(wRef, { status: 'rejected', rejectedAt: new Date(), rejectedBy: currentAdmin.uid, rejectedReason: reason });

    // Log admin action
    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'rejectWithdraw',
        targetId: withdrawId,
        details: { reason },
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

    showNotification('Withdrawal ditolak', 'success');
    await loadPendingWithdrawals();
  } catch (error) {
    console.error('Error rejecting withdrawal:', error);
    showNotification('Gagal reject withdrawal: ' + (error.message || error), 'error');
  }
}

async function loadUsers() {
  try {
    const roleFilter = document.getElementById('filterUserRole')?.value || 'all';
    const searchText = (document.getElementById('searchUser')?.value || '').toLowerCase().trim();
    let q = query(collection(db, 'users'), orderBy('email', 'asc'), limit(200));
    const snapshot = await getDocs(q);
    const users = [];
    snapshot.forEach(d => users.push({ id: d.id, ...d.data() }));
    const filtered = users.filter(u => {
      if (roleFilter !== 'all' && (u.role || 'user') !== roleFilter) return false;
      if (!searchText) return true;
      return (u.email || '').toLowerCase().includes(searchText) || (u.username || '').toLowerCase().includes(searchText) || (u.id || '').toLowerCase().includes(searchText);
    });
    const container = document.getElementById('usersContainer');
    if (!container) return;
    if (filtered.length === 0) {
      container.innerHTML = `<div class="empty-state" style="text-align:center; padding:var(--space-2xl);">
        <div style="font-size:3rem; margin-bottom:var(--space-md);">👤</div>
        <h3>Tidak ada user sesuai filter</h3>
        <p class="text-muted">Gunakan kata kunci lain atau periksa filter</p>
      </div>`;
      return;
    }
    let html = '<div style="display:grid; gap:12px;">';
    for (const u of filtered) {
      html += `<div class="pending-item" style="align-items:center;">
        <div style="flex:1;">
          <div style="font-weight:700;">${escapeHtml(u.email || u.username || u.id)}</div>
          <div style="color:var(--text-muted);">Role: ${u.role || 'user'} • Balance: Rp${formatCurrency(u.mainBalance || 0)}</div>
        </div>
        <div style="display:flex; gap:8px; align-items:center;">
          ${u.role !== 'admin' ? `<button class="btn btn-sm" onclick="makeAdmin('${u.id}')">Make Admin</button>` : `<button class="btn btn-sm btn-outline" onclick="revokeAdmin('${u.id}')">Revoke Admin</button>`}
          <button class="btn btn-sm btn-outline" onclick="viewUser('${u.id}')">Detail</button>
        </div>
      </div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    if (window.appendAuthDebug) window.appendAuthDebug('loadUsers: loaded ' + filtered.length + ' users');
  } catch (error) {
    console.error('Error loading users:', error);
    showNotification('Gagal memuat users: ' + (error.message || error), 'error');
  }
}

async function makeAdmin(userId) {
  try {
    if (!confirm('Jadikan user ini admin?')) return;
    const uRef = doc(db, 'users', userId);
    await updateDoc(uRef, { role: 'admin', isAdmin: true });

    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'makeAdmin',
        targetId: userId,
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

    showNotification('User dijadikan admin', 'success');
    await loadUsers();
  } catch (error) {
    console.error('Error making admin:', error);
    showNotification('Gagal mengubah role user', 'error');
  }
}

async function revokeAdmin(userId) {
  try {
    if (!confirm('Cabut akses admin user ini?')) return;
    const uRef = doc(db, 'users', userId);
    await updateDoc(uRef, { role: 'user', isAdmin: false });

    try {
      await addDoc(collection(db, 'adminLogs'), {
        adminId: currentAdmin.uid,
        action: 'revokeAdmin',
        targetId: userId,
        timestamp: serverTimestamp()
      });
    } catch (e) { console.warn('admin log failed', e); }

    showNotification('Akses admin dicabut', 'success');
    await loadUsers();
  } catch (error) {
    console.error('Error revoking admin:', error);
    showNotification('Gagal mengubah role user', 'error');
  }
}

function viewUser(userId) {
  // Minimal detail view: open a prompt with basic info
  (async () => {
    try {
      const uSnap = await getDoc(doc(db, 'users', userId));
      if (!uSnap.exists()) return alert('User tidak ditemukan');
      const u = uSnap.data();
      alert(`User: ${u.email || userId}\nRole: ${u.role || 'user'}\nBalance: Rp${formatCurrency(u.mainBalance || 0)}\nUID: ${userId}`);
    } catch (e) { console.error(e); }
  })();
}

// Search helper bound to UI button
function searchUsers() {
  loadUsers();
}
window.searchUsers = searchUsers;

async function loadSystemLogs() {
  try {
    // Read debug log textarea if available
    const dbg = document.getElementById('dbgLog');
    let lines = [];
    if (dbg) {
      lines = dbg.textContent && dbg.textContent !== '(log empty)' ? dbg.textContent.split('\n') : [];
    }
    const filterType = document.getElementById('filterLogType')?.value || 'all';
    const filterDate = document.getElementById('filterLogDate')?.value || '';
    const container = document.getElementById('logsContainer');
    if (!container) return;
    if (lines.length === 0) {
      container.innerHTML = `<div class="empty-state" style="text-align:center; padding:var(--space-2xl);">
        <div style="font-size:3rem; margin-bottom:var(--space-md);">📄</div>
        <h3>Belum ada log sistem</h3>
        <p class="text-muted">Log akan muncul saat ada aktivitas di sistem</p>
      </div>`;
      return;
    }
    // Parse lines like "2025-12-17T05:31:46.216Z - message"
    const parsed = lines.map(l => {
      const idx = l.indexOf(' - ');
      if (idx === -1) return { raw: l };
      return { ts: l.slice(0, idx), msg: l.slice(idx + 3), raw: l };
    });
    const filtered = parsed.filter(p => {
      if (filterDate) {
        const d = p.ts ? p.ts.slice(0,10) : null;
        if (d !== filterDate) return false;
      }
      if (filterType && filterType !== 'all') {
        return (p.msg || '').toLowerCase().includes(filterType);
      }
      return true;
    });
    let html = '<div style="display:grid; gap:8px;">';
    for (const p of filtered) {
      html += `<div style="padding:8px; border-radius:6px; background:rgba(255,255,255,0.02); font-size:13px;"><div style="font-weight:700">${p.ts || ''}</div><div style="color:var(--text-muted);">${escapeHtml(p.msg || p.raw)}</div></div>`;
    }
    html += '</div>';
    container.innerHTML = html;
    if (window.appendAuthDebug) window.appendAuthDebug('loadSystemLogs: loaded ' + filtered.length + ' lines');
  } catch (error) {
    console.error('Error loading system logs:', error);
    showNotification('Gagal memuat logs', 'error');
  }
}

function exportLogs() {
  try {
    const dbg = document.getElementById('dbgLog');
    const text = dbg ? (dbg.textContent || '') : '';
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    if (window.appendAuthDebug) window.appendAuthDebug('exportLogs: exported ' + (text ? text.split('\n').length : 0) + ' lines');
  } catch (error) {
    console.error('Error exporting logs:', error);
    showNotification('Gagal export logs', 'error');
  }
}

function showAddMethodModal() {
  const modal = document.getElementById('methodModal');
  if (!modal) return showNotification('Form tambah payment method belum tersedia', 'info');
  modal.classList.add('open');
  document.getElementById('methodModalTitle').textContent = 'Tambah Metode Pembayaran';
}

// Small helpers
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>\"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]; });
}

// Expose implementations to window so onclick handlers still work
window.loadAdvertiserTasks = loadAdvertiserTasks;
window.loadRecentAdminTasks = loadRecentAdminTasks;
window.loadPendingUserProofs = loadPendingUserProofs;
window.loadPendingWithdrawals = loadPendingWithdrawals;
window.loadUsers = loadUsers;
window.loadSystemLogs = loadSystemLogs;
window.exportLogs = exportLogs;
window.approveWithdraw = approveWithdraw;
window.rejectWithdraw = rejectWithdraw;
window.approveProof = approveProof;
window.rejectProof = rejectProof;
window.makeAdmin = makeAdmin;
window.revokeAdmin = revokeAdmin;
window.viewUser = viewUser;
window.showAddMethodModal = showAddMethodModal;
window.loadPendingDeposits = loadPendingDeposits; // ensure existing minimal fn is available globally

// file content end