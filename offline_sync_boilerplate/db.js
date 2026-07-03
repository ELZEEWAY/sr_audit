/**
 * db.js
 * Standalone Dexie.js configuration script for offline-first storage.
 * This file initializes the local IndexedDB database and schema.
 */

// Import Dexie if running in Node/Electron environment, otherwise assume global Dexie (via script tag)
const Dexie = (typeof window !== 'undefined' && window.Dexie) || require('dexie');

// Initialize the database
const db = new Dexie('SR_Audit_LocalDB');

// Define tables and schema
// The first field is the primary key (id, which will hold a UUID string).
// We index 'synced' to quickly query unsynced records (synced === 0).
// We index 'last_updated' to support timestamp-based conflict resolution or sorting.
db.version(1).stores({
  inventory: 'id, synced, last_updated, itemName, category, quantity',
  financial: 'id, synced, last_updated, barangay, budget_amount, bond_amount',
  documents: 'id, synced, last_updated, title, category'
});

// Export the database instance for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = db;
} else {
  window.db = db;
}
