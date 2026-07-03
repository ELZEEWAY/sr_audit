// AuditSyncDB Offline-First Synchronization Engine
// Vanilla JavaScript + IndexedDB

const SYNC_DB_NAME = 'AuditSyncDB';
const SYNC_STORE_NAME = 'mutation_queue';
const SERVER_API_BASE = 'http://127.0.0.1:3000/api';

/**
 * Initializes/Opens the IndexedDB synchronization database
 */
function openSyncDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SYNC_DB_NAME, 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(SYNC_STORE_NAME)) {
        db.createObjectStore(SYNC_STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Pushes a new mutation wrapper object into the IndexedDB local queue
 */
async function queueMutation(endpoint, action, payload) {
  try {
    const db = await openSyncDB();
    const tx = db.transaction(SYNC_STORE_NAME, 'readwrite');
    const store = tx.objectStore(SYNC_STORE_NAME);
    const record = {
      endpoint,
      action,
      payload,
      timestamp: new Date().toISOString()
    };
    store.add(record);
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to write to IndexedDB queue:', err);
    throw err;
  }
}

/**
 * Helper to display non-blocking styled UI toast notifications
 */
function showToast(message, type = 'success') {
  let container = document.getElementById('sync-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sync-toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.style.cssText = `
    min-width: 280px;
    max-width: 380px;
    padding: 14px 20px;
    border-radius: 12px;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 0.88rem;
    font-weight: 600;
    color: #ffffff;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    pointer-events: auto;
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  // Apply colors based on type
  if (type === 'success') {
    toast.style.backgroundColor = '#10b981'; // Green
    toast.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> <span>${message}</span>`;
  } else if (type === 'info') {
    toast.style.backgroundColor = '#3b82f6'; // Blue
    toast.innerHTML = `<i class="fa-solid fa-wifi-slash"></i> <span>${message}</span>`;
  } else {
    toast.style.backgroundColor = '#ef4444'; // Red
    toast.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>${message}</span>`;
  }

  container.appendChild(toast);

  // Trigger animation frame to fade in
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });

  // Remove toast after duration
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => {
      toast.remove();
    }, 300);
  }, 4000);
}

/**
 * Sends a mutation request directly to the PostgreSQL backend database client API
 */
async function sendPayloadToServer(endpoint, action, payload) {
  const url = `${SERVER_API_BASE}/${endpoint.replace(/^\//, '')}`;
  const options = {
    method: action,
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (action !== 'GET' && action !== 'HEAD') {
    options.body = JSON.stringify(payload);
  }

  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Background worker loop that processes the IndexedDB local queue in FIFO order
 */
async function processOfflineQueue() {
  console.log('Online status detected. Processing background sync queue...');
  
  let db;
  try {
    db = await openSyncDB();
  } catch (err) {
    console.error('Could not open IndexedDB in worker process:', err);
    return;
  }

  // FIFO loop execution
  let tx = db.transaction(SYNC_STORE_NAME, 'readonly');
  let store = tx.objectStore(SYNC_STORE_NAME);
  
  const request = store.getAll();
  
  request.onsuccess = async (e) => {
    const mutations = e.target.result;
    if (!mutations || mutations.length === 0) {
      console.log('No pending mutation records to sync.');
      return;
    }

    showToast(`Re-connected. Syncing ${mutations.length} offline changes...`, 'info');

    for (const record of mutations) {
      // Check current network status in the middle of loop (error boundaries)
      if (!navigator.onLine) {
        console.warn('Network connection dropped midway. Sync process halted.');
        showToast('Sync suspended. Connection lost.', 'error');
        break;
      }

      try {
        console.log(`Syncing mutation id: ${record.id} for endpoint: ${record.endpoint}...`);
        await sendPayloadToServer(record.endpoint, record.action, record.payload);

        // Delete row ID from the queue store upon successful submission
        const writeTx = db.transaction(SYNC_STORE_NAME, 'readwrite');
        const writeStore = writeTx.objectStore(SYNC_STORE_NAME);
        writeStore.delete(record.id);
        
        await new Promise((resolve, reject) => {
          writeTx.oncomplete = () => resolve();
          writeTx.onerror = () => reject(writeTx.error);
        });

        console.log(`Mutation id: ${record.id} synced and deleted successfully.`);
      } catch (err) {
        console.error(`Sync failed for mutation id: ${record.id}. Halting queue execution to preserve FIFO order.`, err);
        showToast('Server sync failed. Retrying later.', 'error');
        break; // Halt execution immediately to preserve data order
      }
    }
  };

  request.onerror = (e) => {
    console.error('Failed to read from IndexedDB store:', e.target.error);
  };
}

/**
 * Global write interceptor helper function
 */
async function dispatchDataAction(endpoint, action, payload) {
  if (navigator.onLine) {
    try {
      await sendPayloadToServer(endpoint, action, payload);
      showToast('Data synced successfully with backend database.');
      return { success: true, status: 'synced' };
    } catch (err) {
      console.warn('Backend server unreachable. Queueing payload locally.', err);
      await queueMutation(endpoint, action, payload);
      showToast('Working offline. Changes saved locally.', 'info');
      return { success: true, status: 'queued_offline_error' };
    }
  } else {
    await queueMutation(endpoint, action, payload);
    showToast('Working offline. Changes saved locally.', 'info');
    return { success: true, status: 'queued_offline' };
  }
}

// Attach connectivity change event listeners
window.addEventListener('online', processOfflineQueue);

// Expose functions globally
window.dispatchDataAction = dispatchDataAction;
window.processOfflineQueue = processOfflineQueue;

// Run sync check on startup in case there are residual items
window.addEventListener('DOMContentLoaded', () => {
  if (navigator.onLine) {
    processOfflineQueue();
  }
});
