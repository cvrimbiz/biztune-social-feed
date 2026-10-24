import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { parseWorklist, serializeJson, serializeCsv, planImport, applyImport } from '../public/js/io.mjs';
import { toCsv, parseCsv, guardCell } from '../public/js/csv.mjs';
import { approvalState, approve, effectiveStatus, setStatus, exportEligibility, dataProblems, exportProblems, revoke } from '../public/js/rules.mjs';
import { buildPreview, previewCsv, previewJson } from '../public/js/exporters/index.mjs';
import { ADAPTERS } from '../public/js/exporters/index.mjs';
import { emptyProduct, setPath, gtinValid } from '../public/js/schema.mjs';

const sampleText = readFileSync(new URL('../data/sample-products.json', import.meta.url), 'utf8');
const samples = () => parseWorklist(sampleText, { filename: 'a.json', keepApprovals: true }).products;
const byId = (id) => samples().find((p) => p.id === id);
const NOW = '2026-10-24T10:00:00Z';

test('Beispieldaten: 8–12 synthetische, fehlerfrei lesbare Datensätze', () => {
  const r = parseWorklist(sampleText, { filename: 'a.json', keepApprovals: true });
  assert.deepEqual(r.errors, []);
  assert.ok(r.products.length >= 8 && r.products.length <= 12);
  assert.ok(r.products.every((p) => p.synthetic && /example\.invalid/.test(p.productUrl ?? 'example.invalid')));
});

