// frontend/src/settings.js — User settings (Gemini API key, default model/temp)

import { api } from './api.js';
import { auth } from './auth.js';
import { showToast, escapeHtml } from './utils.js';

function initSettingsUI() {
  const form = document.getElementById('settings-form');
  const apiKeyInput = document.getElementById('settings-api-key');
  const modelSelect = document.getElementById('settings-model');
  const tempInput = document.getElementById('settings-temperature');
  const tempValue = document.getElementById('settings-temp-value');
  
  if (!form) return;
  
  loadSettings();
  
  tempInput?.addEventListener('input', () => {
    if (tempValue) tempValue.textContent = tempInput.value;
  });
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn = form.querySelector('button[type="submit"]');
    const data = {
      gemini_api_key: apiKeyInput.value || undefined,
      default_ai_model: modelSelect.value,
      default_ai_temperature: parseFloat(tempInput.value),
    };
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Saving...';
    
    try {
      await api.updateSettings(data);
      await auth.refreshSettings();
      showToast('Settings saved', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Save Settings';
    }
  });
}

async function loadSettings() {
  try {
    const settings = await api.getSettings();
    const apiKeyInput = document.getElementById('settings-api-key');
    const modelSelect = document.getElementById('settings-model');
    const tempInput = document.getElementById('settings-temperature');
    const tempValue = document.getElementById('settings-temp-value');
    const maskedKey = document.getElementById('settings-masked-key');
    
    if (settings.gemini_api_key && settings.gemini_api_key !== 'Not set') {
      apiKeyInput.placeholder = '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022';
      if (maskedKey) maskedKey.textContent = settings.gemini_api_key;
    } else {
      apiKeyInput.placeholder = 'Enter your Gemini API key';
      if (maskedKey) maskedKey.textContent = 'Not set';
    }
    
    if (modelSelect) modelSelect.value = settings.default_ai_model || 'gemini-1.5-flash';
    if (tempInput) {
      tempInput.value = settings.default_ai_temperature || 0.3;
      if (tempValue) tempValue.textContent = settings.default_ai_temperature || 0.3;
    }
  } catch (err) {
    console.error('Failed to load settings:', err);
  }
}

export function renderSettingsTab(container) {
  const settings = auth.getSettings() || { default_ai_model: 'gemini-1.5-flash', default_ai_temperature: 0.3 };
  const models = ['gemini-1.5-flash', 'gemini-1.5-pro'];
  
  container.innerHTML = `
    <div class="max-w-2xl space-y-6">
      <h2 class="text-xl font-semibold text-slate-900">Settings</h2>
      
      <form id="settings-form" class="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div>
          <h3 class="text-lg font-medium text-slate-900 mb-4">Gemini API Key</h3>
          <div class="space-y-2">
            <label for="settings-api-key" class="block text-sm font-medium text-slate-700">API Key</label>
            <div class="relative">
              <input type="password" id="settings-api-key" autocomplete="new-password" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm pr-10 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none" placeholder="Enter your Gemini API key" />
              <button type="button" id="toggle-api-key" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
              </button>
            </div>
            <p class="text-xs text-slate-500">Stored encrypted in database. Never sent to frontend in plain text.</p>
          </div>
          <div class="flex items-center gap-3 text-sm text-slate-600">
            <span>Current: </span>
            <span id="settings-masked-key" class="font-mono bg-slate-100 px-2 py-1 rounded">${escapeHtml(settings.gemini_api_key || 'Not set')}</span>
          </div>
        </div>
        
        <div class="pt-4 border-t border-slate-200">
          <h3 class="text-lg font-medium text-slate-900 mb-4">Default AI Settings</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label for="settings-model" class="block text-sm font-medium text-slate-700 mb-1">Default Model</label>
              <select id="settings-model" class="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none">
                ${models.map(m => `<option value="${m}" ${settings.default_ai_model === m ? 'selected' : ''}>${m}</option>`).join('')}
              </select>
            </div>
            <div>
              <label for="settings-temperature" class="block text-sm font-medium text-slate-700 mb-1">Default Temperature <span id="settings-temp-value">${escapeHtml(String(settings.default_ai_temperature))}</span></label>
              <input type="range" id="settings-temperature" min="0" max="1" step="0.1" value="${escapeHtml(String(settings.default_ai_temperature))}" class="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600" />
              <p class="text-xs text-slate-500 mt-1">Controls creativity (0 = deterministic, 1 = creative)</p>
            </div>
          </div>
        </div>
        
        <div class="pt-4 border-t border-slate-200">
          <button type="submit" class="rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-700">Save Settings</button>
        </div>
      </form>
    </div>
  `;
  
  // Toggle API key visibility
  const toggleBtn = document.getElementById('toggle-api-key');
  const apiKeyInput = document.getElementById('settings-api-key');
  toggleBtn?.addEventListener('click', () => {
    const isPassword = apiKeyInput.type === 'password';
    apiKeyInput.type = isPassword ? 'text' : 'password';
    toggleBtn.innerHTML = isPassword 
      ? '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.025m5.198-5.198A10.05 10.05 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.05 10.05 0 01-5.198 5.198m-1.5-1.5l6 6M9 9l6 6"/></svg>'
      : '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>';
  });
  
  initSettingsUI();
}

export const settings = {
  initSettingsUI,
  renderSettingsTab,
};