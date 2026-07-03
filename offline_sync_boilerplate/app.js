/**
 * app.js
 * Demonstrates how to refactor your current Javascript form submission event listener
 * to implement offline-first capability using Dexie.js and trigger background sync.
 */

// Import/reference the Dexie db instance created in db.js
// If using standard script tags, 'db' is available on the window object.
// const db = window.db;

/**
 * Wrapper function for handling offline-first form submission.
 * @param {HTMLFormElement} formElement - The HTML form element.
 * @param {string} tableName - The target Dexie.js table name ('inventory', 'financial', or 'documents').
 * @param {Function} getPayloadCallback - Callback function returning the object payload from form input elements.
 * @param {Function} onSuccessCallback - Callback function executed after local saving completes.
 */
function registerOfflineFirstForm(formElement, tableName, getPayloadCallback, onSuccessCallback) {
  if (!formElement) return;

  formElement.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      // 1. Retrieve current payload from the form inputs via the callback
      const formPayload = getPayloadCallback();

      // 2. Generate a UUID for the record to prevent primary key conflicts across clients
      const recordId = crypto.randomUUID();

      // 3. Construct the offline-first record payload
      const localRecord = {
        ...formPayload,
        id: recordId,
        synced: 0, // 0 = false (unsynced)
        last_updated: new Date().toISOString()
      };

      // 4. Save the payload instantly to the local Dexie.js database
      await db[tableName].put(localRecord);
      console.log(`[Offline-First] Record saved locally in table "${tableName}":`, localRecord);

      // Call the success callback (e.g. to update UI, show toast, or clear form)
      if (onSuccessCallback) {
        onSuccessCallback(localRecord);
      }

      // 5. Check network status; if online, trigger background sync
      if (navigator.onLine) {
        console.log('[Offline-First] Internet connection detected. Triggering background synchronization...');
        if (typeof triggerSync === 'function') {
          triggerSync();
        } else {
          console.warn('[Offline-First] triggerSync is not defined. Ensure sync.js is imported.');
        }
      } else {
        console.log('[Offline-First] Offline mode. Record queued for synchronization when connectivity is restored.');
      }

    } catch (error) {
      console.error('[Offline-First] Error during form submission:', error);
      alert('An error occurred while saving the record.');
    }
  });
}

// ==========================================
// EXAMPLE USAGE: Inventory Form Integration
// ==========================================
/*
document.addEventListener('DOMContentLoaded', () => {
  const inventoryForm = document.getElementById('inventory-form');
  
  if (inventoryForm) {
    registerOfflineFirstForm(
      inventoryForm,
      'inventory',
      // Callback to extract fields from your existing form inputs
      () => {
        return {
          itemName: document.getElementById('item-name').value.trim(),
          category: document.getElementById('item-category').value,
          quantity: parseInt(document.getElementById('item-quantity').value, 10),
          status: document.getElementById('item-status').value,
          remarks: document.getElementById('item-remarks').value.trim(),
          location: document.getElementById('item-location').value.trim(),
          barangay_id: parseInt(document.getElementById('barangay-id').value, 10)
        };
      },
      // Callback after record is saved locally
      (savedRecord) => {
        alert('Data saved locally! Ready for synchronization.');
        inventoryForm.reset();
        // Option to reload table from Dexie local state immediately:
        // loadLocalTableIntoUI();
      }
    );
  }
});
*/
