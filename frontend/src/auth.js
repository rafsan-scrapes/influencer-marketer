// frontend/src/auth.js — Auth state, login/logout/signup, token management

import { api } from './api.js';
import { showToast } from './utils.js';

let currentUser = null;
let currentSettings = null;
let authListeners = [];

function getUser() {
  return currentUser;
}

function getSettings() {
  return currentSettings;
}

function isAuthenticated() {
  return !!currentUser;
}

function subscribe(listener) {
  authListeners.push(listener);
  return () => {
    authListeners = authListeners.filter(l => l !== listener);
  };
}

function notify() {
  authListeners.forEach(l => l(currentUser, currentSettings));
}

async function initAuth() {
  try {
    const data = await api.me();
    currentUser = data.user;
    currentSettings = data.settings;
  } catch (err) {
    currentUser = null;
    currentSettings = null;
  }
  notify();
  return currentUser;
}

async function signup(email, password) {
  const data = await api.signup(email, password);
  currentUser = data.user;
  currentSettings = data.settings;
  notify();
  showToast('Account created successfully', 'success');
  return data;
}

async function login(email, password) {
  const data = await api.login(email, password);
  currentUser = data.user;
  currentSettings = data.settings;
  notify();
  showToast('Welcome back!', 'success');
  return data;
}

async function logout() {
  await api.logout();
  currentUser = null;
  currentSettings = null;
  notify();
  showToast('Logged out', 'info');
}

async function refreshSettings() {
  if (!currentUser) return;
  try {
    currentSettings = await api.getSettings();
    notify();
  } catch (err) {
    console.error('Failed to refresh settings:', err);
  }
}

function getAuthHeaders() {
  return {};
}

export const auth = {
  getUser,
  getSettings,
  isAuthenticated,
  subscribe,
  initAuth,
  signup,
  login,
  logout,
  refreshSettings,
  getAuthHeaders,
};