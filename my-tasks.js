// file name: my-tasks.js
// file content begin
import { auth, db, authInitPromise } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Load user's tasks
async function loadMyTasks() {
  try {
    const user = auth.currentUser;
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // Query task proofs by user
    const proofsQuery = query(
      collection(db, "taskProofs"),
      where("userId", "==", user.uid),
      orderBy("submittedAt", "desc")
    );
    
    const proofsSnapshot = await getDocs(proofsQuery);
    const taskList = document.getElementById('taskList');
    
    if (proofsSnapshot.empty) {
      taskList.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 40px;">
          <div style="font-size: 3rem; margin-bottom: 15px;">📭</div>
          <h3>Belum ada task</h3>
          <p class="text-muted">Kerjakan task terlebih dahulu di halaman Task Tersedia</p>
          <a href="tasks.html" class="btn btn-primary" style="margin-top: 15px;">Lihat Task Tersedia</a>
        </div>
      `;
      return;
    }
    
    let html = '<div style="display: grid; gap: 15px;">';
    
    for (const proofDoc of proofsSnapshot.docs) {
      const proof = proofDoc.data();
      const taskDoc = await getDoc(doc(db, "tasks", proof.taskId));
      const task = taskDoc.exists() ? taskDoc.data() : { title: 'Task Tidak Ditemukan' };
      
      // Status badge
      let statusBadge = '';
      if (proof.status === 'approved') {
        statusBadge = '<span class="task-status status-approved">✓ Approved</span>';
      } else if (proof.status === 'rejected') {
        statusBadge = '<span class="task-status status-rejected">✗ Rejected</span>';
      } else {
        statusBadge = '<span class="task-status status-pending">⏳ Pending</span>';
      }
      
      // Date formatting
      const submittedDate = proof.submittedAt?.toDate ? 
        proof.submittedAt.toDate().toLocaleDateString('id-ID') : '-';
      
      html += `
        <div style="padding: 15px; background: var(--bg-card); border-radius: 10px; border-left: 4px solid ${proof.status === 'approved' ? '#10b981' : proof.status === 'rejected' ? '#ef4444' : '#f59e0b'};">
          <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 10px;">
            <div>
              <h4 style="margin: 0 0 5px 0;">${task.title}</h4>
              <div style="font-size: 0.85rem; color: var(--text-muted);">
                Dikirim: ${submittedDate} • Reward: ${proof.reward ? 'Rp' + proof.reward : 'Menunggu'}
              </div>
            </div>
            ${statusBadge}
          </div>
          ${proof.proofDescription ? `<p style="margin: 10px 0; font-size: 0.9rem;">${proof.proofDescription}</p>` : ''}
          ${proof.proofUrl ? `
            <div style="margin-top: 10px;">
              <a href="${proof.proofUrl}" target="_blank" class="btn btn-sm btn-outline">👁️ Lihat Bukti</a>
            </div>
          ` : ''}
        </div>
      `;
    }
    
    html += '</div>';
    taskList.innerHTML = html;
    
  } catch (error) {
    console.error("Error loading my tasks:", error);
    document.getElementById('taskList').innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px;">
        <div style="font-size: 3rem; margin-bottom: 15px;">❌</div>
        <h3>Error memuat task</h3>
        <p class="text-muted">${error.message}</p>
        <button onclick="loadMyTasks()" class="btn btn-primary" style="margin-top: 15px;">Coba Lagi</button>
      </div>
    `;
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check auth
  onAuthStateChanged(auth, async (user) => {
    await authInitPromise;
    if (user) {
      loadMyTasks();
    } else {
      if (window.location.pathname.includes('my-tasks.html')) {
        window.location.href = 'login.html';
      }
    }
  });
});
// file content end