// Internes Datenformat der Arbeitsliste (siehe docs/DATENFORMAT.md).
// Unbekannt = null. Es werden niemals Standardwerte für Preise, Steuer, Bestände,
// Rechte oder Nachweise eingesetzt.

import { Dec } from './decimal.mjs';

export const FORMAT_NAME = 'biztune-social-worklist';
export const FORMAT_VERSION = 1;

export const ENUMS = {
  brandLine: { roemer_praesentset: 'Römer-Präsentset', rominox: 'Rominox', other: 'Sonstiger Kandidat' },
  rightsStatus: { confirmed: 'bestätigt', denied: 'nicht erlaubt' },
  availStatus: { own_stock: 'eigener Bestand', supplier_available: 'beim Lieferanten verfügbar', out_of_stock: 'nicht verfügbar', on_request: 'nur auf Anfrage' },
  priceOrigin: { database: 'Preisdatenbank (bestätigt)', proposal: 'lokaler Vorschlag' },
  compliance: { checked: 'geprüft', not_required: 'nicht erforderlich (geprüft)' },
  status: { candidate: 'Kandidat', review: 'Prüfung nötig', approved: 'freigegeben', excluded: 'ausgeschlossen' },
};
export const TRI = { yes: 'ja', no: 'nein' };

const TRI_IN = { yes: 'yes', ja: 'yes', true: 'yes', '1': 'yes', no: 'no', nein: 'no', false: 'no', '0': 'no' };

