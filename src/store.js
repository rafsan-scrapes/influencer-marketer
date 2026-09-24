// src/store.js — localStorage wrapper. No DOM, no fetch.
//
// Versioned keys: `im_<domain>.v<N>`. Safe JSON parse/stringify:
// corrupt or missing data returns a fresh default, never throws to the UI.

export const STORE_VERSION = 1;

export const DEFAULT_ENDPOINT = "http://localhost:4096";

const DOMAINS = ["config", "templates", "runs", "brands"];

function keyFor(domain) {
  return `im_${domain}.v${STORE_VERSION}`;
}

function defaultFor(domain) {
  switch (domain) {
    case "config":
      return { agentName: "", apiKey: "", model: "", endpoint: DEFAULT_ENDPOINT };
    case "templates":
      return { default: { subject: "", body: "", prompt: "" }, conditions: [] };
    case "runs":
      return [];
    case "brands":
      return { fileName: "", headers: [], rows: [] };
    default:
      throw new Error(`store: unknown domain "${domain}"`);
  }
}

function assertDomain(domain) {
  if (!DOMAINS.includes(domain)) {
    throw new Error(`store: unknown domain "${domain}" (expected one of ${DOMAINS.join(", ")})`);
  }
}

function readRaw(domain) {
  try {
    return window.localStorage.getItem(keyFor(domain));
  } catch {
    return null;
  }
}

function writeRaw(domain, raw) {
  try {
    window.localStorage.setItem(keyFor(domain), raw);
  } catch {
    // Storage full / unavailable (private mode): keep app usable, drop persistence.
  }
}

function safeParse(raw, domain) {
  if (raw == null) return structuredCloneDefault(domain);
  try {
    const value = JSON.parse(raw);
    if (value == null) return structuredCloneDefault(domain);
    return value;
  } catch {
    return structuredCloneDefault(domain);
  }
}

function structuredCloneDefault(domain) {
  return JSON.parse(JSON.stringify(defaultFor(domain)));
}

function isPlainObject(v) {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

// Light shape checks so a corrupt-but-valid-JSON value can't crash the UI.
function coerce(domain, value) {
  const fallback = structuredCloneDefault(domain);
  if (domain === "runs") {
    return Array.isArray(value) ? value : fallback;
  }
  if (!isPlainObject(value)) return fallback;
  if (domain === "config") {
    return {
      agentName: typeof value.agentName === "string" ? value.agentName : "",
      apiKey: typeof value.apiKey === "string" ? value.apiKey : "",
      model: typeof value.model === "string" ? value.model : "",
      endpoint:
        typeof value.endpoint === "string" && value.endpoint.length > 0
          ? value.endpoint
          : DEFAULT_ENDPOINT
    };
  }
  if (domain === "brands") {
    return {
      fileName: typeof value.fileName === "string" ? value.fileName : "",
      headers: Array.isArray(value.headers) ? value.headers.filter((h) => typeof h === "string") : [],
      rows: Array.isArray(value.rows) ? value.rows.filter(isPlainObject) : []
    };
  }
  // templates
  const def = isPlainObject(value.default) ? value.default : {};
  return {
    default: {
      subject: typeof def.subject === "string" ? def.subject : "",
      body: typeof def.body === "string" ? def.body : "",
      prompt: typeof def.prompt === "string" ? def.prompt : ""
    },
    conditions: Array.isArray(value.conditions) ? value.conditions : []
  };
}

export const store = {
  get(domain) {
    assertDomain(domain);
    return coerce(domain, safeParse(readRaw(domain), domain));
  },

  set(domain, value) {
    assertDomain(domain);
    const coerced = coerce(domain, value);
    try {
      writeRaw(domain, JSON.stringify(coerced));
    } catch {
      // Unstringifiable value: store the default so a later get() stays safe.
      writeRaw(domain, JSON.stringify(structuredCloneDefault(domain)));
    }
    return coerced;
  },

  clear(domain) {
    assertDomain(domain);
    try {
      window.localStorage.removeItem(keyFor(domain));
    } catch {
      // ignore
    }
  },

  // Typed accessors — config
  getConfig() {
    return this.get("config");
  },
  setConfig(value) {
    return this.set("config", value);
  },

  // Typed accessors — templates
  getTemplates() {
    return this.get("templates");
  },
  setTemplates(value) {
    return this.set("templates", value);
  },

  // Typed accessors — runs
  getRuns() {
    return this.get("runs");
  },
  setRuns(value) {
    return this.set("runs", value);
  },
  addRun(entry) {
    const runs = this.getRuns();
    runs.push(entry);
    return this.setRuns(runs);
  },
  clearRuns() {
    return this.setRuns([]);
  },

  // Typed accessors — brands (loaded CSV; replaced on each upload, never clears runs)
  getBrands() {
    return this.get("brands");
  },
  setBrands(value) {
    return this.set("brands", value);
  },
  clearBrands() {
    return this.setBrands({ fileName: "", headers: [], rows: [] });
  }
};

export default store;
