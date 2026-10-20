// frontend/src/generator.js — Run pipeline UI

import { api } from './api.js';
import { projects } from './projects.js';
import { sequences } from './sequences.js';
import { contacts } from './contacts.js';
import { showToast, escapeHtml } from './utils.js';

let isGenerating = false;
let generationResults = [];

function initGeneratorUI() {
  const runBtn = document.getElementById('run-generation-btn');
  const sequenceSelect = document.getElementById('generation-sequence-select');
  
  sequences.subscribe(updateSequenceOptions);
  contacts.subscribe(updateRunButtonState);
  projects.subscribe(updateRunButtonState);

  runBtn?.addEventListener('click', runGeneration);
  sequenceSelect?.addEventListener('change', updateRunButtonState);
}

function updateSequenceOptions() {
  const select = document.getElementById('generation-sequence-select');
  if (!select) return;
  
  const seqs = sequences.getSequences();
  select.innerHTML = seqs.map(s => `
    <option value="${escapeHtml(s.id)}">${escapeHtml(s.name)} (Step ${s.step_order})</option>
  `).join('') || '<option value="">No sequences</option>';
  
  updateRunButtonState();
}

function updateRunButtonState() {
  const runBtn = document.getElementById('run-generation-btn');
  const sequenceSelect = document.getElementById('generation-sequence-select');
  const selectedCount = contacts.getSelectedContacts().length;
  const hasSequence = sequenceSelect?.value;
  const projectId = projects.getCurrentProjectId();
  
  if (runBtn) {
    runBtn.disabled = isGenerating || selectedCount === 0 || !hasSequence || !projectId;
    runBtn.textContent = isGenerating ? 'Generating...' : `Run Generation (${selectedCount} contacts)`;
  }
}

async function runGeneration() {
  const projectId = projects.getCurrentProjectId();
  const sequenceId = document.getElementById('generation-sequence-select')?.value;
  const contactIds = contacts.getSelectedContacts();
  
  if (!projectId || !sequenceId || contactIds.length === 0) return;
  
  isGenerating = true;
  updateRunButtonState();
  
  const progressContainer = document.getElementById('generation-progress');
  const resultsContainer = document.getElementById('generation-results');
  
  if (progressContainer) progressContainer.classList.remove('hidden');
  if (resultsContainer) resultsContainer.classList.add('hidden');
  
  try {
    const response = await api.generate(projectId, contactIds, sequenceId);
    generationResults = response.results;
    renderResults();
    showToast(`Generation complete: ${response.results.filter(r => r.status === 'generated').length} generated, ${response.results.filter(r => r.status === 'error').length} errors`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    isGenerating = false;
    updateRunButtonState();
    if (progressContainer) progressContainer.classList.add('hidden');
    if (resultsContainer) resultsContainer.classList.remove('hidden');
  }
}

function renderResults() {
  const container = document.getElementById('generation-results');
  if (!container) return;
  
  const successCount = generationResults.filter(r => r.status === 'generated').length;
  const errorCount = generationResults.filter(r => r.status === 'error').length;
  const skippedCount = generationResults.filter(r => r.status === 'skipped').length;
  
  container.innerHTML = `
    <div class="mb-4 grid grid-cols-3 gap-4 text-center">
      <div class="bg-green-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-green-700">${successCount}</p>
        <p class="text-xs text-green-600">Generated</p>
      </div>
      <div class="bg-red-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-red-700">${errorCount}</p>
        <p class="text-xs text-red-600">Errors</p>
      </div>
      <div class="bg-amber-50 rounded-lg p-4">
        <p class="text-2xl font-bold text-amber-700">${skippedCount}</p>
        <p class="text-xs text-amber-600">Skipped</p>
      </div>
    </div>
    <div class="max-h-64 overflow-auto space-y-2">
      ${generationResults.map(r => `
        <div class="p-3 rounded-lg border ${r.status === 'generated' ? 'border-green-200 bg-green-50' : r.status === 'error' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'}">
          <div class="flex items-center justify-between">
            <span class="font-medium text-sm">${r.contactId ? r.contactId.slice(0, 8) + '...' : 'Unknown'}</span>
            <span class="text-xs px-2 py-0.5 rounded ${r.status === 'generated' ? 'bg-green-100 text-green-700' : r.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}">${r.status}</span>
          </div>
          ${r.error ? `<p class="text-xs text-red-600 mt-1">${escapeHtml(r.error)}</p>` : ''}
          ${r.status === 'generated' ? `
            <div class="mt-2 text-xs text-slate-600 font-mono">
              <div><strong>Subject:</strong> ${escapeHtml(r.subject || '')}</div>
              <div><strong>Body:</strong> ${escapeHtml((r.body || '').slice(0, 100))}${r.body?.length > 100 ? '...' : ''}</div>
            </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    <button id="view-generated-btn" class="mt-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">View Generated Emails</button>
  `;
  
  container.querySelector('#view-generated-btn')?.addEventListener('click', () => {
    // Switch to Generated tab
    window.showTab?.('generated');
  });
}

export function renderGeneratorTab(container) {
  const projectId = getCurrentProjectId();
  const selectedCount = getSelectedContacts().length;
  
  if (!projectId) {
    container.innerHTML = '<p class="text-slate-500 py-8 text-center">Select a project to run generation.</p>';
    return;
  }
  
  container.innerHTML = `
    <div class="space-y-6">
      <div class="bg-white rounded-lg border border-slate-200 p-6">
        <h3 class="text-lg font-semibold text-slate-900 mb-4">Run Generation</h3>
        
        <div class="mb-4">
          <label class="block text-sm font-medium text-slate-700 mb-1">Target Sequence</label>
          <select id="generation-sequence-select" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none">
            <option value="">Select a sequence</option>
          </select>
        </div>
        
        <div class="mb-4 p-3 rounded-lg bg-slate-50">
          <p class="text-sm text-slate-600">
            <strong>${selectedCount}</strong> contact${selectedCount !== 1 ? 's' : ''} selected on the Contacts tab
          </p>
        </div>
        
        <button id="run-generation-btn" type="button" class="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed" disabled>
          Run Generation
        </button>
      </div>
      
      <div id="generation-progress" class="hidden bg-white rounded-lg border border-slate-200 p-6 text-center">
        <div class="flex items-center justify-center gap-3">
          <svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          <span class="text-slate-700">Generating emails...</span>
        </div>
      </div>
      
      <div id="generation-results" class="hidden"></div>
    </div>
  `;
  
  initGeneratorUI();
}

export const generator = {
  initGeneratorUI,
  renderGeneratorTab,
};