// frontend/src/projects.js — Project list, create, switch, delete UI

import { api } from './api.js';
import { auth } from './auth.js';
import { store } from './store.js';
import { showToast, showConfirm, openModal, closeModal, setButtonLoading, escapeHtml } from './utils.js';

let projectsList = [];
let currentProjectId = null;
let listeners = [];

function getProjects() {
  return projectsList;
}

function getCurrentProjectId() {
  return currentProjectId;
}

function setCurrentProjectId(id) {
  currentProjectId = id;
  store.lastProjectId = id;
  notify();
}

function subscribe(listener) {
  listeners.push(listener);
  return () => { listeners = listeners.filter(l => l !== listener); };
}

function notify() {
  listeners.forEach(l => l(projectsList, currentProjectId));
}

async function loadProjects() {
  try {
    projectsList = await api.listProjects();
    if (!currentProjectId) {
      currentProjectId = store.lastProjectId || (projectsList[0]?.id || null);
    }
    if (currentProjectId && !projectsList.find(p => p.id === currentProjectId)) {
      currentProjectId = projectsList[0]?.id || null;
    }
    notify();
    renderProjectSwitcher();
  } catch (err) {
    console.error('Failed to load projects:', err);
    showToast('Failed to load projects', 'error');
  }
}

async function createProject(name) {
  const project = await api.createProject(name);
  projectsList.unshift(project);
  notify();
  return project;
}

async function updateProject(id, name) {
  const updated = await api.updateProject(id, name);
  const idx = projectsList.findIndex(p => p.id === id);
  if (idx >= 0) projectsList[idx] = updated;
  notify();
  return updated;
}

async function deleteProject(id) {
  await api.deleteProject(id);
  projectsList = projectsList.filter(p => p.id !== id);
  if (currentProjectId === id) {
    currentProjectId = projectsList[0]?.id || null;
  }
  notify();
}

function renderProjectSwitcher() {
  const switcher = document.getElementById('project-switcher');
  const btn = document.getElementById('project-switcher-btn');
  const nameEl = document.getElementById('current-project-name');
  const listEl = document.getElementById('project-list');
  const dropdown = document.getElementById('project-dropdown');

  if (projectsList.length === 0) {
    switcher.classList.add('hidden');
    return;
  }
  switcher.classList.remove('hidden');

  const current = projectsList.find(p => p.id === currentProjectId);
  nameEl.textContent = current?.name || 'Select project';

  listEl.innerHTML = projectsList.map(p => `
    <button data-project-id="${escapeHtml(p.id)}" class="w-full text-left px-3 py-2 text-sm ${p.id === currentProjectId ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'} flex items-center gap-2">
      ${escapeHtml(p.name)}
      ${p.id === currentProjectId ? '<svg class="w-4 h-4 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>' : ''}
    </button>
  `).join('');

  listEl.onclick = (e) => {
    const btn = e.target.closest('[data-project-id]');
    if (btn) {
      setCurrentProjectId(btn.dataset.projectId);
      dropdown.classList.add('hidden');
      btn.setAttribute('aria-expanded', 'false');
    }
  };
}

