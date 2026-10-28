import test from 'node:test';
import assert from 'node:assert/strict';
import { Dec, formatMoney } from '../public/js/decimal.mjs';
import { grossFromNet, checkPrice, suggestPrice } from '../public/js/pricing.mjs';

const D = (s) => Dec.parse(s);

test('Dezimalrechnung ist exakt (kein Float-Fehler)', () => {
  assert.equal(D('0.1').add('0.2').toString(), '0.3');
  assert.equal(D('1.10').mul('3').toString(), '3.30');
  assert.equal(D('19.99').mul('100').toString(), '1999.00');
});
test('Parser: Komma ok, Tausendertrenner/Exponent abgelehnt', () => {
  assert.equal(D('12,5').toString(), '12.5');
  for (const bad of ['1.234,56', '1e3', 'abc', '', '1,2,3', 'NaN']) assert.throws(() => D(bad));
  assert.throws(() => Dec.parse(1e21));
});
test('Rundungsmodi inkl. negativer Werte', () => {
  assert.equal(D('2.345').round(2, 'half-up').toString(), '2.35');
  assert.equal(D('-2.345').round(2, 'half-up').toString(), '-2.35');
  assert.equal(D('2.341').round(2, 'ceil').toString(), '2.35');
  assert.equal(D('-2.349').round(2, 'ceil').toString(), '-2.34');
  assert.equal(D('2.349').round(2, 'floor').toString(), '2.34');
  assert.equal(D('1').div('3', 4, 'half-up').toString(), '0.3333');
  assert.equal(D('2').div('3', 4, 'ceil').toString(), '0.6667');
  assert.throws(() => D('1').div('0', 2));
});
test('Format', () => { assert.equal(formatMoney('1234.5'), '1.234,50 €'); assert.equal(formatMoney(null), '–'); });

test('Brutto aus Netto: 19 %, 7 %, 0 % und Halbcent-Rundung', () => {
  assert.equal(grossFromNet('25.00', '19').gross, '29.75');
  assert.equal(grossFromNet('14.95', '7').gross, '16.00'); // 15.9965
  assert.equal(grossFromNet('10.00', '0').gross, '10.00');
  assert.equal(grossFromNet('10.05', '19').gross, '11.96'); // 11.9595
  assert.equal(grossFromNet('0.50', '19').gross, '0.60'); // 0.595 → ab 0,5 auf
  assert.throws(() => grossFromNet('10', null));
  assert.throws(() => grossFromNet('10', '101'));
  assert.throws(() => grossFromNet('-1', '19'));
});
test('Preisprüfung: fehlende Steuer wird nicht unterstellt, Widerspruch erkannt', () => {
  assert.equal(checkPrice({ net: '10', taxRate: null, gross: '11.9', currency: 'EUR' }).ok, false);
  const c = checkPrice({ net: '10.00', taxRate: '19', gross: '11.80', currency: 'EUR' });
  assert.equal(c.ok, false); assert.match(c.problems[0], /erwartet 11.90/);
  assert.equal(checkPrice({ net: '10.00', taxRate: '19', gross: '11.90', currency: 'EUR' }).ok, true);
});

const base = (over = {}) => ({
  packSize: 1, taxRate: '19', finishingRequired: 'no', shippingTaxSame: 'yes', today: '2026-10-24',
  costs: { source: 'Testregel (synthetisch)', validUntil: '2026-12-31', purchaseNetPerPiece: '100', packagingPerUnit: '0', handlingPerUnit: '0',
    shippingCostNetPerUnit: '0', shippingRevenueGross: '0', fees: [] },
  target: { type: 'margin', percent: '20' }, ...over,
});
const withCosts = (c, extra = {}) => base({ costs: { ...base().costs, ...c }, ...extra });

