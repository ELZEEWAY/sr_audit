/**
 * Form State Handler and Preview Table Renderer
 * Resolves row duplication and value mirroring bugs.
 */

// 1. Enforce Distinct State Mutation:
// Maintain state collections for form records
const formStates = {
  af51: [],
  '0016': [],
  checks: []
};

// Configuration of form inputs and table structures
const formConfigs = {
  af51: {
    inputPrefix: 'b1-',
    tableBodyId: 'preview-table-body-af51',
    defaultFormName: 'Official Receipt - AF 51'
  },
  '0016': {
    inputPrefix: 'b3-',
    tableBodyId: 'preview-table-body-0016',
    defaultFormName: 'BIR Form 0016'
  },
  checks: {
    inputPrefix: 'b2-',
    tableBodyId: 'preview-table-body-checks',
    defaultFormName: 'Checks'
  }
};

const formSuffixes = [
  'bb-qty', 'bb-from', 'bb-to',
  'rc-qty', 'rc-from', 'rc-to',
  'is-qty', 'is-from', 'is-to',
  'eb-qty', 'eb-from', 'eb-to'
];

/**
 * Event Handler to save form inputs into state contextually.
 * Extracted contextually from row inputs to prevent global element collisions.
 * 
 * @param {string} formKey - The unique key of the form (e.g. 'af51', '0016', 'checks')
 * @param {HTMLElement} containerElement - The parent container element of the form inputs
 */
function saveFormRowState(formKey, containerElement) {
  const config = formConfigs[formKey];
  const stateArray = formStates[formKey];
  if (!config || !stateArray || !containerElement) return;

  // 1. Contextual Value Extraction:
  // Query only within the passed row container context, not globally
  const rowData = {};
  let hasData = false;

  formSuffixes.forEach(suffix => {
    // Find input either by class or suffix-ending id contextually
    const inputEl = containerElement.querySelector(`.input-${suffix}`) || 
                    containerElement.querySelector(`[id$="${suffix}"]`) ||
                    containerElement.querySelector(`#${config.inputPrefix}${suffix}`);
    
    if (inputEl) {
      const val = inputEl.value.trim();
      rowData[suffix] = val;
      if (val !== '') hasData = true;
    }
  });

  if (!hasData) {
    alert('Please enter data before saving.');
    return;
  }

  // 2. Enforce Distinct State Mutation:
  // Push a shallow cloned copy of the row data object to separate memory addresses
  stateArray.push({ ...rowData });

  // Clear inputs contextually inside this form container for the next entry
  formSuffixes.forEach(suffix => {
    const inputEl = containerElement.querySelector(`.input-${suffix}`) || 
                    containerElement.querySelector(`[id$="${suffix}"]`) ||
                    containerElement.querySelector(`#${config.inputPrefix}${suffix}`);
    if (inputEl) {
      inputEl.value = '';
      // Dispatch input event to clear related automatic cascades
      inputEl.dispatchEvent(new Event('input'));
    }
  });

  // Re-render table for this specific form state
  renderFormTable(formKey);
}

/**
 * Re-render Loop Fix:
 * Iterates through the state array and populates unique rows in the preview table.
 * 
 * @param {string} formKey - The form key to render
 */
function renderFormTable(formKey) {
  const config = formConfigs[formKey];
  const stateArray = formStates[formKey];
  if (!config || !stateArray) return;

  const tbody = document.getElementById(config.tableBodyId);
  if (!tbody) return;

  // Clear existing preview rows
  tbody.innerHTML = '';

  // 3. Re-render Loop Fix:
  // Iterate through the state array and build unique table rows
  stateArray.forEach((data, index) => {
    const tr = document.createElement('tr');
    tr.dataset.rowIndex = index;

    // Build cells ensuring unique values are bound to each distinct index item
    tr.innerHTML = `
      <td class="px-4 py-3 text-sm">${index + 1}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(config.defaultFormName)}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['bb-qty'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['bb-from'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['bb-to'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['is-qty'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['is-from'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['is-to'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['eb-qty'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['eb-from'] || '—')}</td>
      <td class="px-4 py-3 text-sm">${escapeHTML(data['eb-to'] || '—')}</td>
      <td class="px-4 py-3 text-sm text-center">
        <button type="button" class="text-red-600 hover:text-red-900" onclick="deleteFormRowState('${formKey}', ${index})">
          Delete
        </button>
      </td>
    `;
    
    tbody.appendChild(tr);
  });
}

/**
 * Removes a row from state and updates preview table
 */
function deleteFormRowState(formKey, index) {
  const stateArray = formStates[formKey];
  if (stateArray && stateArray[index] !== undefined) {
    stateArray.splice(index, 1);
    renderFormTable(formKey);
  }
}

/**
 * Utility helper to prevent cross-site scripting (XSS) when rendering dynamic strings
 */
function escapeHTML(str) {
  if (typeof str !== 'string') return String(str);
  return str.replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}

// Export functions for module environment if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formStates,
    saveFormRowState,
    renderFormTable,
    deleteFormRowState
  };
}
