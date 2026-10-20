// backend/src/services/templateEngine.js — Template engine (mirrors frontend logic)
const PLACEHOLDER_RE = /\[([^\[\]]+)\]/g;

function headerIndex(row) {
  const map = new Map();
  for (const key of Object.keys(row || {})) {
    const lower = key.toLowerCase();
    if (!map.has(lower)) map.set(lower, key);
  }
  return map;
}

export function extractPlaceholders(text) {
  const seen = [];
  const lower = new Set();
  for (const match of String(text == null ? '' : text).matchAll(PLACEHOLDER_RE)) {
    const name = match[1].trim();
    if (name === '' || lower.has(name.toLowerCase())) continue;
    lower.add(name.toLowerCase());
    seen.push(name);
  }
  return seen;
}

export function substitutePlaceholders(text, row, extras) {
  const index = headerIndex(row);
  const extraIndex = new Map();
  for (const key of Object.keys(extras || {})) {
    const lower = key.toLowerCase();
    if (!extraIndex.has(lower)) extraIndex.set(lower, key);
  }
  return String(text == null ? '' : text).replace(PLACEHOLDER_RE, (token, inner) => {
    const name = inner.trim();
    if (name === '') return token;
    const extraKey = extraIndex.get(name.toLowerCase());
    if (extraKey !== undefined) {
      const v = extras[extraKey];
      return v == null ? '' : String(v);
    }
    const actual = index.get(name.toLowerCase());
    const value = actual === undefined ? '' : row[actual];
    const str = value == null ? '' : String(value);
    if (str === '') {
      throw new Error(`[${name}] is empty in CSV for this row`);
    }
    return str;
  });
}

function cellValue(row, index, column) {
  const actual = index.get(String(column).toLowerCase());
  if (actual === undefined) return '';
  const v = row[actual];
  return v == null ? '' : String(v).trim();
}

function testCondition(condition, row, index) {
  const cell = cellValue(row, index, condition.column || '');
  const op = condition.operator;
  if (op === 'is_empty') return cell === '';
  const want = String(condition.value == null ? '' : condition.value).trim().toLowerCase();
  const have = cell.toLowerCase();
  if (op === 'equals') return have === want;
  if (op === 'contains') return want !== '' && have.includes(want);
  throw new Error(`templateEngine: unknown operator "${op}"`);
}

export function evaluateConditions(conditionBlocks, row, defaultBlock = null) {
  const index = headerIndex(row);
  for (const block of conditionBlocks || []) {
    const conditions = block.conditions || [];
    if (conditions.length > 0 && conditions.every((c) => testCondition(c, row, index))) {
      return block;
    }
  }
  return defaultBlock;
}

export function buildPromptPayload(block, row) {
  const subject = substitutePlaceholders(block.subject || '', row);
  const body = substitutePlaceholders(block.body || '', row);
  const instruction = substitutePlaceholders(block.prompt || '', row, { Subject: subject, Body: body });
  const system =
    `You are an assistant writing personalised outreach emails for influencer-marketing sponsorships. ` +
    `Rules: fill in ONLY what the instruction asks for; preserve the Subject and Body text verbatim everywhere else. ` +
    `Be brief, accurate, and professional. Never invent facts about the recipient. ` +
    `Reply with the completed email only.`;
  const userContent =
    `Subject: ${subject}\n\nBody:\n${body}` +
    (instruction !== '' ? `\n\nInstruction:\n${instruction}` : '');
  return { system, userContent, subject, body };
}

export function splitFirstLine(content) {
  const lines = String(content == null ? '' : content).split(/\r?\n/);
  let i = 0;
  while (i < lines.length && lines[i].trim() === '') i += 1;
  if (i >= lines.length) return { subject: '', body: '' };
  const subject = lines[i].trim().replace(/^subject\s*:\s*/i, '');
  const body = lines.slice(i + 1).join('\n').trim();
  return { subject, body };
}