test('Marge ≠ Aufschlag (Übergabedokument): Kosten 100, Steuer 19 %', () => {
  const m = suggestPrice(base());
  assert.equal(m.netPrice, '125.00'); assert.equal(m.grossPrice, '148.75'); // (R−F)(1−0,2) ≥ C
  assert.equal(m.marginPercent, '20.00'); assert.equal(m.markupPercent, '25.00');
  const k = suggestPrice(base({ target: { type: 'markup', percent: '20' } })); // R−F ≥ C×1,2
  assert.equal(k.netPrice, '120.00'); assert.equal(k.grossPrice, '142.80');
  assert.equal(k.marginPercent, '16.67'); assert.equal(k.markupPercent, '20.00');
});
test('Gebühr auf Brutto-Artikelpreis: kleinster Cent-Preis, von Hand nachgerechnet', () => {
  // 0,881·G·0,8 ≥ 119  →  G ≥ 168,842…; kleinster Netto-Cent mit gerundetem Brutto ≥ 168,85 ist 141,89
  const r = suggestPrice(withCosts({ fees: [{ name: 'T', basis: 'gross_item', ratePercent: '10' }] }));
  assert.equal(r.netPrice, '141.89'); assert.equal(r.grossPrice, '168.85');
  assert.ok(Dec.parse(r.marginPercent).gte('20'));
  assert.ok(r.steps.some((s) => s.label === 'Prüfung' && s.value === 'bestanden'));
});
test('Versandumsatz S: R = (G+S)/(1+t)', () => {
  const r = suggestPrice(withCosts({ shippingRevenueGross: '5.95' }));
  assert.equal(r.netPrice, '120.00'); assert.equal(r.grossPrice, '142.80'); // G+5,95 ≥ 148,75
  assert.equal(suggestPrice(withCosts({ shippingRevenueGross: '5.95' }, { shippingTaxSame: null })).ok, false); // Steuer auf Versand unbestätigt
});
test('Gebühren mit unterschiedlicher Basis werden umgerechnet, nicht addiert', () => {
  const a = suggestPrice(withCosts({ fees: [{ name: 'a', basis: 'net_item', ratePercent: '11.9' }] }));
  const b = suggestPrice(withCosts({ fees: [{ name: 'b', basis: 'gross_item', ratePercent: '10' }] }));
  assert.equal(a.netPrice, b.netPrice); // 11,9 % vom Netto ≙ 10 % vom Brutto bei 19 % Steuer
  const mixed = suggestPrice(withCosts({ fees: [{ name: 'a', basis: 'net_item', ratePercent: '10' }, { name: 'b', basis: 'gross_item', ratePercent: '10' }] }));
  const naive = suggestPrice(withCosts({ fees: [{ name: 'c', basis: 'gross_item', ratePercent: '20' }] }));
  assert.notEqual(mixed.netPrice, naive.netPrice); // nicht schlicht 10 % + 10 %
  const fixed = suggestPrice(withCosts({ fees: [{ name: 'f', basis: 'fixed_per_order', amount: '0.60', unitsPerOrder: 2 }] }));
  assert.equal(fixed.ok, true);
});
test('Paketmenge, Druck, Einmalkosten (nur mit Beleg verteilen)', () => {
  const fin = { purchaseNetPerPiece: '2.50', finishingPerPiece: '0.40', oneOff: { mode: 'per_package', amount: '5' } };
  const r = suggestPrice(withCosts(fin, { packSize: 6, finishingRequired: 'yes', target: { type: 'markup', percent: '0' } }));
  assert.equal(r.costBase, '22.40'); assert.equal(r.netPrice, '22.40');
  const dist = (proof) => suggestPrice(withCosts({ ...fin, oneOff: { mode: 'distributed', total: '60', packages: 30, proof } }, { packSize: 6, finishingRequired: 'yes' }));
  assert.equal(dist('').ok, false);
  assert.equal(dist('Abnahmezusage 30 Pakete (Test)').costBase, '19.400000');
  assert.equal(suggestPrice(withCosts({ purchaseNetPerPiece: '2.50', finishingPerPiece: '0.40' }, { finishingRequired: 'yes' })).ok, false); // Einmalkosten fehlen
});
test('Ergebnis unterschreitet das Ziel nie, ein Cent weniger schon', () => {
  for (const pct of ['7', '13.5', '33.3', '41']) for (const type of ['margin', 'markup']) {
    const c = { purchaseNetPerPiece: '7.77', handlingPerUnit: '1.13', fees: [{ name: 'a', basis: 'gross_total', ratePercent: '3.3' }], shippingRevenueGross: '4.90' };
    const r = suggestPrice(withCosts(c, { target: { type, percent: pct } }));
    assert.equal(r.ok, true);
    const got = Dec.parse(type === 'margin' ? r.marginPercent : r.markupPercent);
    assert.ok(got.gte(Dec.parse(pct).sub('0.005')), `${type} ${pct}: ${got}`);
  }
});
test('Fehlende/veraltete Grundlagen blockieren – nichts wird unterstellt', () => {
  const blocked = (v) => assert.equal(v.ok, false);
  blocked(suggestPrice(base({ taxRate: null })));
  blocked(suggestPrice(withCosts({ fees: null })));
  blocked(suggestPrice(withCosts({ packagingPerUnit: null })));
  blocked(suggestPrice(withCosts({ shippingRevenueGross: '' })));
  blocked(suggestPrice(withCosts({ purchaseNetPerPiece: '' })));
  blocked(suggestPrice(base({ finishingRequired: null })));
  blocked(suggestPrice(withCosts({ fees: [{ name: 'x', ratePercent: '5' }] }))); // Basis fehlt
  blocked(suggestPrice(base({ packSize: 0 })));
  blocked(suggestPrice(withCosts({ source: '' })));
  blocked(suggestPrice(withCosts({ validUntil: '2026-10-01' }))); // abgelaufen
  blocked(suggestPrice(withCosts({ validUntil: null })));
  blocked(suggestPrice(base({ target: { type: null } })));
});
test('Unerreichbares Ziel, Nullkosten, negative Werte', () => {
  blockedFee();
  function blockedFee() {
    assert.equal(suggestPrice(withCosts({ fees: [{ name: 'a', basis: 'gross_item', ratePercent: '90' }] })).ok, false);
  }
  assert.equal(suggestPrice(withCosts({ purchaseNetPerPiece: '0' })).ok, false);
  assert.equal(suggestPrice(withCosts({ purchaseNetPerPiece: '-5' })).ok, false);
});
