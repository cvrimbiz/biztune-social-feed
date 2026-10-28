import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWorklist } from '../public/js/io.mjs';
import { ADAPTERS, buildPreview, previewCsv, canonicalRow } from '../public/js/exporters/index.mjs';
import { scoreProduct, topFor } from '../public/js/recommend.mjs';
import { parseTemplate, suggestMapping, fillTemplate } from '../public/js/templatefill.mjs';
import { config, approve } from '../public/js/rules.mjs';
import { sha256Hex, provenanceProblems, gateProblems, CHECKS } from '../public/js/platform.mjs';
config.today = () => '2026-10-24';
const PROV = { marketDE: true, category: 'Testkategorie', purpose: 'Neuanlage', downloadedAt: '2026-10-20', origin: 'Testherkunft (synthetisch)', sha256: 'a'.repeat(64) };
const OK = (id) => ({ [id]: Object.fromEntries(CHECKS[id].map(([k]) => [k, 'yes'])) });

const text = readFileSync(new URL('../data/sample-products.json', import.meta.url), 'utf8');
const samples = () => parseWorklist(text, { filename: 'a.json', keepApprovals: true }).products;
const amazon = ADAPTERS.find((a) => a.id === 'amazon');

test('Amazon-Adapter: GTIN und Marke werden nicht erfunden und sperren', () => {
  const ps = samples();
  const p = ps.find((x) => x.id === 'SYN-001');
  const clean = structuredClone(p); clean.gtin = null; clean.brand = null;
  const prev = buildPreview(amazon, [clean]);
  assert.equal(prev.rows.length, 0);
  assert.ok(prev.excluded[0].reasons.some((r) => /GTIN/.test(r)) && prev.excluded[0].reasons.some((r) => /Marke/.test(r)));
  assert.equal(buildPreview(amazon, [p]).rows.length, 1);
  assert.equal(amazon.schemaValidated, false);
  assert.match(previewCsv(buildPreview(amazon, [p])), /NICHT FÜR IMPORT/);
  assert.ok(amazon.missingTemplates.length >= 5);
});

test('Empfehlung: Anfrageartikel/ausgeschlossen = 0, Alkohol-Abzug, deterministische Rangfolge', () => {
  const ps = samples();
  const get = (id) => ps.find((p) => p.id === id);
  const meta = ADAPTERS[0];
  assert.equal(scoreProduct(get('SYN-006'), meta).score, 0);
  assert.equal(scoreProduct(get('SYN-009'), meta).score, 0);
  assert.ok(scoreProduct(get('SYN-001'), meta).score > scoreProduct(get('SYN-008'), meta).score);
  assert.ok(scoreProduct(get('SYN-008'), meta).minus.some((m) => /Alkohol/.test(m)));
  const top = topFor(ps, 'meta', 3).map((r) => r.p.id);
  assert.equal(top[0], 'SYN-001');
  assert.deepEqual(top, topFor(ps, 'meta', 3).map((r) => r.p.id));
  assert.ok(!topFor(ps, 'meta', 20).some((r) => ['SYN-006', 'SYN-009'].includes(r.p.id)));
});

