const BARANGAYS = [
  "Aplaya",
  "Balibago",
  "Caingin",
  "Dila",
  "Dita",
  "Don Jose",
  "Ibaba",
  "Kanluran",
  "Labas",
  "Macabling",
  "Malitlit",
  "Malusak",
  "Market Area",
  "Pooc (Pook)",
  "Pulong Santa Cruz",
  "Santo Domingo",
  "Sinalhan",
  "Tagapo"
];

const KEY_ACTIVE = 'sr_active_barangay';
const KEY_OFFICE = 'sr_active_office';

const OFFICES = [
  { name: 'Administration', icon: 'fa-building-columns', description: 'Oversees operations, records, and office supplies.' },
  { name: 'Finance', icon: 'fa-coins', description: 'Handles financial assets, budgets, and cash-related property.' },
  { name: 'Health', icon: 'fa-heart-pulse', description: 'Maintains medical equipment and health support assets.' },
  { name: 'Engineering', icon: 'fa-wrench', description: 'Tracks tools, maintenance equipment, and infrastructure property.' },
  { name: 'Disaster Response', icon: 'fa-shield-alt', description: 'Audits rescue gear, communication devices, and emergency supplies.' }
];

const SUB_OFFICES = {
  'Administration': [
    { id: 'punong_barangay', name: 'Office of the Punong Barangay (Barangay Captain)', icon: 'fa-user-tie' },
    { id: 'barangay_secretary', name: 'Office of the Barangay Secretary', icon: 'fa-file-signature' },
    { id: 'session_hall', name: 'Barangay Session Hall', icon: 'fa-users' },
    { id: 'vaw_desk', name: 'Barangay VAW Desk', icon: 'fa-person-shelter' },
    { id: 'lupon_area', name: 'Katarungang Pambarangay (Lupon) Area', icon: 'fa-gavel' }
  ],
  'Finance': [
    { id: 'barangay_treasurer', name: 'Office of the Barangay Treasurer', icon: 'fa-vault' }
  ],
  'Health': [
    { id: 'health_station', name: 'Barangay Health Station / Health Center', icon: 'fa-file-medical' },
    { id: 'nutrition_post', name: 'Barangay Nutrition Post', icon: 'fa-apple-whole' }
  ],
  'Engineering': [
    { id: 'tanod_headquarters', name: 'Barangay Tanod Headquarters', icon: 'fa-user-shield' },
    { id: 'utility_storage', name: 'Maintenance / Utility Storage Room', icon: 'fa-toolbox' }
  ],
  'Disaster Response': [
    { id: 'bdrrm_office', name: 'BDRRM Office / Emergency Operations Center', icon: 'fa-tower-broadcast' }
  ]
};

const elBarangaySelect = document.getElementById('barangay-select');
const elActiveLabelText = document.getElementById('active-barangay-label');
const elBtnAddItem = document.getElementById('btn-add-item');
const elSearchInput = document.getElementById('searchInput');
const elCategoryFilter = document.getElementById('categoryFilter');
const elInventoryBody = document.getElementById('inventoryBody');
const elInventoryTable = document.getElementById('inventoryTable');
const elOfficeSelectionScreen = document.getElementById('office-selection-screen');
const elSubOfficeSelectionScreen = document.getElementById('sub-office-selection-screen');
const elSubOfficesGrid = document.getElementById('subOfficesGrid');
const elSelectedCategoryTitle = document.getElementById('selected-category-title');
const elBtnBackCategories = document.getElementById('btn-back-categories');
const elBtnStartSubAudit = document.getElementById('btn-start-sub-audit');
const elAuditWorkspace = document.getElementById('audit-workspace');
const elOfficesGrid = document.getElementById('officesGrid');
const elAuditBarangayDisplay = document.getElementById('audit-barangay-display');
const elAuditOfficeDisplay = document.getElementById('audit-office-display');
const elBtnBackOffices = document.getElementById('btn-back-offices');
const elModalOverlay = document.getElementById('modal-overlay');
const elModalClose = document.getElementById('modal-close');
const elBtnCancel = document.getElementById('btn-cancel');
const elItemForm = document.getElementById('itemForm');
const elItemName = document.getElementById('itemName');
const elItemDescription = document.getElementById('itemDescription');
const elItemCategory = document.getElementById('itemCategory');
const elItemICSNumber = document.getElementById('itemICSNumber');
const elItemQuantity = document.getElementById('itemQuantity');
const elItemStatus = document.getElementById('itemStatus');
const elItemRemarks = document.getElementById('itemRemarks');
const elItemLocation = document.getElementById('itemLocation');
const elItemImage = document.getElementById('itemImage');
const elImagePreview = document.getElementById('imagePreview');
const elImageViewerOverlay = document.getElementById('image-viewer-overlay');
const elImageViewerImage = document.getElementById('image-viewer-image');
const elImageViewerClose = document.getElementById('image-viewer-close');
const elModalHeaderTitle = document.querySelector('.modal-header h3');

