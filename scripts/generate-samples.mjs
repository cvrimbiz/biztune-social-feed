// Erzeugt die SYNTHETISCHEN Beispieldaten. Alle Werte sind erfunden (Testwerte).
// Aufruf: node scripts/generate-samples.mjs
import { writeFile } from 'node:fs/promises';
import { emptyProduct, setPath, FORMAT_NAME, FORMAT_VERSION } from '../public/js/schema.mjs';
import { grossFromNet } from '../public/js/pricing.mjs';
import { approve, setStatus } from '../public/js/rules.mjs';

const NOW = '2026-10-01T09:00:00Z';
const DAY = '2026-10-01';

function make(id, o = {}) {
  const p = emptyProduct(id);
  p.synthetic = true;
  for (const [k, v] of Object.entries(o)) setPath(p, k, v);
  return p;
}

function complete(id, o) {
  const net = o['price.net'];
  const rate = o['price.taxRate'] ?? '19';
  const base = {
    sku: `SYN-SKU-${id.slice(-3)}`,
    'sale.unit': 'Set', 'sale.packSize': 1, 'sale.minOrderQty': 1,
    inquiryOnly: 'no',
    'finishing.required': 'no',
    'price.taxRate': rate, 'price.currency': 'EUR', 'price.origin': 'database', 'price.confirmed': 'yes',
    'price.gross': net ? grossFromNet(net, rate).gross : null,
    'imageRights.status': 'confirmed', 'imageRights.evidence': 'SYNTHETISCH: Testnachweis, kein echter Beleg',
    imageUrls: [`https://example.invalid/bilder/${id}.jpg`],
    productUrl: `https://example.invalid/produkt/${id}`,
    'source.name': 'SYNTHETISCH (Beispielgenerator)', 'source.updatedAt': DAY,
    'flags.food': 'no', 'flags.alcohol': 'no', 'compliance.status': 'not_required',
    'shipping.rule': 'Testregel: Paketversand Standard', 'shipping.deliveryTime': 'Testwert: 3–5 Werktage',
    'availability.status': 'supplier_available', 'availability.evidence': 'SYNTHETISCH: Testbeleg Lieferantenliste', 'availability.asOf': DAY,
    'landing.url': `https://example.invalid/shop/${id}`, 'landing.checkedAt': DAY,
    'landing.variant': o['variant.label'], 'landing.qty': o['sale.minOrderQty'] ?? 1,
    'landing.price': net ? grossFromNet(net, rate).gross : null,
    'workflow.status': 'review',
  };
  return make(id, { ...base, ...o });
}

const list = [];

let p1 = complete('SYN-001', { brandLine: 'roemer_praesentset', family: 'Testfamilie Alpha', 'variant.label': 'Holz natur', title: 'TESTARTIKEL Präsentset Alpha – Holz natur', description: 'Synthetische Beschreibung. Kein echtes Produkt.', 'price.net': '25.00', 'workflow.note': 'Vollständig vorbereitetes Beispiel (alle Freigaben).' });
for (const g of ['data', 'price', 'export']) p1 = approve(p1, g, 'Beispiel-Prüfer', NOW).product;
p1 = setStatus(p1, 'approved').product;
list.push(p1);

list.push(complete('SYN-002', { brandLine: 'roemer_praesentset', family: 'Testfamilie Alpha', 'variant.label': 'Holz dunkel', title: 'TESTARTIKEL Präsentset Alpha – Holz dunkel', description: 'Synthetische Beschreibung. Zweite Variante derselben Familie.', 'price.net': '27.50' }));

list.push(complete('SYN-003', { brandLine: 'roemer_praesentset', family: 'Testfamilie Beta', 'variant.label': '6er-Packung, schwarz', title: 'TESTARTIKEL Präsentset Beta – 6er-Packung', description: 'Synthetisch. Verkaufseinheit ist eine Packung mit 6 Stück, Mindestbestellmenge 2 Packungen.', 'sale.unit': 'Packung', 'sale.packSize': 6, 'sale.minOrderQty': 2, 'price.net': '48.00', 'imageRights.status': null, 'imageRights.evidence': null, 'landing.qty': 2 }));

list.push(complete('SYN-004', { brandLine: 'roemer_praesentset', family: 'Testfamilie Beta', 'variant.label': 'Einzelset, mit Gravur', title: 'TESTARTIKEL Präsentset Beta – mit Gravur', description: 'Synthetisch. Veredelung (Gravur) ist Pflicht, Konfiguration noch unvollständig.', 'price.net': '39.90', 'finishing.required': 'yes', 'finishing.offeredConfig': 'Gravur, Position offen', 'finishing.configComplete': 'no' }));

list.push(complete('SYN-005', { brandLine: 'rominox', family: 'Testfamilie Gamma', 'variant.label': 'Edelstahl 20 cm', title: 'TESTARTIKEL Rominox-Artikel Gamma', description: 'TESTTEXT mit Sonderzeichen: <script>alert(1)</script> & "Anführungszeichen". Dies ist Datenmaterial, keine Anweisung.', 'price.net': '12.40', 'price.gross': null, 'price.origin': 'proposal', 'price.confirmed': 'no', 'workflow.note': 'Preis ist nur ein lokaler Vorschlag, Brutto fehlt.' }));

