import "./style.css";
import { store } from "./store.js";
import { initAiConfig } from "./aiConfig.js";
import { initBrands } from "./brands.js";
import { initTemplateEditor } from "./templateEditor.js";

// Exposed for browser-console verification (Unit 2 verify step).
window.store = store;

initAiConfig();
initBrands();
initTemplateEditor();

const ACTIVE = ["bg-slate-900", "text-white"];
const INACTIVE = ["bg-white", "text-slate-700", "hover:bg-slate-200"];

const buttons = [...document.querySelectorAll(".tab-btn[data-tab]")];
const panels = {
  "ai-config": document.getElementById("panel-ai-config"),
  "email-template": document.getElementById("panel-email-template"),
  brands: document.getElementById("panel-brands"),
  runs: document.getElementById("panel-runs")
};

export function showTab(name) {
  for (const btn of buttons) {
    const active = btn.dataset.tab === name;
    btn.classList.remove(...ACTIVE, ...INACTIVE);
    btn.classList.add(...(active ? ACTIVE : INACTIVE));
    btn.setAttribute("aria-selected", String(active));
  }
  for (const [key, panel] of Object.entries(panels)) {
    panel.classList.toggle("hidden", key !== name);
  }
}

for (const btn of buttons) {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
}

showTab("ai-config");
