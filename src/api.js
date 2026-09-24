// src/api.js — the ONLY module allowed to call fetch for the AI.
// OpenAI-compatible `/chat/completions`. No DOM, no placeholder logic.
// The API key is passed in per call and never logged.

export const CHAT_COMPLETIONS_PATH = "/chat/completions";

export function resolveChatUrl(endpoint) {
  const base = (endpoint || "").trim().replace(/\/+$/, "");
  if (base.endsWith(CHAT_COMPLETIONS_PATH)) return base;
  return base + CHAT_COMPLETIONS_PATH;
}

function classifyHttpError(status, detail) {
  if (status === 401 || status === 403) {
    return {
      kind: "auth",
      message: "Authentication failed (HTTP " + status + "). Check the API key." + (detail ? " " + detail : "")
    };
  }
  if (status === 404) {
    return {
      kind: "not-found",
      message: "Endpoint or model not found (HTTP 404). Check the endpoint URL and model name." + (detail ? " " + detail : "")
    };
  }
  if (status === 429) {
    return {
      kind: "rate-limit",
      message: "Rate limited (HTTP 429). Wait a moment and try again." + (detail ? " " + detail : "")
    };
  }
  return {
    kind: "http",
    message: "Request failed (HTTP " + status + ")." + (detail ? " " + detail : "")
  };
}

function classifyNetworkError(err) {
  // Browsers report CORS blocks, DNS failures, refused connections, and
  // offline state all as a generic TypeError — they are indistinguishable
  // from fetch. Say so explicitly rather than guessing.
  if (err instanceof TypeError) {
    return {
      kind: "network",
      message:
        "Network error: the request never reached the server. " +
        "This is usually a CORS block (browser refused the cross-origin response), " +
        "a wrong endpoint URL, or no internet connection."
    };
  }
  return { kind: "network", message: "Network error: " + (err && err.message ? err.message : String(err)) };
}

async function postChatCompletions({ endpoint, apiKey, model, messages, maxTokens }) {
  if (!apiKey) {
    return { ok: false, kind: "auth", message: "No API key set. Enter it in the AI Config tab." };
  }
  if (!model) {
    return { ok: false, kind: "config", message: "No model set. Enter the model name in the AI Config tab." };
  }
  let res;
  try {
    res = await fetch(resolveChatUrl(endpoint), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey
      },
      body: JSON.stringify({
        model,
        messages,
        ...(typeof maxTokens === "number" ? { max_tokens: maxTokens } : {})
      })
    });
  } catch (err) {
    const classified = classifyNetworkError(err);
    return { ok: false, ...classified };
  }

  if (!res.ok) {
    let detail = "";
    try {
      const text = await res.text();
      detail = text.slice(0, 300);
    } catch {
      // ignore body read failures
    }
    const classified = classifyHttpError(res.status, detail);
    return { ok: false, ...classified };
  }

  let data;
  try {
    data = await res.json();
  } catch {
    return { ok: false, kind: "http", message: "Server returned an unreadable response (not JSON)." };
  }
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    return { ok: false, kind: "http", message: "Server response had no message content." };
  }
  return { ok: true, kind: "ok", message: "Connection successful.", content };
}

// Cheap connectivity check: one minimal completion.
export function testConnection({ endpoint, apiKey, model }) {
  return postChatCompletions({
    endpoint,
    apiKey,
    model,
    messages: [{ role: "user", content: "ping" }],
    maxTokens: 1
  });
}

// Full generation call used by the run pipeline (Unit 7).
// `system`/`userContent` come from templates.buildPromptPayload —
// this module never substitutes [Column Name] tokens itself.
export function sendMessage({ endpoint, apiKey, model, system, userContent }) {
  return postChatCompletions({
    endpoint,
    apiKey,
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userContent }
    ]
  });
}
