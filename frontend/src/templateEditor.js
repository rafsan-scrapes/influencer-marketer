// frontend/src/templateEditor.js — Template editor per sequence (default + conditions + AI config)

import { api } from './api.js';
import { sequences } from './sequences.js';
import { projects } from './projects.js';
import { auth } from './auth.js';
import { showToast, showConfirm, escapeHtml, debounce } from './utils.js';

let currentSequenceId = null;
let templates = [];
let columnHeaders = [];
let listeners = [];

function getTemplates() {
  return templates;
}

function getCurrentSequenceId() {
  return currentSequenceId;
}

function setColumnHeaders(headers) {
  columnHeaders = headers;
  renderColumnChips();
}

function subscribe(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function notify() {
  listeners.forEach(l => l(templates, currentSequenceId));
}

async function loadTemplates(sequenceId) {
  currentSequenceId = sequenceId;
  if (!sequenceId) {
    templates = [];
    notify();
    return;
  }
  try {
    templates = await api.listTemplates(sequenceId);
    notify();
  } catch (err) {
    console.error('Failed to load templates:', err);
    showToast('Failed to load templates', 'error');
  }
}

async function saveTemplate(template) {
  const isNew = !template.id || template.id.startsWith('temp-');
  if (isNew) {
    const created = await api.createTemplate(currentSequenceId, template);
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx >= 0) templates[idx] = created;
  } else {
    const updated = await api.updateTemplate(template.id, template);
    const idx = templates.findIndex(t => t.id === template.id);
    if (idx >= 0) templates[idx] = updated;
  }
  notify();
}

async function deleteTemplate(id) {
  if (await showConfirm('Delete Template', 'Delete this template block?')) {
    await api.deleteTemplate(id);
    templates = templates.filter(t => t.id !== id);
    notify();
    showToast('Template deleted', 'success');
  }
}

async function addCondition(templateId, condition) {
  const created = await api.addCondition(templateId, condition);
  const template = templates.find(t => t.id === templateId);
  if (template) {
    template.conditions = [...(template.conditions || []), created];
    notify();
  }
}

async function updateCondition(id, condition) {
  const updated = await api.updateCondition(id, condition);
  for (const template of templates) {
    const idx = template.conditions?.findIndex(c => c.id === id);
    if (idx >= 0) {
      template.conditions[idx] = updated;
      notify();
      break;
    }
  }
}

async function deleteCondition(id) {
  if (await showConfirm('Delete Condition', 'Delete this condition?')) {
    await api.deleteCondition(id);
    for (const template of templates) {
      template.conditions = template.conditions?.filter(c => c.id !== id) || [];
    }
    notify();
    showToast('Condition deleted', 'success');
  }
}

// UI
export function initTemplateEditorUI() {
  subscribeSequences(() => {
    if (currentSequenceId && !getSequences().find(s => s.id === currentSequenceId)) {
      loadTemplates(null);
    }
  });
}

