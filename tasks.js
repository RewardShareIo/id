// file name: tasks.js
// file content begin
import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc, addDoc, updateDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let userData = null;
let currentPage = 1;
const tasksPerPage = 10;

// Fungsi untuk memuat data user
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

// Load tasks dengan filter
async function loadTasks() {
  try {
    const filterType = document.getElementById('filterType').value;
    const filterSort = document.getElementById('filterSort').value;
    const filterReward = parseInt(document.getElementById('filterReward').value) || 0;
    
    // Build query
    let tasksQuery = query(
      collection(db, "tasks"),
      where("status", "==", "active")
    );
    
    // Filter by type
    if (filterType) {
      tasksQuery = query(tasksQuery, where("type", "==", filterType));
    }
    
    // Filter by minimum reward
    if (filterReward > 0) {
      tasksQuery = query(tasksQuery, where("reward", ">=", filterReward));
    }
    
    // Sort
    if (filterSort === 'reward-high') {
      tasksQuery = query(tasksQuery, orderBy("reward", "desc"));
    } else if (filterSort === 'reward-low') {
      tasksQuery = query(tasksQuery, orderBy("reward", "asc"));
    } else if (filterSort === 'slots') {
      tasksQuery = query(tasksQuery, orderBy("availableSlots", "desc"));
    } else {
      tasksQuery = query(tasksQuery, orderBy("createdAt", "desc"));
    }
    
    // Get tasks
    const tasksSnapshot = await getDocs(tasksQuery);
    const tasksContainer = document.getElementById('tasksContainer');
    
    if (tasksSnapshot.empty) {
      tasksContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📭</div>
          <h3>Tidak ada task tersedia</h3>
          <p class="text-muted">Coba filter lain atau cek lagi nanti</p>
        </div>
      `;
      document.getElementById('taskCount').textContent = "0 task tersedia";
      document.getElementById('footerStats').textContent = "0 task tersedia";
      return;
    }
    
    // Filter tasks yang belum dikerjakan oleh user
    const tasks = [];
    const userTaskProofsQuery = query(
      collection(db, "taskProofs"),
      where("userId", "==", currentUser.uid)
    );
    const userProofsSnapshot = await getDocs(userTaskProofsQuery);
    const completedTaskIds = new Set();
    
    userProofsSnapshot.forEach(proof => {
      completedTaskIds.add(proof.data().taskId);
    });
    
    // Process tasks
    tasksSnapshot.forEach(docSnap => {
      const task = docSnap.data();
      task.id = docSnap.id;
      
      // Skip jika sudah dikerjakan
      if (!completedTaskIds.has(task.id)) {
        tasks.push(task);
      }
    });
    
    // Update task count
    const taskCountElement = document.getElementById('taskCount');
    const footerStatsElement = document.getElementById('footerStats');
    taskCountElement.textContent = `${tasks.length} task tersedia`;
    footerStatsElement.textContent = `${tasks.length} task tersedia`;
    
    // Pagination
    const totalPages = Math.ceil(tasks.length / tasksPerPage);
    const startIndex = (currentPage - 1) * tasksPerPage;
    const endIndex = startIndex + tasksPerPage;
    const paginatedTasks = tasks.slice(startIndex, endIndex);
    
    // Render tasks
    if (paginatedTasks.length === 0) {
      tasksContainer.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📄</div>
          <h3>Tidak ada task di halaman ini</h3>
          <p class="text-muted">Coba halaman sebelumnya</p>
        </div>
      `;
    } else {
      let html = '<div style="display: grid; gap: var(--space-md);">';
      
      paginatedTasks.forEach(task => {
        html += `
          <div class="task-card" data-task-id="${task.id}">
            <div class="task-header">
              <div style="flex: 1;">
                <h3 style="margin: 0 0 var(--space-xs) 0;">${task.title || 'Untitled Task'}</h3>
                <div style="display: flex; gap: var(--space-sm); flex-wrap: wrap;">
                  <span class="badge badge-primary">${task.type || 'general'}</span>
                  ${task.isAdminTask ? '<span class="badge badge-success">Admin Task</span>' : ''}
                  ${task.verified ? '<span class="badge badge-lavender">Verified</span>' : ''}
                </div>
              </div>
              <div class="task-reward">Rp${task.reward || 0}</div>
            </div>
            
            <p style="margin: 0 0 var(--space-md) 0; color: var(--text-secondary);">
              ${task.description || 'Tidak ada deskripsi'}
            </p>
            
            <div class="task-meta">
              <div style="display: flex; align-items: center; gap: var(--space-xs);">
                <span style="color: var(--text-muted);">🎯</span>
                <span>${task.availableSlots || 0}/${task.slots || 0} slot</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-xs);">
                <span style="color: var(--text-muted);">⏱️</span>
                <span>${task.estimatedTime || '5-10 menit'}</span>
              </div>
              <div style="display: flex; align-items: center; gap: var(--space-xs);">
                <span style="color: var(--text-muted);">📅</span>
                <span>${task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString('id-ID') : '-'}</span>
              </div>
            </div>
            
            ${task.instructions ? `
              <div class="task-instructions">
                <strong>Instruksi:</strong><br>
                ${task.instructions.substring(0, 150)}${task.instructions.length > 150 ? '...' : ''}
              </div>
            ` : ''}
            
            <div class="task-actions">
              <button onclick="viewTaskDetails('${task.id}')" class="btn btn-primary">
                👁️ Lihat Detail
              </button>
              <button onclick="startTask('${task.id}')" class="btn btn-success">
                🚀 Kerjakan
              </button>
            </div>
          </div>
        `;
      });
      
      html += '</div>';
      tasksContainer.innerHTML = html;
    }
    
    // Render pagination
    renderPagination(totalPages);
    
  } catch (error) {
    console.error("Error loading tasks:", error);
    showNotification("Error memuat task", "error");
    document.getElementById('tasksContainer').innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">❌</div>
        <h3>Error memuat task</h3>
        <p class="text-muted">${error.message}</p>
        <button onclick="loadTasks()" class="btn btn-primary">Coba Lagi</button>
      </div>
    `;
  }
}

// Render pagination
function renderPagination(totalPages) {
  const paginationContainer = document.getElementById('pagination');
  if (totalPages <= 1) {
    paginationContainer.innerHTML = '';
    return;
  }
  
  let html = '';
  
  // Previous button
  html += `
    <button onclick="changePage(${currentPage - 1})" 
            class="btn btn-sm btn-outline"
            ${currentPage === 1 ? 'disabled' : ''}>
      ← Prev
    </button>
  `;
  
  // Page numbers
  const maxVisiblePages = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
  
  if (endPage - startPage + 1 < maxVisiblePages) {
    startPage = Math.max(1, endPage - maxVisiblePages + 1);
  }
  
  for (let i = startPage; i <= endPage; i++) {
    html += `
      <button onclick="changePage(${i})" 
              class="btn btn-sm ${i === currentPage ? 'btn-primary' : 'btn-outline'}">
        ${i}
      </button>
    `;
  }
  
  // Next button
  html += `
    <button onclick="changePage(${currentPage + 1})" 
            class="btn btn-sm btn-outline"
            ${currentPage === totalPages ? 'disabled' : ''}>
      Next →
    </button>
  `;
  
  paginationContainer.innerHTML = html;
}

// Change page
function changePage(page) {
  if (page < 1) return;
  currentPage = page;
  loadTasks();
}

// Apply filters
function applyFilters() {
  currentPage = 1;
  loadTasks();
}

// Refresh tasks
function refreshTasks() {
  currentPage = 1;
  loadTasks();
  showNotification("Task diperbarui", "success");
}

// View task details
async function viewTaskDetails(taskId) {
  try {
    const taskDoc = await getDoc(doc(db, "tasks", taskId));
    if (!taskDoc.exists()) {
      showNotification("Task tidak ditemukan", "error");
      return;
    }
    
    const task = taskDoc.data();
    
    // Update modal content
    document.getElementById('modalTaskTitle').textContent = task.title || 'Untitled Task';
    document.getElementById('modalTaskType').textContent = task.type || 'general';
    document.getElementById('modalTaskReward').textContent = `Rp${task.reward || 0}`;
    document.getElementById('modalTaskSlots').textContent = `${task.availableSlots || 0}/${task.slots || 0} slot`;
    document.getElementById('modalTaskInstructions').innerHTML = `
      <strong>Instruksi:</strong><br>
      ${task.instructions || 'Tidak ada instruksi'}
    `;
    
    // Additional details
    let detailsHtml = '';
    if (task.link) {
      detailsHtml += `<p><strong>Link:</strong> <a href="${task.link}" target="_blank">${task.link}</a></p>`;
    }
    if (task.requirements) {
      detailsHtml += `<p><strong>Requirements:</strong> ${task.requirements}</p>`;
    }
    if (task.estimatedTime) {
      detailsHtml += `<p><strong>Estimasi waktu:</strong> ${task.estimatedTime}</p>`;
    }
    
    document.getElementById('modalTaskDetails').innerHTML = detailsHtml;
    
    // Reset form
    document.getElementById('proofDescription').value = '';
    document.getElementById('proofFile').value = '';
    document.getElementById('fileName').style.display = 'none';
    document.getElementById('fileDropArea').innerHTML = `
      <div style="font-size: 3rem; margin-bottom: var(--space-md);">📎</div>
      <p><strong>Klik atau drop file di sini</strong></p>
      <p class="text-muted" style="font-size: var(--text-sm);">Format: JPG, PNG, GIF (Max 5MB)</p>
    `;
    
    // Store current task ID
    window.currentTaskId = taskId;
    
    // Show modal
    showModal('taskModal');
    
  } catch (error) {
    console.error("Error viewing task details:", error);
    showNotification("Error memuat detail task", "error");
  }
}

// Start task
function startTask(taskId) {
  viewTaskDetails(taskId);
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
  
  if (file.size > 5 * 1024 * 1024) { // 5MB
    showNotification("File terlalu besar. Maksimal 5MB.", "error");
    return;
  }
  
  // Update UI
  const fileDropArea = document.getElementById('fileDropArea');
  const fileName = document.getElementById('fileName');
  
  fileDropArea.innerHTML = `
    <div style="font-size: 3rem; margin-bottom: var(--space-md); color: var(--success);">✅</div>
    <p><strong>File siap diupload</strong></p>
    <p class="text-muted" style="font-size: var(--text-sm);">${file.name}</p>
  `;
  
  fileName.textContent = `${file.name} (${formatFileSize(file.size)})`;
  fileName.style.display = 'block';
  
  // Store file
  window.selectedFile = file;
}

// Format file size
function formatFileSize(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// Submit task proof
async function submitTaskProof() {
  try {
    const taskId = window.currentTaskId;
    const description = document.getElementById('proofDescription').value.trim();
    const file = window.selectedFile;
    
    if (!taskId) {
      showNotification("Task tidak valid", "error");
      return;
    }
    
    if (!file) {
      showNotification("Silakan upload bukti screenshot", "error");
      return;
    }
    
    // Disable button
    const submitBtn = document.getElementById('submitProofBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ Mengupload...';
    
    // Upload ke IMGG (simulasi)
    // Note: Di implementasi asli, ini akan upload ke IMGG API
    const proofUrl = await uploadToIMGG(file);
    
    // Simpan ke Firestore
    const proofData = {
      taskId: taskId,
      userId: currentUser.uid,
      userEmail: currentUser.email,
      userName: userData?.username || currentUser.email,
      proofUrl: proofUrl,
      proofDescription: description,
      status: 'pending',
      reward: 0, // Akan diisi admin setelah approve
      submittedAt: new Date(),
      reviewedAt: null,
      reviewedBy: null
    };
    
    await addDoc(collection(db, "taskProofs"), proofData);
    
    // Update task available slots
    const taskDoc = await getDoc(doc(db, "tasks", taskId));
    if (taskDoc.exists()) {
      const task = taskDoc.data();
      const newAvailableSlots = Math.max(0, (task.availableSlots || task.slots || 0) - 1);
      
      await updateDoc(doc(db, "tasks", taskId), {
        availableSlots: newAvailableSlots
      });
    }
    
    // Show success
    showNotification("Bukti task berhasil dikirim! Menunggu review admin.", "success");
    
    // Close modal setelah 1.5 detik
    setTimeout(() => {
      closeModal('taskModal');
      loadTasks(); // Refresh task list
    }, 1500);
    
  } catch (error) {
    console.error("Error submitting task proof:", error);
    showNotification("Error mengirim bukti: " + error.message, "error");
    
    // Re-enable button
    const submitBtn = document.getElementById('submitProofBtn');
    submitBtn.disabled = false;
    submitBtn.innerHTML = '✅ Submit Bukti Task';
  }
}

// Simulasi upload ke IMGG
async function uploadToIMGG(file) {
  // Note: Ini adalah simulasi
  // Di implementasi asli, Anda akan menggunakan API IMGG
  return new Promise((resolve) => {
    setTimeout(() => {
      const randomId = Math.random().toString(36).substring(7);
      resolve(`https://i.imgg.com/${randomId}.jpg`);
    }, 1000);
  });
}

