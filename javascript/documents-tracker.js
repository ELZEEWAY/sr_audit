import { REQUIRED_CATEGORIES } from './tracker-docs.js';

const BARANGAYS = [
  'Aplaya',
  'Balibago',
  'Caingin',
  'Dila',
  'Dita',
  'Don Jose',
  'Ibaba',
  'Kanluran',
  'Labas',
  'Macabling',
  'Malitlit',
  'Malusak',
  'Market Area',
  'Pooc (Pook)',
  'Pulong Santa Cruz',
  'Santo Domingo',
  'Sinalhan',
  'Tagapo'
];

const KEY_ACTIVE = 'sr_active_barangay';

const STATUS = {
  AVAILABLE: 'available',
  PENDING: 'pending',
  N_A: 'na'
};

const FILTER = {
  ALL: 'all',
  ONLY_MISSING: 'missing',
  ONLY_COMPLIANT: 'compliant'
};

const TABS = {
  LEGISLATIVE: 'legislative',
  AGREEMENTS: 'agreements',
  MASTERLISTS: 'masterlists',
  SPECIAL: 'special'
};

let activeTab = TABS.LEGISLATIVE; // Track the active compliance tab

function getActiveBarangay() {
  let active = localStorage.getItem(KEY_ACTIVE);
  if (!active || !BARANGAYS.includes(active)) {
    active = BARANGAYS[0];
    localStorage.setItem(KEY_ACTIVE, active);
  }
  return active;
}

function getKey() {
  return `sr_doc_tracker_v1:${getActiveBarangay()}`;
}

function defaultState() {
  const state = {
    categories: {}
  };

  REQUIRED_CATEGORIES.forEach((cat) => {
    state.categories[cat.id] = {};
    cat.items.forEach((item) => {
      state.categories[cat.id][item] = {
        status: '',
        notes: '',
        date: ''
      };
    });
  });

  return state;
}