let currentImage = null;
let inventoryData = [];
let editingIndex = null;
let selectedCategory = null;
let selectedSubOffice = null;

function getActiveBarangay() {
  let active = localStorage.getItem(KEY_ACTIVE);
  if (!active || !BARANGAYS.includes(active)) {
    active = BARANGAYS[0];
    localStorage.setItem(KEY_ACTIVE, active);
  }
  return active;
}

function setActiveBarangay(name) {
  if (BARANGAYS.includes(name)) {
    localStorage.setItem(KEY_ACTIVE, name);
    localStorage.removeItem(KEY_OFFICE);
    window.location.reload();
  }
}

function getActiveOffice() {
  const raw = localStorage.getItem(KEY_OFFICE);
  if (!raw) return null;
  const [barangayName, officeName] = raw.split('|');
  if (barangayName !== getActiveBarangay()) return null;
  return officeName || null;
}

function setActiveOffice(name) {
  localStorage.setItem(KEY_OFFICE, `${getActiveBarangay()}|${name}`);
}


async function loadInventory() {
  const office = getActiveOffice();
  if (!office) return [];
  const barangay = getActiveBarangay();

  // Try to load from IndexedDB/SQLite first
  try {
    const localItems = await SRAuditDB.inventory.list(barangay, office);
    if (localItems && localItems.length > 0) {
      return localItems;
    }
  } catch (err) {
    console.error('Failed to load from local SQLite:', err);
  }

  // Fallback to server/seed if local DB is empty
  const currentUserStr = sessionStorage.getItem('currentUser');
  if (!currentUserStr) return [];
  const currentUser = JSON.parse(currentUserStr);

  try {
    const response = await fetch(`https://sr-audit-api.onrender.com/api/inventory?barangay_id=${currentUser.barangay_id}&user_role=${currentUser.role}`);
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const items = await response.json();
    const filtered = items.filter(item => item.office === office).map(item => ({
      id: item.id,
      itemName: item.item_name,
      category: item.classification,
      description: item.custodian || '',
      icsNumber: item.serial_number || '',
      quantity: item.qty,
      status: item.condition,
      remarks: '',
      location: '',
      image: null
    }));

    if (filtered.length > 0) {
      await SRAuditDB.inventory.replaceAll(barangay, office, filtered);
    }
    return filtered;
  } catch (error) {
    console.error('Failed to load inventory from server:', error);
    return [];
  }
}

async function saveInventory(data) {
  const barangay = getActiveBarangay();
  const office = getActiveOffice();
  if (barangay && office) {
    try {
      await SRAuditDB.inventory.replaceAll(barangay, office, data);
    } catch (err) {
      console.error('Failed to persist inventory locally:', err);
    }
  }
}

function openModal(indexToEdit = null) {
  editingIndex = indexToEdit;
  currentImage = null;
  elItemForm.reset();
  elImagePreview.innerHTML = '';

  if (indexToEdit !== null) {
    const item = inventoryData[indexToEdit];
    if (elModalHeaderTitle) elModalHeaderTitle.textContent = 'Edit Item';
    elItemName.value = item.itemName;
    elItemDescription.value = item.description;
    elItemCategory.value = item.category;
    elItemICSNumber.value = item.icsNumber || '';
    elItemQuantity.value = item.quantity;
    elItemStatus.value = item.status;
    elItemRemarks.value = item.remarks || '';
    elItemLocation.value = item.location || '';
    if (item.image) {
      currentImage = item.image;
      displayImagePreview(currentImage);
    }
  } else {
    if (elModalHeaderTitle) elModalHeaderTitle.textContent = 'Add New Item';
  }

  elModalOverlay.classList.add('active');
}