// Show notification
function showNotification(message, type = 'info') {
  // Hapus notifikasi lama
  const oldNotification = document.querySelector('.notification');
  if (oldNotification) {
    oldNotification.remove();
  }

  // Buat notifikasi baru
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  // Auto remove setelah 3 detik
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
  
  // Load tasks
  loadTasks();
  
  // Setup logout button
  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.onclick = logout;
  }
  
  // Setup file drop area
  const fileDropArea = document.getElementById('fileDropArea');
  if (fileDropArea) {
    fileDropArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      fileDropArea.style.borderColor = 'var(--primary-sky)';
      fileDropArea.style.backgroundColor = 'rgba(14, 165, 233, 0.05)';
    });
    
    fileDropArea.addEventListener('dragleave', () => {
      fileDropArea.style.borderColor = '';
      fileDropArea.style.backgroundColor = '';
    });
    
    fileDropArea.addEventListener('drop', (e) => {
      e.preventDefault();
      fileDropArea.style.borderColor = '';
      fileDropArea.style.backgroundColor = '';
      
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
  if (!user && window.location.pathname.includes('tasks.html')) {
    window.location.href = 'login.html';
  }
});

// Export fungsi ke window object
window.applyFilters = applyFilters;
window.refreshTasks = refreshTasks;
window.viewTaskDetails = viewTaskDetails;
window.startTask = startTask;
window.handleFileSelect = handleFileSelect;
window.submitTaskProof = submitTaskProof;
window.changePage = changePage;
window.showModal = showModal;
window.closeModal = closeModal;
window.logout = logout;

// Import tambahan yang dibutuhkan
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// file content end