// type: text | longtext | url | urls | int | dec | date | datetime | enum | tri | bool | currency | gtin
export const FIELDS = [
  { path: 'id', label: 'Artikel-/Angebots-ID', type: 'text', pattern: /^[A-Za-z0-9._:-]{1,64}$/, patternHint: 'nur Buchstaben, Ziffern und . _ : - (max. 64)', group: 'Grunddaten', required: true },
  { path: 'sku', label: 'SKU', type: 'text', group: 'Grunddaten' },
  { path: 'gtin', label: 'GTIN (nur wenn belegt)', type: 'gtin', group: 'Grunddaten' },
  { path: 'asin', label: 'ASIN (nur mit Identitätsnachweis)', type: 'text', pattern: /^[A-Z0-9]{10}$/, patternHint: '10 Zeichen, Großbuchstaben/Ziffern', group: 'Grunddaten' },
  { path: 'asinProof', label: 'Nachweis der Produktidentität zur ASIN', type: 'text', group: 'Grunddaten' },
  { path: 'brandLine', label: 'Auswahlgruppe', type: 'enum', options: 'brandLine', group: 'Grunddaten' },
  { path: 'brand', label: 'Marke (nur wenn belegt)', type: 'text', group: 'Grunddaten' },
  { path: 'family', label: 'Produktfamilie', type: 'text', group: 'Grunddaten' },
  { path: 'variant.label', label: 'Konkrete Variante', type: 'text', group: 'Grunddaten' },
  { path: 'title', label: 'Titel', type: 'text', group: 'Grunddaten' },
  { path: 'description', label: 'Beschreibung', type: 'longtext', group: 'Grunddaten' },
  { path: 'productUrl', label: 'Produktlink', type: 'url', group: 'Grunddaten' },
  { path: 'imageUrls', label: 'Bildlinks (einer je Zeile)', type: 'urls', group: 'Grunddaten' },
  { path: 'imageRights.status', label: 'Bildrechte', type: 'enum', options: 'rightsStatus', group: 'Bildrechte' },
  { path: 'imageRights.evidence', label: 'Nachweis / Quelle der Bildrechte', type: 'text', group: 'Bildrechte' },
  { path: 'sale.unit', label: 'Verkaufseinheit (z. B. Set, Packung)', type: 'text', group: 'Verkaufseinheit' },
  { path: 'sale.packSize', label: 'Paketinhalt (Stück je Verkaufseinheit)', type: 'int', group: 'Verkaufseinheit' },
  { path: 'sale.minOrderQty', label: 'Mindestbestellmenge (in Verkaufseinheiten)', type: 'int', group: 'Verkaufseinheit' },
  { path: 'sale.components', label: 'Feste Stückliste / Inhalt des Sets', type: 'longtext', group: 'Verkaufseinheit' },
  { path: 'inquiryOnly', label: 'Nur auf Anfrage (kein Festpreis)?', type: 'tri', group: 'Verkaufseinheit' },
  { path: 'finishing.required', label: 'Veredelung Pflicht?', type: 'tri', group: 'Veredelung' },
  { path: 'finishing.offeredConfig', label: 'Konkret angebotene Konfiguration', type: 'text', group: 'Veredelung' },
  { path: 'finishing.configComplete', label: 'Konfiguration vollständig festgelegt?', type: 'tri', group: 'Veredelung' },
  { path: 'finishing.printPosition', label: 'Druckposition', type: 'text', group: 'Veredelung' },
  { path: 'finishing.printColors', label: 'Druckfarben', type: 'text', group: 'Veredelung' },
  { path: 'finishing.printArea', label: 'Druckfläche', type: 'text', group: 'Veredelung' },
  { path: 'finishing.artworkProcess', label: 'Druckdaten-/Korrekturprozess', type: 'text', group: 'Veredelung' },
  { path: 'finishing.oneOffIncluded', label: 'Einmalkosten im Angebotspreis enthalten?', type: 'tri', group: 'Veredelung' },
  { path: 'price.net', label: 'Nettoverkaufspreis je Verkaufseinheit', type: 'dec', group: 'Verkaufspreis' },
  { path: 'price.taxRate', label: 'Steuersatz in %', type: 'dec', max: '100', group: 'Verkaufspreis' },
  { path: 'price.gross', label: 'Bruttoverkaufspreis je Verkaufseinheit', type: 'dec', group: 'Verkaufspreis' },
  { path: 'price.currency', label: 'Währung (z. B. EUR)', type: 'currency', group: 'Verkaufspreis' },
  { path: 'price.origin', label: 'Herkunft des Preises', type: 'enum', options: 'priceOrigin', group: 'Verkaufspreis' },
  { path: 'price.confirmed', label: 'Preis in Datenbank bestätigt?', type: 'tri', group: 'Verkaufspreis' },
  { path: 'shipping.rule', label: 'Versandregel', type: 'text', group: 'Versand & Verfügbarkeit' },
  { path: 'shipping.deliveryTime', label: 'Lieferzeit', type: 'text', group: 'Versand & Verfügbarkeit' },
  { path: 'availability.status', label: 'Verfügbarkeit', type: 'enum', options: 'availStatus', group: 'Versand & Verfügbarkeit' },
  { path: 'availability.evidence', label: 'Beleg der Verfügbarkeit', type: 'text', group: 'Versand & Verfügbarkeit' },
  { path: 'availability.asOf', label: 'Stand der Verfügbarkeit', type: 'date', group: 'Versand & Verfügbarkeit' },
  { path: 'availability.reservedQty', label: 'Reservierter eigener Bestand (nur bei eigenem Bestand)', type: 'int', group: 'Versand & Verfügbarkeit' },
  { path: 'availability.location', label: 'Lagerort des Bestands', type: 'text', group: 'Versand & Verfügbarkeit' },
  { path: 'availability.sla', label: 'Zusage/SLA zur Bestandsreservierung', type: 'text', group: 'Versand & Verfügbarkeit' },
  { path: 'availability.capacityConfirmed', label: 'Lieferfähigkeit (auch saisonal/Produktion) bestätigt?', type: 'tri', group: 'Versand & Verfügbarkeit' },
  { path: 'logistics.weightGrams', label: 'Versandgewicht in Gramm', type: 'int', group: 'Versand & Verfügbarkeit' },
  { path: 'logistics.dimensionsMm', label: 'Maße in mm (L×B×H)', type: 'text', group: 'Versand & Verfügbarkeit' },
  { path: 'landing.url', label: 'Landingpage-Link', type: 'url', group: 'Landingpage-Prüfung' },
  { path: 'landing.checkedAt', label: 'Geprüft am', type: 'date', group: 'Landingpage-Prüfung' },
  { path: 'landing.variant', label: 'Dort kaufbare Variante', type: 'text', group: 'Landingpage-Prüfung' },
  { path: 'landing.qty', label: 'Dort bestellbare Mindestmenge (Verkaufseinheiten)', type: 'int', group: 'Landingpage-Prüfung' },
  { path: 'landing.price', label: 'Dort angezeigter Bruttopreis', type: 'dec', group: 'Landingpage-Prüfung' },
  { path: 'flags.food', label: 'Lebensmittel?', type: 'tri', group: 'Kennzeichnung & Sicherheit' },
  { path: 'flags.alcohol', label: 'Alkohol?', type: 'tri', group: 'Kennzeichnung & Sicherheit' },
  { path: 'flags.chilled', label: 'Kühlpflichtig?', type: 'tri', group: 'Kennzeichnung & Sicherheit' },
  { path: 'compliance.status', label: 'Prüfstatus Produkt-/Sicherheitsangaben', type: 'enum', options: 'compliance', group: 'Kennzeichnung & Sicherheit' },
  { path: 'compliance.notes', label: 'Notiz zur Prüfung', type: 'longtext', group: 'Kennzeichnung & Sicherheit' },
  { path: 'food.ingredients', label: 'Zutaten je Bestandteil', type: 'longtext', group: 'Lebensmittel (nur wenn Lebensmittel)' },
  { path: 'food.allergens', label: 'Allergene', type: 'text', group: 'Lebensmittel (nur wenn Lebensmittel)' },
  { path: 'food.netContent', label: 'Füllmenge', type: 'text', group: 'Lebensmittel (nur wenn Lebensmittel)' },
  { path: 'food.nutrition', label: 'Nährwerte (oder belegte Ausnahme)', type: 'longtext', group: 'Lebensmittel (nur wenn Lebensmittel)' },
  { path: 'food.responsibleOperator', label: 'Verantwortlicher Lebensmittelunternehmer', type: 'text', group: 'Lebensmittel (nur wenn Lebensmittel)' },
  { path: 'food.shelfLife', label: 'Haltbarkeit / Charge (bis zur vorgesehenen Nutzung)', type: 'text', group: 'Lebensmittel (nur wenn Lebensmittel)' },
  { path: 'food.storage', label: 'Lager-/Verwendungshinweise', type: 'text', group: 'Lebensmittel (nur wenn Lebensmittel)' },
  { path: 'source.name', label: 'Quelle', type: 'text', group: 'Quelle' },
  { path: 'source.updatedAt', label: 'Aktualisiert am', type: 'date', group: 'Quelle' },
  { path: 'workflow.status', label: 'Status', type: 'enum', options: 'status', group: 'Arbeitsstand', ui: false },
  { path: 'workflow.exclusionReason', label: 'Ausschlussgrund', type: 'text', group: 'Arbeitsstand', ui: false },
  { path: 'workflow.note', label: 'Interne Notiz', type: 'longtext', group: 'Arbeitsstand' },
  ...['data', 'price', 'export'].flatMap((g) => [
    { path: `approvals.${g}.approved`, label: `Freigabe ${g}`, type: 'bool', group: 'Freigaben', ui: false, approval: true },
    { path: `approvals.${g}.by`, label: `Freigabe ${g} durch`, type: 'text', group: 'Freigaben', ui: false, approval: true },
    { path: `approvals.${g}.at`, label: `Freigabe ${g} am`, type: 'datetime', group: 'Freigaben', ui: false, approval: true },
    { path: `approvals.${g}.fingerprint`, label: `Freigabe ${g} Prüfsumme`, type: 'text', pattern: /^[0-9a-f]{8}$/, patternHint: '8 Hex-Zeichen', group: 'Freigaben', ui: false, approval: true },
  ]),
  { path: 'synthetic', label: 'Synthetisches Beispiel', type: 'bool', group: 'Arbeitsstand', ui: false },
];

