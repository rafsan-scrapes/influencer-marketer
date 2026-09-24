// src/csv.js — CSV parsing via PapaParse. No AI calls, no placeholder logic.
// parseCsv(file) resolves { headers: string[], rows: Record<string,string>[] }.
// Empty cells become "" so "empty cell" checks are simple string comparisons.

import Papa from "papaparse";

export function normalizeHeaders(rawFields) {
  // Strip BOM, trim whitespace, drop fully-empty header names.
  return (rawFields || [])
    .map((h) => (h == null ? "" : String(h).replace(/^\uFEFF/, "").trim()))
    .filter((h) => h !== "");
}

export function normalizeRow(rawRow, headers) {
  const row = {};
  for (const h of headers) {
    const v = rawRow ? rawRow[h] : undefined;
    row[h] = v == null ? "" : String(v);
  }
  return row;
}

export function parseCsvText(text) {
  return new Promise((resolve, reject) => {
    Papa.parse(text, {
      header: true,
      skipEmptyLines: "greedy",
      complete: (results) => {
        if (results.errors && results.errors.length > 0) {
          reject(new Error("CSV parse error: " + results.errors[0].message));
          return;
        }
        const headers = normalizeHeaders(results.meta.fields);
        if (headers.length === 0) {
          reject(new Error("CSV has no headers."));
          return;
        }
        resolve({ headers, rows: (results.data || []).map((r) => normalizeRow(r, headers)) });
      },
      error: (err) => reject(new Error("CSV parse error: " + (err && err.message ? err.message : String(err))))
    });
  });
}

export function parseCsv(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      parseCsvText(String(reader.result || "")).then(resolve, reject);
    };
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsText(file);
  });
}