function loadState() {
  try {
    const raw = localStorage.getItem(getKey());
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.categories) return defaultState();

    const base = defaultState();
    Object.keys(base.categories).forEach((catId) => {
      const items = base.categories[catId];
      if (!parsed.categories[catId]) parsed.categories[catId] = {};
      Object.keys(items).forEach((itemName) => {
        const existing = parsed.categories[catId][itemName];
        if (!existing) parsed.categories[catId][itemName] = items[itemName];
      });
    });

    return parsed;
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(getKey(), JSON.stringify(state));
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function statusToLabel(status) {
  if (status === STATUS.AVAILABLE) return 'Available (Compliant)';
  if (status === STATUS.PENDING) return 'Pending/Missing';
  if (status === STATUS.N_A) return 'Not Applicable';
  return '—';
}

function computeProgress(state) {
  let total = 0;
  let available = 0;
  let pending = 0;
  let na = 0;

  REQUIRED_CATEGORIES.forEach((cat) => {
    cat.items.forEach((item) => {
      total += 1;
      const rec = state.categories?.[cat.id]?.[item];
      const s = rec?.status;
      if (s === STATUS.AVAILABLE) available += 1;
      else if (s === STATUS.PENDING) pending += 1;
      else if (s === STATUS.N_A) na += 1;
    });
  });

  const compliant = available;
  const percent = total === 0 ? 0 : Math.round((compliant / total) * 100);

  return {
    total,
    available,
    pending,
    na,
    percent
  };
}

function updateDashboard(state) {
  const progress = computeProgress(state);
  const elPercent = document.querySelector('[data-tracker="overall-percent"]');
  const elMetricTotal = document.querySelector('[data-tracker="metric-total"]');
  const elMetricCompliant = document.querySelector('[data-tracker="metric-compliant"]');
  const elMetricMissing = document.querySelector('[data-tracker="metric-missing"]');
  const elMetricNA = document.querySelector('[data-tracker="metric-na"]');

  if (elPercent) elPercent.textContent = `${progress.percent}% Compliant`;
  if (elMetricTotal) elMetricTotal.textContent = String(progress.total);
  if (elMetricCompliant) elMetricCompliant.textContent = `${progress.available} (Available)`;
  if (elMetricMissing) elMetricMissing.textContent = `${progress.pending} (Pending)`;
  if (elMetricNA) elMetricNA.textContent = String(progress.na);

  // Update progress bar
  const pBar = document.querySelector('.tracker-bar > div');
  if (pBar) {
    pBar.style.width = `${progress.percent}%`;
  }
}

// Maps document names to respective categories dynamically
function getTabId(itemName, catId) {
  const name = itemName.toLowerCase();
  
  if (name.includes('executive order') || name.includes('resolution') || name.includes('ordinance') || name.startsWith('eo') || name.includes('eo enacted')) {
    return TABS.LEGISLATIVE;
  }
  
  if (name.includes('moa') || name.includes('mou') || name.includes('journal') || name.includes('minutes') || name.includes('activity report') || name.includes('post-activity') || name.includes('assembly 2024-2026')) {
    return TABS.AGREEMENTS;
  }
  
  if (name.includes('masterlist') || name.includes('flow chart') || name.includes('registry') || name.includes('profile') || name.includes('rbi') || name.includes('logbook') || name.includes('charter')) {
    return TABS.MASTERLISTS;
  }
  
  return TABS.SPECIAL;
}

function buildRows(state, filterMode, query) {
  const container = document.getElementById('tracker-items');
  if (!container) return;
  container.innerHTML = '';

  const q = (query || '').trim().toLowerCase();

  const section = document.createElement('section');
  section.className = 'tracker-category';

  const table = document.createElement('div');
  table.className = 'tracker-table';

  table.innerHTML = `
    <div class="tracker-table-header no-print">
      <div class="tracker-th tracker-td-title">Document Title & Category</div>
      <div class="tracker-th tracker-td-status">Status</div>
      <div class="tracker-th tracker-td-date">Compliance Date</div>
      <div class="tracker-th tracker-td-actions">Actions</div>
    </div>
  `;

  let matchedRowCount = 0;

  REQUIRED_CATEGORIES.forEach((cat) => {
    cat.items.forEach((itemName) => {
      const tabId = getTabId(itemName, cat.id);
      if (tabId !== activeTab) return;

      const rec = state.categories?.[cat.id]?.[itemName] || { status: '', notes: '', date: '' };
      const status = rec.status;

      const searchable = `${cat.title} ${itemName}`.toLowerCase();
      if (q && !searchable.includes(q)) return;

      const isCompliant = status === STATUS.AVAILABLE;
      const isMissing = status === STATUS.PENDING || !status;

      if (filterMode === FILTER.ONLY_MISSING && isCompliant) return;
      if (filterMode === FILTER.ONLY_COMPLIANT && !isCompliant) return;

      matchedRowCount++;

      const row = document.createElement('div');
      row.className = 'tracker-row';
      row.dataset.catid = cat.id;
      row.dataset.itemname = itemName;

      let activeBadgeClass = 'na';
      let activeBadgeText = 'N/A';
      if (status === STATUS.AVAILABLE) {
        activeBadgeClass = 'available';
        activeBadgeText = 'Available';
      } else if (status === STATUS.PENDING) {
        activeBadgeClass = 'pending';
        activeBadgeText = 'Pending';
      }

      const displayDate = rec.date ? `<span class="compliance-date-text"><i class="fa-regular fa-calendar-check text-slate-500"></i> ${escapeHtml(rec.date)}</span>` : `<span class="compliance-date-empty">—</span>`;

      row.innerHTML = `
        <div class="tracker-td tracker-td-title">
          <div class="tracker-doc-wrapper">
            <span class="tracker-doc-bold-title">${escapeHtml(itemName)}</span>
            <span class="tracker-doc-cat-subtitle">${escapeHtml(cat.title)}</span>
          </div>
        </div>
        <div class="tracker-td tracker-td-status">
          <span class="compliance-badge ${activeBadgeClass}" data-role="status-badge">${activeBadgeText}</span>
        </div>
        <div class="tracker-td tracker-td-date">
          ${displayDate}
        </div>
        <div class="tracker-td tracker-td-actions no-print">
          <button type="button" class="btn-action-edit" title="Edit Remarks & Details" data-role="edit-btn">
            <i class="fa-solid fa-pen-to-square"></i>
          </button>
        </div>
      `;

      table.appendChild(row);
    });
  });

  if (matchedRowCount > 0) {
    section.appendChild(table);
    container.appendChild(section);
  } else {
    const emptyMsg = document.createElement('div');
    emptyMsg.style.padding = '30px';
    emptyMsg.style.textAlign = 'center';
    emptyMsg.style.color = '#64748b';
    emptyMsg.style.fontWeight = '600';
    emptyMsg.innerHTML = `<i class="fa-regular fa-folder-open text-3xl mb-2 block"></i> No documents found matching current filters.`;
    section.appendChild(emptyMsg);
    container.appendChild(section);
  }
}

function wireEvents(state) {
  const container = document.getElementById('tracker-items');
  if (!container) return;

  // Handle Quick status badge popover click updates
  container.addEventListener('click', (e) => {
    const badge = e.target.closest('[data-role="status-badge"]');
    if (!badge) {
      document.querySelectorAll('.status-popover-menu').forEach(menu => menu.remove());
      return;
    }

    e.stopPropagation();
    document.querySelectorAll('.status-popover-menu').forEach(menu => menu.remove());

    const cell = badge.parentElement;
    const row = badge.closest('.tracker-row');
    if (!row) return;

    const catId = row.dataset.catid;
    const itemName = row.dataset.itemname;

    const menu = document.createElement('div');
    menu.className = 'status-popover-menu';
    menu.innerHTML = `
      <button type="button" class="status-popover-item available" data-status="available">
        <i class="fa-solid fa-circle-check mr-2"></i> Available
      </button>
      <button type="button" class="status-popover-item pending" data-status="pending">
        <i class="fa-solid fa-circle-exclamation mr-2"></i> Pending
      </button>
      <button type="button" class="status-popover-item na" data-status="na">
        <i class="fa-solid fa-circle-minus mr-2"></i> N/A
      </button>
    `;

    cell.appendChild(menu);

    menu.addEventListener('click', (ev) => {
      const item = ev.target.closest('.status-popover-item');
      if (!item) return;

      const newStatus = item.getAttribute('data-status');
      if (state.categories?.[catId]?.[itemName]) {
        state.categories[catId][itemName].status = newStatus;
        saveState(state);
        updateDashboard(state);
        buildRows(state, getActiveFilter(), document.getElementById('tracker-search')?.value || '');
        wireEvents(state);
      }
      menu.remove();
    });
  });

  // Handle action edit drawer reveal
  container.addEventListener('click', (e) => {
    const editBtn = e.target.closest('[data-role="edit-btn"]');
    if (!editBtn) return;

    const row = editBtn.closest('.tracker-row');
    if (!row) return;

    const catId = row.dataset.catid;
    const itemName = row.dataset.itemname;
    const rec = state.categories?.[catId]?.[itemName] || { status: '', notes: '', date: '' };

    const overlay = document.getElementById('drawer-overlay');
    const titleEl = document.getElementById('drawer-title');
    const catEl = document.getElementById('drawer-category');
    const statusSelect = document.getElementById('drawer-status');
    const dateInput = document.getElementById('drawer-date');
    const notesTextarea = document.getElementById('drawer-notes');
    const saveBtn = document.getElementById('drawer-save');

    if (!overlay || !titleEl || !statusSelect || !dateInput || !notesTextarea || !saveBtn) return;

    titleEl.textContent = itemName;
    catEl.textContent = catId.toUpperCase().replace(/_/g, ' ');
    statusSelect.value = rec.status || 'pending';
    dateInput.value = rec.date || '';
    notesTextarea.value = rec.notes || '';

    overlay.classList.add('active');

    // Clone save button to remove previous event listeners
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', () => {
      if (state.categories?.[catId]?.[itemName]) {
        state.categories[catId][itemName].status = statusSelect.value;
        state.categories[catId][itemName].date = dateInput.value;
        state.categories[catId][itemName].notes = notesTextarea.value;

        saveState(state);
        updateDashboard(state);
        buildRows(state, getActiveFilter(), document.getElementById('tracker-search')?.value || '');
        wireEvents(state);

        overlay.classList.remove('active');
      }
    });
  });
}

