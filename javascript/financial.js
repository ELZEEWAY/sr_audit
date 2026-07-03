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
const SELECT_BARANGAY = document.getElementById('barangay-select');
const LABEL_BARANGAY = document.getElementById('active-barangay-label');

// Audit Workflow Elements
const AUDIT_OVERLAY = document.getElementById('audit-overlay');
const CONFIRMATION_LETTER_INPUT = document.getElementById('confirmationLetter');
const CONFIRMATION_LETTER_PREVIEW = document.getElementById('confirmation-letter-preview');
const CONFIRMATION_LETTER_DROP_ZONE = document.getElementById('confirmation-letter-drop-zone');
const STEP_2 = document.getElementById('step2');
const STEP_3 = document.getElementById('step3');
const GENERATE_REPORT_BTN = document.getElementById('generate-report-btn');

// Step 2 Document Check Elements
const DOCUMENT_CHECKS = {
  budget: {
    verified: document.getElementById('budget-verified'),
    fileInput: document.getElementById('scannedBudget'),
    filePreview: document.getElementById('scanned-budget-preview'),
    amountInput: document.getElementById('totalApprovedBudget'),
    label: 'Approved Budget'
  },
  bond: {
    verified: document.getElementById('bond-verified'),
    fileInput: document.getElementById('bondDocument'),
    filePreview: document.getElementById('bond-document-preview'),
    amountInput: document.getElementById('maximumBondCoverage'),
    label: 'Fidelity Bond Certificate'
  },
  bank: {
    verified: document.getElementById('bank-verified'),
    fileInput: document.getElementById('statementScan'),
    filePreview: document.getElementById('statement-scan-preview'),
    amountInput: document.getElementById('endingBankBalance'),
    label: 'Bank Book & Bank Statements'
  },
  checkRegister: {
    verified: document.getElementById('check-register-verified'),
    fileInput: document.getElementById('logBookScan'),
    filePreview: document.getElementById('log-book-scan-preview'),
    label: 'Check Register Log Book'
  },
  af51: {
    verified: document.getElementById('af51-verified'),
    textInput: document.getElementById('bookletSerialRange'),
    label: 'Accountable Form 51 (AF-51 Receipt Book)'
  },
  coa0016: {
    verified: document.getElementById('coa0016-verified'),
    fileInput: document.getElementById('rcdScan'),
    filePreview: document.getElementById('rcd-scan-preview'),
    amountInput: document.getElementById('totalRecordedCollections'),
    label: 'COA Form 0016 (Report of Collections and Deposits - RCD)'
  },
  checksDv: {
    verified: document.getElementById('checks-dv-verified'),
    fileInput: document.getElementById('checksDvScan'),
    filePreview: document.getElementById('checks-dv-scan-preview'),
    amountInput: document.getElementById('totalDisbursedAmount'),
    label: 'Barangay Checks & Disbursement Vouchers (DV)'
  }
};

// Summary Report Elements
const BUDGET_COLLECTIONS_INSIGHT = document.getElementById('budget-collections-insight');
const MISSING_FILES_INSIGHT = document.getElementById('missing-files-insight');

const TABLE_BODY = document.getElementById('financialTableBody');
const REPORT_NOTIFICATION = document.getElementById('report-notification');
const PREVIEW_MODAL = document.getElementById('preview-modal');
const PREVIEW_CONTENT = document.getElementById('preview-content');
const PREVIEW_PRINT_BTN = document.getElementById('preview-print-btn');
const PREVIEW_CLOSE_BTN = document.getElementById('preview-close-btn');
const PREVIEW_DOWNLOAD_BTN = document.getElementById('preview-download-btn');

function getActiveBarangay() {
  let active = localStorage.getItem(KEY_ACTIVE);
  if (!active || !BARANGAYS.includes(active)) {
    active = BARANGAYS[0];
    localStorage.setItem(KEY_ACTIVE, active);
  }
  return active;
}

