// frontend/src/main.js — App bootstrap, tab routing, auth state

import './style.css';
import { api } from './api.js';
import { auth } from './auth.js';
import { store } from './store.js';
import { projects } from './projects.js';
import { sequences } from './sequences.js';
import { templateEditor } from './templateEditor.js';
import { contacts } from './contacts.js';
import { generator } from './generator.js';
import { generated } from './generated.js';
import { settings } from './settings.js';
import { showToast, openModal, closeModal, escapeHtml } from './utils.js';

// Tab management
const TABS = ['projects', 'sequences', 'templates', 'contacts', 'generate', 'generated', 'settings'];
let currentTab = 'projects';

export function showTab(tabName) {
  if (!TABS.includes(tabName)) return;
  
  // Check auth for protected tabs
  const protectedTabs = ['projects', 'sequences', 'templates', 'contacts', 'generate', 'generated', 'settings'];
  if (protectedTabs.includes(tabName) && !auth.isAuthenticated()) {
    showAuthPage('login');
    return;
  }
  
  currentTab = tabName;
  
  // Update tab buttons
  document.querySelectorAll('[data-tab]').forEach(btn => {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle('bg-slate-900', isActive);
    btn.classList.toggle('text-white', isActive);
    btn.classList.toggle('bg-slate-100', !isActive);
    btn.classList.toggle('text-slate-700', !isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  
  // Update panel visibility
  document.querySelectorAll('[data-panel]').forEach(panel => {
    panel.classList.toggle('hidden', panel.dataset.panel !== tabName);
  });
  
  // Render tab content
  renderTabContent(tabName);
}

async function renderTabContent(tabName) {
  const container = document.getElementById('app-content');
  if (!container) return;
  
  container.innerHTML = '<div class="flex items-center justify-center py-12"><svg class="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg></div>';
  
  try {
    switch (tabName) {
      case 'projects':
        await projects.loadProjects();
        renderProjectsTab(container);
        break;
      case 'sequences':
        await sequences.loadSequences();
        renderSequencesTab(container);
        break;
      case 'templates':
        await templateEditor.loadTemplates(projects.getCurrentProjectId() ? sequences.getSequences()[0]?.id : null);
        templateEditor.renderTemplateEditor(container);
        break;
      case 'contacts':
        await contacts.loadContacts();
        renderContactsTab(container);
        break;
      case 'generate':
        generator.renderGeneratorTab(container);
        break;
      case 'generated':
        await generated.loadGeneratedEmails();
        generated.renderGeneratedTab(container);
        break;
      case 'settings':
        settings.renderSettingsTab(container);
        break;
    }
  } catch (err) {
    console.error('Tab render error:', err);
    container.innerHTML = `<div class="text-center py-12 text-red-600">Error loading tab: ${escapeHtml(err.message)}</div>`;
  }
}

function renderProjectsTab(container) {
  const projectList = projects.getProjects();
  const currentId = projects.getCurrentProjectId();
  
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-slate-900">Projects</h2>
        <button id="new-project-main-btn" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">+ New Project</button>
      </div>
      
      ${projectList.length === 0 ? `
        <div class="bg-white rounded-lg border border-slate-200 p-12 text-center">
          <svg class="mx-auto h-12 w-12 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg>
          <h3 class="mt-4 text-lg font-medium text-slate-900">No projects yet</h3>
          <p class="mt-2 text-slate-500">Create your first project to start building email campaigns</p>
          <button id="new-project-empty-btn" class="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Create Project</button>
        </div>
      ` : `
        <div class="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table class="w-full">
            <thead>
              <tr class="bg-slate-50 border-b border-slate-200">
                <th class="px-4 py-3 text-left font-medium text-slate-700">Project</th>
                <th class="px-4 py-3 text-left font-medium text-slate-700">Sequences</th>
                <th class="px-4 py-3 text-left font-medium text-slate-700">Contacts</th>
                <th class="px-4 py-3 text-left font-medium text-slate-700">Created</th>
                <th class="px-4 py-3 text-left font-medium text-slate-700 w-32">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              ${projectList.map(p => `
                <tr class="hover:bg-slate-50 ${p.id === currentId ? 'bg-indigo-50' : ''}" data-project-id="${escapeHtml(p.id)}">
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-900">${escapeHtml(p.name)}</p>
                    <p class="text-xs text-slate-500">${p.id === currentId ? 'Active' : ''}</p>
                  </td>
                  <td class="px-4 py-3 text-slate-600">0</td>
                  <td class="px-4 py-3 text-slate-600">0</td>
                  <td class="px-4 py-3 text-slate-500">${new Date(p.created_at).toLocaleDateString()}</td>
                  <td class="px-4 py-3">
                    <div class="flex items-center gap-2">
                      ${p.id !== currentId ? `<button data-switch="${escapeHtml(p.id)}" class="text-sm text-indigo-600 hover:text-indigo-700">Switch</button>` : '<span class="text-xs text-indigo-600 font-medium">Current</span>'}
                      <button data-manage="${escapeHtml(p.id)}" class="text-sm text-slate-500 hover:text-slate-700">Manage</button>
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
  
  attachProjectsTabEvents(container);
}

function renderSequencesTab(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-slate-900">Sequences</h2>
      </div>
      
      <div class="bg-white rounded-lg border border-slate-200 p-4 mb-4">
        <form id="sequence-form" class="flex items-center gap-3 max-w-md">
          <input type="text" id="sequence-name" placeholder="Sequence name (e.g., Initial Outreach)" class="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none" />
          <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">Add Sequence</button>
        </form>
      </div>
      
      <div id="sequences-list" class="bg-white rounded-lg border border-slate-200">
        ${renderSequencesList()}
      </div>
    </div>
  `;
  
  sequences.initSequencesUI(renderSequencesTab);
  sequences.initSequenceForm();
}

function renderSequencesList() {
  const seqs = sequences.getSequences();
  if (seqs.length === 0) {
    return '<div class="p-8 text-center text-slate-500">No sequences yet. Add one above.</div>';
  }
  return seqs.map((s, idx) => `
    <div class="flex items-center gap-3 p-3 border-t border-slate-100 hover:bg-slate-50">
      <span class="w-6 text-center text-slate-500 font-medium">${idx + 1}</span>
      <div class="flex-1 min-w-0">
        <p class="font-medium text-slate-900 truncate">${escapeHtml(s.name)}</p>
        <p class="text-xs text-slate-500">Step ${s.step_order}</p>
      </div>
      <div class="flex items-center gap-2">
        <button data-edit="${escapeHtml(s.id)}" class="text-sm text-indigo-600 hover:text-indigo-700">Edit</button>
        <button data-delete="${escapeHtml(s.id)}" class="text-sm text-red-600 hover:text-red-700">Delete</button>
        ${idx > 0 ? `<button data-move-up="${escapeHtml(s.id)}" class="p-1 text-slate-400 hover:text-slate-600" title="Move up"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg></button>` : ''}
        ${idx < seqs.length - 1 ? `<button data-move-down="${escapeHtml(s.id)}" class="p-1 text-slate-400 hover:text-slate-600" title="Move down"><svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>` : ''}
      </div>
    </div>
  `).join('');
}

function renderContactsTab(container) {
  container.innerHTML = `
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h2 class="text-xl font-semibold text-slate-900">Contacts</h2>
      </div>
      
      <div class="bg-white rounded-lg border border-slate-200 p-4 mb-4">
        <div class="flex flex-wrap items-center gap-3">
          <label for="contacts-file" class="cursor-pointer rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Upload CSV
          </label>
          <input id="contacts-file" type="file" accept=".csv,text/csv" class="hidden" />
          <button id="contacts-select-all" class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">Select All</button>
          <button id="contacts-deselect-all" class="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">Deselect All</button>
          <span id="contacts-selection-count" class="text-sm text-slate-500 ml-auto">0 selected</span>
        </div>
      </div>
      
      <div id="contacts-table" class="bg-white rounded-lg border border-slate-200">
        <p class="text-sm text-slate-500 py-8 text-center">No contacts yet. Upload a CSV to get started.</p>
      </div>
    </div>
  `;
  
  initContactsUI();
}

function attachProjectsTabEvents(container) {
  // New project buttons
  container.querySelectorAll('#new-project-main-btn, #new-project-empty-btn').forEach(btn => {
    btn.addEventListener('click', () => openModal('new-project-modal'));
  });
  
  // Switch project
  container.querySelectorAll('[data-switch]').forEach(btn => {
    btn.addEventListener('click', () => {
      setCurrentProjectId(btn.dataset.switch);
      showTab('projects');
    });
  });
  
  // Manage project
  container.querySelectorAll('[data-manage]').forEach(btn => {
    btn.addEventListener('click', () => {
      renderManageProjects();
      openModal('manage-projects-modal');
    });
  });
}

function attachGeneratedEvents(container) {
  // Handled in generated.js
}

// Auth pages
function showAuthPage(page) {
  document.getElementById('login-page').classList.toggle('hidden', page !== 'login');
  document.getElementById('signup-page').classList.toggle('hidden', page !== 'signup');
  document.getElementById('app-shell').classList.add('hidden');
}

function showAppShell() {
  document.getElementById('login-page').classList.add('hidden');
  document.getElementById('signup-page').classList.add('hidden');
  document.getElementById('app-shell').classList.remove('hidden');
  showTab('projects');
}

// Auth form handlers
function initAuthForms() {
  // Login form
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Signing in...';
    try {
      await auth.login(email, password);
      showAppShell();
    } catch (err) {
      document.getElementById('auth-error').textContent = err.message;
      document.getElementById('auth-error').classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Sign In';
    }
  });
  
  // Signup form
  document.getElementById('signup-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;
    const confirm = document.getElementById('signup-confirm').value;
    if (password !== confirm) {
      document.getElementById('signup-error').textContent = 'Passwords do not match';
      document.getElementById('signup-error').classList.remove('hidden');
      return;
    }
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creating account...';
    try {
      await auth.signup(email, password);
      showAppShell();
    } catch (err) {
      document.getElementById('signup-error').textContent = err.message;
      document.getElementById('signup-error').classList.remove('hidden');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Create Account';
    }
  });
  
  // Toggle between login/signup
  document.getElementById('show-signup')?.addEventListener('click', () => showAuthPage('signup'));
  document.getElementById('show-login')?.addEventListener('click', () => showAuthPage('login'));
  
  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await auth.logout();
    showAuthPage('login');
  });
  
  // Settings link
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    closeModal('user-dropdown');
    showTab('settings');
  });
}

// Modal handlers
function initModals() {
  // Close on backdrop click
  document.querySelectorAll('[id$="-modal"]').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal(modal.id);
    });
  });
  
  // Close buttons
  document.querySelectorAll('[id$="-close"], [id$="-cancel"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('[id$="-modal"]');
      if (modal) closeModal(modal.id);
    });
  });
  
  // User dropdown
  document.getElementById('user-menu-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('user-dropdown');
    dropdown.classList.toggle('hidden');
  });
  
  // Project dropdown
  document.getElementById('project-switcher-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('project-dropdown');
    const expanded = document.getElementById('project-switcher-btn').getAttribute('aria-expanded') === 'true';
    document.getElementById('project-switcher-btn').setAttribute('aria-expanded', !expanded);
    dropdown.classList.toggle('hidden');
  });
  
  // Close dropdowns on outside click
  document.addEventListener('click', () => {
    document.getElementById('user-dropdown')?.classList.add('hidden');
    document.getElementById('project-dropdown')?.classList.add('hidden');
    document.getElementById('project-switcher-btn')?.setAttribute('aria-expanded', 'false');
  });
}

// Initialize app
async function init() {
  initAuthForms();
  initModals();
  projects.initProjectsUI();
  sequences.initSequencesUI(renderSequencesTab);
  templateEditor.initTemplateEditorUI();
  contacts.initContactsUI();
  generator.initGeneratorUI();
  generated.initGeneratedUI();
  settings.initSettingsUI();
  
  // Tab navigation
  document.querySelectorAll('[data-tab]').forEach(btn => {
    btn.addEventListener('click', () => showTab(btn.dataset.tab));
  });
  
  // Check auth state
  const user = await auth.initAuth();
  if (user) {
    showAppShell();
    document.getElementById('user-email').textContent = user.email;
  } else {
    showAuthPage('login');
  }
  
  // Handle 401 errors globally
  const originalFetch = window.fetch;
  window.fetch = async (...args) => {
    const res = await originalFetch(...args);
    if (res.status === 401) {
      await auth.logout();
      showAuthPage('login');
    }
    return res;
  };
}

init();