function closeModal() {
  elModalOverlay.classList.remove('active');
  elItemForm.reset();
  currentImage = null;
  elImagePreview.innerHTML = '';
  editingIndex = null;
  if (elModalHeaderTitle) elModalHeaderTitle.textContent = 'Add New Item';
}

function handleImageSelect(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    alert('Only PNG and JPEG images are allowed.');
    elItemImage.value = '';
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert('Image size must be less than 5MB.');
    elItemImage.value = '';
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    currentImage = e.target.result;
    displayImagePreview(currentImage);
  };
  reader.onerror = () => {
    alert('Failed to read image file.');
  };
  reader.readAsDataURL(file);
}

function displayImagePreview(base64) {
  elImagePreview.innerHTML = '';
  const img = document.createElement('img');
  img.src = base64;
  img.className = 'preview-img';
  elImagePreview.appendChild(img);
}

function openImageViewer(imageSrc) {
  elImageViewerImage.src = imageSrc;
  elImageViewerOverlay.classList.add('active');
}

function closeImageViewer() {
  elImageViewerOverlay.classList.remove('active');
}

async function renderInventory(data = null) {
  if (!getActiveOffice()) {
    return;
  }

  if (!data) {
    data = await loadInventory();
  }
  inventoryData = data;

  // Clear HTML Container Before Re-rendering
  elInventoryBody.innerHTML = '';

  if (inventoryData.length === 0) {
    elInventoryBody.innerHTML = `
      <tr class="empty-row">
        <td colspan="9" class="empty-message">No items recorded. Click "Add Item" to begin.</td>
      </tr>
    `;
    return;
  }

  // Draw every saved item sequentially from the growing data array
  inventoryData.forEach((item, index) => {
    const tr = document.createElement('tr');
    tr.dataset.index = index;

    const imageHTML = item.image
      ? `<img src="${item.image}" alt="${item.itemName}" class="item-image" style="cursor: pointer;" data-image-src="${item.image}" />`
      : '<div class="item-image-placeholder">📦</div>';

    tr.innerHTML = `
      <td class="col-item">
        <p class="item-name">${escapeHtml(item.itemName)}</p>
      </td>
      <td class="col-category">
        <span class="item-category">${escapeHtml(item.category)}</span>
      </td>
      <td class="col-description">
        <p class="item-description">${escapeHtml(item.description)}</p>
      </td>
      <td class="col-ics">
        <span class="item-ics">${item.icsNumber ? escapeHtml(item.icsNumber) : '—'}</span>
      </td>
      <td class="col-quantity">
        <span class="item-quantity">${item.quantity}</span>
        <span class="quantity-units">PCS</span>
      </td>
      <td class="col-image">${imageHTML}</td>
      <td class="col-location">
        <span class="item-location">${item.location ? escapeHtml(item.location) : '—'}</span>
      </td>
      <td class="col-remarks">
        <span class="item-remarks">${item.remarks ? escapeHtml(item.remarks) : '—'}</span>
      </td>
      <td class="col-actions">
        <button class="btn-edit" data-index="${index}" aria-label="Edit item">✎</button>
      </td>
    `;
    elInventoryBody.appendChild(tr);
  });

  document.querySelectorAll('.btn-edit').forEach((btn) => {
    btn.addEventListener('click', handleEditItem);
  });

  document.querySelectorAll('[data-image-src]').forEach((img) => {
    img.addEventListener('click', (e) => {
      openImageViewer(e.target.src);
    });
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function getStatusClass(status) {
  switch ((status || '').toString().trim().toLowerCase()) {
    case 'good':
      return 'badge-good';
    case 'broken':
    case 'unserviceable':
      return 'badge-broken';
    case 'missing':
      return 'badge-missing';
    case 'serviceable':
      return 'badge-good';
    default:
      return 'badge-missing';
  }
}

async function handleFormSubmit(event) {
  event.preventDefault();

  // Enforce Unique Object Instantiation: A completely brand-new item object declared on every cycle
  const newItemObject = {
    itemName: elItemName.value.trim(),
    description: elItemDescription.value.trim(),
    category: elItemCategory.value,
    icsNumber: elItemICSNumber.value.trim(),
    quantity: Number(elItemQuantity.value) || 0,
    status: elItemStatus.value,
    remarks: elItemRemarks.value.trim(),
    location: elItemLocation.value.trim(),
    image: currentImage,
    createdAt: new Date().toISOString()
  };

  if (!newItemObject.itemName || !newItemObject.description || !newItemObject.category || newItemObject.quantity <= 0) {
    alert('Please fill in all required fields with valid data.');
    return;
  }

  // Load the current active items collection array
  const activeOfficeItems = await loadInventory();

  if (editingIndex !== null) {
    // Modify existing item
    activeOfficeItems[editingIndex] = { ...activeOfficeItems[editingIndex], ...newItemObject };
  } else {
    // Fix Array State Push: Append new item using push method on the collection array
    activeOfficeItems.push(newItemObject);
  }

  await saveInventory(activeOfficeItems);
  await renderInventory(activeOfficeItems);
  closeModal();
  editingIndex = null;
}

async function handleEditItem(event) {
  const index = Number(event.target.dataset.index);
  if (!Number.isInteger(index) || index < 0) return;
  openModal(index);
}

async function handleDeleteItem(event) {
  const index = Number(event.target.dataset.index);
  if (!Number.isInteger(index) || index < 0) return;

  const confirmed = confirm('Delete this item? This action cannot be undone.');
  if (!confirmed) return;

  const inventory = await loadInventory();
  inventory.splice(index, 1);
  await saveInventory(inventory);
  await renderInventory(inventory);
}

function handleSearch(query, category = '') {
  const normalizedQuery = (query || '').toLowerCase().trim();
  const normalizedCategory = (category || '').toLowerCase().trim();

  document.querySelectorAll('#inventoryTable tbody tr').forEach((row) => {
    const index = Number(row.dataset.index);
    if (!Number.isInteger(index) || index < 0) {
      row.style.display = normalizedQuery || normalizedCategory ? 'none' : '';
      return;
    }

    const item = inventoryData[index];
    const itemName = item.itemName.toLowerCase();
    const description = item.description.toLowerCase();
    const categoryText = (item.category || '').toLowerCase();

    const matchesQuery =
      !normalizedQuery ||
      itemName.includes(normalizedQuery) ||
      description.includes(normalizedQuery) ||
      categoryText.includes(normalizedQuery);

    const matchesCategory =
      !normalizedCategory ||
      categoryText === normalizedCategory;

    row.style.display = matchesQuery && matchesCategory ? '' : 'none';
  });
}

function setupBarangaySelector() {
  BARANGAYS.forEach((name) => {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    elBarangaySelect.appendChild(option);
  });

  const activeBarangay = getActiveBarangay();
  elBarangaySelect.value = activeBarangay;
  elActiveLabelText.textContent = activeBarangay;

  elBarangaySelect.addEventListener('change', (e) => {
    setActiveBarangay(e.target.value);
  });
  elBarangaySelect.disabled = true;
  elBarangaySelect.title = 'Barangay is selected at login and cannot be changed here.';
}

const CUSTOM_OFFICES_KEY = 'sr_custom_offices';

// State schema helper to get custom offices by active Barangay key
function getCustomOfficesForBarangay(barangay) {
  const raw = localStorage.getItem(CUSTOM_OFFICES_KEY);
  if (!raw) return [];
  try {
    const state = JSON.parse(raw);
    return state[barangay] || [];
  } catch (e) {
    return [];
  }
}

function saveCustomOffice(barangay, office) {
  const raw = localStorage.getItem(CUSTOM_OFFICES_KEY);
  let state = {};
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch (e) {
      state = {};
    }
  }
  if (!state[barangay]) {
    state[barangay] = [];
  }
  state[barangay].push(office);
  localStorage.setItem(CUSTOM_OFFICES_KEY, JSON.stringify(state));
}

async function handleAddCustomOfficeClick() {
  const selectEl = document.querySelector('.active-barangay-select') || document.getElementById('barangay-select');
  const activeBarangay = selectEl ? selectEl.value : getActiveBarangay();

  const name = prompt("Enter Custom Office Name (e.g., SK Office):");
  if (!name || !name.trim()) return;

  const desc = prompt("Enter Brief Functional Description:");
  if (!desc || !desc.trim()) return;

  const newOffice = {
    name: name.trim(),
    icon: 'fa-building',
    description: desc.trim(),
    isCustom: true
  };

  saveCustomOffice(activeBarangay, newOffice);

  // Automatically register a fresh, empty isolated inventory array in the global formState registry
  if (!window.formState) {
    window.formState = {};
  }
  window.formState[newOffice.name] = [];

  renderOfficeCards();
}

function renderOfficeCards() {
  if (!elOfficesGrid) return;

  const selectEl = document.querySelector('.active-barangay-select') || document.getElementById('barangay-select');
  const activeBarangay = selectEl ? selectEl.value : getActiveBarangay();

  // Clear container
  elOfficesGrid.innerHTML = '';

  const customList = getCustomOfficesForBarangay(activeBarangay);
  const allOffices = [...OFFICES, ...customList];

  elOfficesGrid.innerHTML = allOffices.map((office) => `
    <article class="office-card" data-office="${office.name}" data-is-custom="${office.isCustom ? 'true' : 'false'}" tabindex="0" role="button">
      <div class="office-card-top">
        <span class="office-icon"><i class="fas ${office.icon || 'fa-building'}"></i></span>
        <div>
          <h3 class="office-name">${office.name}</h3>
        </div>
      </div>
      <p class="office-card-description">${escapeHtml(office.description)}</p>
    </article>
  `).join('') + `
    <article class="office-card btn-add-custom-office" id="btn-add-custom-office" tabindex="0" role="button" style="border: 2px dashed #cbd5e1; background: #f8fafc; cursor: pointer;">
      <div class="office-card-top">
        <span class="office-icon" style="background: #e2e8f0; color: #64748b;"><i class="fas fa-plus"></i></span>
        <div>
          <h3 class="office-name" style="color: #475569;">Add Custom Office</h3>
        </div>
      </div>
      <p class="office-card-description" style="color: #64748b;">Create a new specific custom office card for this Barangay.</p>
    </article>
  `;

  elOfficesGrid.querySelectorAll('.office-card').forEach((card) => {
    if (card.id === 'btn-add-custom-office') {
      card.addEventListener('click', handleAddCustomOfficeClick);
      return;
    }

    card.addEventListener('click', async (event) => {
      const office = event.currentTarget.dataset.office;
      const isCustom = event.currentTarget.dataset.isCustom === 'true';
      if (office) {
        if (isCustom) {
          // Directly enter audit workspace for custom office
          setActiveOffice(office);
          await showAuditWorkspace();
        } else {
          showSubOfficeSelection(office);
        }
      }
    });

    card.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        card.click();
      }
    });
  });
}