export function renderTemplateEditor(container) {
  const sequence = getSequences().find(s => s.id === currentSequenceId);
  const projectId = getCurrentProjectId();

  if (!sequence || !projectId) {
    container.innerHTML = '<p class="text-slate-500 py-8 text-center">Select a sequence to configure templates.</p>';
    return;
  }

  const defaultBlock = templates.find(t => t.is_default);
  const conditionBlocks = templates.filter(t => !t.is_default);

  container.innerHTML = `
    <div class="space-y-6">
      <!-- Sequence selector (tabs) -->
      <div class="border-b border-slate-200">
        <nav class="flex gap-1 overflow-x-auto pb-px" role="tablist" aria-label="Sequences">
          ${getSequences().map(s => `
            <button data-seq-tab="${escapeHtml(s.id)}" role="tab" aria-selected="${s.id === currentSequenceId}" class="whitespace-nowrap px-3 py-2 text-sm font-medium rounded-t-lg transition-colors ${s.id === currentSequenceId ? 'bg-white text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}">
              ${escapeHtml(s.name)}
            </button>
          `).join('')}
        </nav>
      </div>

      <!-- Column chips -->
      <div id="template-chips" class="flex flex-wrap gap-2 min-h-[36px]">
        ${columnHeaders.length === 0 ? '<p class="text-sm text-slate-500">Upload a CSV on the Contacts tab to see column chips.</p>' : ''}
        ${columnHeaders.map(h => `<span class="chip px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200" data-chip="${escapeHtml(h)}">[${escapeHtml(h)}]</span>`).join('')}
      </div>

      <!-- Default Block -->
      <div class="bg-white rounded-lg border border-slate-200 p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-slate-900">Default Template</h3>
          <span class="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded">Default</span>
        </div>
        ${renderTemplateBlock(defaultBlock, true)}
      </div>

      <!-- Condition Blocks -->
      <div id="condition-blocks" class="space-y-4">
        ${conditionBlocks.map((block, idx) => renderConditionBlock(block, idx)).join('')}
      </div>

      <!-- Add Condition Block -->
      <button id="add-condition-block" type="button" class="w-full flex items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 py-4 text-slate-500 hover:border-indigo-400 hover:text-indigo-600 transition-colors">
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
        Add Condition Block
      </button>
    </div>
  `;

  attachTemplateEditorEvents(container);
  renderColumnChips();
}