function buildBarangaySelector() {
  if (!SELECT_BARANGAY) return;

  BARANGAYS.forEach((barangay) => {
    const option = document.createElement('option');
    option.value = barangay;
    option.textContent = barangay;
    SELECT_BARANGAY.appendChild(option);
  });

  SELECT_BARANGAY.value = getActiveBarangay();
  SELECT_BARANGAY.addEventListener('change', () => {
    localStorage.setItem(KEY_ACTIVE, SELECT_BARANGAY.value);
    if (LABEL_BARANGAY) {
      LABEL_BARANGAY.textContent = SELECT_BARANGAY.value;
    }
    loadAuditDataAndRenderTable();
  });
  SELECT_BARANGAY.disabled = true;
  SELECT_BARANGAY.title = 'Barangay is selected at login and cannot be changed here.';
}

function readAndPreviewFile(fileInput, previewElement) {
  const file = fileInput.files[0];
  if (!file) {
    previewElement.innerHTML = '';
    return;
  }

  if (!['image/png', 'image/jpeg', 'application/pdf'].includes(file.type)) {
    previewElement.innerHTML = `<span style="color: var(--danger);">Invalid file type.</span>`;
    fileInput.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const fileUrl = e.target.result;
    if (file.type.startsWith('image')) {
      previewElement.innerHTML = `<img src="${fileUrl}" alt="${file.name}" /><span>${file.name}</span>`;
    } else if (file.type === 'application/pdf') {
      previewElement.innerHTML = `<i class="fas fa-file-pdf" style="font-size: 24px; color: var(--dilg-red);"></i><span>${file.name}</span>`;
    }
  };
  reader.onerror = () => {
    previewElement.innerHTML = `<span style="color: var(--danger);">Failed to read file.</span>`;
  };
  reader.readAsDataURL(file);
}

async function saveAuditData() {
  const activeBarangay = getActiveBarangay();
  const auditData = {};
  const existingAudit = await SRAuditDB.financial.getAuditData(activeBarangay);

  // Step 1 Data
  const confirmationLetterFile = CONFIRMATION_LETTER_INPUT.files[0];
  if (confirmationLetterFile) {
    auditData.confirmationLetter = {
      fileBase64: await readFileAsBase64(confirmationLetterFile),
      date: new Date().toISOString(),
    };
  } else if (existingAudit?.confirmationLetter) {
    auditData.confirmationLetter = existingAudit.confirmationLetter; // Keep existing if not updated
  }

  // Step 2 Data
  for (const key in DOCUMENT_CHECKS) {
    const check = DOCUMENT_CHECKS[key];
    const data = {};

    if (check.verified) data.verified = check.verified.checked;

    if (check.fileInput && check.fileInput.files[0]) {
      data.fileBase64 = await readFileAsBase64(check.fileInput.files[0]);
      data.date = new Date().toISOString();
    } else if (existingAudit?.[key]?.fileBase64) {
      data.fileBase64 = existingAudit[key].fileBase64;
      data.date = existingAudit[key].date;
    }

    if (check.amountInput) data.amount = parseFloat(check.amountInput.value) || 0;
    if (check.textInput) data.textInput = check.textInput.value.trim();

    if (Object.keys(data).length > 0) {
      auditData[key] = data;
    }
  }
  
  await SRAuditDB.financial.updateAuditData(activeBarangay, auditData);
  await renderTable();
  await updateSummaryInsights();
}

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

function toggleAuditWorkflowLock() {
  if (!AUDIT_OVERLAY || !CONFIRMATION_LETTER_INPUT || !STEP_2 || !STEP_3) return;

  const isConfirmationLetterUploaded = CONFIRMATION_LETTER_INPUT.files.length > 0;

  if (isConfirmationLetterUploaded) {
    AUDIT_OVERLAY.classList.remove('active');
    STEP_2.classList.remove('locked');
    STEP_3.classList.remove('locked');
  } else {
    AUDIT_OVERLAY.classList.add('active');
    STEP_2.classList.add('locked');
    STEP_3.classList.add('locked');
  }
}

function assignFileInputFiles(fileInput, files) {
  if (!files || files.length === 0) return;
  const dataTransfer = new DataTransfer();
  Array.from(files).forEach((file) => dataTransfer.items.add(file));
  fileInput.files = dataTransfer.files;
}