function showSubOfficeSelection(categoryName) {
  selectedCategory = categoryName;
  selectedSubOffice = null;

  if (elSelectedCategoryTitle) {
    elSelectedCategoryTitle.textContent = categoryName;
  }

  if (elBtnStartSubAudit) {
    elBtnStartSubAudit.disabled = true;
    elBtnStartSubAudit.classList.add('opacity-50', 'cursor-not-allowed');
  }

  const subOffices = SUB_OFFICES[categoryName] || [];
  if (elSubOfficesGrid) {
    elSubOfficesGrid.innerHTML = subOffices.map((sub) => `
      <article class="sub-office-card" data-sub-office-id="${sub.id}" data-sub-office-name="${sub.name}" tabindex="0" role="button">
        <span class="sub-office-icon"><i class="fas ${sub.icon}"></i></span>
        <h3 class="sub-office-name">${escapeHtml(sub.name)}</h3>
      </article>
    `).join('');

    elSubOfficesGrid.querySelectorAll('.sub-office-card').forEach((card) => {
      card.addEventListener('click', () => {
        elSubOfficesGrid.querySelectorAll('.sub-office-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        selectedSubOffice = {
          id: card.dataset.subOfficeId,
          name: card.dataset.subOfficeName
        };

        if (elBtnStartSubAudit) {
          elBtnStartSubAudit.disabled = false;
          elBtnStartSubAudit.classList.remove('opacity-50', 'cursor-not-allowed');
        }
      });
      card.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          card.click();
        }
      });
    });
  }

  elOfficeSelectionScreen.classList.remove('active');
  if (elSubOfficeSelectionScreen) {
    elSubOfficeSelectionScreen.classList.add('active');
  }
}

