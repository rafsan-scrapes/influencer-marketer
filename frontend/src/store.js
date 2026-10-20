// frontend/src/store.js — UI preferences (theme, lastProjectId)

const STORAGE_KEY = 'im_ui_prefs';

export const store = {
  get theme() {
    return localStorage.getItem(`${STORAGE_KEY}_theme`) || 'light';
  },
  set theme(val) {
    localStorage.setItem(`${STORAGE_KEY}_theme`, val);
    document.documentElement.classList.toggle('dark', val === 'dark');
  },

  get lastProjectId() {
    return localStorage.getItem(`${STORAGE_KEY}_lastProjectId`) || null;
  },
  set lastProjectId(val) {
    if (val) localStorage.setItem(`${STORAGE_KEY}_lastProjectId`, val);
    else localStorage.removeItem(`${STORAGE_KEY}_lastProjectId`);
  },

  get sidebarOpen() {
    return localStorage.getItem(`${STORAGE_KEY}_sidebarOpen`) === 'true';
  },
  set sidebarOpen(val) {
    localStorage.setItem(`${STORAGE_KEY}_sidebarOpen`, String(val));
  },
};

// Initialize theme on load
if (store.theme === 'dark') {
  document.documentElement.classList.add('dark');
}