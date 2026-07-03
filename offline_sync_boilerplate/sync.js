/**
 * sync.js
 * Synchronization engine for coordinating local Dexie.js database
 * state changes with the cloud PostgreSQL server.
 */

// Define endpoint for batch sync
const SYNC_API_ENDPOINT = 'http://127.0.0.1:3000/api/sync';

/**
 * Triggers background synchronization of all unsynced records across all tables.
 */
async function triggerSync() {
  console.log('[Sync Engine] Starting sync process...');

  const tables = ['inventory', 'financial', 'documents'];
  let totalSynced = 0;

  for (const tableName of tables) {
    try {
      // 1. Query local Dexie table for all records where synced === 0
      const unsyncedRecords = await db[tableName]
        .where('synced')
        .equals(0)
        .toArray();

      if (unsyncedRecords.length === 0) {
        console.log(`[Sync Engine] Table "${tableName}" is fully up to date.`);
        continue;
      }

      console.log(`[Sync Engine] Found ${unsyncedRecords.length} unsynced records in table "${tableName}". Sending...`);

      // 2. Batch send unsynced records via POST fetch request
      const response = await fetch(SYNC_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          table: tableName,
          records: unsyncedRecords
        })
      });

      if (!response.ok) {
        throw new Error(`Server responded with HTTP status ${response.status}`);
      }

      const result = await response.json();
      console.log(`[Sync Engine] Server batch response for "${tableName}":`, result);

      // 3. Upon receiving a successful HTTP response (200 OK), update local records' status
      await db.transaction('readwrite', db[tableName], async () => {
        for (const record of unsyncedRecords) {
          await db[tableName].update(record.id, { synced: 1 });
        }
      });

      console.log(`[Sync Engine] Successfully updated ${unsyncedRecords.length} records to synced: 1 in "${tableName}".`);
      totalSynced += unsyncedRecords.length;

    } catch (error) {
      console.error(`[Sync Engine] Synchronization failed for table "${tableName}":`, error);
    }
  }

  console.log(`[Sync Engine] Sync completed. Total records processed: ${totalSynced}`);
}

// 4. Listen for the window 'online' event to automatically trigger a sync when connection returns
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Sync Engine] Online event fired. Connection restored.');
    triggerSync();
  });

  // Export to window scope so other frontend components can call triggerSync() manually
  window.triggerSync = triggerSync;
}

// Export for Node/Electron module syntax if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { triggerSync };
}