function handleBackCategories() {
  selectedCategory = null;
  selectedSubOffice = null;
  if (elSubOfficeSelectionScreen) {
    elSubOfficeSelectionScreen.classList.remove('active');
  }
  elOfficeSelectionScreen.classList.add('active');
}

function handleStartSubAudit() {
  if (!selectedCategory || !selectedSubOffice) return;
  const categoryKey = selectedCategory.toLowerCase().replace(/\s+/g, '_');
  const officeKey = selectedSubOffice.id;
  window.location.href = `inventory.html?category=${categoryKey}&office=${officeKey}`;
}

async function showOfficeSelection() {
  elAuditWorkspace.classList.remove('active');
  if (elSubOfficeSelectionScreen) {
    elSubOfficeSelectionScreen.classList.remove('active');
  }
  elOfficeSelectionScreen.classList.add('active');
}

async function showAuditWorkspace() {
  const activeOffice = getActiveOffice();
  if (!activeOffice) {
    await showOfficeSelection();
    return;
  }



  elOfficeSelectionScreen.classList.remove('active');
  if (elSubOfficeSelectionScreen) {
    elSubOfficeSelectionScreen.classList.remove('active');
  }
  elAuditWorkspace.classList.add('active');
  elAuditBarangayDisplay.textContent = getActiveBarangay();
  elAuditOfficeDisplay.textContent = activeOffice;
  elActiveLabelText.textContent = getActiveBarangay();

  // Hide the compare audit trigger panel button if the logged-in user is not DILG Admin
  const currentUserStr = sessionStorage.getItem('currentUser');
  if (currentUserStr) {
    const user = JSON.parse(currentUserStr);
    const compareBtn = document.getElementById('btn-compare-audit');
    if (compareBtn) {
      if (user.role === 'admin') {
        compareBtn.style.display = 'inline-flex';
      } else {
        compareBtn.style.display = 'none';
      }
    }
  }

  await renderInventory();
}

