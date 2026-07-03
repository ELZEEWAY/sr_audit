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
const documentForm = document.getElementById('document-form');
const documentGrid = document.getElementById('document-grid');
const fileInput = document.getElementById('document-image');
const fileLabel = document.getElementById('document-image-label');
const imagePreview = document.getElementById('document-image-preview');
const viewerOverlay = document.getElementById('document-viewer-overlay');
const viewerImage = document.getElementById('document-viewer-image');
const viewerClose = document.getElementById('document-viewer-close');

function getActiveBarangay() {
  let active = localStorage.getItem(KEY_ACTIVE);
  if (!active || !BARANGAYS.includes(active)) {
    active = BARANGAYS[0];
    localStorage.setItem(KEY_ACTIVE, active);
  }
  return active;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text == null ? '' : String(text);
  return div.innerHTML;
}

function getDocumentImageSrc(doc) {
  return doc.image || doc.image_data || doc.IMAGE || '';
}

function openDocumentViewer(imageSrc) {
  if (!imageSrc) {
    alert('No scanned image is stored for this document.');
    return;
  }
  viewerImage.src = imageSrc;
  viewerOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeDocumentViewer() {
  viewerOverlay.classList.remove('active');
  viewerImage.removeAttribute('src');
  document.body.style.overflow = '';
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
    renderDocuments();
  });
  elSelect.disabled = true;
  elSelect.title = 'Barangay is selected at login and cannot be changed here.';
}

function displayImagePreview(base64) {
  if (!imagePreview) return;
  imagePreview.innerHTML = '';
  const img = document.createElement('img');
  img.src = base64;
  img.className = 'preview-img';
  img.alt = 'Upload preview';
  imagePreview.appendChild(img);
}

function resetUploadUi() {
  if (fileLabel) {
    fileLabel.textContent = 'Choose an image file (.png, .jpg)';
    fileLabel.classList.remove('has-file');
  }
  if (imagePreview) {
    imagePreview.innerHTML = '';
  }
}

function handleImageSelect(event) {
  const file = event.target.files?.[0];
  if (!file) {
    resetUploadUi();
    return;
  }

  if (!['image/png', 'image/jpeg'].includes(file.type)) {
    alert('Only PNG and JPEG images are allowed.');
    fileInput.value = '';
    resetUploadUi();
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    if (fileLabel) {
      fileLabel.textContent = file.name;
      fileLabel.classList.add('has-file');
    }
    displayImagePreview(e.target.result);
  };
  reader.onerror = () => {
    alert('Failed to read image file.');
    resetUploadUi();
  };
  reader.readAsDataURL(file);
}

function readImageAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Unable to read file.'));
    reader.readAsDataURL(file);
  });
}

async function renderDocuments() {
  const documents = await SRAuditDB.documents.list(getActiveBarangay());
  documentGrid.innerHTML = '';
  if (documents.length === 0) {
    documentGrid.innerHTML = '<div class="empty-state">No documents uploaded yet.</div>';
    return;
  }

  documents.forEach((doc) => {
    const card = document.createElement('article');
    card.className = 'document-card';
    const date = new Date(doc.createdAt).toLocaleString();
    const imageSrc = getDocumentImageSrc(doc);

    card.innerHTML = `
      <div class="meta-row">
        <span class="badge">${escapeHtml(doc.category)}</span>
        <span>${escapeHtml(date)}</span>
      </div>
      <h3 class="document-title">${escapeHtml(doc.title)}</h3>
      <p class="document-body">${escapeHtml(doc.category)} for active barangay.</p>
      <div class="document-meta">
        <span><strong>Uploaded:</strong> ${escapeHtml(date)}</span>
        <span><strong>Category:</strong> ${escapeHtml(doc.category)}</span>
      </div>
    `;

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'btn-primary';
    viewBtn.textContent = 'View Scanned Document';
    viewBtn.addEventListener('click', () => openDocumentViewer(imageSrc));
    card.appendChild(viewBtn);

    documentGrid.appendChild(card);
  });
}

async function handleSubmit(event) {
  event.preventDefault();
  const category = document.getElementById('document-category').value;
  const title = document.getElementById('document-title').value.trim();
  const fileInput = document.getElementById('document-image');
  if (!title) {
    alert('Please enter a document title.');
    return;
  }
  if (fileInput.files.length === 0) {
    alert('Please upload a scanned document image.');
    return;
  }
  let imageString;
  try {
    imageString = await readImageAsBase64(fileInput.files[0]);
  } catch (err) {
    alert('Failed to read uploaded document image.');
    return;
  }
  try {
    await SRAuditDB.documents.insert(getActiveBarangay(), {
      category,
      title,
      image: imageString,
      createdAt: new Date().toISOString()
    });
    documentForm.reset();
    resetUploadUi();
    await renderDocuments();
  } catch (err) {
    alert('Could not save document. Try a smaller image.');
  }
}

function setupViewer() {
  viewerClose.addEventListener('click', closeDocumentViewer);
  viewerOverlay.addEventListener('click', (event) => {
    if (event.target === viewerOverlay) {
      closeDocumentViewer();
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && viewerOverlay.classList.contains('active')) {
      closeDocumentViewer();
    }
  });
}

async function init() {
  await SRAuditDB.ready();
  setupViewer();
  buildSelect();
  await renderDocuments();
  documentForm.addEventListener('submit', handleSubmit);
  if (fileInput) {
    fileInput.addEventListener('change', handleImageSelect);
  }
}

init();
