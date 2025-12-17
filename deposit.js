// file name: deposit.js
// file content begin
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, addDoc, collection, query, where, getDocs, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let userData = null;
let selectedMethod = null;
let selectedAmount = 0;
let selectedFile = null;

// Payment methods data
const paymentMethods = {
  BCA: {
    name: "BCA",
    type: "bank",
    holder: "ADMIN REWARDSHAREIO",
    number: "1234567890",
    icon: "🏦",
    instructions: "Transfer dengan berita: DEPOSIT_[KODE_USER]"
  },
  BRI: {
    name: "BRI",
    type: "bank",
    holder: "ADMIN REWARDSHAREIO",
    number: "1234567891",
    icon: "🏦",
    instructions: "Transfer dengan berita: DEPOSIT_[KODE_USER]"
  },
  BNI: {
    name: "BNI",
    type: "bank",
    holder: "ADMIN REWARDSHAREIO",
    number: "1234567892",
    icon: "🏦",
    instructions: "Transfer dengan berita: DEPOSIT_[KODE_USER]"
  },
  DANA: {
    name: "DANA",
    type: "ewallet",
    holder: "Admin RewardShare",
    number: "081234567890",
    icon: "💜",
    instructions: "Kirim ke nomor DANA di atas"
  },
  OVO: {
    name: "OVO",
    type: "ewallet",
    holder: "Admin RewardShare",
    number: "081234567891",
    icon: "💙",
    instructions: "Kirim ke nomor OVO di atas"
  },
  GoPay: {
    name: "GoPay",
    type: "ewallet",
    holder: "Admin RewardShare",
    number: "081234567892",
    icon: "💚",
    instructions: "Kirim ke nomor GoPay di atas"
  }
};

// Load user data
async function loadUserData() {
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

    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if (userDoc.exists()) {
      userData = userDoc.data();
      updateHeaderUI();
      loadDepositHistory();
    }
  } catch (error) {
    console.error("Error loading user data:", error);
    showNotification("Error memuat data", "error");
  }
}

// Update header UI
function updateHeaderUI() {
  const userRefCodeElement = document.getElementById('userRefCode');
  if (userRefCodeElement && userData) {
    const refCodeSpan = userRefCodeElement.querySelector('span:nth-child(2)');
    if (refCodeSpan) {
      refCodeSpan.textContent = userData.referralCode || 'LOADING...';
    }
  }
}

// Select payment method
function selectMethod(method) {
  selectedMethod = method;
  
  // Update UI
  document.querySelectorAll('.method-card').forEach(card => card.classList.remove('selected'));
  const methodCard = document.querySelector(`.method-card[data-method="${method}"]`);
  if (methodCard) methodCard.classList.add('selected');
  
  // Show method info (guard)
  const selectedMethodInfo = document.getElementById('selectedMethodInfo');
  const methodNameEl = document.getElementById('methodName');
  if (selectedMethodInfo) selectedMethodInfo.style.display = 'block';
  if (methodNameEl) methodNameEl.textContent = method;
  
  // Show account info
  showAccountInfo();
}

// Select amount
function selectAmount(amount) {
  selectedAmount = amount;
  
  // Update UI
  document.querySelectorAll('.amount-option').forEach(option => option.classList.remove('selected'));
  const selectedOption = document.querySelector(`.amount-option[data-amount="${amount}"]`);
  if (selectedOption) selectedOption.classList.add('selected');
  
  // Hide custom amount container (guard)
  const customAmountContainer = document.getElementById('customAmountContainer');
  if (customAmountContainer) customAmountContainer.style.display = 'none';
  
  // Update display
  updateAmountDisplay();
}

// Show custom amount input
function showCustomAmount() {
  const customAmountContainer = document.getElementById('customAmountContainer');
  if (customAmountContainer) customAmountContainer.style.display = 'block';
  document.querySelectorAll('.amount-option').forEach(option => option.classList.remove('selected'));
}

// Use custom amount
function useCustomAmount() {
  const customAmountEl = document.getElementById('customAmount');
  if (!customAmountEl) return;
  const customAmount = parseInt(customAmountEl.value);
  if (customAmount >= 30000) {
    selectedAmount = customAmount;
    updateAmountDisplay();
  } else {
    showNotification("Minimal deposit Rp30.000", "error");
  }
}

