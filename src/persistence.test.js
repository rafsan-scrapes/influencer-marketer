// @vitest-environment jsdom
// Unit 9 verification: seed config + 2-block template + CSV + a run entry,
// boot the REAL index.html + main.js, "reload" (fresh modules + fresh DOM),
// and confirm everything restores. Run with `npm test`.

import { readFileSync } from "node:fs";
import { describe, it, expect, beforeEach, vi } from "vitest";

function appBodyHtml() {
  const html = readFileSync("index.html", "utf8");
  return html.split(/<body[^>]*>/)[1].split('<script type="module"')[0];
}

// Fresh module registry + fresh DOM = faithful reload (module-level UI state
// like selection/statuses starts over, only localStorage survives).
async function boot() {
  vi.resetModules();
  document.body.innerHTML = appBodyHtml();
  await import("./main.js");
  return (await import("./store.js")).store;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("Unit 9 — full reload persistence", () => {
  it("restores config, template, CSV table, chips, and runs", async () => {
    let store = await boot();

    store.setConfig({ apiKey: "secret", model: "m1", endpoint: "http://srv" });
    store.setTemplates({
      default: { subject: "Hi [Name]", body: "Body [Name]", prompt: "Prompt [Name]" },
      conditions: [
        {
          id: "b1",
          conditions: [{ column: "Email Sequence", op: "equals", value: "2" }],
          subject: "Follow [Name]",
          body: "Bump [Name]",
          prompt: "Second touch."
        },
        {
          id: "b2",
          conditions: [{ column: "Category", op: "contains", value: "AI" }],
          subject: "AI [Name]",
          body: "AI body [Name]",
          prompt: ""
        }
      ]
    });
    store.setBrands({
      fileName: "sample.csv",
      headers: ["Name", "Email Sequence", "Category"],
      rows: [
        { Name: "Clay", "Email Sequence": "1", Category: "AI" },
        { Name: "Qlik", "Email Sequence": "2", Category: "AI" },
        { Name: "Acme", "Email Sequence": "3", Category: "Other" }
      ]
    });
    store.addRun({
      id: "r1",
      timestamp: 1700000000000,
      brandName: "Clay",
      emailSequence: "1",
      subject: "Hi Clay",
      body: "Done email!"
    });

    // Reload.
    store = await boot();

    // Config restored (key stays a password field; no agent-name field).
    expect(document.getElementById("cfg-agent")).toBe(null);
    expect(document.getElementById("cfg-key").value).toBe("secret");
    expect(document.getElementById("cfg-key").type).toBe("password");
    expect(document.getElementById("cfg-model").value).toBe("m1");
    expect(document.getElementById("cfg-endpoint").value).toBe("http://srv");

    // Template restored: default + 2 condition blocks with values.
    expect(document.getElementById("tpl-def-subject").value).toBe("Hi [Name]");
    const blocks = [...document.querySelectorAll("[data-block-id]")];
    expect(blocks.map((b) => b.getAttribute("data-block-id"))).toEqual(["b1", "b2"]);
    expect(blocks[0].querySelector('[data-field="subject"]').value).toBe("Follow [Name]");
    expect(blocks[0].querySelector('[data-field="column"]').value).toBe("Email Sequence");

    // Brands table restored: 3 rows, all selected by default; chips present.
    expect(document.querySelectorAll("#brands-table tbody tr")).toHaveLength(3);
    expect(document.getElementById("brands-table").textContent).toContain("Clay");
    expect(document.querySelectorAll("#brands-table [data-select-row]:checked")).toHaveLength(3);
    expect(document.getElementById("template-chips").textContent).toContain("Email Sequence");

    // Runs restored.
    expect(document.getElementById("runs-list").textContent).toContain("Hi Clay");
    expect(document.getElementById("runs-list").textContent).toContain("Done email!");

    // Store intact after reload.
    expect(store.getRuns()).toHaveLength(1);
    expect(store.getTemplates().conditions).toHaveLength(2);
  });
});