function renderTemplateBlock(block, isDefault) {
  const settings = auth.getSettings() || { default_ai_model: 'gemini-1.5-flash', default_ai_temperature: 0.3 };
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
  
  return `
    <div class="template-block space-y-4" data-template-id="${escapeHtml(block?.id || '')}" data-is-default="${isDefault}">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Subject</label>
          <input type="text" name="subject" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Subject line" value="${escapeHtml(block?.subject || '')}" />
        </div>
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">AI Model</label>
          <select name="ai_model" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none">
            ${models.map(m => `<option value="${m}" ${block?.ai_model === m ? 'selected' : ''}>${m}</option>`).join('')}
          </select>
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Body</label>
        <textarea name="body" rows="4" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono text-sm" placeholder="Email body...">${escapeHtml(block?.body || '')}</textarea>
      </div>
      <div>
        <label class="block text-sm font-medium text-slate-700 mb-1">Prompt (for AI)</label>
        <textarea name="prompt" rows="2" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-mono text-sm" placeholder="AI instructions...">${escapeHtml(block?.prompt || '')}</textarea>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-slate-700 mb-1">Temperature</label>
          <input type="range" name="ai_temperature" min="0" max="1" step="0.1" value="${block?.ai_temperature ?? settings.default_ai_temperature ?? 0.3}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
          <div class="flex justify-between text-xs text-slate-500 mt-1">
            <span>0.0</span>
            <span id="temp-value-${block?.id || 'default'}">${block?.ai_temperature ?? settings.default_ai_temperature ?? 0.3}</span>
            <span>1.0</span>
          </div>
        </div>
        <div class="flex items-end">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="use_ai" ${block?.use_ai ? 'checked' : ''} class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
            <span class="text-sm text-slate-700">Use AI</span>
          </label>
        </div>
        <div class="flex items-end">
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" name="subject_from_first_line" ${block?.subject_from_first_line ? 'checked' : ''} class="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500" />
            <span class="text-sm text-slate-700">Split first line as Subject</span>
          </label>
        </div>
      </div>
      ${!isDefault ? `
        <div class="pt-2 border-t border-slate-200">
          <button type="button" data-delete-template="${escapeHtml(block?.id || '')}" class="text-sm text-red-600 hover:text-red-700">Delete this block</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderConditionBlock(block, idx) {
  const conditions = block.conditions || [];
  
  return `
    <div class="condition-block bg-white rounded-lg border border-slate-200 p-4 space-y-4" data-template-id="${escapeHtml(block.id)}">
      <div class="flex items-center justify-between">
        <h4 class="font-semibold text-slate-900">Condition Block ${idx + 1}</h4>
        <button type="button" data-delete-template="${escapeHtml(block.id)}" class="text-sm text-red-600 hover:text-red-700">Delete</button>
      </div>
      
      <!-- Conditions (AND-joined) -->
      <div class="space-y-2">
        <label class="block text-sm font-medium text-slate-700 mb-1">Conditions (ALL must match)</label>
        <div id="conditions-${block.id}" class="space-y-2">
          ${conditions.map((c, ci) => renderConditionRow(block.id, c, ci)).join('')}
        </div>
        <button type="button" data-add-condition="${escapeHtml(block.id)}" class="text-sm text-indigo-600 hover:text-indigo-700">+ Add Condition</button>
      </div>

      <!-- Template content -->
      ${renderTemplateBlock(block, false)}
    </div>
  `;
}

function renderConditionRow(templateId, condition, idx) {
  return `
    <div class="flex items-center gap-2 condition-row" data-condition-id="${escapeHtml(condition.id)}" data-template-id="${escapeHtml(templateId)}">
      <select name="column_name" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none">
        <option value="">Select column</option>
        ${columnHeaders.map(h => `<option value="${escapeHtml(h)}" ${condition.column_name === h ? 'selected' : ''}>${escapeHtml(h)}</option>`).join('')}
      </select>
      <select name="operator" class="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none">
        <option value="equals" ${condition.operator === 'equals' ? 'selected' : ''}>=</option>
        <option value="contains" ${condition.operator === 'contains' ? 'selected' : ''}>contains</option>
        <option value="is_empty" ${condition.operator === 'is_empty' ? 'selected' : ''}>is empty</option>
      </select>
      <input type="text" name="value" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Value" value="${escapeHtml(condition.value || '')}" ${condition.operator === 'is_empty' ? 'disabled' : ''} />
      <button type="button" data-delete-condition="${escapeHtml(condition.id)}" class="p-2 text-slate-400 hover:text-red-600" title="Delete"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg></button>
    </div>
  `;
}

function attachTemplateEditorEvents(container) {
  // Sequence tabs
  container.querySelectorAll('[data-seq-tab]').forEach(btn => {
    btn.addEventListener('click', () => loadTemplates(btn.dataset.seqTab));
  });

  // Add condition block
  container.querySelector('#add-condition-block')?.addEventListener('click', async () => {
    const name = prompt('Condition block name (optional):');
    const block = {
      is_default: false,
      subject: '',
      body: '',
      prompt: '',
      use_ai: true,
      ai_model: 'gemini-1.5-flash',
      ai_temperature: 0.3,
      subject_from_first_line: false,
    };
    try {
      const created = await api.createTemplate(currentSequenceId, block);
      templates.push(created);
      notify();
      showToast('Condition block added', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Template block events (save on change, delete)
  container.querySelectorAll('.template-block').forEach(blockEl => {
    const templateId = blockEl.dataset.templateId;
    const isDefault = blockEl.dataset.isDefault === 'true';
    
    // Debounced save
    const save = debounce(async () => {
      const data = {
        subject: blockEl.querySelector('[name="subject"]')?.value || '',
        body: blockEl.querySelector('[name="body"]')?.value || '',
        prompt: blockEl.querySelector('[name="prompt"]')?.value || '',
        use_ai: blockEl.querySelector('[name="use_ai"]')?.checked ?? true,
        ai_model: blockEl.querySelector('[name="ai_model"]')?.value || 'gemini-1.5-flash',
        ai_temperature: parseFloat(blockEl.querySelector('[name="ai_temperature"]')?.value || '0.3'),
        subject_from_first_line: blockEl.querySelector('[name="subject_from_first_line"]')?.checked ?? false,
      };
      try {
        await saveTemplate({ id: templateId, ...data });
      } catch (err) {
        showToast(err.message, 'error');
      }
    }, 500);

    blockEl.querySelectorAll('input, select, textarea').forEach(el => {
      el.addEventListener('input', save);
      el.addEventListener('change', save);
    });

    // Temperature display update
    const tempInput = blockEl.querySelector('[name="ai_temperature"]');
    const tempValue = blockEl.querySelector(`#temp-value-${templateId}`);
    tempInput?.addEventListener('input', () => {
      if (tempValue) tempValue.textContent = tempInput.value;
    });

    // Delete template
    blockEl.querySelector('[data-delete-template]')?.addEventListener('click', () => deleteTemplate(templateId));
  });

  // Condition rows
  container.querySelectorAll('.condition-row').forEach(row => {
    const templateId = row.dataset.templateId;
    const conditionId = row.dataset.conditionId;

    // Save condition on change
    const saveCondition = debounce(async () => {
      const data = {
        column_name: row.querySelector('[name="column_name"]')?.value || '',
        operator: row.querySelector('[name="operator"]')?.value || 'equals',
        value: row.querySelector('[name="value"]')?.value || '',
      };
      if (!data.column_name) return;
      try {
        await updateCondition(conditionId, data);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }, 500);

    row.querySelectorAll('select, input').forEach(el => {
      el.addEventListener('change', saveCondition);
      el.addEventListener('input', saveCondition);
    });

    // Disable value for is_empty
    const operatorSelect = row.querySelector('[name="operator"]');
    const valueInput = row.querySelector('[name="value"]');
    operatorSelect?.addEventListener('change', () => {
      valueInput.disabled = operatorSelect.value === 'is_empty';
    });

    // Delete condition
    row.querySelector('[data-delete-condition]')?.addEventListener('click', () => deleteCondition(conditionId));
  });

  // Add condition
  container.querySelectorAll('[data-add-condition]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const templateId = btn.dataset.addCondition;
      try {
        const created = await api.addCondition(templateId, {
          column_name: '',
          operator: 'equals',
          value: '',
        });
        // Re-render to show new condition
        renderTemplateEditor(document.getElementById('app-content'));
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  });

  // Column chips - insert at cursor
  container.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const placeholder = `[${chip.dataset.chip}]`;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        const val = activeEl.value;
        activeEl.value = val.slice(0, start) + placeholder + val.slice(end);
        activeEl.focus();
        activeEl.dispatchEvent(new Event('input'));
      }
    });
  });
}

function renderColumnChips() {
  const chipsContainer = document.getElementById('template-chips');
  if (!chipsContainer) return;
  if (columnHeaders.length === 0) {
    chipsContainer.innerHTML = '<p class="text-sm text-slate-500">Upload a CSV on the Contacts tab to see column chips.</p>';
    return;
  }
  chipsContainer.innerHTML = columnHeaders.map(h => `
    <span class="chip px-2 py-1 text-xs bg-slate-100 text-slate-700 rounded border border-slate-200 cursor-pointer hover:bg-indigo-50 hover:border-indigo-200" data-chip="${escapeHtml(h)}">[${escapeHtml(h)}]</span>
  `).join('');
  chipsContainer.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const placeholder = `[${chip.dataset.chip}]`;
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        const start = activeEl.selectionStart;
        const end = activeEl.selectionEnd;
        const val = activeEl.value;
        activeEl.value = val.slice(0, start) + placeholder + val.slice(end);
        activeEl.focus();
        activeEl.dispatchEvent(new Event('input'));
      }
    });
  });
}

export const templateEditor = {
  getTemplates,
  getCurrentSequenceId,
  setColumnHeaders,
  subscribe,
  loadTemplates,
  initTemplateEditorUI: () => {
    sequences.subscribe(() => {
      if (currentSequenceId && !sequences.getSequences().find(s => s.id === currentSequenceId)) {
        loadTemplates(null);
      }
    });
  },
  renderTemplateEditor,
};