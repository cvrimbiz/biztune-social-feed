import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseWorklist } from '../public/js/io.mjs';
import { ADAPTERS, buildPreview, previewCsv, canonicalRow } from '../public/js/exporters/index.mjs';
import { scoreProduct, topFor } from '../public/js/recommend.mjs';
import { parseTemplate, suggestMapping, fillTemplate } from '../public/js/templatefill.mjs';

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
  const r = fillTemplate(t, m, ps, ADAPTERS.find((a) => a.id === 'meta'));
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
  const p = samples().find((x) => x.id === 'SYN-001'); p.brand = '=1+1';
  const r = fillTemplate(t, { 0: 'brand' }, [p], ADAPTERS[0]);
  assert.match(r.csv, /'=1\+1/);
  assert.ok(!Object.keys(canonicalRow(p)).some((k) => /cost|margin|purchase|fee/i.test(k)));
});