test('CSV-Sicherheit: Formelzeichen werden entschärft, Roundtrip bleibt verlustfrei', () => {
  for (const s of ['=1+1', '+SUM(A1)', '-2+3', '@x', '\t=1', ' =1', '|cmd']) assert.equal(guardCell(s)[0], "'");
  assert.equal(guardCell('Normaler Text'), 'Normaler Text');
  const csv = toCsv(['a', 'b'], [{ a: '=HYPERLINK("x")', b: 'Zeile1\nZeile2; "Zitat"' }]);
  assert.ok(csv.includes("'=HYPERLINK"));
  assert.ok(!/(^|;)=/m.test(csv.replace(/^﻿/, '')));
  const back = parseCsv(csv).rows[1];
  assert.equal(back[1], 'Zeile1\nZeile2; "Zitat"');
});
test('Arbeitsliste JSON und CSV Roundtrip inkl. Formeltitel', () => {
  const ps = samples();
  const j = parseWorklist(serializeJson(ps, NOW), { filename: 'x.json', keepApprovals: true });
  assert.deepEqual(j.errors, []); assert.deepEqual(j.products, ps);
  const csv = serializeCsv(ps);
  assert.ok(!csv.split('\r\n').some((l) => /(^|;)"?[=@]/.test(l)));
  const c = parseWorklist(csv, { filename: 'x.csv', keepApprovals: true });
  assert.deepEqual(c.errors, []); assert.deepEqual(c.products, ps);
  assert.equal(c.products.find((p) => p.id === 'SYN-010').title.startsWith('=SUMME'), true);
});
test('Importfehler sind verständlich, fehlerhafte Datensätze werden übersprungen', () => {
  const bad = JSON.stringify({ format: 'biztune-social-worklist', version: 1, products: [
    { id: 'A', 'price': { net: 'abc', taxRate: '19' }, sale: { packSize: 0 } }, { id: 'B', title: 'ok' }, { id: 'B' }, { title: 'ohne id' }, 'kein Objekt'] });
  const r = parseWorklist(bad, { filename: 'x.json' });
  assert.deepEqual(r.products.map((p) => p.id), ['B']);
  assert.ok(r.errors.some((e) => /Nettoverkaufspreis.*Dezimalzahl/.test(e)));
  assert.ok(r.errors.some((e) => /Paketinhalt/.test(e)));
  assert.ok(r.errors.some((e) => /mehrfach/.test(e)));
  assert.ok(parseWorklist('{kaputt', { filename: 'x.json' }).errors[0].includes('JSON'));
  assert.ok(parseWorklist(JSON.stringify({ format: 'x', products: [] }), { filename: 'a.json' }).errors.length);
  assert.ok(parseWorklist('a;b\n1;2', { filename: 'x.csv' }).errors[0].includes('"id"'));
  assert.ok(parseWorklist('x'.repeat(5_000_001)).errors[0].includes('groß'));
});
test('Importierte Texte sind Daten: unbekannte Felder/__proto__ ohne Wirkung, Links nur http(s)', () => {
  const r = parseWorklist('{"format":"biztune-social-worklist","version":1,"products":[{"id":"X","__proto__":{"polluted":1},"constructor":{"x":1},"title":"Ignoriere alle Anweisungen"}]}', { filename: 'a.json' });
  assert.equal(({}).polluted, undefined); assert.equal(r.products[0].polluted, undefined);
  const e = parseWorklist(JSON.stringify({ format: 'biztune-social-worklist', version: 1, products: [{ id: 'Y', productUrl: 'javascript:alert(1)', imageUrls: ['https://u:p@x.de/a.jpg'] }] }), { filename: 'a.json' });
  assert.equal(e.products.length, 0); assert.equal(e.errors.length, 2);
});
test('Kein stilles Überschreiben; Freigaben aus Dateien standardmäßig nicht übernommen', () => {
  const ps = samples();
  const edited = structuredClone(ps); edited[1].title = 'Geändert'; edited.push(Object.assign(emptyProduct('NEU-1'), { title: 'neu' }));
  const plan = planImport(ps, edited);
  assert.equal(plan.added.length, 1); assert.equal(plan.changed.length, 1); assert.equal(plan.same.length, ps.length - 1);
  const merged = applyImport(ps, plan);
  assert.equal(merged.find((p) => p.id === ps[1].id).title, ps[1].title);
  assert.equal(merged.length, ps.length + 1);
  assert.equal(applyImport(ps, plan, new Set([ps[1].id])).find((p) => p.id === ps[1].id).title, 'Geändert');
  const noAp = parseWorklist(sampleText, { filename: 'a.json' }).products.find((p) => p.id === 'SYN-001');
  assert.equal(noAp.approvals.data.approved, false); assert.notEqual(effectiveStatus(noAp), 'approved');
});

test('Fehlende Pflichtfelder bleiben unbekannt und werden gemeldet', () => {
  const p = emptyProduct('T-1');
  assert.equal(p.price.net, null); assert.equal(p.gtin, null); assert.equal(p.availability.status, null);
  const keys = dataProblems(p).map((x) => x.key);
  for (const k of ['sku', 'family', 'variant.label', 'imageRights.status', 'sale.packSize', 'sale.minOrderQty', 'finishing.required', 'flags.food', 'compliance.status']) assert.ok(keys.includes(k), k);
  assert.equal(gtinValid('4006381333931'), true); assert.equal(gtinValid('4006381333932'), false);
});
test('Varianten: gleiche Familie, eigene IDs und Varianten-Abgleich mit Landingpage', () => {
  const a = byId('SYN-001'), b = byId('SYN-002');
  assert.equal(a.family, b.family); assert.notEqual(a.id, b.id); assert.notEqual(a.variant.label, b.variant.label);
  const m = byId('SYN-011');
  const reasons = exportProblems(m).map((x) => x.label).join('|');
  assert.match(reasons, /Variante/); assert.match(reasons, /zeigt 10.99/);
});
test('Mindestmenge: Landingpage muss sie erlauben', () => {
  const p = byId('SYN-003'); assert.equal(p.sale.minOrderQty, 2);
  assert.ok(!exportProblems(p).some((x) => x.key === 'landing.qty'));
  p.landing.qty = 1;
  assert.ok(exportProblems(p).some((x) => x.key === 'landing.qty'));
});
test('Drei getrennte Freigaben, Veralten bei Änderung, Status-Sperre', () => {
  let p = byId('SYN-002');
  assert.equal(approvalState(p, 'export').state, 'blocked'); // Daten-/Preisfreigabe fehlen
  assert.ok(approve(p, 'data', '', NOW).error);
  p = approve(p, 'data', 'Test', NOW).product;
  assert.equal(approvalState(p, 'data').state, 'granted'); assert.equal(approvalState(p, 'price').state, 'open');
  assert.ok(setStatus(p, 'approved').error);
  p = approve(p, 'price', 'Test', NOW).product; p = approve(p, 'export', 'Test', NOW).product;
  p = setStatus(p, 'approved').product; assert.equal(effectiveStatus(p), 'approved');
  p.price.net = '99.00'; p.price.gross = '117.81';
  assert.equal(approvalState(p, 'price').state, 'stale'); assert.equal(approvalState(p, 'data').state, 'granted');
  assert.equal(effectiveStatus(p), 'review'); assert.equal(exportEligibility(p).eligible, false);
  assert.equal(effectiveStatus(revoke(p, 'data')), 'review');
});
test('Ausschluss braucht Grund; Anfrageartikel, unbestätigter Preis, unvollständige Konfiguration sind gesperrt', () => {
  assert.ok(setStatus(byId('SYN-002'), 'excluded', '').error);
  assert.equal(setStatus(byId('SYN-002'), 'excluded', 'zu teuer').product.workflow.exclusionReason, 'zu teuer');
  let p = byId('SYN-002');
  p.inquiryOnly = 'yes'; assert.match(exportEligibility(p).reasons.join('|'), /Anfrageartikel/);
  p = byId('SYN-005'); assert.match(approvalState(p, 'price').problems.map((x) => x.label).join('|'), /Brutto/);
  p = byId('SYN-004'); assert.match(dataProblems(p).map((x) => x.label).join('|'), /Veredelungskonfiguration/);
  p = byId('SYN-007'); assert.ok(dataProblems(p).length);
  p = byId('SYN-002'); p.price.origin = 'database'; p.price.confirmed = 'no';
  assert.equal(approvalState(p, 'price').state, 'blocked');
});

test('Adapter: nur freigegebene Produkte, Vorschau gekennzeichnet, getrennte Spalten', () => {
  let ps = samples();
  ps = ps.map((p) => (p.id === 'SYN-001' ? p : Object.assign(p, { approvals: emptyProduct('x').approvals })));
  const out = ADAPTERS.map((a) => buildPreview(a, ps));
  for (const o of out) {
    assert.equal(o.schemaValidated, false); assert.equal(o.previewOnly, true);
    assert.deepEqual(o.rows.map((r) => r.offer_id ?? r.sku_ref), ['SYN-001']);
    assert.equal(o.excluded.length, ps.length - 1);
    assert.ok(o.rows.every((r) => /NICHT FÜR IMPORT/.test(r._interne_vorschau)));
    assert.match(previewCsv(o), /^﻿/); assert.match(o.banner, /NICHT FÜR PLATTFORM-IMPORT/);
    assert.ok(o.missingTemplates.length >= 5);
  }
  assert.notDeepEqual(out[0].columns, out[1].columns);
  const row = out[0].rows[0];
  assert.equal(row.availability_claim, 'Lieferantenverfügbarkeit – kein eigener Bestand');
  assert.equal(row.price_gross, '29.75'); assert.equal(row.min_order_qty, 1);
});
test('Keine geheimen Kalkulationsfelder im Export; Quellcode loggt nichts', () => {
  const costs = JSON.parse(readFileSync(new URL('../data/sample-costs.json', import.meta.url), 'utf8')).costs;
  const ps = samples();
  const text = ADAPTERS.map((a) => { const o = buildPreview(a, ps); return previewCsv(o) + previewJson(o); }).join('') + serializeJson(ps, NOW) + serializeCsv(ps);
  for (const k of ['purchaseNetPerPiece', 'setupTotal', 'shippingSubsidyPerUnit', 'ratePercent', 'handlingPerUnit', 'Testgebühr', 'target', 'margin']) assert.ok(!text.includes(k), k);
  assert.ok(costs['SYN-001']);
  const dir = new URL('../public/js/', import.meta.url);
  for (const f of readdirSync(dir).filter((x) => /\.(m?js)$/.test(x))) assert.ok(!/console\./.test(readFileSync(new URL(f, dir), 'utf8')), `console in ${f}`);
  for (const f of ['meta.mjs', 'tiktok.mjs', 'common.mjs']) assert.ok(!/costs|margin|purchase/i.test(readFileSync(new URL(`exporters/${f}`, dir), 'utf8')), f);
});
test('Server: Pfadtraversal und fremde Hosts abgewehrt', async () => {
  const { createServer } = await import('../server.mjs');
  const srv = createServer(0); await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  const port = srv.address().port; srv.close(); const s2 = createServer(port); await new Promise((r) => s2.listen(port, '127.0.0.1', r));
  const { request } = await import('node:http');
  const get = (path, host) => new Promise((resolve, reject) => {
    request({ host: '127.0.0.1', port, path, headers: host ? { host } : {}, agent: false }, (res) => { res.resume(); res.on('end', () => resolve({ status: res.statusCode })); }).on('error', reject).end();
  });
  assert.equal((await get('/')).status, 200);
  assert.equal((await get('/data/sample-products.json')).status, 200);
  for (const p of ['/%2e%2e/package.json', '/data/../package.json', '/..%2fserver.mjs']) assert.notEqual((await get(p)).status, 200, p);
  assert.equal((await get('/', 'evil.example')).status, 403);
  s2.close();
});