function getActiveFilter() {
  const activeMarker = document.querySelector('[data-tracker="active-filter"]');
  return activeMarker ? activeMarker.getAttribute('data-active-filter') : FILTER.ALL;
}

function initTracker() {
  const state = loadState();

  updateDashboard(state);

  // Initialize Category Tabs Click switcher
  document.querySelectorAll('.tracker-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tracker-tab').forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      activeTab = tab.getAttribute('data-tab');

      buildRows(state, getActiveFilter(), document.getElementById('tracker-search')?.value || '');
      wireEvents(state);
    });
  });

  // Handle active Barangay dropdown selector
  const elSelect = document.getElementById('barangay-select');
  if (elSelect) {
    elSelect.innerHTML = '';
    BARANGAYS.forEach((name) => {
      const option = document.createElement('option');
      option.value = name;
      option.textContent = name;
      elSelect.appendChild(option);
    });

    elSelect.value = getActiveBarangay();

    // Check if the current user is a superadmin to toggle lock
    const currentUserStr = sessionStorage.getItem('currentUser');
    let isSuperadmin = false;
    if (currentUserStr) {
      try {
        const user = JSON.parse(currentUserStr);
        if (user.authorized_module === 'all') {
          isSuperadmin = true;
        }
      } catch (e) {}
    }

    if (isSuperadmin) {
      elSelect.disabled = false;
      elSelect.addEventListener('change', () => {
        localStorage.setItem(KEY_ACTIVE, elSelect.value);
        const freshState = loadState();
        updateDashboard(freshState);
        buildRows(freshState, getActiveFilter(), document.getElementById('tracker-search')?.value || '');
        wireEvents(freshState);
      });
    } else {
      elSelect.disabled = true;
      elSelect.title = 'Selected Barangay context is locked.';
    }
  }

  // Initial table render
  buildRows(state, FILTER.ALL, '');
  wireEvents(state);

  // Search input event handler
  const searchEl = document.getElementById('tracker-search');
  if (searchEl) {
    searchEl.addEventListener('input', () => {
      const q = searchEl.value || '';
      const fm = getActiveFilter();
      buildRows(state, fm, q);
      wireEvents(state);
    });
  }

  // Filter button switches
  document.querySelectorAll('[data-filter-btn]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-filter-btn]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const mode = btn.getAttribute('data-filter-btn');
      const q = searchEl?.value || '';

      const activeMarker = document.querySelector('[data-tracker="active-filter"]');
      if (activeMarker) activeMarker.setAttribute('data-active-filter', mode);

      buildRows(state, mode, q);
      wireEvents(state);
    });
  });

  // Reset compliance data
  const resetBtn = document.getElementById('tracker-reset');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      const ok = window.confirm('Reset compliance tracker for the active barangay? This will erase all saved document statuses, dates, and remarks.');
      if (!ok) return;
      
      // Wipe the underlying state object data in-place to keep listener closures updated
      const fresh = defaultState();
      Object.assign(state, fresh);
      saveState(state);

      // Redraw data tables with clean states
      buildRows(state, getActiveFilter(), searchEl?.value || '');
      updateDashboard(state);
    });
  }

  // Export report document action handler
  const exportBtn = document.getElementById('tracker-export');
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const progress = computeProgress(state);

      const exportObj = {
        barangay: getActiveBarangay(),
        exportedAt: new Date().toISOString(),
        progress,
        data: state
      };

      const exportText = JSON.stringify(exportObj, null, 2);

      // Download JSON File
      const blob = new Blob([exportText], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `barangay-document-audit-tracker-${getActiveBarangay().replace(/\s+/g, '-').toLowerCase()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      // Open print layout tab
      const printWin = window.open('', '_blank');
      if (printWin) {
        printWin.document.write(`
          <html><head><title>Document Compliance Export Report</title>
          <style>
            body{font-family:Arial,Helvetica,sans-serif;margin:24px;color:#334155;background:#f8fafc;}
            h1{font-size:22px;margin:0 0 10px;color:#0f172a;}
            .muted{color:#64748b;margin-bottom:6px;}
            .cards{display:flex;gap:12px;margin:20px 0;}
            .card{border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:12px 16px;min-width:160px;box-shadow:0 1px 3px rgba(0,0,0,0.05);}
            .card strong {font-size:18px;color:#0f172a;}
            table{border-collapse:collapse;width:100%;margin-top:16px;}
            th,td{border:1px solid #e2e8f0;padding:10px 12px;vertical-align:top;font-size:13px;}
            th{background:#f1f5f9;text-align:left;color:#475569;font-weight:700;}
            .ok{color:#065f46;font-weight:700;}
            .warn{color:#9a3412;font-weight:700;}
            .na{color:#4b5563;font-weight:700;}
            .section{margin-top:28px;}
          </style></head><body>
          <h1>Barangay Document Audit & Compliance Tracker</h1>
          <div class="muted">Active Barangay: <strong>${escapeHtml(getActiveBarangay())}</strong></div>
          <div class="muted">Exported Date: <strong>${escapeHtml(new Date(exportObj.exportedAt).toLocaleString())}</strong></div>
          <div class="cards">
            <div class="card"><strong>${progress.percent}%</strong><div class="muted" style="margin:4px 0 0;">Compliance Rate</div></div>
            <div class="card"><strong>${progress.total}</strong><div class="muted" style="margin:4px 0 0;">Total Required</div></div>
            <div class="card"><strong>${progress.available}</strong><div class="muted" style="margin:4px 0 0;">Available</div></div>
            <div class="card"><strong>${progress.pending}</strong><div class="muted" style="margin:4px 0 0;">Pending</div></div>
          </div>

          ${REQUIRED_CATEGORIES.map((cat) => {
            const rows = cat.items
              .map((item) => {
                const rec = state.categories?.[cat.id]?.[item];
                const st = rec?.status || '';
                const cls =
                  st === STATUS.AVAILABLE ? 'ok' : st === STATUS.PENDING ? 'warn' : st === STATUS.N_A ? 'na' : 'muted';
                const label = statusToLabel(st);
                return `<tr><td style="width: 50%; font-weight: 600;">${escapeHtml(item)}</td><td style="width: 20%;"><span class="${cls}">${escapeHtml(label)}</span></td><td style="width: 15%; font-family: monospace;">${escapeHtml(rec?.date || '—')}</td><td style="width: 15%;">${escapeHtml(rec?.notes || '—')}</td></tr>`;
              })
              .join('');
            return `<div class="section"><h2 style="font-size:15px;margin:0 0 10px;color:#0f172a;border-bottom:2px solid #cbd5e1;padding-bottom:6px;">${escapeHtml(cat.title)}</h2><table><thead><tr><th>Document</th><th>Status</th><th>Date Verified</th><th>Remarks/Notes</th></tr></thead><tbody>${rows}</tbody></table></div>`;
          }).join('')}

          </body></html>
        `);
        printWin.document.close();
        printWin.focus();
      }
    });
  }

  // Bind close buttons and overlays for slide drawer
  const closeBtn = document.getElementById('drawer-close');
  const overlay = document.getElementById('drawer-overlay');
  if (closeBtn && overlay) {
    closeBtn.addEventListener('click', () => {
      overlay.classList.remove('active');
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.classList.remove('active');
      }
    });
  }

  // Close status absolute popover dropdown on outside clicks
  document.addEventListener('click', () => {
    document.querySelectorAll('.status-popover-menu').forEach(menu => menu.remove());
  });
}

// Bootstrap on DOM ready
window.addEventListener('DOMContentLoaded', () => {
  try {
    if (typeof REQUIRED_CATEGORIES !== 'undefined') {
      initTracker();
    } else {
      console.warn('REQUIRED_CATEGORIES not available from tracker-docs.js import.');
    }
  } catch (e) {
    console.error('Tracker init failed:', e);
  }
});
