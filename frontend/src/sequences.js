// frontend/src/sequences.js — Sequence manager per project

import { api } from './api.js';
import { projects } from './projects.js';
import { showToast, showConfirm, escapeHtml, formatDate } from './utils.js';

let sequencesList = [];
let listeners = [];

function getSequences() {
  return sequencesList;
}

function subscribe(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function notify() {
  listeners.forEach(l => l(sequencesList));
}

async function loadSequences() {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) {
    sequencesList = [];
    notify();
    return;
  }
  try {
    sequencesList = await api.listSequences(projectId);
    notify();
  } catch (err) {
    console.error('Failed to load sequences:', err);
    showToast('Failed to load sequences', 'error');
  }
}

async function createSequence(name) {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) throw new Error('No project selected');
  const sequence = await api.createSequence(projectId, name);
  sequencesList.push(sequence);
  notify();
  return sequence;
}

async function updateSequence(id, name) {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) throw new Error('No project selected');
  const updated = await api.updateSequence(projectId, id, name);
  const idx = sequencesList.findIndex(s => s.id === id);
  if (idx >= 0) sequencesList[idx] = updated;
  notify();
  return updated;
}

async function deleteSequence(id) {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) throw new Error('No project selected');
  if (await showConfirm('Delete Sequence', 'Delete this sequence? This will remove all its templates and generated emails.')) {
    await api.deleteSequence(projectId, id);
    sequencesList = sequencesList.filter(s => s.id !== id);
    notify();
    showToast('Sequence deleted', 'success');
  }
}

async function reorderSequences(ids) {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) throw new Error('No project selected');
  await api.reorderSequences(projectId, ids);
  // Reorder local array to match
  const reordered = ids.map(id => sequencesList.find(s => s.id === id)).filter(Boolean);
  sequencesList = reordered;
  notify();
}

// UI
function initSequencesUI(renderCallback) {
  // Subscribe to project changes
  projects.subscribe(loadSequences);
  subscribe(renderCallback);

  // Listen for drag-and-drop reorder (simple up/down buttons for now)
  // Could be enhanced with a proper drag library later
}

// Render function for sequence list (used by template editor and generator)
export function renderSequenceList(container, options = {}) {
  const { selectable = false, onSelect, showOrder = true, currentSequenceId = null } = options;
  
  if (sequencesList.length === 0) {
    container.innerHTML = '<p class="text-sm text-slate-500 py-4">No sequences yet. Add one below.</p>';
    return;
  }

  container.innerHTML = sequencesList.map((s, idx) => `
    <div class="flex items-center gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 ${s.id === currentSequenceId ? 'bg-indigo-50 border-indigo-200' : ''}" data-sequence-id="${escapeHtml(s.id)}">
      ${showOrder ? `<span class="w-6 text-center text-slate-500 font-medium">${idx + 1}</span>` : ''}
      ${selectable ? `
        <input type="${options.multiple ? 'checkbox' : 'radio'}" name="sequence-select" value="${escapeHtml(s.id)}" class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" ${s.id === currentSequenceId ? 'checked' : ''}>
      ` : ''}
      <div class="flex-1 min-w-0">
        <p class="font-medium text-slate-900 truncate">${escapeHtml(s.name)}</p>
        <p class="text-xs text-slate-500">Step ${s.step_order}</p>
      </div>
      <div class="flex items-center gap-2">
        ${!selectable ? `
          <button data-edit="${escapeHtml(s.id)}" class="text-sm text-indigo-600 hover:text-indigo-700">Edit</button>
          <button data-delete="${escapeHtml(s.id)}" class="text-sm text-red-600 hover:text-red-700">Delete</button>
        ` : ''}
        ${showOrder && idx > 0 ? `<button data-move-up="${escapeHtml(s.id)}" class="p-1 text-slate-400 hover:text-slate-600" title="Move up"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg></button>` : ''}
        ${showOrder && idx < sequencesList.length - 1 ? `<button data-move-down="${escapeHtml(s.id)}" class="p-1 text-slate-400 hover:text-slate-600" title="Move down"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>` : ''}
      </div>
    </div>
  `).join('');

  container.onclick = async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const deleteBtn = e.target.closest('[data-delete]');
    const moveUpBtn = e.target.closest('[data-move-up]');
    const moveDownBtn = e.target.closest('[data-move-down]');
    const selectInput = e.target.closest('input[name="sequence-select"]');

    if (editBtn) {
      openSequenceEditor(editBtn.dataset.edit);
    }
    if (deleteBtn) {
      await deleteSequence(deleteBtn.dataset.delete);
    }
    if (moveUpBtn) {
      const id = moveUpBtn.dataset.moveUp;
      const idx = sequencesList.findIndex(s => s.id === id);
      if (idx > 0) {
        const ids = sequencesList.map(s => s.id);
        [ids[idx], ids[idx - 1]] = [ids[idx - 1], ids[idx]];
        await reorderSequences(ids);
      }
    }
    if (moveDownBtn) {
      const id = moveDownBtn.dataset.moveDown;
      const idx = sequencesList.findIndex(s => s.id === id);
      if (idx < sequencesList.length - 1) {
        const ids = sequencesList.map(s => s.id);
        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
        await reorderSequences(ids);
      }
    }
    if (selectInput && onSelect) {
      onSelect(selectInput.value);
    }
  };
}

// Simple inline editor for sequence name
function openSequenceEditor(sequenceId) {
  const seq = sequencesList.find(s => s.id === sequenceId);
  if (!seq) return;

  const newName = prompt('Sequence name:', seq.name);
  if (newName && newName.trim() && newName.trim() !== seq.name) {
    updateSequence(sequenceId, newName.trim()).catch(err => showToast(err.message, 'error'));
  }
}

// Create sequence form handler
function initSequenceForm() {
  const form = document.getElementById('sequence-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('sequence-name').value.trim();
    if (!name) return;
    const submitBtn = form.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);
    try {
      await createSequence(name);
      form.reset();
      showToast('Sequence added', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
}

export const sequences = {
  getSequences,
  subscribe,
  loadSequences,
  createSequence,
  updateSequence,
  deleteSequence: async (id) => {
    const projectId = getCurrentProjectId();
    if (!projectId) throw new Error('No project selected');
    if (await showConfirm('Delete Sequence', 'Delete this sequence? This will remove all its templates and generated emails.')) {
      await api.deleteSequence(projectId, id);
      sequencesList = sequencesList.filter(s => s.id !== id);
      notify();
      showToast('Sequence deleted', 'success');
    }
  },
  reorderSequences,
  initSequencesUI: (renderCallback) => {
    subscribeProjects(loadSequences);
    subscribe(renderCallback);
  },
  renderSequenceList,
  initSequenceForm,
};