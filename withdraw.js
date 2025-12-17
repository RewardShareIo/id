// file name: history.js
// file content begin
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy, addDoc, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let currentTab = 'all';

// Load history data
async function loadHistory() {
  try {
    currentUser = auth.currentUser;
    if (!currentUser) {
      await new Promise((resolve) => {
        const unsub = onAuthStateChanged(auth, (u) => {
          currentUser = u;
          unsub();
          resolve();
        });
        setTimeout(resolve, 1000);
      });
      if (!currentUser) {
        window.location.href = 'login.html';
        return;
      }
    }

    // Load all history types
    await Promise.all([
      loadDepositHistory(),
      loadWithdrawHistory(),
      loadTaskHistory(),
      loadReferralHistory()
    ]);
    
  } catch (error) {
    console.error("Error loading history:", error);
    showNotification("Error memuat riwayat", "error");
  }
}

// Load deposit history
async function loadDepositHistory() {
  try {
    const depositsQuery = query(
      collection(db, "deposits"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    
    const depositsSnapshot = await getDocs(depositsQuery);
    const deposits = [];
    
    depositsSnapshot.forEach(doc => {
      deposits.push({
        ...doc.data(),
        id: doc.id,
        type: 'deposit'
      });
    });
    
    window.depositHistory = deposits;
  } catch (error) {
    console.error("Error loading deposit history:", error);
  }
}

// Load withdraw history
async function loadWithdrawHistory() {
  try {
    const withdrawalsQuery = query(
      collection(db, "withdrawals"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc")
    );
    
    const withdrawalsSnapshot = await getDocs(withdrawalsQuery);
    const withdrawals = [];
    
    withdrawalsSnapshot.forEach(doc => {
      withdrawals.push({
        ...doc.data(),
        id: doc.id,
        type: 'withdraw'
      });
    });
    
    window.withdrawHistory = withdrawals;
  } catch (error) {
    console.error("Error loading withdraw history:", error);
  }
}

// Load task history
async function loadTaskHistory() {
  try {
    const taskProofsQuery = query(
      collection(db, "taskProofs"),
      where("userId", "==", currentUser.uid),
      orderBy("submittedAt", "desc")
    );
    
    const taskProofsSnapshot = await getDocs(taskProofsQuery);
    const taskHistory = [];
    
    for (const doc of taskProofsSnapshot.docs) {
      const proof = doc.data();
      // Get task details
      const tasksQuery = query(
        collection(db, "tasks"),
        where("__name__", "==", proof.taskId)
      );
      const tasksSnapshot = await getDocs(tasksQuery);
      let taskTitle = "Task Tidak Ditemukan";
      
      if (!tasksSnapshot.empty) {
        taskTitle = tasksSnapshot.docs[0].data().title;
      }
      
      taskHistory.push({
        ...proof,
        id: doc.id,
        type: 'task',
        taskTitle: taskTitle
      });
    }
    
    window.taskHistory = taskHistory;
  } catch (error) {
    console.error("Error loading task history:", error);
  }
}

// Load referral history
async function loadReferralHistory() {
  try {
    const referralsQuery = query(
      collection(db, "referrals"),
      where("referrerId", "==", currentUser.uid),
      orderBy("date", "desc")
    );
    
    const referralsSnapshot = await getDocs(referralsQuery);
    const referrals = [];
    
    referralsSnapshot.forEach(doc => {
      referrals.push({
        ...doc.data(),
        id: doc.id,
        type: 'referral'
      });
    });
    
    window.referralHistory = referrals;
  } catch (error) {
    console.error("Error loading referral history:", error);
  }
}

// Show specific tab
function showTab(tab) {
  currentTab = tab;
  
  // Update active tab UI
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  const activeTabEl = document.querySelector(`.tab[onclick*="${tab}"]`);
  if (activeTabEl) activeTabEl.classList.add('active');
  
  // Display data
  displayHistory();
}

// Display history based on current tab
function displayHistory() {
  const container = document.getElementById('historyContent');
  if (!container) return;
  
  // Combine all history
  let allHistory = [];
  if (window.depositHistory) allHistory = [...allHistory, ...window.depositHistory];
  if (window.withdrawHistory) allHistory = [...allHistory, ...window.withdrawHistory];
  if (window.taskHistory) allHistory = [...allHistory, ...window.taskHistory];
  if (window.referralHistory) allHistory = [...allHistory, ...window.referralHistory];
  
  // Sort by date (newest first)
  allHistory.sort((a, b) => {
    const dateA = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.date || a.submittedAt);
    const dateB = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.date || b.submittedAt);
    return dateB - dateA;
  });
  
  // Filter by tab
  let filteredHistory = allHistory;
  if (currentTab !== 'all') {
    filteredHistory = allHistory.filter(item => item.type === currentTab);
  }
  
  // Display
  if (filteredHistory.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px;">
        <div style="font-size: 3rem; margin-bottom: 15px;">📭</div>
        <h3>Tidak ada riwayat</h3>
        <p class="text-muted">Belum ada aktivitas ${currentTab === 'all' ? '' : currentTab}</p>
      </div>
    `;
    return;
  }
  
  let html = '<div style="display: grid; gap: 10px;">';
  
  filteredHistory.forEach(item => {
    html += createHistoryItem(item);
  });
  
  html += '</div>';
  container.innerHTML = html;
}

// Create history item HTML
function createHistoryItem(item) {
  let icon = '📄';
  let title = '';
  let amount = '';
  let status = '';
  let date = '';
  let extraInfo = '';
  
  switch (item.type) {
    case 'deposit':
      icon = '💰';
      title = `Deposit #${item.depositCode || item.id.substring(0, 8)}`;
      amount = `+Rp${item.amount?.toLocaleString('id-ID') || '0'}`;
      status = item.status || 'pending';
      date = item.createdAt?.toDate ? 
        item.createdAt.toDate().toLocaleDateString('id-ID') : '-';
      extraInfo = `Metode: ${item.method}`;
      break;
      
    case 'withdraw':
      icon = '💸';
      title = `Withdraw #${item.withdrawCode || item.id.substring(0, 8)}`;
      amount = `-Rp${item.amount?.toLocaleString('id-ID') || '0'}`;
      status = item.status || 'pending';
      date = item.createdAt?.toDate ? 
        item.createdAt.toDate().toLocaleDateString('id-ID') : '-';
      extraInfo = `Net: Rp${item.netAmount?.toLocaleString('id-ID') || '0'} (fee: Rp2,000)`;
      break;
      
    case 'task':
      icon = '✅';
      title = item.taskTitle || 'Task';
      amount = item.reward ? `+Rp${item.reward.toLocaleString('id-ID')}` : 'Pending';
      status = item.status || 'pending';
      date = item.submittedAt?.toDate ? 
        item.submittedAt.toDate().toLocaleDateString('id-ID') : '-';
      extraInfo = item.proofDescription || '';
      break;
      
    case 'referral':
      icon = '👥';
      title = `Referral: ${item.referredEmail}`;
      amount = `+Rp${item.reward?.toLocaleString('id-ID') || '250'}`;
      status = item.status || 'completed';
      date = item.date?.toDate ? 
        item.date.toDate().toLocaleDateString('id-ID') : '-';
      extraInfo = `User: ${item.referredUsername || '-'}`;
      break;
  }
  
  // Status badge
  let statusBadge = '';
  if (status === 'approved' || status === 'completed') {
    statusBadge = '<span class="badge badge-success" style="margin-left: 10px;">✓ ' + status + '</span>';
  } else if (status === 'rejected') {
    statusBadge = '<span class="badge badge-danger" style="margin-left: 10px;">✗ ' + status + '</span>';
  } else {
    statusBadge = '<span class="badge badge-warning" style="margin-left: 10px;">⏳ ' + status + '</span>';
  }
  
  return `
    <div class="history-item history-${item.type}">
      <div style="display: flex; align-items: center; gap: 15px;">
        <div style="font-size: 1.5rem;">${icon}</div>
        <div style="flex: 1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <strong>${title}</strong>
            <div style="font-weight: bold; color: ${amount.startsWith('+') ? '#10b981' : amount.startsWith('-') ? '#ef4444' : '#f59e0b'}">
              ${amount}
            </div>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px;">
            ${date} • ${extraInfo}
          </div>
        </div>
      </div>
      ${statusBadge}
    </div>
  `;
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
}

// Logout function
async function logout() {
  try {
    await signOut(auth);
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Error saat logout", "error");
  }
}

// Submit withdraw request
async function submitWithdraw(event) {
  try {
    if (event && event.preventDefault) event.preventDefault();

    const nameEl = document.getElementById('name');
    const methodEl = document.getElementById('method');
    const accountEl = document.getElementById('accountNumber');
    const amountEl = document.getElementById('amount');
    const withdrawMsg = document.getElementById('withdrawMsg');

    if (!nameEl || !methodEl || !accountEl || !amountEl || !withdrawMsg) {
      console.error('Form withdraw tidak lengkap');
      return;
    }

    const name = nameEl.value.trim();
    const method = methodEl.value;
    const accountNumber = accountEl.value.trim();
    const amount = parseInt(amountEl.value, 10) || 0;

    // Validation
    if (!name || !method || !accountNumber || !amount) {
      withdrawMsg.textContent = 'Semua field harus diisi';
      return;
    }

    if (amount < 30000) {
      withdrawMsg.textContent = 'Minimal withdraw Rp30.000';
      return;
    }

    // Check balance (client-side)
    if (!currentUser) {
      withdrawMsg.textContent = 'User tidak ditemukan. Silakan login ulang.';
      return;
    }

    const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
    const userBal = userDoc.exists() ? (userDoc.data().mainBalance || 0) : 0;

    if (userBal < amount) {
      withdrawMsg.textContent = 'Saldo tidak mencukupi';
      return;
    }

    // Disable button
    const submitBtn = document.querySelector('#withdrawForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Mengirim...';
    }

    // Create withdrawal entry
    await addDoc(collection(db, 'withdrawals'), {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: userDoc.exists() ? userDoc.data().username : currentUser.email,
      method: method,
      accountNumber: accountNumber,
      amount: amount,
      fee: 2000,
      netAmount: amount - 2000,
      status: 'pending',
      createdAt: new Date()
    });

    showNotification('Permintaan withdraw terkirim, menunggu verifikasi admin', 'success');
    withdrawMsg.textContent = '';

    // Reset form
    const wf = document.getElementById('withdrawForm');
    if (wf) wf.reset();

    // Refresh history
    loadWithdrawHistory();

  } catch (error) {
    console.error('Error submitting withdraw:', error);
    const withdrawMsg = document.getElementById('withdrawMsg');
    if (withdrawMsg) withdrawMsg.textContent = 'Error mengirim withdraw: ' + error.message;

    const submitBtn = document.querySelector('#withdrawForm button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Ajukan Penarikan';
    }
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadHistory();
    } else {
      window.location.href = 'login.html';
    }
  });
  
  // Setup withdraw form
  const withdrawForm = document.getElementById('withdrawForm');
  if (withdrawForm) {
    withdrawForm.addEventListener('submit', submitWithdraw);
  }

  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
});

// Export fungsi ke window object
window.showTab = showTab;
// file content end