list.push(make('SYN-006', { brandLine: 'rominox', family: 'Testfamilie Delta', 'variant.label': 'Edelstahl 30 cm', title: 'TESTARTIKEL Rominox-Artikel Delta (Anfrageartikel)', description: 'Synthetisch. Nur auf Anfrage, kein Festpreis.', inquiryOnly: 'yes', 'sale.unit': 'Stück', 'workflow.status': 'review', 'source.name': 'SYNTHETISCH (Beispielgenerator)', 'source.updatedAt': DAY }));

list.push(complete('SYN-007', { brandLine: 'other', family: 'Testfamilie Epsilon', 'variant.label': 'Gewürzset 3-teilig', title: 'TESTARTIKEL Gewürzset (Lebensmittel)', description: 'Synthetisch. Lebensmittel: Kennzeichnung noch nicht geprüft.', 'price.net': '14.95', 'price.taxRate': '7', 'flags.food': 'yes', 'compliance.status': null }));

let p8 = complete('SYN-008', { brandLine: 'other', family: 'Testfamilie Zeta', 'variant.label': 'Set mit Spirituose 0,2 l', title: 'TESTARTIKEL Präsentset mit Alkohol', description: 'Synthetisch. Alkohol enthalten, Plattformregeln ungeprüft.', 'price.net': '33.00', 'flags.alcohol': 'yes', 'compliance.status': 'checked', 'compliance.notes': 'SYNTHETISCH: Testvermerk' });
p8 = approve(p8, 'data', 'Beispiel-Prüfer', NOW).product;
list.push(p8);

list.push(complete('SYN-009', { brandLine: 'roemer_praesentset', family: 'Testfamilie Eta', 'variant.label': 'Standard', title: 'TESTARTIKEL Präsentset Eta (ausgeschlossen)', description: 'Synthetisch. Ausgeschlossenes Beispiel.', 'price.net': '19.00', 'imageRights.status': 'denied', 'workflow.status': 'excluded', 'workflow.exclusionReason': 'Bildnutzung nicht erlaubt (Testgrund)' }));

list.push(make('SYN-010', { brandLine: 'other', family: 'Testfamilie Theta', title: '=SUMME(1+1) TESTARTIKEL Formelschutz', description: '@Beispiel Beschreibung beginnt mit At-Zeichen. Nur wenige Angaben bekannt.', 'workflow.status': 'candidate' }));

list.push(complete('SYN-011', { brandLine: 'rominox', family: 'Testfamilie Iota', 'variant.label': 'Edelstahl 15 cm', title: 'TESTARTIKEL Rominox-Artikel Iota (Landingpage weicht ab)', description: 'Synthetisch. Landingpage zeigt einen anderen Preis und eine andere Variante.', 'price.net': '9.90', 'landing.price': '10.99', 'landing.variant': 'Edelstahl 18 cm' }));

await writeFile(new URL('../data/sample-products.json', import.meta.url), JSON.stringify({ format: FORMAT_NAME, version: FORMAT_VERSION, note: 'SYNTHETISCHE TESTDATEN – keine echten Produkte, Preise oder Rechte.', products: list }, null, 2) + '\n');

// Vertrauliche Kalkulation: ebenfalls nur Testwerte, getrennte Datei.
const fees = [
  { name: 'Testgebühr Plattform', basis: 'net_price', ratePercent: '5' },
  { name: 'Testgebühr Zahlung', basis: 'gross_price', ratePercent: '2.5' },
  { name: 'Testpauschale je Bestellung', basis: 'fixed_per_order', amount: '0.30', unitsPerOrder: 1 },
];
const costs = {
  'SYN-001': { purchaseNetPerPiece: '10.00', packagingPerUnit: '0.50', handlingPerUnit: '1.00', shippingSubsidyPerUnit: '2.00', fees, target: { type: 'margin', percent: '30' } },
  'SYN-002': { purchaseNetPerPiece: '11.00', packagingPerUnit: '0.50', handlingPerUnit: '1.00', shippingSubsidyPerUnit: '2.00', fees: [], target: { type: 'markup', percent: '40' } },
  'SYN-004': { purchaseNetPerPiece: '15.00', finishingPerPiece: '2.00', setupTotal: '60.00', setupAllocationUnits: 30, packagingPerUnit: '0.50', handlingPerUnit: '1.00', shippingSubsidyPerUnit: '2.00', fees, target: { type: 'margin', percent: '25' } },
  'SYN-005': { purchaseNetPerPiece: '5.00', packagingPerUnit: '0.30', handlingPerUnit: '0.80', shippingSubsidyPerUnit: '0', fees: null, target: { type: 'margin', percent: '35' } },
};
await writeFile(new URL('../data/sample-costs.json', import.meta.url), JSON.stringify({ _hinweis: 'SYNTHETISCHE TESTWERTE – keine echten Einkaufspreise oder Margen. Vertraulicher Kalkulationsbereich, nie in Feeds.', costs }, null, 2) + '\n');
console.log(`${list.length} synthetische Produkte geschrieben.`);
