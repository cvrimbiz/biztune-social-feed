// Import/Export der internen Arbeitsliste (JSON und CSV). Importierte Inhalte sind Daten:
// nur bekannte Felder werden übernommen, alles wird geprüft, nichts wird still überschrieben.

import { FIELDS, FIELD_BY_PATH, FORMAT_NAME, FORMAT_VERSION, getPath, setPath, normalizeProduct } from './schema.mjs';
import { toCsv, parseCsv, unguardCell } from './csv.mjs';

export const MAX_IMPORT_CHARS = 5_000_000;
export const WORKLIST_COLUMNS = FIELDS.map((f) => f.path);

export function serializeJson(products, nowIso) {
  return JSON.stringify({ format: FORMAT_NAME, version: FORMAT_VERSION, exportedAt: nowIso, products }, null, 2) + '\n';
}

function flat(p, path) {
  const f = FIELD_BY_PATH[path];
  const v = getPath(p, path);
  if (v === null || v === undefined) return '';
  if (f.type === 'urls') return v.join(' | ');
  if (f.type === 'bool') return v ? 'yes' : '';
  return String(v);
}

export function serializeCsv(products) {
  const rows = products.map((p) => Object.fromEntries(WORKLIST_COLUMNS.map((c) => [c, flat(p, c)])));
  return toCsv(WORKLIST_COLUMNS, rows);
}

function rawFromJson(text) {
  let data;
  try { data = JSON.parse(text); } catch (e) { return { error: `Keine gültige JSON-Datei: ${e.message}` }; }
  let list = data;
  if (!Array.isArray(data)) {
    if (data === null || typeof data !== 'object') return { error: 'JSON muss ein Objekt oder eine Liste sein' };
    if (data.format !== FORMAT_NAME) return { error: `Unbekanntes Format "${String(data.format).slice(0, 40)}" (erwartet: ${FORMAT_NAME})` };
    if (typeof data.version !== 'number' || data.version > FORMAT_VERSION) return { error: `Formatversion ${String(data.version).slice(0, 10)} wird nicht unterstützt (höchstens ${FORMAT_VERSION})` };
    list = data.products;
    if (!Array.isArray(list)) return { error: 'Feld "products" muss eine Liste sein' };
  }
  return { list };
}

function rawFromCsv(text) {
  let parsed;
  try { parsed = parseCsv(text); } catch (e) { return { error: `CSV nicht lesbar: ${e.message}` }; }
  const [header, ...body] = parsed.rows;
  if (!header) return { error: 'CSV ist leer' };
  const cols = header.map((h) => h.trim());
  if (!cols.includes('id')) return { error: 'CSV braucht eine Spalte "id" in der Kopfzeile' };
  const warnings = cols.filter((c) => c && !Object.hasOwn(FIELD_BY_PATH, c)).map((c) => `Unbekannte Spalte "${c.slice(0, 40)}" wird ignoriert`);
  const list = body.map((cells) => {
    const o = {};
    cols.forEach((c, i) => {
      if (Object.hasOwn(FIELD_BY_PATH, c) && cells[i] !== undefined) setPath(o, c, unguardCell(cells[i]));
    });
    return o;
  });
  return { list, warnings };
}

/** Liest JSON oder CSV. Rückgabe: {products, errors, warnings, total}. Fehlerhafte Datensätze werden übersprungen. */
export function parseWorklist(text, { filename = '', keepApprovals = false } = {}) {
  const out = { products: [], errors: [], warnings: [], total: 0 };
  if (typeof text !== 'string') { out.errors.push('Datei konnte nicht als Text gelesen werden'); return out; }
  if (text.length > MAX_IMPORT_CHARS) { out.errors.push('Datei ist zu groß (mehr als 5 MB)'); return out; }
  const trimmed = text.replace(/^﻿/, '').trimStart();
  const isJson = /\.json$/i.test(filename) || (!/\.csv$/i.test(filename) && /^[[{]/.test(trimmed));
  const raw = isJson ? rawFromJson(trimmed) : rawFromCsv(text);
  if (raw.error) { out.errors.push(raw.error); return out; }
  out.warnings.push(...(raw.warnings ?? []));
  if (raw.list.length > 5000) { out.errors.push('Mehr als 5000 Datensätze – Datei zu groß'); return out; }
  out.total = raw.list.length;
  const seen = new Set();
  raw.list.forEach((rec, i) => {
    const r = normalizeProduct(rec, { keepApprovals });
    const where = `Datensatz ${i + 1}${r.product ? ` (${r.product.id})` : ''}`;
    r.errors.forEach((e) => out.errors.push(`${where}: ${e}`));
    if (!r.product) return;
    r.warnings.forEach((w) => out.warnings.push(`${where}: ${w}`));
    if (seen.has(r.product.id)) { out.errors.push(`${where}: ID kommt in der Datei mehrfach vor – übersprungen`); return; }
    seen.add(r.product.id);
    out.products.push(r.product);
  });
  const skus = new Map();
  for (const p of out.products) {
    if (!p.sku) continue;
    if (skus.has(p.sku)) out.warnings.push(`SKU "${p.sku}" gehört zu mehreren IDs (${skus.get(p.sku)}, ${p.id})`);
    else skus.set(p.sku, p.id);
  }
  return out;
}

const NON_APPROVAL = FIELDS.filter((f) => !f.approval).map((f) => f.path);

/** Vergleicht eingelesene mit vorhandenen Produkten – ohne etwas zu verändern. */
export function planImport(existing, incoming) {
  const byId = new Map(existing.map((p) => [p.id, p]));
  const plan = { added: [], same: [], changed: [] };
  for (const inc of incoming) {
    const cur = byId.get(inc.id);
    if (!cur) { plan.added.push(inc); continue; }
    const fields = NON_APPROVAL.filter((k) => JSON.stringify(getPath(cur, k) ?? null) !== JSON.stringify(getPath(inc, k) ?? null));
    if (fields.length) plan.changed.push({ incoming: inc, existing: cur, fields });
    else plan.same.push(inc);
  }
  return plan;
}

/**
 * Wendet einen Plan an. Neue Produkte werden hinzugefügt; abweichende nur,
 * wenn ihre ID ausdrücklich in replaceIds steht. Ohne keepApprovals bleiben vorhandene Freigaben erhalten (und werden bei Änderungen veraltet).
 */
export function applyImport(existing, plan, replaceIds = new Set(), { keepApprovals = false } = {}) {
  const replacements = new Map();
  for (const c of plan.changed) {
    if (!replaceIds.has(c.incoming.id)) continue;
    const next = structuredClone(c.incoming);
    if (!keepApprovals) {
      next.approvals = structuredClone(c.existing.approvals);
      if (next.workflow.status === 'review' && c.existing.workflow.status === 'approved') next.workflow.status = 'approved';
    }
    replacements.set(c.incoming.id, next);
  }
  return [...existing.map((p) => replacements.get(p.id) ?? p), ...plan.added];
}