export const FIELD_BY_PATH = Object.fromEntries(FIELDS.map((f) => [f.path, f]));

const LIMITS = { text: 500, longtext: 5000, url: 2000, urlsMax: 10 };

export function getPath(obj, path) {
  let cur = obj;
  for (const k of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined;
    cur = cur[k];
  }
  return cur;
}

export function setPath(obj, path, value) {
  const keys = path.split('.');
  let cur = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (cur[keys[i]] === null || typeof cur[keys[i]] !== 'object') cur[keys[i]] = {};
    cur = cur[keys[i]];
  }
  cur[keys[keys.length - 1]] = value;
}

function cleanText(s, multiline) {
  const re = multiline ? /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return s.replace(/\r\n?/g, '\n').replace(re, multiline ? '' : ' ').trim();
}

function validDate(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3];
}

export function gtinValid(s) {
  if (!/^\d+$/.test(s) || ![8, 12, 13, 14].includes(s.length)) return false;
  const digits = [...s].map(Number);
  const check = digits.pop();
  let sum = 0;
  digits.reverse().forEach((d, i) => { sum += d * (i % 2 === 0 ? 3 : 1); });
  return (10 - (sum % 10)) % 10 === check;
}

function httpUrl(s) {
  if (s.length > LIMITS.url) return `Link zu lang (max. ${LIMITS.url} Zeichen)`;
  let u;
  try { u = new URL(s); } catch { return 'kein gültiger Link'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'nur http(s)-Links erlaubt';
  if (u.username || u.password) return 'Link darf keine Zugangsdaten enthalten';
  return null;
}

/** Wandelt einen Rohwert in den Zielwert. Rückgabe {value} oder {error}. Leer → null. */
export function coerce(def, raw) {
  const isEmpty = raw === null || raw === undefined || (typeof raw === 'string' && raw.trim() === '') || (Array.isArray(raw) && raw.length === 0);
  if (isEmpty) return { value: def.type === 'urls' ? [] : null };
  switch (def.type) {
    case 'text':
    case 'longtext': {
      if (typeof raw !== 'string' && typeof raw !== 'number') return { error: 'Text erwartet' };
      const s = cleanText(String(raw), def.type === 'longtext');
      const max = LIMITS[def.type];
      if (s.length > max) return { error: `zu lang (max. ${max} Zeichen)` };
      if (def.pattern && s && !def.pattern.test(s)) return { error: def.patternHint ?? 'ungültiges Format' };
      return { value: s || null };
    }
    case 'url': {
      if (typeof raw !== 'string') return { error: 'Link erwartet' };
      const s = raw.trim();
      const err = httpUrl(s);
      return err ? { error: err } : { value: s };
    }
    case 'urls': {
      let list = raw;
      if (typeof raw === 'string') list = raw.split(/[\n|]+/);
      if (!Array.isArray(list)) return { error: 'Liste von Links erwartet' };
      list = list.map((x) => (typeof x === 'string' ? x.trim() : x)).filter((x) => x !== '');
      if (list.length > LIMITS.urlsMax) return { error: `höchstens ${LIMITS.urlsMax} Links` };
      for (const u of list) {
        if (typeof u !== 'string') return { error: 'Link erwartet' };
        const err = httpUrl(u);
        if (err) return { error: `${err}: ${u.slice(0, 60)}` };
      }
      return { value: list };
    }
    case 'int': {
      const s = typeof raw === 'number' ? String(raw) : typeof raw === 'string' ? raw.trim() : null;
      if (s === null || !/^\d{1,9}$/.test(s)) return { error: 'ganze Zahl ≥ 1 erwartet' };
      const n = Number(s);
      if (n < 1) return { error: 'muss mindestens 1 sein' };
      return { value: n };
    }
    case 'dec': {
      const d = Dec.tryParse(typeof raw === 'string' || typeof raw === 'number' ? raw : null);
      if (!d) return { error: 'keine gültige Dezimalzahl (Beispiel: 12,50 oder 12.50; ohne Tausenderpunkt)' };
      if (d.isNeg()) return { error: 'darf nicht negativ sein' };
      if (def.max !== undefined && d.gt(def.max)) return { error: `höchstens ${def.max}` };
      return { value: d.toString() };
    }
    case 'date': {
      const s = typeof raw === 'string' ? raw.trim() : '';
      return validDate(s) ? { value: s } : { error: 'Datum im Format JJJJ-MM-TT erwartet' };
    }
    case 'datetime': {
      const s = typeof raw === 'string' ? raw.trim() : '';
      return /^\d{4}-\d{2}-\d{2}T[\d:.]+(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s)) ? { value: s } : { error: 'ISO-Zeitstempel erwartet' };
    }
    case 'enum': {
      const s = String(raw).trim();
      const opts = ENUMS[def.options];
      if (Object.hasOwn(opts, s)) return { value: s };
      const byLabel = Object.entries(opts).find(([, l]) => l.toLowerCase() === s.toLowerCase());
      if (byLabel) return { value: byLabel[0] };
      return { error: `unbekannter Wert "${s.slice(0, 40)}" (erlaubt: ${Object.keys(opts).join(', ')})` };
    }
    case 'tri': {
      const v = TRI_IN[String(raw).trim().toLowerCase()];
      return v ? { value: v } : { error: 'ja/nein oder leer (= unbekannt) erwartet' };
    }
    case 'bool': {
      if (raw === true || raw === false) return { value: raw };
      const v = TRI_IN[String(raw).trim().toLowerCase()];
      return v ? { value: v === 'yes' } : { error: 'ja/nein erwartet' };
    }
    case 'currency': {
      const s = String(raw).trim().toUpperCase();
      return /^[A-Z]{3}$/.test(s) ? { value: s } : { error: 'dreibuchstabiger Währungscode erwartet (z. B. EUR)' };
    }
    case 'gtin': {
      const s = String(raw).trim();
      return gtinValid(s) ? { value: s } : { error: 'keine gültige GTIN (Länge/Prüfziffer)' };
    }
    default: return { error: 'unbekannter Feldtyp' };
  }
}

