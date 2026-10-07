// @vitest-environment jsdom
// src/templateEditor.test.js — Unit 6 verification. Run with `npm test`.

import { describe, it, expect, beforeEach } from "vitest";
import { store } from "./store.js";
import { moveBlockId, initTemplateEditor } from "./templateEditor.js";

const PANEL = `
<section id="panel-email-template">
  <div id="template-chips"></div>
  <input id="tpl-def-subject" type="text" class="tpl-target" />
  <textarea id="tpl-def-body" class="tpl-target"></textarea>
  <textarea id="tpl-def-prompt" class="tpl-target"></textarea>
  <input id="tpl-def-split" type="checkbox" />
  <div id="template-conditions"></div>
  <button id="template-add-condition" type="button">Add condition</button>
</section>`;

function fire(el, type) {
  el.dispatchEvent(new window.Event(type, { bubbles: true }));
}

function typeInto(el, text) {
  el.value = text;
  fire(el, "input");
}

beforeEach(() => {
  window.localStorage.clear();
  document.body.innerHTML = PANEL;
  store.setBrands({ fileName: "t.csv", headers: ["Name", "Email Sequence"], rows: [] });
  initTemplateEditor();
});

describe("moveBlockId", () => {
  it("moves up/down, clamps at edges", () => {
    expect(moveBlockId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveBlockId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
    expect(moveBlockId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveBlockId(["a", "b"], "b", 1)).toEqual(["a", "b"]);
  });
});

describe("default block persistence", () => {
  it("typing persists, reload restores", () => {
    typeInto(document.getElementById("tpl-def-subject"), "Hi [Name]");
    expect(store.getTemplates().default.subject).toBe("Hi [Name]");
    // Simulate reload: wipe DOM, re-init from the same localStorage.
    document.body.innerHTML = PANEL;
    initTemplateEditor();
    expect(document.getElementById("tpl-def-subject").value).toBe("Hi [Name]");
  });
});

describe("condition blocks", () => {
  it("add → fill → reload restores with values", () => {
    document.getElementById("template-add-condition").click();
    const block = document.querySelector("[data-block-id]");
    expect(block).not.toBe(null);
    typeInto(block.querySelector('[data-field="subject"]'), "Follow [Name]");
    const id = block.getAttribute("data-block-id");
    expect(store.getTemplates().conditions).toHaveLength(1);
    document.body.innerHTML = PANEL;
    initTemplateEditor();
    const restored = document.querySelector(`[data-block-id="${id}"]`);
    expect(restored.querySelector('[data-field="subject"]').value).toBe("Follow [Name]");
  });

  it("delete removes the block", () => {
    document.getElementById("template-add-condition").click();
    document.querySelector('[data-action="del-block"]').click();
    expect(document.querySelector("[data-block-id]")).toBe(null);
    expect(store.getTemplates().conditions).toHaveLength(0);
  });

  it("reorder swaps blocks", () => {
    const add = document.getElementById("template-add-condition");
    add.click();
    add.click();
    const ids = () => [...document.querySelectorAll("[data-block-id]")].map((b) => b.getAttribute("data-block-id"));
    const [first, second] = ids();
    document.querySelector(`[data-block-id="${second}"] [data-action="move-up"]`).click();
    expect(ids()).toEqual([second, first]);
    expect(store.getTemplates().conditions.map((b) => b.id)).toEqual([second, first]);
  });

  it("AND rows: add second row shows AND badge", () => {
    document.getElementById("template-add-condition").click();
    document.querySelector('[data-action="add-row"]').click();
    expect(document.querySelectorAll("[data-cond-row]")).toHaveLength(2);
    expect(document.body.textContent).toContain("AND");
  });
});

describe("subject split toggle", () => {
  it("default checkbox persists and reload restores", () => {
    const box = document.getElementById("tpl-def-split");
    box.checked = true;
    fire(box, "change");
    expect(store.getTemplates().default.subjectFromFirstLine).toBe(true);
    document.body.innerHTML = PANEL;
    initTemplateEditor();
    expect(document.getElementById("tpl-def-split").checked).toBe(true);
  });

  it("condition block checkbox persists and reload restores", () => {
    document.getElementById("template-add-condition").click();
    const block = document.querySelector("[data-block-id]");
    const box = block.querySelector('[data-field="subjectFromFirstLine"]');
    expect(box).not.toBe(null);
    box.checked = true;
    fire(box, "change");
    const id = block.getAttribute("data-block-id");
    expect(store.getTemplates().conditions[0].subjectFromFirstLine).toBe(true);
    document.body.innerHTML = PANEL;
    initTemplateEditor();
    const restored = document.querySelector(`[data-block-id="${id}"]`);
    expect(restored.querySelector('[data-field="subjectFromFirstLine"]').checked).toBe(true);
  });
});

describe("chips", () => {
  it("click inserts [Column] at cursor in the focused input", () => {
    const subject = document.getElementById("tpl-def-subject");
    typeInto(subject, "Hi ");
    subject.focus();
    subject.setSelectionRange(3, 3);
    fire(subject, "focusin");
    document.querySelector('[data-chip="Name"]').click();
    expect(subject.value).toBe("Hi [Name]");
    expect(store.getTemplates().default.subject).toBe("Hi [Name]");
  });

  it("headers-changed event re-renders chips", () => {
    window.dispatchEvent(new window.CustomEvent("im:headers-changed", { detail: { headers: ["A", "B", "C"] } }));
    expect(document.querySelectorAll("[data-chip]")).toHaveLength(3);
  });
});
