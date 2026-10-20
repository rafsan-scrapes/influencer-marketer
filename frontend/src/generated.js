// frontend/src/generated.js — Generated emails view per sequence

import { api } from './api.js';
import { projects } from './projects.js';
import { sequences } from './sequences.js';
import { showToast, showConfirm, escapeHtml, formatDate } from './utils.js';

let generatedEmails = [];
let currentSequenceFilter = null;
let currentStatusFilter = null;
let listeners = [];

function getGeneratedEmails() {
  return generatedEmails;
}

function subscribe(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function notify() {
  listeners.forEach(l => l(generatedEmails));
}

async function loadGeneratedEmails() {
  const projectId = projects.getCurrentProjectId();
  if (!projectId) {
    generatedEmails = [];
    notify();
    return;
  }
  try {
    const params = {};
    if (currentSequenceFilter) params.sequenceId = currentSequenceFilter;
    if (currentStatusFilter) params.status = currentStatusFilter;
    const response = await api.listGenerated(projectId, params);
    generatedEmails = response;
    notify();
  } catch (err) {
    console.error('Failed to load generated emails:', err);
    showToast('Failed to load generated emails', 'error');
  }
}

async function deleteGeneratedEmail(id) {
  if (await showConfirm('Delete Email', 'Delete this generated email?')) {
    try {
      await api.deleteGenerated(id);
      generatedEmails = generatedEmails.filter(e => e.id !== id);
      notify();
      showToast('Email deleted', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }
}

export function setSequenceFilter(sequenceId) {
  currentSequenceFilter = sequenceId;
  loadGeneratedEmails();
}

export function setStatusFilter(status) {
  currentStatusFilter = status;
  loadGeneratedEmails();
}

// UI
export function initGeneratedUI() {
  subscribeSequences(() => {
    renderGeneratedTab(document.getElementById('app-content'));
  });
  projects.subscribe(loadGeneratedEmails);
}

export function renderGeneratedTab(container) {
  const projectId = getCurrentProjectId();
  const seqs = getSequences();
  
  if (!projectId) {
    container.innerHTML = '<p class="text-slate-500 py-8 text-center">Select a project to view generated emails.</p>';
    return;
  }
  
  // Group by sequence for tabs
  const emailsBySequence = {};
  generatedEmails.forEach(e => {
    if (!emailsBySequence[e.sequence_id]) emailsBySequence[e.sequence_id] = [];
    emailsBySequence[e.sequence_id].push(e);
  });
  
  container.innerHTML = `
    <div class="space-y-6">
      <!-- Sequence filter tabs -->
      <div class="border-b border-slate-200">
        <nav class="flex gap-1 overflow-x-auto pb-px" role="tablist" aria-label="Sequences">
          <button data-seq-filter="all" class="whitespace-nowrap px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${currentSequenceFilter === null ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}">
            All Sequences
          </button>
          ${seqs.map(s => `
            <button data-seq-filter="${escapeHtml(s.id)}" class="whitespace-nowrap px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${currentSequenceFilter === s.id ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}">
              ${escapeHtml(s.name)} (${emailsBySequence[s.id]?.length || 0})
            </button>
          `).join('')}
        </nav>
      </div>
      
      <!-- Status filter -->
      <div class="flex flex-wrap gap-2 mb-4">
        <label class="flex items-center gap-2 text-sm text-slate-600">
          <span>Status:</span>
          <select id="status-filter" class="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none">
            <option value="">All</option>
            <option value="generated" ${currentStatusFilter === 'generated' ? 'selected' : ''}>Generated</option>
            <option value="error" ${currentStatusFilter === 'error' ? 'selected' : ''}>Error</option>
            <option value="skipped" ${currentStatusFilter === 'skipped' ? 'selected' : ''}>Skipped</option>
          </select>
        </label>
      </div>
      
      <!-- Emails table -->
      <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
        ${generatedEmails.length === 0 ? `
          <div class="py-12 text-center text-slate-500">No generated emails yet. Run generation to create some.</div>
        ` : renderEmailsTable()}
      </div>
    </div>
  `;
  
  attachGeneratedEvents(container);
}

function renderEmailsTable() {
  return `
    <div class="overflow-x-auto">
      <table class="w-full text-sm">
        <thead>
          <tr class="bg-slate-50 border-b border-slate-200">
            <th class="px-3 py-2 text-left font-medium text-slate-700">Contact</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700">Sequence</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700">Subject</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700">Body Preview</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700">Status</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700">Date</th>
            <th class="px-3 py-2 text-left font-medium text-slate-700 w-24">Actions</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          ${generatedEmails.map(e => `
            <tr class="hover:bg-slate-50">
              <td class="px-3 py-3 text-slate-900">${escapeHtml(e.contact_email || e.contact_id?.slice(0, 8) + '...')}</td>
              <td class="px-3 py-3 text-slate-600">${escapeHtml(e.sequence_name || e.sequence_id?.slice(0, 8) + '...')}</td>
              <td class="px-3 py-3 text-slate-900 max-w-[300px] truncate font-mono text-sm" title="${escapeHtml(e.subject || '')}">${escapeHtml(e.subject || '')}</td>
              <td class="px-3 py-3 text-slate-600 max-w-[400px] truncate font-mono text-sm" title="${escapeHtml(e.body || '')}">${escapeHtml((e.body || '').slice(0, 80))}${e.body?.length > 80 ? '...' : ''}</td>
              <td class="px-3 py-3">
                <span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusClass(e.status)}">${escapeHtml(e.status)}</span>
              </td>
              <td class="px-3 py-3 text-slate-500 whitespace-nowrap">${formatDate(e.generated_at)}</td>
              <td class="px-3 py-3">
                <div class="flex items-center gap-2">
                  <button data-copy-subject="${escapeHtml(e.id)}" class="p-2 text-slate-400 hover:text-indigo-600" title="Copy Subject"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg></button>
                  <button data-copy-body="${escapeHtml(e.id)}" class="p-2 text-slate-400 hover:text-indigo-600" title="Copy Body"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"/></svg></button>
                  <button data-delete="${escapeHtml(e.id)}" class="p-2 text-slate-400 hover:text-red-600" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getStatusClass(status) {
  switch (status) {
    case 'generated': return 'bg-green-100 text-green-700';
    case 'error': return 'bg-red-100 text-red-700';
    case 'skipped': return 'bg-amber-100 text-amber-700';
    default: return 'bg-slate-100 text-slate-600';
  }
}

function attachGeneratedEvents(container) {
  // Sequence filter
  container.querySelectorAll('[data-seq-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
      const seqId = btn.dataset.seqFilter === 'all' ? null : btn.dataset.seqFilter;
      setSequenceFilter(seqId);
    });
  });
  
  // Status filter
  container.querySelector('#status-filter')?.addEventListener('change', (e) => {
    const status = e.target.value || null;
    setStatusFilter(status);
  });
  
  // Copy subject
  container.querySelectorAll('[data-copy-subject]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = generatedEmails.find(e => e.id === btn.dataset.copySubject);
      if (email) {
        await navigator.clipboard.writeText(email.subject || '');
        showToast('Subject copied', 'success');
      }
    });
  });
  
  // Copy body
  container.querySelectorAll('[data-copy-body]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const email = generatedEmails.find(e => e.id === btn.dataset.copyBody);
      if (email) {
        await navigator.clipboard.writeText(email.body || '');
        showToast('Body copied', 'success');
      }
    });
  });
  
  // Delete
  container.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', () => deleteGeneratedEmail(btn.dataset.delete));
  });
}

export const generated = {
  getGeneratedEmails,
  subscribe,
  loadGeneratedEmails,
  deleteGeneratedEmail,
  setSequenceFilter,
  setStatusFilter,
  initGeneratedUI: () => {
    sequences.subscribe(() => {
      renderGeneratedTab(document.getElementById('app-content'));
    });
    projects.subscribe(loadGeneratedEmails);
  },
  renderGeneratedTab,
};