export function emptyProduct(id = null) {
  const p = {};
  for (const f of FIELDS) setPath(p, f.path, f.type === 'urls' ? [] : f.type === 'bool' ? false : null);
  p.id = id;
  p.workflow.status = 'candidate';
  return p;
}

/**
 * Normalisiert einen Rohdatensatz. Es werden nur bekannte Felder übernommen
 * (unbekannte erzeugen eine Warnung, werden aber nie ausgewertet).
 */
export function normalizeProduct(raw, { keepApprovals = false } = {}) {
  const errors = [];
  const warnings = [];
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { product: null, errors: ['Datensatz ist kein Objekt'], warnings };
  }
  const p = emptyProduct();
  const seen = new Set();
  for (const f of FIELDS) {
    const rawVal = getPath(raw, f.path);
    seen.add(f.path.split('.')[0]);
    if (rawVal === undefined) continue;
    if (f.approval && !keepApprovals) continue;
    const r = coerce(f, rawVal);
    if (r.error) errors.push(`${f.label} (${f.path}): ${r.error}`);
    else setPath(p, f.path, f.type === 'bool' && r.value === null ? false : r.value);
  }
  for (const k of Object.keys(raw)) {
    if (!seen.has(k)) warnings.push(`Unbekanntes Feld "${String(k).slice(0, 40)}" wurde ignoriert`);
  }
  if (!p.id) errors.push('Artikel-/Angebots-ID fehlt');
  if (!keepApprovals) {
    if (getPath(raw, 'approvals') !== undefined) warnings.push('Freigaben in der Datei wurden nicht übernommen');
    if (p.workflow.status === 'approved') p.workflow.status = 'review';
  }
  return { product: errors.length ? null : p, errors, warnings };
}

/** Geld-/Mengenfelder als sichere Anzeige: Beschriftung eines Enum-Werts. */
export function enumLabel(optionsKey, value) {
  if (value === null || value === undefined) return 'unbekannt';
  return ENUMS[optionsKey]?.[value] ?? String(value);
}