const TEMPLATE = 'Hinweis: bitte nicht ändern;;;\r\nSKU;Titel;Preis;Zustand;Brutto-Preis\r\n';
test('Vorlagenbefüllung: Vorschläge nur eindeutig, Hinweiszeilen bleiben, nur exportfähige Produkte', () => {
  const t = parseTemplate(TEMPLATE, 2);
  assert.deepEqual(t.headers, ['SKU', 'Titel', 'Preis', 'Zustand', 'Brutto-Preis']);
  assert.equal(t.preRows.length, 1);
  const m = suggestMapping(t.headers);
  assert.equal(m[0], 'sku'); assert.equal(m[1], 'title'); assert.equal(m[2], ''); // „Preis“ mehrdeutig → nicht geraten
  assert.equal(m[4], 'price_gross');
  m[3] = 'const:New';
  const ps = samples();
  const r = fillTemplate(t, m, ps, ADAPTERS.find((a) => a.id === 'meta'), { provenance: PROV, platformSettings: OK('meta') });
  assert.equal(r.filled, 1);
  assert.equal(r.excluded.length, ps.length - 1);
  const lines = r.csv.replace(/^﻿/, '').trim().split('\r\n');
  assert.equal(lines[0], 'Hinweis: bitte nicht ändern;;;');
  assert.equal(lines[1], 'SKU;Titel;Preis;Zustand;Brutto-Preis');
  assert.match(lines[2], /^SYN-SKU-001;.*;;New;29\.75$/);
  assert.deepEqual(r.unmapped, ['Preis']);
});
test('Vorlagenbefüllung: Formelschutz, Fehler bei falscher Kopfzeile, keine Kalkulationsfelder', () => {
  assert.throws(() => parseTemplate(TEMPLATE, 9), /Kopfzeile/);
  const t = parseTemplate('Marke\r\n', 1);
  let p = samples().find((x) => x.id === 'SYN-001'); p.brand = '=1+1';
  for (const g of ['data', 'export']) p = approve(p, g, 'T', '2026-10-24T10:00:00Z').product; // Freigaben nach Änderung erneuern
  const r = fillTemplate(t, { 0: 'brand' }, [p], ADAPTERS[0], { provenance: PROV, platformSettings: OK('meta') });
  assert.match(r.csv, /'=1\+1/);
  assert.ok(!Object.keys(canonicalRow(p)).some((k) => /cost|margin|purchase|fee/i.test(k)));
});

test('Ohne Herkunftsnachweis oder bestätigte Plattform-Voraussetzungen wird nichts befüllt', () => {
  const t = parseTemplate(TEMPLATE, 2); const m = suggestMapping(t.headers); const meta = ADAPTERS[0]; const ps = samples();
  const none = fillTemplate(t, m, ps, meta, {});
  assert.equal(none.blocked, true); assert.equal(none.csv, null);
  assert.ok(none.gate.some((g) => /Herkunftsangabe/.test(g)) && none.gate.some((g) => /SHA-256/.test(g)) && none.gate.some((g) => /Nicht bestätigt/.test(g)));
  assert.equal(fillTemplate(t, m, ps, meta, { provenance: PROV }).blocked, true);
  assert.equal(fillTemplate(t, m, ps, meta, { platformSettings: OK('meta') }).blocked, true);
  assert.equal(fillTemplate(t, m, ps, meta, { provenance: { ...PROV, marketDE: false }, platformSettings: OK('meta') }).blocked, true);
  assert.equal(fillTemplate(t, m, ps, meta, { provenance: PROV, platformSettings: OK('meta') }).blocked, false);
  assert.equal(provenanceProblems(PROV).length, 0);
  assert.equal(gateProblems('amazon', {}).length, CHECKS.amazon.length);
});
test('Pflichtspalten: ohne Zuordnung gesperrt, leere Pflichtwerte sperren das Produkt', () => {
  const t = parseTemplate('SKU;Marke;Zustand\r\n', 1); const meta = ADAPTERS[0]; const opts = { provenance: PROV, platformSettings: OK('meta') };
  assert.equal(fillTemplate(t, { 0: 'sku', 1: '', 2: '' }, samples(), meta, { ...opts, required: { 2: true } }).blocked, true);
  const r = fillTemplate(t, { 0: 'sku', 1: 'gtin', 2: 'const:' }, samples(), meta, { ...opts, required: { 2: true } });
  assert.equal(r.filled, 0); assert.match(r.excluded.find((e) => e.id === 'SYN-001').reasons[0], /Pflichtspalte leer: Zustand/);
});
test('SHA-256 der Originaldatei', async () => {
  assert.equal(await sha256Hex(new TextEncoder().encode('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
});