function setupFileUploadInteractions() {
  const dropZones = document.querySelectorAll('.drop-zone, .file-micro-upload');
  dropZones.forEach((zone) => {
    const fileInput = zone.querySelector('input[type="file"]');
    if (!fileInput) return;

    zone.addEventListener('click', () => fileInput.click());

    zone.addEventListener('dragenter', (event) => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragover', (event) => {
      event.preventDefault();
      zone.classList.add('drag-over');
    });

    zone.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over');
    });

    zone.addEventListener('drop', (event) => {
      event.preventDefault();
      zone.classList.remove('drag-over');
      const files = event.dataTransfer?.files;
      if (files && files.length > 0) {
        assignFileInputFiles(fileInput, files);
        fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });

  const microButtons = document.querySelectorAll('.micro-upload-btn');
  microButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault();
      const wrapper = button.closest('.file-micro-upload');
      if (!wrapper) return;
      const fileInput = wrapper.querySelector('input[type="file"]');
      if (fileInput) fileInput.click();
    });
  });
}

function formatDate(isoString) {
  if (!isoString) return '—';
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return isoString;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

async function renderTable() {
  if (!TABLE_BODY) return;
  const activeBarangay = getActiveBarangay();
  const auditData = await SRAuditDB.financial.getAuditData(activeBarangay);
  const allDocsVerified = ['budget', 'bond', 'bank', 'checkRegister', 'af51', 'coa0016', 'checksDv']
    .every((key) => auditData?.[key]?.verified);
  const hasAnyAmount = !!(
    auditData?.budget?.amount ||
    auditData?.coa0016?.amount ||
    auditData?.checksDv?.amount
  );

  const rows = [
    {
      pillar: 'Pre-Audit Authorization',
      status: auditData?.confirmationLetter?.fileBase64 ? 'Completed' : 'Pending',
      lastUpdated: auditData?.confirmationLetter?.date ? formatDate(auditData.confirmationLetter.date) : '—',
      action: '<span class="badge">View</span>'
    },
    {
      pillar: 'Document Verification',
      status: allDocsVerified ? 'Completed' : 'Pending',
      lastUpdated: auditData?.lastUpdated ? formatDate(auditData.lastUpdated) : '—',
      action: '<span class="badge">Review</span>'
    },
    {
      pillar: 'Audit Summary Report',
      status: hasAnyAmount ? 'Ready' : 'Incomplete',
      lastUpdated: auditData?.lastUpdated ? formatDate(auditData.lastUpdated) : '—',
      action: '<span class="badge">Preview</span>'
    }
  ];

  TABLE_BODY.innerHTML = rows.map((row) => `
    <tr>
      <td>${row.pillar}</td>
      <td>${row.status}</td>
      <td>${row.lastUpdated}</td>
      <td class="action-col">${row.action}</td>
    </tr>
  `).join('');
}

async function updateSummaryInsights() {
  const activeBarangay = getActiveBarangay();
  const auditData = await SRAuditDB.financial.getAuditData(activeBarangay);

  let totalApprovedBudget = auditData?.budget?.amount || 0;
  let totalRecordedCollections = auditData?.coa0016?.amount || 0;

  if (BUDGET_COLLECTIONS_INSIGHT) {
    const diff = totalApprovedBudget - totalRecordedCollections;
    BUDGET_COLLECTIONS_INSIGHT.textContent = `₱${totalApprovedBudget.toLocaleString('en-PH')} vs ₱${totalRecordedCollections.toLocaleString('en-PH')} (${diff >= 0 ? 'Surplus' : 'Deficit'}: ₱${diff.toLocaleString('en-PH')})`;
    BUDGET_COLLECTIONS_INSIGHT.style.color = diff >= 0 ? 'green' : 'var(--dilg-red)';
  }

  let missingFiles = [];
  if (!auditData?.confirmationLetter?.fileBase64) missingFiles.push('Confirmation Letter');
  for (const key in DOCUMENT_CHECKS) {
    const check = DOCUMENT_CHECKS[key];
    if (check.fileInput && !auditData?.[key]?.fileBase64 && check.verified?.checked) {
        missingFiles.push(check.label);
    } else if (check.textInput && !auditData?.[key]?.textInput && check.verified?.checked) {
        missingFiles.push(check.label);
    }
  }

  if (MISSING_FILES_INSIGHT) {
    if (missingFiles.length > 0) {
      MISSING_FILES_INSIGHT.textContent = missingFiles.join(', ');
      MISSING_FILES_INSIGHT.style.color = 'var(--dilg-red)';
    } else {
      MISSING_FILES_INSIGHT.textContent = 'None';
      MISSING_FILES_INSIGHT.style.color = 'green';
    }
  }
}

async function generateAndPrintReport() {
  const activeBarangay = getActiveBarangay();
  const storedAudit = (await SRAuditDB?.financial?.getAuditData?.(activeBarangay)) || {};

  // Simple validation: require confirmation letter and at least one key amount
  const hasConfirmation = !!(storedAudit?.confirmationLetter?.fileBase64 || CONFIRMATION_LETTER_INPUT.files[0]);
  const hasAnyAmount = !!(storedAudit?.budget?.amount || storedAudit?.coa0016?.amount || (DOCUMENT_CHECKS.checksDv && DOCUMENT_CHECKS.checksDv.amountInput && DOCUMENT_CHECKS.checksDv.amountInput.value));

  const missing = [];
  if (!hasConfirmation) missing.push('Confirmation Letter');
  if (!hasAnyAmount) missing.push('Budget or Collections or Disbursed Amount');

  if (missing.length > 0) {
    showNotification('error', `Please provide: ${missing.join(', ')}`);
    return;
  }

  // Build report for preview using storedAudit as source of truth
  const auditData = storedAudit;
  const reportHtml = `
    <div class="print-report-content">
      <div class="header-info">
        <h1>Financial Audit Summary Report</h1>
        <p><strong>Barangay:</strong> ${activeBarangay}</p>
        <p><strong>Date Generated:</strong> ${formatDate(new Date().toISOString())}</p>
      </div>

      <h2>1. Pre-Audit Authorization</h2>
      <div class="section">
        <h3>Confirmation Letter</h3>
        <div class="document-item">
          <p><strong>Status:</strong> ${auditData?.confirmationLetter?.fileBase64 || CONFIRMATION_LETTER_INPUT.files[0] ? '<span class="status-badge status-uploaded">Uploaded</span>' : '<span class="status-badge status-pending">Pending</span>'}</p>
          ${auditData?.confirmationLetter?.date ? `<p><strong>Uploaded On:</strong> ${formatDate(auditData.confirmationLetter.date)}</p>` : ''}
        </div>
      </div>

      <h2>2. Document Verification & Core Audit Ledger</h2>
      <div class="section">
        ${Object.entries(DOCUMENT_CHECKS).map(([key, check]) => `
          <h3>${check.label}</h3>
          <div class="document-item">
            <p><strong>Verification Status:</strong> ${auditData?.[key]?.verified ? '<span class="status-badge status-uploaded">Verified</span>' : '<span class="status-badge status-pending">Not Verified</span>'}</p>
            ${check.amountInput ? `<p><strong>Amount:</strong> ₱${((auditData?.[key]?.amount) || 0).toLocaleString('en-PH')}</p>` : ''}
            ${check.textInput ? `<p><strong>Serial Range:</strong> ${auditData?.[key]?.textInput || ''}</p>` : ''}
          </div>
        `).join('')}
      </div>

      <h2>3. Synthesis & Audit Summary</h2>
      <div class="section">
        <p><strong>Budget vs Collections:</strong> ${BUDGET_COLLECTIONS_INSIGHT?.textContent || 'N/A'}</p>
        <p><strong>Missing Files:</strong> ${MISSING_FILES_INSIGHT?.textContent || 'N/A'}</p>
      </div>
    </div>
  `;

  openPreviewModal(reportHtml);
  showNotification('success', 'Report ready — preview available.');
}

// Notification helper
function showNotification(type, message, timeout = 4000) {
  if (!REPORT_NOTIFICATION) return alert(message);
  const el = document.createElement('div');
  el.className = `toast ${type === 'error' ? 'error' : 'success'}`;
  el.textContent = message;
  REPORT_NOTIFICATION.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade');
    setTimeout(() => el.remove(), 300);
  }, timeout);
}

