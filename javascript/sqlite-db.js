/**
 * Browser SQLite (sql.js) with persistence in IndexedDB.
 * Demo database: no PostgreSQL/MySQL server required.
 */
(function (global) {
  'use strict';

  const IDB_NAME = 'sr_audit_sqlite_store';
  const IDB_STORE = 'database';
  const IDB_KEY = 'main';
  const MIGRATION_FLAG = 'sr_sqlite_migrated_v1';

  let SQL = null;
  let db = null;
  let readyPromise = null;
  let persistTimer = null;

  function resolveLibFile(file) {
    const scripts = document.querySelectorAll('script[src*="sqlite-db.js"]');
    const script = scripts[scripts.length - 1];
    if (script && script.src) {
      return new URL(`../lib/${file}`, script.src).href;
    }
    return new URL(`../lib/${file}`, document.baseURI).href;
  }

  function openIdb() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IDB_NAME, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const idb = event.target.result;
        if (!idb.objectStoreNames.contains(IDB_STORE)) {
          idb.createObjectStore(IDB_STORE);
        }
      };
    });
  }

  async function loadDbBlob() {
    const idb = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readonly');
      const req = tx.objectStore(IDB_STORE).get(IDB_KEY);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function saveDbBlob(bytes) {
    const idb = await openIdb();
    return new Promise((resolve, reject) => {
      const tx = idb.transaction(IDB_STORE, 'readwrite');
      tx.objectStore(IDB_STORE).put(bytes, IDB_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(async () => {
      try {
        const data = db.export();
        await saveDbBlob(data);
      } catch (err) {
        console.error('SQLite persist failed:', err);
      }
    }, 120);
  }

  function runSchema() {
    db.run(`
      CREATE TABLE IF NOT EXISTS inventory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barangay TEXT NOT NULL,
        office TEXT NOT NULL,
        item_name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        ics_number TEXT,
        quantity INTEGER DEFAULT 0,
        status TEXT,
        remarks TEXT,
        location TEXT,
        image_data TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS inventory_history (
        id INTEGER,
        barangay TEXT NOT NULL,
        office TEXT NOT NULL,
        item_name TEXT NOT NULL,
        description TEXT,
        category TEXT,
        ics_number TEXT,
        quantity INTEGER DEFAULT 0,
        status TEXT,
        remarks TEXT,
        location TEXT,
        image_data TEXT,
        created_at TEXT,
        archived_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS financial (
        barangay TEXT NOT NULL PRIMARY KEY,
        confirmation_letter_file TEXT,
        confirmation_letter_date TEXT,
        budget_verified INTEGER DEFAULT 0,
        budget_file TEXT,
        budget_amount REAL DEFAULT 0,
        bond_verified INTEGER DEFAULT 0,
        bond_file TEXT,
        bond_amount REAL DEFAULT 0,
        bank_verified INTEGER DEFAULT 0,
        bank_file TEXT,
        bank_amount REAL DEFAULT 0,
        check_register_verified INTEGER DEFAULT 0,
        check_register_file TEXT,
        af51_verified INTEGER DEFAULT 0,
        af51_text TEXT,
        coa0016_verified INTEGER DEFAULT 0,
        coa0016_file TEXT,
        coa0016_amount REAL DEFAULT 0,
        checks_dv_verified INTEGER DEFAULT 0,
        checks_dv_file TEXT,
        checks_dv_amount REAL DEFAULT 0,
        last_updated TEXT
      );
      CREATE TABLE IF NOT EXISTS documents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barangay TEXT NOT NULL,
        category TEXT,
        title TEXT,
        image_data TEXT,
        created_at TEXT
      );
      CREATE TABLE IF NOT EXISTS analytics (
        page TEXT PRIMARY KEY,
        views INTEGER DEFAULT 0,
        last_visit INTEGER
      );
      CREATE INDEX IF NOT EXISTS idx_inventory_barangay_office ON inventory(barangay, office);
      CREATE INDEX IF NOT EXISTS idx_inventory_history_barangay_office ON inventory_history(barangay, office, archived_at);
      CREATE INDEX IF NOT EXISTS idx_documents_barangay ON documents(barangay);
    `);
  }

  // Ensure expected columns exist on the `financial` table (for older DB blobs)
  function ensureFinancialColumns() {
    try {
      const info = queryAll(`PRAGMA table_info(financial)`);
      const existing = (info || []).map(r => r.name);
      const expected = {
        confirmation_letter_file: 'TEXT',
        confirmation_letter_date: 'TEXT',
        budget_verified: 'INTEGER DEFAULT 0',
        budget_file: 'TEXT',
        budget_amount: 'REAL DEFAULT 0',
        bond_verified: 'INTEGER DEFAULT 0',
        bond_file: 'TEXT',
        bond_amount: 'REAL DEFAULT 0',
        bank_verified: 'INTEGER DEFAULT 0',
        bank_file: 'TEXT',
        bank_amount: 'REAL DEFAULT 0',
        check_register_verified: 'INTEGER DEFAULT 0',
        check_register_file: 'TEXT',
        af51_verified: 'INTEGER DEFAULT 0',
        af51_text: 'TEXT',
        coa0016_verified: 'INTEGER DEFAULT 0',
        coa0016_file: 'TEXT',
        coa0016_amount: 'REAL DEFAULT 0',
        checks_dv_verified: 'INTEGER DEFAULT 0',
        checks_dv_file: 'TEXT',
        checks_dv_amount: 'REAL DEFAULT 0',
        last_updated: 'TEXT'
      };

      Object.keys(expected).forEach((col) => {
        if (!existing.includes(col)) {
          try {
            runSql(`ALTER TABLE financial ADD COLUMN ${col} ${expected[col]}`);
            console.info('Added missing column to financial:', col);
          } catch (err) {
            console.warn('Failed to add column', col, err);
          }
        }
      });
    } catch (err) {
      console.warn('ensureFinancialColumns failed', err);
    }
  }

  function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  function runSql(sql, params = []) {
    db.run(sql, params);
    persist();
  }

  function rowToInventoryItem(row) {
    return {
      id: row.id,
      itemName: row.item_name,
      description: row.description || '',
      category: row.category || '',
      icsNumber: row.ics_number || '',
      quantity: row.quantity || 0,
      status: row.status || '',
      remarks: row.remarks || '',
      location: row.location || '',
      image: row.image_data || null,
      createdAt: row.created_at || null
    };
  }

  function migrateLocalStorage() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key) keys.push(key);
    }

    keys.forEach((key) => {
      if (!key.startsWith('sr_audit_')) return;

      let raw;
      try {
        raw = localStorage.getItem(key);
        const data = JSON.parse(raw);
        if (!Array.isArray(data)) return;

        if (key.endsWith('_financial')) {
          const barangay = key.replace(/^sr_audit_/, '').replace(/_financial$/, '');
          if (data.length > 0) {
              // For simplicity, taking the last entry from the old format for migration
              const latestRecord = data[data.length - 1];
              runSql(
                  `INSERT OR REPLACE INTO financial (barangay, confirmation_letter_file, confirmation_letter_date, last_updated)
                   VALUES (?, ?, ?, ?)`,
                  [
                      barangay,
                      latestRecord.scanBase64 || null,
                      latestRecord.dateAudited || null,
                      latestRecord.createdAt || new Date().toISOString()
                  ]
              );
          }
          return;
        }

        if (key.endsWith('_documents')) {
          const barangay = key.replace(/^sr_audit_/, '').replace(/_documents$/, '');
          data.forEach((doc) => {
            runSql(
              `INSERT INTO documents (barangay, category, title, image_data, created_at)
               VALUES (?, ?, ?, ?, ?)`,
              [
                barangay,
                doc.category || null,
                doc.title || null,
                doc.image || null,
                doc.createdAt || new Date().toISOString()
              ]
            );
          });
          return;
        }

        if (key.endsWith('_inventory')) {
          const middle = key.replace(/^sr_audit_/, '').replace(/_inventory$/, '');
          const lastUnderscore = middle.lastIndexOf('_');
          if (lastUnderscore === -1) return;
          const barangay = middle.slice(0, lastUnderscore);
          const office = middle.slice(lastUnderscore + 1);
          data.forEach((item) => {
            runSql(
              `INSERT INTO inventory (barangay, office, item_name, description, category, ics_number, quantity, status, remarks, image_data, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                barangay,
                office,
                item.itemName || 'Unnamed',
                item.description || '',
                item.category || '',
                item.icsNumber || '',
                Number(item.quantity) || 0,
                item.status || '',
                item.remarks || '',
                item.image || null,
                item.createdAt || new Date().toISOString()
              ]
            );
          });
        }
      } catch (err) {
        console.warn('Skip migration for', key, err);
      }
    });

    try {
      const analyticsRaw = localStorage.getItem('site_analytics_v1');
      if (analyticsRaw) {
        const analytics = JSON.parse(analyticsRaw);
        Object.keys(analytics).forEach((page) => {
          const entry = analytics[page] || {};
          runSql(
            `INSERT OR REPLACE INTO analytics (page, views, last_visit) VALUES (?, ?, ?)`,
            [page, entry.views || 0, entry.lastVisit || null]
          );
        });
      }
    } catch (err) {
      console.warn('Analytics migration skipped', err);
    }
  }

  function migrateIndexedDbInventory() {
    return new Promise((resolve) => {
      const request = indexedDB.open('sr_audit_db', 1);
      request.onerror = () => resolve();
      request.onsuccess = () => {
        const idb = request.result;
        if (!idb.objectStoreNames.contains('inventory')) {
          resolve();
          return;
        }
        const tx = idb.transaction('inventory', 'readonly');
        const store = tx.objectStore('inventory');
        const getAllReq = store.getAll();
        getAllReq.onsuccess = () => {
          (getAllReq.result || []).forEach((entry) => {
            if (!entry || !entry.key || !Array.isArray(entry.items)) return;
            const middle = entry.key.replace(/^sr_audit_/, '').replace(/_inventory$/, '');
            const lastUnderscore = middle.lastIndexOf('_');
            if (lastUnderscore === -1) return;
            const barangay = middle.slice(0, lastUnderscore);
            const office = middle.slice(lastUnderscore + 1);
            entry.items.forEach((item) => {
              runSql(
                `INSERT INTO inventory (barangay, office, item_name, description, category, ics_number, quantity, status, remarks, location, image_data, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  barangay,
                  office,
                  item.itemName || 'Unnamed',
                  item.description || '',
                  item.category || '',
                  item.icsNumber || '',
                  Number(item.quantity) || 0,
                  item.status || '',
                  item.remarks || '',
                  item.location || '',
                  item.image || null,
                  item.createdAt || new Date().toISOString()
                ]
              );
            });
          });
          resolve();
        };
        getAllReq.onerror = () => resolve();
      };
    });
  }

  async function migrateLegacy() {
    if (localStorage.getItem(MIGRATION_FLAG)) return;
    migrateLocalStorage();
    await migrateIndexedDbInventory();
    localStorage.setItem(MIGRATION_FLAG, '1');
    persist();
  }

  async function init() {
    if (db) return db;

    SQL = await initSqlJs({ locateFile: resolveLibFile });
    const blob = await loadDbBlob();

    if (blob) {
      db = new SQL.Database(blob);
      runSchema();
      ensureFinancialColumns();
      await migrateLegacy();
    } else {
      db = new SQL.Database();
      runSchema();
      ensureFinancialColumns();
      await migrateLegacy();
    }

    return db;
  }

  function ready() {
    if (!readyPromise) {
      readyPromise = init().catch((err) => {
        readyPromise = null;
        console.error('SQLite init failed:', err);
        throw err;
      });
    }
    return readyPromise;
  }

  global.SRAuditDB = {
    ready,

    exportDatabase() {
      const bytes = db.export();
      const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'sr_audit_demo.sqlite';
      a.click();
      URL.revokeObjectURL(url);
    },

    async importDatabase(file) {
      const buffer = await file.arrayBuffer();
      db = new SQL.Database(new Uint8Array(buffer));
      runSchema();
      await saveDbBlob(db.export());
      localStorage.setItem(MIGRATION_FLAG, '1');
    },

    inventory: {
      async list(barangay, office) {
        await ready();
        const rows = queryAll(
          `SELECT * FROM inventory WHERE barangay = ? AND office = ? ORDER BY id ASC`,
          [barangay, office]
        );
        return rows.map(rowToInventoryItem);
      },

      async replaceAll(barangay, office, items) {
        await ready();
        db.run('BEGIN');
        try {
          // Archive current inventory before deleting
          const archiveDate = new Date().toISOString();
          db.run(
            `INSERT INTO inventory_history (id, barangay, office, item_name, description, category, ics_number, quantity, status, remarks, location, image_data, created_at, archived_at)
             SELECT id, barangay, office, item_name, description, category, ics_number, quantity, status, remarks, location, image_data, created_at, ?
             FROM inventory WHERE barangay = ? AND office = ?`,
            [archiveDate, barangay, office]
          );

          db.run('DELETE FROM inventory WHERE barangay = ? AND office = ?', [barangay, office]);
          items.forEach((item) => {
            db.run(
              `INSERT INTO inventory (barangay, office, item_name, description, category, ics_number, quantity, status, remarks, location, image_data, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                barangay,
                office,
                item.itemName,
                item.description || '',
                item.category || '',
                item.icsNumber || '',
                Number(item.quantity) || 0,
                item.status || '',
                item.remarks || '',
                item.location || '',
                item.image || null,
                item.createdAt || new Date().toISOString()
              ]
            );
          });
          db.run('COMMIT');
        } catch (err) {
          db.run('ROLLBACK');
          throw err;
        }
        persist();
      },

      async getLatestHistory(barangay, office) {
        await ready();
        // Find the most recent archive date for this barangay/office
        const latestArchive = queryAll(
          `SELECT MAX(archived_at) as last_audit_date FROM inventory_history WHERE barangay = ? AND office = ?`,
          [barangay, office]
        )[0];

        if (!latestArchive || !latestArchive.last_audit_date) {
          return []; // No history found
        }

        const rows = queryAll(
          `SELECT * FROM inventory_history WHERE barangay = ? AND office = ? AND archived_at = ?`,
          [barangay, office, latestArchive.last_audit_date]
        );
        return rows.map(rowToInventoryItem);
      },

      async countByBarangay(barangay) {
        await ready();
        const row = queryAll(
          `SELECT COUNT(*) AS total FROM inventory WHERE barangay = ?`,
          [barangay]
        )[0];
        return row ? row.total : 0;
      }
    },

    financial: {
      async getAuditData(barangay) {
        await ready();
        const row = queryAll(
          `SELECT
            barangay,
            confirmation_letter_file AS confirmationLetterFile,
            confirmation_letter_date AS confirmationLetterDate,
            budget_verified AS budgetVerified,
            budget_file AS budgetFile,
            budget_amount AS budgetAmount,
            bond_verified AS bondVerified,
            bond_file AS bondFile,
            bond_amount AS bondAmount,
            bank_verified AS bankVerified,
            bank_file AS bankFile,
            bank_amount AS bankAmount,
            check_register_verified AS checkRegisterVerified,
            check_register_file AS checkRegisterFile,
            af51_verified AS af51Verified,
            af51_text AS af51Text,
            coa0016_verified AS coa0016Verified,
            coa0016_file AS coa0016File,
            coa0016_amount AS coa0016Amount,
            checks_dv_verified AS checksDvVerified,
            checks_dv_file AS checksDvFile,
            checks_dv_amount AS checksDvAmount,
            last_updated AS lastUpdated
           FROM financial WHERE barangay = ?`,
          [barangay]
        )[0];

        if (!row) return {};

        return {
          confirmationLetter: {
            fileBase64: row.confirmationLetterFile,
            date: row.confirmationLetterDate,
          },
          budget: {
            verified: Boolean(row.budgetVerified),
            fileBase64: row.budgetFile,
            amount: row.budgetAmount,
          },
          bond: {
            verified: Boolean(row.bondVerified),
            fileBase64: row.bondFile,
            amount: row.bondAmount,
          },
          bank: {
            verified: Boolean(row.bankVerified),
            fileBase64: row.bankFile,
            amount: row.bankAmount,
          },
          checkRegister: {
            verified: Boolean(row.checkRegisterVerified),
            fileBase64: row.checkRegisterFile,
          },
          af51: {
            verified: Boolean(row.af51Verified),
            textInput: row.af51Text,
          },
          coa0016: {
            verified: Boolean(row.coa0016Verified),
            fileBase64: row.coa0016File,
            amount: row.coa0016Amount,
          },
          checksDv: {
            verified: Boolean(row.checksDvVerified),
            fileBase64: row.checksDvFile,
            amount: row.checksDvAmount,
          },
          lastUpdated: row.lastUpdated || null,
        };
      },

      async updateAuditData(barangay, data) {
        await ready();
        const existing = await this.getAuditData(barangay);

        const confirmationLetterFile = data?.confirmationLetter?.fileBase64 || existing?.confirmationLetter?.fileBase64 || null;
        const confirmationLetterDate = data?.confirmationLetter?.date || existing?.confirmationLetter?.date || null;

        const budgetVerified = data?.budget?.verified ? 1 : 0 || existing?.budget?.verified ? 1 : 0 || 0;
        const budgetFile = data?.budget?.fileBase64 || existing?.budget?.fileBase64 || null;
        const budgetAmount = data?.budget?.amount || existing?.budget?.amount || 0;

        const bondVerified = data?.bond?.verified ? 1 : 0 || existing?.bond?.verified ? 1 : 0 || 0;
        const bondFile = data?.bond?.fileBase64 || existing?.bond?.fileBase64 || null;
        const bondAmount = data?.bond?.amount || existing?.bond?.amount || 0;

        const bankVerified = data?.bank?.verified ? 1 : 0 || existing?.bank?.verified ? 1 : 0 || 0;
        const bankFile = data?.bank?.fileBase64 || existing?.bank?.fileBase64 || null;
        const bankAmount = data?.bank?.amount || existing?.bank?.amount || 0;

        const checkRegisterVerified = data?.checkRegister?.verified ? 1 : 0 || existing?.checkRegister?.verified ? 1 : 0 || 0;
        const checkRegisterFile = data?.checkRegister?.fileBase64 || existing?.checkRegister?.fileBase64 || null;

        const af51Verified = data?.af51?.verified ? 1 : 0 || existing?.af51?.verified ? 1 : 0 || 0;
        const af51Text = data?.af51?.textInput || existing?.af51?.textInput || null;

        const coa0016Verified = data?.coa0016?.verified ? 1 : 0 || existing?.coa0016?.verified ? 1 : 0 || 0;
        const coa0016File = data?.coa0016?.fileBase64 || existing?.coa0016?.fileBase64 || null;
        const coa0016Amount = data?.coa0016?.amount || existing?.coa0016?.amount || 0;

        const checksDvVerified = data?.checksDv?.verified ? 1 : 0 || existing?.checksDv?.verified ? 1 : 0 || 0;
        const checksDvFile = data?.checksDv?.fileBase64 || existing?.checksDv?.fileBase64 || null;
        const checksDvAmount = data?.checksDv?.amount || existing?.checksDv?.amount || 0;

        runSql(
          `INSERT OR REPLACE INTO financial (
            barangay,
            confirmation_letter_file, confirmation_letter_date,
            budget_verified, budget_file, budget_amount,
            bond_verified, bond_file, bond_amount,
            bank_verified, bank_file, bank_amount,
            check_register_verified, check_register_file,
            af51_verified, af51_text,
            coa0016_verified, coa0016_file, coa0016_amount,
            checks_dv_verified, checks_dv_file, checks_dv_amount,
            last_updated
           ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            barangay,
            confirmationLetterFile, confirmationLetterDate,
            budgetVerified, budgetFile, budgetAmount,
            bondVerified, bondFile, bondAmount,
            bankVerified, bankFile, bankAmount,
            checkRegisterVerified, checkRegisterFile,
            af51Verified, af51Text,
            coa0016Verified, coa0016File, coa0016Amount,
            checksDvVerified, checksDvFile, checksDvAmount,
            new Date().toISOString()
          ]
        );
      },

      async deleteAuditData(barangay) {
        await ready();
        runSql("DELETE FROM financial WHERE barangay = ?", [barangay]);
      },
    },

    documents: {
      async list(barangay) {
        await ready();
        return queryAll(
          `SELECT id, barangay, category, title, image_data, created_at
           FROM documents WHERE barangay = ? ORDER BY datetime(created_at) DESC`,
          [barangay]
        ).map((row) => ({
          id: row.id,
          barangay: row.barangay,
          category: row.category,
          title: row.title,
          image: row.image_data || row.image || null,
          createdAt: row.created_at || row.createdAt || null
        }));
      },

      async insert(barangay, doc) {
        await ready();
        runSql(
          `INSERT INTO documents (barangay, category, title, image_data, created_at)
           VALUES (?, ?, ?, ?, ?)`,
          [
            barangay,
            doc.category,
            doc.title,
            doc.image,
            doc.createdAt || new Date().toISOString()
          ]
        );
        persist();
      },

      async countByBarangay(barangay) {
        await ready();
        const row = queryAll(
          `SELECT COUNT(*) AS total FROM documents WHERE barangay = ?`,
          [barangay]
        )[0];
        return row ? row.total : 0;
      }
    },

    analytics: {
      async record(page) {
        await ready();
        const rows = queryAll('SELECT views FROM analytics WHERE page = ?', [page]);
        const views = rows.length ? (rows[0].views || 0) + 1 : 1;
        runSql(
          `INSERT OR REPLACE INTO analytics (page, views, last_visit) VALUES (?, ?, ?)`,
          [page, views, Date.now()]
        );
      },

      async getAll() {
        await ready();
        const rows = queryAll('SELECT page, views, last_visit AS lastVisit FROM analytics');
        const out = {};
        rows.forEach((row) => {
          out[row.page] = { views: row.views, lastVisit: row.lastVisit };
        });
        return out;
      },

      async reset() {
        await ready();
        runSql('DELETE FROM analytics');
      }
    },

    dev: {
      async seedComparisonData(barangay, office) {
        await ready();
        
        const archiveDate = new Date('2023-10-26T10:00:00.000Z').toISOString();
        const previousItems = [
            // This item will be UNCHANGED
            { itemName: 'Office Chair', description: 'Standard black office chair, fabric', category: 'Furniture & Fixtures', icsNumber: 'ICS-2023-001', quantity: 10, status: 'Good', remarks: 'Old stock', location: 'Office Room A', image: null, createdAt: '2023-01-15T10:00:00.000Z' },
            // This item will be MODIFIED (quantity and remarks)
            { itemName: 'Desktop Computer', description: 'Dell OptiPlex 3080', category: 'IT Equipment', icsNumber: 'ICS-2023-002', quantity: 5, status: 'Good', remarks: '', location: 'Main Office', image: null, createdAt: '2023-01-15T10:00:00.000Z' },
            // This item will be MISSING from the current audit
            { itemName: 'Old Filing Cabinet', description: '2-drawer metal cabinet, gray', category: 'Furniture & Fixtures', icsNumber: 'ICS-2023-004', quantity: 1, status: 'Good', remarks: 'To be disposed', location: 'Storage Room', image: null, createdAt: '2022-05-20T10:00:00.000Z' },
            // This item will be MODIFIED (status)
            { itemName: 'Fire Extinguisher', description: 'Type ABC, 5lbs', category: 'Rescue Equipment', icsNumber: 'ICS-2023-003', quantity: 2, status: 'Broken', remarks: 'Needs replacement', location: 'Hallway', image: null, createdAt: '2023-01-15T10:00:00.000Z' },
        ];

        const currentItems = [
            // UNCHANGED from previous
            { itemName: 'Office Chair', description: 'Standard black office chair, fabric', category: 'Furniture & Fixtures', icsNumber: 'ICS-2023-001', quantity: 10, status: 'Good', remarks: 'Old stock', location: 'Office Room A', image: null, createdAt: '2023-01-15T10:00:00.000Z' },
            // MODIFIED from previous
            { itemName: 'Desktop Computer', description: 'Dell OptiPlex 3080', category: 'IT Equipment', icsNumber: 'ICS-2023-002', quantity: 8, status: 'Good', remarks: '3 new units added', location: 'Main Office', image: null, createdAt: '2023-01-15T10:00:00.000Z' },
            // MODIFIED from previous
            { itemName: 'Fire Extinguisher', description: 'Type ABC, 5lbs', category: 'Rescue Equipment', icsNumber: 'ICS-2023-003', quantity: 2, status: 'Good', remarks: 'Replaced the old one', location: 'Hallway', image: null, createdAt: '2023-01-15T10:00:00.000Z' },
            // This is a NEW item
            { itemName: 'New Laptop', description: 'MacBook Pro 14-inch', category: 'IT Equipment', icsNumber: 'ICS-2024-050', quantity: 1, status: 'Good', remarks: 'For manager', location: 'Manager Office', image: null, createdAt: new Date().toISOString() },
        ];

        db.run('BEGIN');
        try {
            db.run('DELETE FROM inventory_history WHERE barangay = ? AND office = ?', [barangay, office]);
            db.run('DELETE FROM inventory WHERE barangay = ? AND office = ?', [barangay, office]);

            const histStmt = db.prepare(
                `INSERT INTO inventory_history (id, barangay, office, item_name, description, category, ics_number, quantity, status, remarks, location, image_data, created_at, archived_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            let idCounter = 1000;
            previousItems.forEach(item => {
                histStmt.run([idCounter++, barangay, office, item.itemName, item.description, item.category, item.icsNumber, item.quantity, item.status, item.remarks, item.location, item.image, item.createdAt, archiveDate]);
            });
            histStmt.free();

            const invStmt = db.prepare(
                `INSERT INTO inventory (barangay, office, item_name, description, category, ics_number, quantity, status, remarks, location, image_data, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            );
            currentItems.forEach(item => {
                invStmt.run([barangay, office, item.itemName, item.description, item.category, item.icsNumber, item.quantity, item.status, item.remarks, item.location, item.image, item.createdAt]);
            });
            invStmt.free();

            db.run('COMMIT');
            console.log(`DEV: Seeded comparison data for ${barangay} - ${office}`);
        } catch (err) {
            db.run('ROLLBACK');
            console.error('DEV: Failed to seed comparison data:', err);
            throw err;
        }
        persist();
      }
    }
  };
})(window);