// UI Event Handlers
export function initProjectsUI() {
  // Project switcher dropdown
  const switcherBtn = document.getElementById('project-switcher-btn');
  const dropdown = document.getElementById('project-dropdown');
  const newProjectBtn = document.getElementById('new-project-btn');
  const manageProjectsBtn = document.getElementById('manage-projects-btn');

  switcherBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = switcherBtn.getAttribute('aria-expanded') === 'true';
    switcherBtn.setAttribute('aria-expanded', !expanded);
    dropdown.classList.toggle('hidden');
  });

  // Close dropdown on outside click
  document.addEventListener('click', () => {
    dropdown?.classList.add('hidden');
    switcherBtn?.setAttribute('aria-expanded', 'false');
  });

  // New project from dropdown
  newProjectBtn?.addEventListener('click', () => {
    dropdown.classList.add('hidden');
    openModal('new-project-modal');
  });

  // Manage projects from dropdown
  manageProjectsBtn?.addEventListener('click', () => {
    dropdown.classList.add('hidden');
    renderManageProjects();
    openModal('manage-projects-modal');
  });

  // New project modal
  const newProjectForm = document.getElementById('new-project-form');
  const newProjectCancel = document.getElementById('new-project-cancel');
  newProjectForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('new-project-name').value.trim();
    if (!name) return;
    const submitBtn = newProjectForm.querySelector('button[type="submit"]');
    setButtonLoading(submitBtn, true);
    try {
      await createProject(name);
      closeModal('new-project-modal');
      newProjectForm.reset();
      showToast('Project created', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      setButtonLoading(submitBtn, false);
    }
  });
  newProjectCancel?.addEventListener('click', () => closeModal('new-project-modal'));

  // Manage projects modal
  const manageProjectsNew = document.getElementById('manage-projects-new');
  const manageProjectsClose = document.getElementById('manage-projects-close');
  manageProjectsNew?.addEventListener('click', () => {
    closeModal('manage-projects-modal');
    openModal('new-project-modal');
  });
  manageProjectsClose?.addEventListener('click', () => closeModal('manage-projects-modal'));
}

function renderManageProjects() {
  const listEl = document.getElementById('manage-projects-list');
  if (!listEl) return;

  listEl.innerHTML = projectsList.map(p => `
    <div class="flex items-center justify-between p-3 rounded-lg border border-slate-200 hover:bg-slate-50 ${p.id === currentProjectId ? 'bg-indigo-50 border-indigo-200' : ''}">
      <div class="flex items-center gap-3">
        <svg class="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/></svg>
        <div>
          <p class="font-medium text-slate-900">${escapeHtml(p.name)}</p>
          <p class="text-xs text-slate-500">${p.id === currentProjectId ? 'Current' : ''} • ${p.created_at ? new Date(p.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''}</p>
        </div>
      </div>
      <div class="flex items-center gap-2">
        ${p.id !== currentProjectId ? `
          <button data-switch="${escapeHtml(p.id)}" class="text-sm text-indigo-600 hover:text-indigo-700">Switch</button>
        ` : '<span class="text-xs text-indigo-600 font-medium">Active</span>'}
        <button data-delete="${escapeHtml(p.id)}" class="text-sm text-red-600 hover:text-red-700">Delete</button>
      </div>
    </div>
  `).join('');

  listEl.onclick = async (e) => {
    const switchBtn = e.target.closest('[data-switch]');
    const deleteBtn = e.target.closest('[data-delete]');
    if (switchBtn) {
      setCurrentProjectId(switchBtn.dataset.switch);
      closeModal('manage-projects-modal');
    }
    if (deleteBtn) {
      const id = deleteBtn.dataset.delete;
      const project = projectsList.find(p => p.id === id);
      if (project && await showConfirm('Delete Project', `Delete "${project.name}"? This will remove all sequences, templates, contacts, and generated emails.`)) {
        try {
          await deleteProject(id);
          renderManageProjects();
          showToast('Project deleted', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      }
    }
  };
}

// Auth listener to reload projects on login/logout
auth.subscribe(() => {
  if (auth.isAuthenticated()) {
    loadProjects();
  } else {
    projectsList = [];
    currentProjectId = null;
    notify();
  }
});

// Initialize on load
auth.initAuth().then(() => {
  if (auth.isAuthenticated()) loadProjects();
});

export const projects = {
  getProjects,
  getCurrentProjectId,
  setCurrentProjectId,
  subscribe,
  loadProjects,
  createProject: async (name) => {
    const project = await api.createProject(name);
    projectsList.unshift(project);
    notify();
    return project;
  },
  updateProject: async (id, name) => {
    const updated = await api.updateProject(id, name);
    const idx = projectsList.findIndex(p => p.id === id);
    if (idx >= 0) projectsList[idx] = updated;
    notify();
    return updated;
  },
  deleteProject: async (id) => {
    await api.deleteProject(id);
    projectsList = projectsList.filter(p => p.id !== id);
    if (currentProjectId === id) {
      currentProjectId = projectsList[0]?.id || null;
    }
    notify();
  },
};