// Preview modal helpers
function openPreviewModal(html) {
  if (!PREVIEW_MODAL || !PREVIEW_CONTENT) return;
  PREVIEW_CONTENT.innerHTML = html;
  PREVIEW_MODAL.classList.add('open');
  PREVIEW_MODAL.setAttribute('aria-hidden', 'false');
}

function closePreviewModal() {
  if (!PREVIEW_MODAL) return;
  PREVIEW_MODAL.classList.remove('open');
  PREVIEW_MODAL.setAttribute('aria-hidden', 'true');
}

// Print from preview - copy to print container and call print
if (PREVIEW_PRINT_BTN) {
  PREVIEW_PRINT_BTN.addEventListener('click', () => {
    const printContainer = document.getElementById('print-report-container');
    if (!printContainer || !PREVIEW_CONTENT) return;
    printContainer.innerHTML = PREVIEW_CONTENT.innerHTML;
    closePreviewModal();
    window.print();
  });
}

if (PREVIEW_CLOSE_BTN) {
  PREVIEW_CLOSE_BTN.addEventListener('click', () => closePreviewModal());
}

if (PREVIEW_DOWNLOAD_BTN) {
  PREVIEW_DOWNLOAD_BTN.addEventListener('click', () => alert('PDF export not implemented yet.'));
}