function handleBackOffices() {
  localStorage.removeItem(KEY_OFFICE);
  inventoryData = [];
  elInventoryBody.innerHTML = '';
  elBtnAddItem.disabled = false;
  showOfficeSelection(); // This doesn't need to be awaited here
}


function setupEventListeners() {
  elBtnAddItem.addEventListener('click', () => openModal());
  elModalClose.addEventListener('click', closeModal);
  elBtnCancel.addEventListener('click', closeModal);
  elBtnBackOffices.addEventListener('click', handleBackOffices);

  if (elBtnBackCategories) {
    elBtnBackCategories.addEventListener('click', handleBackCategories);
  }
  if (elBtnStartSubAudit) {
    elBtnStartSubAudit.addEventListener('click', handleStartSubAudit);
  }

  elModalOverlay.addEventListener('click', (e) => {
    if (e.target === elModalOverlay) {
      closeModal();
    }
  });

  elItemForm.addEventListener('submit', handleFormSubmit);
  elItemImage.addEventListener('change', handleImageSelect);

  elSearchInput.addEventListener('keyup', (e) => {
    handleSearch(e.target.value, elCategoryFilter.value);
  });

  if (elCategoryFilter) {
    elCategoryFilter.addEventListener('change', () => {
      handleSearch(elSearchInput.value, elCategoryFilter.value);
    });
  }

  elImageViewerClose.addEventListener('click', closeImageViewer);

  elImageViewerOverlay.addEventListener('click', (e) => {
    if (e.target === elImageViewerOverlay) {
      closeImageViewer();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
      closeImageViewer();
    }
  });
}

async function parseUrlParameters() {
  const urlParams = new URLSearchParams(window.location.search);
  const categoryParam = urlParams.get('category');
  const officeParam = urlParams.get('office');

  if (categoryParam && officeParam) {
    const mainCat = Object.keys(SUB_OFFICES).find(
      k => k.toLowerCase().replace(/\s+/g, '_') === categoryParam.toLowerCase() || k.toLowerCase() === categoryParam.toLowerCase()
    );
    if (mainCat) {
      const subOffice = SUB_OFFICES[mainCat].find(
        s => s.id === officeParam || s.name.toLowerCase() === officeParam.toLowerCase()
      );
      if (subOffice) {
        localStorage.setItem(KEY_OFFICE, `${getActiveBarangay()}|${subOffice.name}`);
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }
  }
}

async function init() {
  await SRAuditDB.ready();
  await parseUrlParameters();
  setupBarangaySelector();
  renderOfficeCards();
  setupEventListeners();

  if (getActiveOffice()) {
    await showAuditWorkspace();
  } else {
    await showOfficeSelection();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
