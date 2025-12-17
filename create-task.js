// file name: create-task.js
// file content begin
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { doc, getDoc, addDoc, collection, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let userData = null;

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
      
      // Check advertiser eligibility
      if (userData.totalDeposit < 50000) {
        showNotification("Minimal deposit Rp50.000 untuk membuat task", "warning");
        setTimeout(() => window.location.href = 'dashboard.html', 2000);
      }
      
      // Setup form event listeners
      setupFormListeners();
    }
  } catch (error) {
    console.error("Error loading user data:", error);
    showNotification("Error memuat data", "error");
  }
}

// Setup form listeners
function setupFormListeners() {
  const form = document.getElementById('createTaskForm');
  const rewardInput = document.getElementById('reward');
  const slotsInput = document.getElementById('slots');
  
  // If expected elements are not present, do nothing
  if (!form || !rewardInput || !slotsInput) return;
  
  // Update cost summary on input change
  [rewardInput, slotsInput].forEach(input => {
    input.addEventListener('input', updateCostSummary);
  });
  
  // Form submission
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    await createTask();
  });
}

// Update cost summary
function updateCostSummary() {
  const rewardEl = document.getElementById('reward');
  const slotsEl = document.getElementById('slots');
  if (!rewardEl || !slotsEl) return;

  const reward = parseInt(rewardEl.value) || 0;
  const slots = parseInt(slotsEl.value) || 0;
  
  // Calculate costs
  const totalReward = reward * slots;
  const platformFee = Math.floor(totalReward * 0.2); // 20% fee
  const totalCost = totalReward + platformFee;
  
  // Update display (guard elements)
  const rewardDisplay = document.getElementById('rewardDisplay');
  const slotsDisplay = document.getElementById('slotsDisplay');
  const feeDisplay = document.getElementById('feeDisplay');
  const totalCostEl = document.getElementById('totalCost');
  const msgEl = document.getElementById('createTaskMsg');

  if (rewardDisplay) rewardDisplay.textContent = `Rp${reward.toLocaleString('id-ID')}`;
  if (slotsDisplay) slotsDisplay.textContent = slots;
  if (feeDisplay) feeDisplay.textContent = `Rp${platformFee.toLocaleString('id-ID')}`;
  if (totalCostEl) totalCostEl.textContent = `Rp${totalCost.toLocaleString('id-ID')}`;
  
  // Check if user has enough locked balance
  if (userData && userData.lockedBalance < totalCost) {
    if (msgEl) {
      msgEl.textContent = `Saldo terkunci tidak mencukupi. Dibutuhkan: Rp${totalCost.toLocaleString('id-ID')}`;
      msgEl.className = "text-danger";
    }
  } else {
    if (msgEl) msgEl.textContent = '';
  }
}

// Create task
async function createTask() {
  try {
    const taskTypeEl = document.getElementById('taskType');
    const taskTitleEl = document.getElementById('taskTitle');
    const taskDescriptionEl = document.getElementById('taskDescription');
    const taskLinkEl = document.getElementById('taskLink');
    const rewardEl = document.getElementById('reward');
    const slotsEl = document.getElementById('slots');

    if (!taskTypeEl || !taskTitleEl || !taskDescriptionEl || !rewardEl || !slotsEl) {
      showNotification("Form tidak ditemukan atau tidak lengkap", "error");
      return;
    }

    const taskType = taskTypeEl.value;
    const taskTitle = taskTitleEl.value.trim();
    const taskDescription = taskDescriptionEl.value.trim();
    const taskLink = taskLinkEl ? taskLinkEl.value.trim() : '';
    const reward = parseInt(rewardEl.value);
    const slots = parseInt(slotsEl.value);
    
    // Validation
    if (!taskType || !taskTitle || !taskDescription || !reward || !slots) {
      showNotification("Harap isi semua field yang wajib", "error");
      return;
    }
    
    if (reward < 500) {
      showNotification("Reward minimal Rp500 per worker", "error");
      return;
    }
    
    if (slots < 1 || slots > 100) {
      showNotification("Jumlah worker antara 1-100", "error");
      return;
    }
    
    // Calculate costs
    const totalCost = reward * slots + Math.floor(reward * slots * 0.2);
    
    // Check balance
    if (userData.lockedBalance < totalCost) {
      showNotification(`Saldo terkunci tidak mencukupi. Dibutuhkan: Rp${totalCost.toLocaleString('id-ID')}`, "error");
      return;
    }
    
    // Create task data
    const taskData = {
      title: taskTitle,
      description: taskDescription,
      type: taskType,
      instructions: taskDescription, // Using description as instructions
      link: taskLink || '',
      reward: reward,
      slots: slots,
      availableSlots: slots,
      advertiserId: currentUser.uid,
      advertiserEmail: currentUser.email,
      advertiserName: userData.username,
      status: 'pending', // Menunggu approval admin
      isAdminTask: false,
      estimatedTime: '5-10 menit',
      requirements: '',
      fee: Math.floor(reward * slots * 0.2),
      totalCost: totalCost,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    // Disable button
    const submitBtn = document.querySelector('#createTaskForm button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Membuat Task...';
    
    // Save to Firestore
    await addDoc(collection(db, "tasks"), taskData);
    
    // Update user's locked balance
    await updateDoc(doc(db, "users", currentUser.uid), {
      lockedBalance: increment(-totalCost)
    });
    
    // Show success
    showNotification("Task berhasil dibuat! Menunggu approval admin.", "success");
    
    // Reset form
    document.getElementById('createTaskForm').reset();
    updateCostSummary();
    
    // Redirect after 2 seconds
    setTimeout(() => {
      window.location.href = 'dashboard.html';
    }, 2000);
    
  } catch (error) {
    console.error("Error creating task:", error);
    showNotification("Error membuat task: " + error.message, "error");
    
    // Re-enable button
    const submitBtn = document.querySelector('#createTaskForm button[type="submit"]');
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Buat Task';
  }
}

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  onAuthStateChanged(auth, (user) => {
    if (user) {
      loadUserData();
    } else {
      window.location.href = 'login.html';
    }
  });
  
  // Initial cost calculation (only if fields exist)
  if (document.getElementById('reward') && document.getElementById('slots')) {
    updateCostSummary();
  }
});
// file content end