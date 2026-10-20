// frontend/src/contacts.js — CSV import, contacts table, sequence step dropdown

import { api } from './api.js';
import { projects } from './projects.js';
import { templateEditor } from './templateEditor.js';
import { showToast, escapeHtml } from './utils.js';

let contactsList = [];
let selectedContacts = new Set();
let listeners = [];

function getContacts() {
  return contactsList;
}

function getSelectedContacts() {
  return Array.from(selectedContacts);
}

function subscribe(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function notify() {
  listeners.forEach(l => l(contactsList, selectedContacts));
}

async function loadContacts() {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) {
    contactsList = [];
    notify();
    return;
  }
  try {
    contactsList = await api.listContacts(projectId);
    selectedContacts.clear();
    notify();
  } catch (err) {
    console.error('Failed to load contacts:', err);
    showToast('Failed to load contacts', 'error');
  }
}

async function importCSV(file) {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) throw new Error('No project selected');

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target.result;
        const result = parseCSV(text);
        templateEditor.setColumnHeaders(result.headers);
        
        const response = await api.importContacts(projectId, result.headers, result.rows);
        contactsList = response.contacts;
        selectedContacts.clear();
        notify();
        showToast(`Imported ${response.imported} contacts`, 'success');
        resolve(response);
      } catch (err) {
        showToast(err.message, 'error');
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) throw new Error('CSV must have at least a header row and one data row');
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  if (!headers.includes('email')) {
    throw new Error('CSV must contain an "email" column');
  }

  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length !== headers.length) {
      while (values.length < headers.length) values.push('');
    }
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    rows.push(row);
  }
  return { headers, rows };
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

async function updateContactSequenceStep(contactId, step) {
  try {
    const updated = await api.updateContactSequenceStep(contactId, step);
    const idx = contactsList.findIndex(c => c.id === contactId);
    if (idx >= 0) contactsList[idx] = updated;
    notify();
  } catch (err) {
    showToast(err.message, 'error');
    throw err;
  }
}

function toggleContactSelection(contactId) {
  if (selectedContacts.has(contactId)) {
    selectedContacts.delete(contactId);
  } else {
    selectedContacts.add(contactId);
  }
  notify();
}

function toggleSelectAll() {
  if (selectedContacts.size === contactsList.length) {
    selectedContacts.clear();
  } else {
    contactsList.forEach(c => selectedContacts.add(c.id));
  }
  notify();
}

// UI
function initContactsUI() {
  const fileInput = document.getElementById('contacts-file');
  const uploadBtn = document.getElementById('contacts-upload-btn');
  const selectAllBtn = document.getElementById('contacts-select-all');
  const deselectAllBtn = document.getElementById('contacts-deselect-all');

  uploadBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await importCSV(file);
        fileInput.value = '';
      } catch (err) {
        // Error shown in importCSV
      }
    }
  });

  selectAllBtn?.addEventListener('click', () => {
    toggleSelectAll();
    renderContactsTable();
  });

  deselectAllBtn?.addEventListener('click', () => {
    selectedContacts.clear();
    renderContactsTable();
  });

  subscribe(renderContactsTable);
  projects.subscribe(loadContacts);
}

function renderContactsTable(container = document.getElementById('contacts-table')) {
  if (!container) return;

  if (contactsList.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-500 py-8 text-center">No contacts yet. Upload a CSV to get started.</p>';
    return;
  }

  const allColumns = new Set();
  contactsList.forEach(c => Object.keys(c.csv_data || {}).forEach(k => allColumns.add(k)));
  const displayColumns = ['email', ...Array.from(allColumns).filter(c => c !== 'email')];

  container.innerHTML = `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="w-12 px-3 py-2 text-left">
              <input type="checkbox" id="select-all-header" class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
            </th>
            ${displayColumns.map(col => `<th class="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider text-xs">${escapeHtml(col)}</th>`).join('')}
            <th class="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider text-xs">Step</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700 uppercase tracking-wider text-xs">Status</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${contactsList.map(c => `
            <tr class="hover:bg-slate-50 ${selectedContacts.has(c.id) ? 'bg-indigo-50' : ''}" data-contact-id="${escapeHtml(c.id)}">
              <td class="px-3 py-2">
                <input type="checkbox" class="contact-checkbox w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" ${selectedContacts.has(c.id) ? 'checked' : ''} />
              </td>
              ${displayColumns.map(col => `
                <td class="px-3 py-2 text-slate-900 truncate max-w-[200px]">${escapeHtml(c.csv_data?.[col] || '')}</td>
              `).join('')}
              <td class="px-3 py-2">
                <select class="step-dropdown w-full rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none" data-contact-id="${escapeHtml(c.id)}">
                  ${Array.from({ length: 10 }, (_, i) => i + 1).map(step => `
                    <option value="${step}" ${c.current_sequence_step === step ? 'selected' : ''}>Step ${step}</option>
                  `).join('')}
                </select>
              </td>
              <td class="px-3 py-2">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(c.id)}">${getStatusText(c.id)}</span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  attachContactsEvents(container);
}

function getStatusClass(contactId) {
  // Could be enhanced to show actual generation status
  return 'bg-slate-100 text-slate-600';
}

function getStatusText(contactId) {
  return 'Idle';
}

function attachContactsEvents(container) {
  // Select all header
  container.querySelector('#select-all-header')?.addEventListener('change', (e) => {
    if (e.target.checked) {
      contacts.forEach(c => selectedContacts.add(c.id));
    } else {
      selectedContacts.clear();
    }
    notify();
  });

  // Individual checkboxes
  container.querySelectorAll('.contact-checkbox').forEach(cb => {
    cb.addEventListener('change', (e) => {
      const contactId = e.target.closest('tr').dataset.contactId;
      toggleContactSelection(contactId);
    });
  });

  // Row click (toggle selection)
  container.querySelectorAll('tbody tr').forEach(row => {
    row.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const contactId = row.dataset.contactId;
      toggleContactSelection(contactId);
    });
  });

  // Sequence step dropdown
  container.querySelectorAll('.step-dropdown').forEach(select => {
    select.addEventListener('change', async (e) => {
      const contactId = e.target.dataset.contactId;
      const step = parseInt(e.target.value, 10);
      try {
        await updateContactSequenceStep(contactId, step);
        showToast('Step updated', 'success');
      } catch (err) {
        const contact = contacts.find(c => c.id === contactId);
        if (contact) e.target.value = contact.current_sequence_step;
      }
    });
  });
}

export const contacts = {
  getContacts,
  getSelectedContacts,
  subscribe,
  loadContacts,
  importCSV,
  updateContactSequenceStep: async (contactId, step) => {
    const updated = await api.updateContactSequenceStep(contactId, step);
    const idx = contactsList.findIndex(c => c.id === contactId);
    if (idx >= 0) contactsList[idx] = updated;
    notify();
  },
  initContactsUI,
  renderContactsTable,
};