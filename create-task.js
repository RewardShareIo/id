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
      window.location.href = 'login.html';
      return;
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
  const reward = parseInt(document.getElementById('reward').value) || 0;
  const slots = parseInt(document.getElementById('slots').value) || 0;
  
  // Calculate costs
  const totalReward = reward * slots;
  const platformFee = Math.floor(totalReward * 0.2); // 20% fee
  const totalCost = totalReward + platformFee;
  
  // Update display
  document.getElementById('rewardDisplay').textContent = `Rp${reward.toLocaleString('id-ID')}`;
  document.getElementById('slotsDisplay').textContent = slots;
  document.getElementById('feeDisplay').textContent = `Rp${platformFee.toLocaleString('id-ID')}`;
  document.getElementById('totalCost').textContent = `Rp${totalCost.toLocaleString('id-ID')}`;
  
  // Check if user has enough locked balance
  if (userData && userData.lockedBalance < totalCost) {
    document.getElementById('createTaskMsg').textContent = `Saldo terkunci tidak mencukupi. Dibutuhkan: Rp${totalCost.toLocaleString('id-ID')}`;
    document.getElementById('createTaskMsg').className = "text-danger";
  } else {
    document.getElementById('createTaskMsg').textContent = '';
  }
}

// Create task
async function createTask() {
  try {
    const taskType = document.getElementById('taskType').value;
    const taskTitle = document.getElementById('taskTitle').value.trim();
    const taskDescription = document.getElementById('taskDescription').value.trim();
    const taskLink = document.getElementById('taskLink').value.trim();
    const reward = parseInt(document.getElementById('reward').value);
    const slots = parseInt(document.getElementById('slots').value);
    
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
  
  // Initial cost calculation
  updateCostSummary();
});
// file content end