setupFileUploadInteractions();

// Event Listeners
CONFIRMATION_LETTER_INPUT.addEventListener('change', async () => {
  readAndPreviewFile(CONFIRMATION_LETTER_INPUT, CONFIRMATION_LETTER_PREVIEW);
  await saveAuditData();
  toggleAuditWorkflowLock();
});

for (const key in DOCUMENT_CHECKS) {
  const check = DOCUMENT_CHECKS[key];
  if (check.fileInput) {
    check.fileInput.addEventListener('change', async () => {
      readAndPreviewFile(check.fileInput, check.filePreview);
      await saveAuditData();
    });
  }
  if (check.verified) {
    check.verified.addEventListener('change', async () => {
      await saveAuditData();
    });
  }
  if (check.amountInput) {
    check.amountInput.addEventListener('input', async () => {
      await saveAuditData();
    });
  }
  if (check.textInput) {
    check.textInput.addEventListener('input', async () => {
      await saveAuditData();
    });
  }
}

if (GENERATE_REPORT_BTN) {
  GENERATE_REPORT_BTN.addEventListener('click', generateAndPrintReport);
}

async function loadAuditDataAndRenderTable() {
  const activeBarangay = getActiveBarangay();
  const auditData = await SRAuditDB.financial.getAuditData(activeBarangay);

  // Load Step 1 data
  if (auditData?.confirmationLetter?.fileBase64) {
    const response = await fetch(auditData.confirmationLetter.fileBase64);
    const blob = await response.blob();
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([blob], 'confirmation_letter', { type: blob.type }));
    CONFIRMATION_LETTER_INPUT.files = dataTransfer.files;
    readAndPreviewFile(CONFIRMATION_LETTER_INPUT, CONFIRMATION_LETTER_PREVIEW);
  } else {
    CONFIRMATION_LETTER_INPUT.value = '';
    CONFIRMATION_LETTER_PREVIEW.innerHTML = '';
  }

  // Load Step 2 data
  for (const key in DOCUMENT_CHECKS) {
    const check = DOCUMENT_CHECKS[key];
    const data = auditData?.[key];
    if (data) {
      if (check.verified) check.verified.checked = data.verified || false;
      if (check.fileInput && data.fileBase64) {
        const response = await fetch(data.fileBase64);
        const blob = await response.blob();
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(new File([blob], `${key}_document`, { type: blob.type }));
        check.fileInput.files = dataTransfer.files;
        readAndPreviewFile(check.fileInput, check.filePreview);
      } else if (check.fileInput) {
          check.fileInput.value = '';
          check.filePreview.innerHTML = '';
      }
      if (check.amountInput) check.amountInput.value = data.amount || '';
      if (check.textInput) check.textInput.value = data.textInput || '';
    } else {
        // Reset fields if no data
        if (check.verified) check.verified.checked = false;
        if (check.fileInput) {
            check.fileInput.value = '';
            check.filePreview.innerHTML = '';
        }
        if (check.amountInput) check.amountInput.value = '';
        if (check.textInput) check.textInput.value = '';
    }
  }

  renderTable();
  toggleAuditWorkflowLock();
  updateSummaryInsights();
}

async function init() {
  await SRAuditDB.ready();
  buildBarangaySelector();
  if (LABEL_BARANGAY) {
    LABEL_BARANGAY.textContent = getActiveBarangay();
  }
  loadAuditDataAndRenderTable();
}

init();