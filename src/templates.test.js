// src/templates.test.js — Unit 5 verification. Run with `npm test` (Vitest).
// Hardcoded 2-row sample; row 2 has an empty cell the template needs.

import { describe, it, expect } from "vitest";
import {
  extractPlaceholders,
  substitutePlaceholders,
  evaluateConditions,
  buildPromptPayload,
  splitFirstLine
} from "./templates.js";

const ROWS = [
  { Name: "Clay", "Email Sequence": "1", Category: "AI Tools" },
  { Name: "Qlik", "Email Sequence": "", Category: "AI Tools" }
];

const DEFAULT_BLOCK = {
  subject: "Quick idea for [Name]",
  body: "Hi [Name], love your work in [Category].",
  prompt: "Personalise this email for step [Email Sequence] of the sequence."
};

const CONDITION_BLOCKS = [
  {
    id: "c1",
    conditions: [{ column: "Email Sequence", op: "equals", value: "2" }],
    subject: "Follow-up for [Name]",
    body: "Bumping this, [Name].",
    prompt: "Write follow-up email 2."
  },
  {
    id: "c2",
    conditions: [
      { column: "Category", op: "contains", value: "ai" },
      { column: "Email Sequence", op: "equals", value: "1" }
    ],
    subject: "AI idea for [Name]",
    body: "Hi [Name], step [Email Sequence].",
    prompt: ""
  }
];

describe("extractPlaceholders", () => {
  it("finds tokens in order, deduped", () => {
    expect(extractPlaceholders("Hi [Name], [name] at [Category]!")).toEqual(["Name", "Category"]);
  });
  it("returns [] for plain text", () => {
    expect(extractPlaceholders("no tokens here")).toEqual([]);
  });
});

describe("substitutePlaceholders", () => {
  it("substitutes case-insensitively", () => {
    expect(substitutePlaceholders("Hi [name]!", ROWS[0])).toBe("Hi Clay!");
  });
  it("throws with the column name on empty cell", () => {
    expect(() => substitutePlaceholders("Step [Email Sequence]", ROWS[1])).toThrow(
      "[Email Sequence] is empty in CSV for this row"
    );
  });
  it("throws on unknown header", () => {
    expect(() => substitutePlaceholders("Hi [Nope]", ROWS[0])).toThrow(
      "[Nope] is empty in CSV for this row"
    );
  });
});

describe("evaluateConditions", () => {
  it("returns the first matching block (AND across rows)", () => {
    expect(evaluateConditions(CONDITION_BLOCKS, ROWS[0], DEFAULT_BLOCK).id).toBe("c2");
  });
  it("falls back to the default block", () => {
    expect(evaluateConditions(CONDITION_BLOCKS, ROWS[1], DEFAULT_BLOCK)).toBe(DEFAULT_BLOCK);
  });
  it("first match wins over later matches", () => {
    const blocks = [
      { id: "a", conditions: [{ column: "Category", op: "contains", value: "AI" }] },
      { id: "b", conditions: [{ column: "Name", op: "equals", value: "clay" }] }
    ];
    expect(evaluateConditions(blocks, ROWS[0]).id).toBe("a");
  });
  it("supports isEmpty operator", () => {
    const blocks = [{ id: "e", conditions: [{ column: "Email Sequence", op: "isEmpty", value: "" }] }];
    expect(evaluateConditions(blocks, ROWS[1]).id).toBe("e");
    expect(evaluateConditions(blocks, ROWS[0])).toBe(null);
  });
});

describe("buildPromptPayload", () => {
  it("returns substituted system + userContent, no raw tokens", () => {
    const { system, userContent } = buildPromptPayload(CONDITION_BLOCKS[1], ROWS[0]);
    expect(system).toContain("outreach emails");
    expect(userContent).toContain("AI idea for Clay");
    expect(userContent).toContain("step 1.");
    expect(userContent).not.toMatch(/\[[^\]]+\]/);
  });
  it("throws when a used placeholder cell is empty", () => {
    expect(() => buildPromptPayload(DEFAULT_BLOCK, ROWS[1])).toThrow(
      "[Email Sequence] is empty in CSV for this row"
    );
  });
  it("omits the instruction section when prompt is empty", () => {
    const { userContent } = buildPromptPayload(
      { subject: "Hi [Name]", body: "Yo [Name]", prompt: "" },
      ROWS[0]
    );
    expect(userContent).not.toContain("Instruction:");
    expect(userContent).toContain("Hi Clay");
  });
  it("resolves [Subject]/[Body] in the prompt to the filled template", () => {
    const { userContent } = buildPromptPayload(
      { subject: "Hi [Name]", body: "Yo [Name]", prompt: "Complete:\n[Subject]\n[Body]" },
      ROWS[0]
    );
    expect(userContent).toContain("Complete:\nHi Clay\nYo Clay");
    expect(userContent).not.toMatch(/\[[^\]]+\]/);
  });
  it("[Subject] is case-insensitive and may be empty without throwing", () => {
    const out = substitutePlaceholders("[subject] + [BODY]", ROWS[0], { Subject: "", Body: "b" });
    expect(out).toBe(" + b");
  });
  it("extras take precedence but unknown tokens still throw", () => {
    expect(() => substitutePlaceholders("[Nope]", ROWS[0], { Subject: "s", Body: "b" })).toThrow(
      "[Nope] is empty in CSV for this row"
    );
  });
});

describe("splitFirstLine", () => {
  it("splits first non-empty line as subject, strips Subject: label", () => {
    expect(splitFirstLine("My Subject\n\nHi there")).toEqual({ subject: "My Subject", body: "Hi there" });
    expect(splitFirstLine("\nSubject: Hello World\nBody line")).toEqual({ subject: "Hello World", body: "Body line" });
  });
  it("blank content yields empty subject and body", () => {
    expect(splitFirstLine("   \n  ")).toEqual({ subject: "", body: "" });
  });
  it("single line yields subject only", () => {
    expect(splitFirstLine("Only subject")).toEqual({ subject: "Only subject", body: "" });
  });
});