// Update amount display
function updateAmountDisplay() {
  const displayAmountEl = document.getElementById('displayAmount');
  if (displayAmountEl) displayAmountEl.textContent = `Rp${selectedAmount.toLocaleString('id-ID')}`;
  
  // Show account info if method selected
  if (selectedMethod) {
    showAccountInfo();
  }
}

// Show account info
function showAccountInfo() {
  if (!selectedMethod || selectedAmount === 0) return;
  
  const method = paymentMethods[selectedMethod];
  if (!method) return;
  
  const accountDetails = document.getElementById('accountDetails');
  if (!accountDetails) return;
  accountDetails.innerHTML = `
    <div class="account-detail">
      <div><strong>Nama:</strong> ${method.holder}</div>
      <div><strong>Nomor:</strong> ${method.number}</div>
      <div><strong>Jumlah Transfer:</strong> <span class="text-success">Rp${selectedAmount.toLocaleString('id-ID')}</span></div>
    </div>
    ${method.instructions ? `<p><strong>Instruksi:</strong> ${method.instructions}</p>` : ''}
  `;
  
  // Show account info and upload container (guard)
  const accountInfoContainer = document.getElementById('accountInfoContainer');
  const uploadContainer = document.getElementById('uploadContainer');
  if (accountInfoContainer) accountInfoContainer.style.display = 'block';
  if (uploadContainer) uploadContainer.style.display = 'block';
}

// Handle file select
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  // Validate file
  const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
  if (!validTypes.includes(file.type)) {
    showNotification("Format file tidak didukung. Gunakan JPG, PNG, atau GIF.", "error");
    return;
  }
  
  if (file.size > 5 * 1024 * 1024) {
    showNotification("File terlalu besar. Maksimal 5MB.", "error");
    return;
  }
  
  selectedFile = file;
  
  // Preview image
  const reader = new FileReader();
  reader.onload = (e) => {
    const previewImage = document.getElementById('previewImage');
    if (previewImage) previewImage.src = e.target.result;
  };
  reader.readAsDataURL(file);
  
  // Update UI (guard)
  const filePreviewEl = document.getElementById('filePreview');
  const fileNameEl = document.getElementById('fileName');
  const fileSizeEl = document.getElementById('fileSize');
  const submitBtn = document.getElementById('submitBtn');

  if (filePreviewEl) filePreviewEl.style.display = 'flex';
  if (fileNameEl) fileNameEl.textContent = file.name;
  if (fileSizeEl) fileSizeEl.textContent = formatFileSize(file.size);
  
  // Enable submit button
  if (submitBtn) submitBtn.disabled = false;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Remove file
function removeFile() {
  selectedFile = null;
  const filePreview = document.getElementById('filePreview');
  const proofFile = document.getElementById('proofFile');
  const submitBtn = document.getElementById('submitBtn');
  if (filePreview) filePreview.style.display = 'none';
  if (proofFile) proofFile.value = '';
  if (submitBtn) submitBtn.disabled = true;
}

// Submit deposit
async function submitDeposit() {
  try {
    if (!selectedMethod || selectedAmount === 0 || !selectedFile) {
      showNotification("Lengkapi semua data terlebih dahulu", "error");
      return;
    }
    
    // Disable button
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Mengirim...';
    
    // Upload proof to IMGG (simulasi)
    const proofUrl = await uploadToIMGG(selectedFile);
    
    // Generate deposit code
    const depositCode = `DEP${Date.now().toString().slice(-8)}`;
    
    // Save deposit data
    const depositData = {
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: userData?.username || currentUser.email,
      method: selectedMethod,
      amount: selectedAmount,
      proofUrl: proofUrl,
      depositCode: depositCode,
      status: 'pending',
      createdAt: new Date(),
      approvedAt: null,
      approvedBy: null,
      lockedUntil: null
    };
    
    await addDoc(collection(db, "deposits"), depositData);
    
    // Show success modal
    document.getElementById('successAmount').textContent = `Rp${selectedAmount.toLocaleString('id-ID')}`;
    document.getElementById('successCode').textContent = depositCode;
    showModal('successModal');
    
    // Reset form
    resetForm();
    
    // Refresh history
    loadDepositHistory();
    
  } catch (error) {
    console.error("Error submitting deposit:", error);
    showNotification("Error mengirim deposit: " + error.message, "error");
    
    // Re-enable button
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '🚀 Kirim Deposit untuk Review';
  }
}

// Simulasi upload ke IMGG
async function uploadToIMGG(file) {
  return new Promise((resolve) => {
    setTimeout(() => {
      const randomId = Math.random().toString(36).substring(7);
      resolve(`https://i.imgg.com/${randomId}.jpg`);
    }, 1000);
  });
}

