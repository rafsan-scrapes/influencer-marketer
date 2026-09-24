// src/aiConfig.js — AI Config tab wiring. Owns the form DOM only.
// Config values live in store.js; network goes through api.js (never here).

import { store } from "./store.js";
import { testConnection } from "./api.js";

const STATUS_COLORS = {
  idle: "text-slate-600",
  busy: "text-slate-600",
  ok: "text-green-700",
  error: "text-red-700"
};

function setStatus(el, kind, text) {
  el.textContent = text;
  el.classList.remove(...Object.values(STATUS_COLORS));
  el.classList.add(STATUS_COLORS[kind] || STATUS_COLORS.idle);
}

export function initAiConfig() {
  const agent = document.getElementById("cfg-agent");
  const key = document.getElementById("cfg-key");
  const model = document.getElementById("cfg-model");
  const endpoint = document.getElementById("cfg-endpoint");
  const testBtn = document.getElementById("cfg-test");
  const status = document.getElementById("cfg-status");
  if (!agent || !key || !model || !endpoint || !testBtn || !status) return;

  // Restore persisted values.
  const saved = store.getConfig();
  agent.value = saved.agentName;
  key.value = saved.apiKey;
  model.value = saved.model;
  endpoint.value = saved.endpoint;

  const persist = () => {
    store.setConfig({
      agentName: agent.value,
      apiKey: key.value,
      model: model.value,
      endpoint: endpoint.value.trim() === "" ? undefined : endpoint.value
    });
    // store coerces an empty endpoint back to the default; reflect it.
    endpoint.value = store.getConfig().endpoint;
  };
  for (const input of [agent, key, model, endpoint]) {
    input.addEventListener("input", persist);
    input.addEventListener("change", persist);
  }

  testBtn.addEventListener("click", async () => {
    persist();
    const config = store.getConfig();
    setStatus(status, "busy", "Testing…");
    testBtn.disabled = true;
    try {
      const result = await testConnection(config);
      if (result.ok) {
        setStatus(status, "ok", "Connection successful.");
      } else {
        setStatus(status, "error", result.message);
      }
    } finally {
      testBtn.disabled = false;
    }
  });
}
