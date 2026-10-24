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
  packSize: 1, taxRate: '19', finishingRequired: 'no',
  costs: { purchaseNetPerPiece: '10', packagingPerUnit: '0', handlingPerUnit: '0', shippingSubsidyPerUnit: '0', fees: [] },
  target: { type: 'margin', percent: '20' }, ...over,
});

test('Marge ≠ Aufschlag: Kosten 100', () => {
  const m = suggestPrice(base({ costs: { ...base().costs, purchaseNetPerPiece: '100' } }));
  assert.equal(m.netPrice, '125.00'); // 20 % Marge
  const k = suggestPrice(base({ costs: { ...base().costs, purchaseNetPerPiece: '100' }, target: { type: 'markup', percent: '20' } }));
  assert.equal(k.netPrice, '120.00'); // 20 % Aufschlag
  assert.equal(m.marginPercent, '20.00'); assert.equal(m.markupPercent, '25.00');
  assert.equal(k.marginPercent, '16.67'); assert.equal(k.markupPercent, '20.00');
  assert.equal(m.grossPrice, '148.75');
});
test('Paketmenge multipliziert Einkauf', () => {
  const r = suggestPrice(base({ packSize: 6, costs: { ...base().costs, purchaseNetPerPiece: '2.50' }, target: { type: 'markup', percent: '0' } }));
  assert.equal(r.netPrice, '15.00');
});
test('Gebühren mit unterschiedlicher Basis', () => {
  const costs = { ...base().costs, purchaseNetPerPiece: '100', fees: [{ name: 'a', basis: 'net_price', ratePercent: '10' }] };
  const net = suggestPrice(base({ costs })); // P = 100/(1-0.1-0.2)
  assert.equal(net.netPrice, '142.86');
  const gross = suggestPrice(base({ costs: { ...costs, fees: [{ name: 'b', basis: 'gross_price', ratePercent: '10' }] } })); // φ=0.119
  assert.equal(gross.netPrice, '146.85'); // 100 / 0,681 = 146,842… → aufgerundet
});
test('Festgebühr je Bestellung, anteilige Einrichtung, Veredelung', () => {
  const r = suggestPrice(base({ finishingRequired: 'yes', costs: { ...base().costs, purchaseNetPerPiece: '10', finishingPerPiece: '2', setupTotal: '60', setupAllocationUnits: 30,
    fees: [{ name: 'f', basis: 'fixed_per_order', amount: '0.60', unitsPerOrder: 2 }] }, target: { type: 'markup', percent: '0' } }));
  assert.equal(r.costBase, '14.000000'); // 10 + 2 + 2
  assert.equal(r.netPrice, '14.30');
});
test('Ergebnis unterschreitet das Ziel nie (Aufrunden)', () => {
  for (const pct of ['7', '13.5', '33.3', '41']) {
    const r = suggestPrice(base({ costs: { ...base().costs, purchaseNetPerPiece: '7.77', fees: [{ name: 'a', basis: 'net_price', ratePercent: '3.3' }] }, target: { type: 'margin', percent: pct } }));
    assert.ok(Dec.parse(r.marginPercent).gte(Dec.parse(pct).sub('0.005')), `${pct}: ${r.marginPercent}`);
  }
});
test('Fehlende Grundlagen blockieren – nichts wird unterstellt', () => {
  const miss = (mut) => suggestPrice(mut(base()));
  assert.equal(miss((b) => ({ ...b, taxRate: null })).ok, false);
  assert.equal(miss((b) => ({ ...b, costs: { ...b.costs, fees: null } })).ok, false);
  assert.equal(miss((b) => ({ ...b, costs: { ...b.costs, packagingPerUnit: null } })).ok, false);
  assert.equal(miss((b) => ({ ...b, costs: { ...b.costs, purchaseNetPerPiece: '' } })).ok, false);
  assert.equal(miss((b) => ({ ...b, finishingRequired: null })).ok, false);
  assert.equal(miss((b) => ({ ...b, finishingRequired: 'yes' })).ok, false); // Veredelungskosten fehlen
  assert.equal(miss((b) => ({ ...b, target: { type: null } })).ok, false);
  assert.equal(miss((b) => ({ ...b, costs: { ...b.costs, fees: [{ name: 'x', ratePercent: '5' }] } })).ok, false); // Basis fehlt
  assert.equal(miss((b) => ({ ...b, packSize: 0 })).ok, false);
});
test('Unerreichbares Ziel und Nullkosten', () => {
  assert.equal(suggestPrice(base({ target: { type: 'margin', percent: '95' }, costs: { ...base().costs, fees: [{ name: 'a', basis: 'net_price', ratePercent: '10' }] } })).ok, false);
  assert.equal(suggestPrice(base({ costs: { ...base().costs, purchaseNetPerPiece: '0' } })).ok, false);
});
