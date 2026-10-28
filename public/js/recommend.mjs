// Transparente, regelbasierte Eignungsbewertung je Plattform.
// ACHTUNG: Bewertet nur den VORBEREITUNGSSTAND und einfache Verkaufbarkeit anhand vorhandener Daten.
// Marktnachfrage, Verkaufshistorie oder Margen fließen NICHT ein (dafür liegen keine Daten vor).
import { exportEligibility, dataProblems, priceProblems, exportProblems } from './rules.mjs';
import { ADAPTERS, eligibility } from './exporters/index.mjs';

const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreProduct(p, adapter) {
  const plus = [];
  const minus = [];
  if (p.workflow.status === 'excluded') return { score: 0, plus, minus: ['ausgeschlossen'], hardStop: true };
  if (p.inquiryOnly === 'yes') return { score: 0, plus, minus: ['Anfrageartikel ohne Festpreis'], hardStop: true };
  let s = 0;
  const el = eligibility(adapter, p);
  if (el.eligible) { s += 40; plus.push('sofort exportfähig (Vorschau)'); }
  else {
    const n = dataProblems(p).length + priceProblems(p).length + exportProblems(p).length + (adapter.extraBlockers?.(p).length ?? 0);
    const part = Math.max(0, 40 - 3 * n);
    s += part;
    minus.push(`${n} fehlende/ungültige Angabe(n)`);
  }
  if (p.price.origin === 'database' && p.price.confirmed === 'yes') { s += 15; plus.push('Preis in Datenbank bestätigt'); } else minus.push('Preis nicht bestätigt');
  if (p.sale.minOrderQty === 1) { s += 10; plus.push('Mindestbestellmenge 1'); } else if (p.sale.minOrderQty > 1) minus.push(`Mindestbestellmenge ${p.sale.minOrderQty}`);
  if (p.finishing.required === 'no') { s += 10; plus.push('keine Veredelung nötig'); }
  else if (p.finishing.required === 'yes') { if (p.finishing.configComplete === 'yes') { s += 5; plus.push('Veredelung vollständig konfiguriert'); } else minus.push('Veredelung unvollständig'); }
  if (p.availability.status === 'own_stock' && p.availability.evidence) { s += 10; plus.push('eigener Bestand belegt'); }
  else if (p.availability.status === 'supplier_available' && p.availability.evidence) { s += 5; plus.push('Lieferantenverfügbarkeit belegt'); }
  else minus.push('Verfügbarkeit nicht belegt');
  if (p.imageRights.status === 'confirmed') { s += 10; plus.push('Bildrechte bestätigt'); } else minus.push('Bildrechte offen');
  if (p.gtin) { s += 5; plus.push('GTIN vorhanden'); }
  if (p.flags.alcohol === 'yes') { s -= 25; minus.push('Alkohol (Plattformbeschränkungen ungeprüft)'); }
  if (p.flags.chilled === 'yes') { s -= 15; minus.push('Kühlware (Anforderungen ungeprüft)'); }
  if (p.flags.food === 'yes') { s -= 15; minus.push('Lebensmittel (Auflagen ungeprüft)'); }
  return { score: clamp(s), plus, minus, hardStop: false };
}

/** Liefert je Produkt die Bewertung für alle Plattformen. */
export function rankAll(products) {
  return products.map((p) => ({ p, scores: Object.fromEntries(ADAPTERS.map((a) => [a.id, scoreProduct(p, a)])) }));
}

export function topFor(products, adapterId, n = 10) {
  return rankAll(products)
    .filter((r) => !r.scores[adapterId].hardStop)
    .sort((a, b) => b.scores[adapterId].score - a.scores[adapterId].score || a.p.id.localeCompare(b.p.id))
    .slice(0, n);
}