// Reset form
function resetForm() {
  selectedMethod = null;
  selectedAmount = 0;
  selectedFile = null;
  
  // Reset UI
  document.querySelectorAll('.method-card').forEach(card => card.classList.remove('selected'));
  document.querySelectorAll('.amount-option').forEach(option => option.classList.remove('selected'));
  
  const selectedMethodInfo = document.getElementById('selectedMethodInfo');
  const customAmountContainer = document.getElementById('customAmountContainer');
  const accountInfoContainer = document.getElementById('accountInfoContainer');
  const uploadContainer = document.getElementById('uploadContainer');
  const filePreview = document.getElementById('filePreview');
  const proofFile = document.getElementById('proofFile');
  const submitBtn = document.getElementById('submitBtn');
  const displayAmount = document.getElementById('displayAmount');
  const customAmount = document.getElementById('customAmount');

  if (selectedMethodInfo) selectedMethodInfo.style.display = 'none';
  if (customAmountContainer) customAmountContainer.style.display = 'none';
  if (accountInfoContainer) accountInfoContainer.style.display = 'none';
  if (uploadContainer) uploadContainer.style.display = 'none';
  if (filePreview) filePreview.style.display = 'none';
  if (proofFile) proofFile.value = '';
  if (submitBtn) submitBtn.disabled = true;
  if (displayAmount) displayAmount.textContent = 'Rp0';
  if (customAmount) customAmount.value = '';
}

// Load deposit history
async function loadDepositHistory() {
  try {
    const depositsQuery = query(
      collection(db, "deposits"),
      where("userId", "==", currentUser.uid),
      orderBy("createdAt", "desc"),
      limit(10)
    );
    
    const depositsSnapshot = await getDocs(depositsQuery);
    const historyContainer = document.getElementById('depositHistory');
    
    if (depositsSnapshot.empty) {
      return; // Keep default empty state
    }
    
    let html = '<div style="display: grid; gap: 10px;">';
    
    depositsSnapshot.forEach(doc => {
      const deposit = doc.data();
      const statusClass = deposit.status === 'approved' ? 'approved' : 
                         deposit.status === 'rejected' ? 'rejected' : 'pending';
      
      const date = deposit.createdAt?.toDate ? 
        deposit.createdAt.toDate().toLocaleDateString('id-ID') : '-';
      
      html += `
        <div class="history-item ${statusClass}">
          <div>
            <strong>${deposit.depositCode}</strong>
            <div style="font-size: 0.85rem; color: var(--text-muted);">
              ${date} • ${deposit.method}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold;">Rp${deposit.amount.toLocaleString('id-ID')}</div>
            <span class="badge ${deposit.status === 'approved' ? 'badge-success' : 
                             deposit.status === 'rejected' ? 'badge-danger' : 'badge-warning'}">
              ${deposit.status}
            </span>
          </div>
        </div>
      `;
    });
    
    html += '</div>';
    historyContainer.innerHTML = html;
    
  } catch (error) {
    console.error("Error loading deposit history:", error);
  }
}

// Show notification
function showNotification(message, type = 'info') {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => notification.remove(), 3000);
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
    window.location.href = 'login.html';
  } catch (error) {
    console.error("Logout error:", error);
    showNotification("Error saat logout", "error");
  }
}

// Setup event listeners
document.addEventListener('DOMContentLoaded', () => {
  // Load user data
  loadUserData();
  
  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
  
  // Setup file drop area
  const uploadArea = document.getElementById('uploadArea');
  if (uploadArea) {
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    
    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });
    
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      
      const file = e.dataTransfer.files[0];
      if (file) {
        const input = document.getElementById('proofFile');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        input.files = dataTransfer.files;
        handleFileSelect({ target: input });
      }
    });
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
  if (!user && window.location.pathname.includes('deposit.html')) {
    window.location.href = 'login.html';
  }
});

// Export fungsi ke window object
window.selectMethod = selectMethod;
window.selectAmount = selectAmount;
window.showCustomAmount = showCustomAmount;
window.useCustomAmount = useCustomAmount;
window.handleFileSelect = handleFileSelect;
window.removeFile = removeFile;
window.submitDeposit = submitDeposit;
window.loadMoreHistory = loadDepositHistory;
window.showModal = showModal;
window.closeModal = closeModal;
window.logout = logout;
// file content end