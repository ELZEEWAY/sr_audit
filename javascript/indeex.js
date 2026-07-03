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
const elSelect = document.getElementById('barangay-select');
const balanceEl = document.getElementById('balance-value');
const assetCountEl = document.getElementById('asset-count');
const documentCountEl = document.getElementById('document-count');
const progressFdp = document.getElementById('progress-fdp');
const progressSk = document.getElementById('progress-sk');
const progressLupon = document.getElementById('progress-lupon');
const barFdp = document.getElementById('bar-fdp');
const barSk = document.getElementById('bar-sk');
const barLupon = document.getElementById('bar-lupon');

function getActiveBarangay() {
  let active = localStorage.getItem(KEY_ACTIVE);
  if (!active || !BARANGAYS.includes(active)) {
    active = BARANGAYS[0];
    localStorage.setItem(KEY_ACTIVE, active);
  }
  return active;
}

function buildSelect() {
  BARANGAYS.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    elSelect.appendChild(option);
  });
  elSelect.value = getActiveBarangay();
  elSelect.addEventListener('change', () => {
    localStorage.setItem(KEY_ACTIVE, elSelect.value);
    renderDashboard();
  });
  elSelect.disabled = true;
  elSelect.title = 'Barangay is selected at login and cannot be changed here.';
}

function formatCurrency(value) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2
  }).format(value);
}

async function renderDashboard() {
  const barangay = getActiveBarangay();
  const assetCount = await SRAuditDB.inventory.countByBarangay(barangay);
  const financialCount = await SRAuditDB.financial.countByBarangay(barangay);
  const docCount = await SRAuditDB.documents.countByBarangay(barangay);

  if (balanceEl) balanceEl.textContent = formatCurrency(0);
  if (assetCountEl) assetCountEl.textContent = assetCount;
  if (documentCountEl) documentCountEl.textContent = docCount;

  const fdpProgress = Math.min(100, Math.round((docCount / 5) * 100));
  const skProgress = Math.min(100, Math.round((financialCount / 6) * 100));
  const luponProgress = Math.min(100, Math.round((assetCount / 8) * 100));

  if (progressFdp) progressFdp.textContent = `${fdpProgress}%`;
  if (progressSk) progressSk.textContent = `${skProgress}%`;
  if (progressLupon) progressLupon.textContent = `${luponProgress}%`;
  if (barFdp) barFdp.style.width = `${fdpProgress}%`;
  if (barSk) barSk.style.width = `${skProgress}%`;
  if (barLupon) barLupon.style.width = `${luponProgress}%`;
}

async function init() {
  await SRAuditDB.ready();
  buildSelect();
  await renderDashboard();
}

init();
