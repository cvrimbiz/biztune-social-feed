// Getrennter, vertraulicher lokaler Kalkulationsbereich. Werte hier gehören NICHT
// zur Arbeitsliste, werden nie exportiert und nie geloggt.
import { h } from './ui.mjs';
import { checkPrice, grossFromNet, suggestPrice, FEE_BASES, ROUNDING, MARGIN_DEF, MARKUP_DEF } from './pricing.mjs';
import { formatMoney, formatPercent } from './decimal.mjs';

const COST_FIELDS = [
  ['purchaseNetPerPiece', 'Netto-Einstand je Stück'],
  ['packagingPerUnit', 'Netto-Verpackung je Verkaufseinheit'],
  ['handlingPerUnit', 'Netto-Handling je Verkaufseinheit'],
  ['shippingCostNetPerUnit', 'Netto-Versandkosten je Verkaufseinheit (eigene Kosten)'],
  ['shippingRevenueGross', 'Brutto-Versandumsatz je Verkaufseinheit (0 = kein Versand berechnet)'],
];

export function renderCalc(ctx) {
  const { state, commit, save } = ctx;
  const p = state.products.find((x) => x.id === state.current);
  const wrap = h('div');
  wrap.append(h('div', { class: 'card' }, h('h2', null, 'Verkaufspreis rechnen'),
    h('p', { class: 'small muted' }, 'Zwei getrennte Wege: (1) bereits bestätigten Netto-Preis aus der Datenbank in brutto umrechnen, (2) optional einen neuen Preis aus Kostengrundlagen vorschlagen.')));
  if (!p) {
    wrap.append(h('div', { class: 'card muted' }, 'Bitte zuerst im Reiter „Produkte“ ein Produkt auswählen.'));
    return wrap;
  }
  wrap.append(h('p', null, h('strong', null, `${p.id} – ${p.title ?? ''}`)));

  // Weg 1
  const c = checkPrice(p.price);
  let g = null;
  try { g = grossFromNet(p.price.net, p.price.taxRate); } catch { /* unvollständig */ }
  wrap.append(h('div', { class: 'card' }, h('h3', null, '1) Bestätigten Preis in brutto umrechnen'),
    g ? stepTable(g.steps) : h('p', { class: 'muted' }, 'Netto-Preis oder Steuersatz fehlen – es wird nichts angenommen.'),
    h('p', { class: 'small' }, `Rundungsregel: ${ROUNDING.gross}`),
    c.problems.length ? h('ul', { class: 'plain small' }, c.problems.map((x) => h('li', { class: 'bad' }, x))) : h('p', { class: 'small' }, 'Netto, Steuer und Brutto sind widerspruchsfrei.'),
    p.price.origin === 'database' ? null : h('p', { class: 'small muted' }, 'Hinweis: Dieser Preis stammt nicht (bestätigt) aus der Preisdatenbank.')));

  // Weg 2
  const costs = (state.costs[p.id] ??= { fees: null, target: { type: null, percent: null } });
  const set = (fn) => { fn(costs); save(); ctx.rerender(); };
  const text = (obj, key, label, ph = '') => h('div', { class: 'field' }, h('label', null, label), h('input', { type: 'text', value: obj[key] ?? '', placeholder: ph, onchange: (e) => set(() => { obj[key] = e.target.value.trim() === '' ? null : e.target.value.trim(); }) }));

  const fees = costs.fees;
  const feeRows = Array.isArray(fees) ? fees.map((fee, i) => h('fieldset', null, h('legend', null, `Gebühr ${i + 1}`),
    h('div', { class: 'fields' },
      text(fee, 'name', 'Bezeichnung'),
      h('div', { class: 'field' }, h('label', null, 'Berechnungsbasis'), h('select', { value: fee.basis ?? '', onchange: (e) => set(() => { fee.basis = e.target.value || null; }) }, h('option', { value: '' }, 'bitte wählen'), Object.entries(FEE_BASES).map(([k, v]) => h('option', { value: k }, v)))),
      fee.basis === 'fixed_per_order' ? [text(fee, 'amount', 'Betrag je Bestellung'), text(fee, 'unitsPerOrder', 'Verkaufseinheiten je Bestellung')] : text(fee, 'ratePercent', 'Satz in %')),
    h('button', { class: 'btn', onclick: () => set(() => fees.splice(i, 1)) }, 'Gebühr entfernen'))) : [];

  const calcOut = h('div');
  const result = suggestPrice({ packSize: p.sale.packSize, taxRate: p.price.taxRate, finishingRequired: p.finishing.required, shippingTaxSame: costs.shippingTaxSame, today: ctx.now().slice(0, 10), costs, target: costs.target });
  if (!result.ok) {
    calcOut.append(h('p', null, h('strong', null, 'Kein belastbarer Preisvorschlag möglich:')), h('ul', { class: 'plain' }, result.blockers.map((b) => h('li', { class: 'bad' }, b))));
  } else {
    calcOut.append(
      h('div', { class: 'row' }, h('div', null, h('div', { class: 'muted small' }, 'Netto-Vorschlag'), h('div', { class: 'big' }, formatMoney(result.netPrice, p.price.currency ?? 'EUR'))),
        h('div', null, h('div', { class: 'muted small' }, 'Brutto'), h('div', { class: 'big' }, formatMoney(result.grossPrice, p.price.currency ?? 'EUR'))),
        h('div', null, h('div', { class: 'muted small' }, 'Marge (tatsächlich)'), h('div', { class: 'big' }, formatPercent(result.marginPercent))),
        h('div', null, h('div', { class: 'muted small' }, 'Aufschlag (tatsächlich)'), h('div', { class: 'big' }, formatPercent(result.markupPercent)))),
      h('p', { class: 'small' }, MARGIN_DEF, h('br'), MARKUP_DEF),
      stepTable(result.steps),
      h('p', { class: 'small' }, `Rundungsregel: ${result.rounding}`),
      h('button', { class: 'btn primary', onclick: () => {
        if (p.price.net && !window.confirm('Vorhandenen Preis durch den Vorschlag ersetzen? Der Preis gilt danach als lokaler Vorschlag und muss neu freigegeben werden.')) return;
        commit(p.id, (q) => { q.price.net = result.netPrice; q.price.gross = result.grossPrice; q.price.origin = 'proposal'; q.price.confirmed = 'no'; q.price.currency ??= 'EUR'; });
        ctx.rerender();
      } }, 'Als Preisentwurf übernehmen (unbestätigt)'));
  }

  wrap.append(h('div', { class: 'card secret' },
    h('h3', null, '2) Neuen Preis vorschlagen – VERTRAULICH'),
    h('p', { class: 'small' }, 'Nur lokal gespeichert, getrennt von der Arbeitsliste; wird nie in Feeds, Berichte, Exporte oder Logs übernommen. Derzeit nur Testwerte verwenden.'),
    h('p', { class: 'small muted' }, `Bezug: Paketinhalt ${p.sale.packSize ?? 'unbekannt'} Stück je Verkaufseinheit · Steuersatz ${p.price.taxRate ?? 'unbekannt'} % · Veredelung Pflicht: ${p.finishing.required ? (p.finishing.required === 'yes' ? 'ja' : 'nein') : 'unbekannt'}. Leer = unbekannt (blockiert), „0“ = bekannt und kostenlos.`),
    h('div', { class: 'fields' }, text(costs, 'source', 'Quelle der Kostenregel'), text(costs, 'validUntil', 'Gültig bis (JJJJ-MM-TT)')),
    h('div', { class: 'fields' }, COST_FIELDS.map(([k, l]) => text(costs, k, l))),
    h('div', { class: 'field' }, h('label', null, 'Steuer auf Versandumsatz gleich wie auf den Artikel (bestätigt)?'),
      h('select', { 'aria-label': 'Versandsteuer', value: costs.shippingTaxSame ?? '', onchange: (e) => set(() => { costs.shippingTaxSame = e.target.value || null; }) }, h('option', { value: '' }, 'unbekannt'), h('option', { value: 'yes' }, 'ja, bestätigt'), h('option', { value: 'no' }, 'nein (abweichend) – nicht rechenbar'))),
    p.finishing.required === 'yes' ? oneOffEditor(costs, text, set) : null,
    h('h3', null, 'Gebühren'),
    fees === null ? h('p', { class: 'small warn' }, 'Noch unbekannt – Gebühren eintragen oder bewusst „keine Gebühren“ bestätigen.') : null,
    feeRows,
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => set(() => { costs.fees = [...(costs.fees ?? []), { name: '', basis: null }]; }) }, '+ Gebühr hinzufügen'),
      h('button', { class: 'btn', onclick: () => set(() => { costs.fees = []; }) }, 'Keine Gebühren (bestätigt)')),
    h('h3', null, 'Ziel'),
    h('div', { class: 'row' },
      h('select', { 'aria-label': 'Zielart', value: costs.target?.type ?? '', onchange: (e) => set(() => { costs.target = { ...(costs.target ?? {}), type: e.target.value || null }; }) },
        h('option', { value: '' }, 'Zielart wählen'), h('option', { value: 'margin' }, 'Marge (Anteil am Verkaufspreis)'), h('option', { value: 'markup' }, 'Aufschlag (Anteil auf die Kosten)')),
      h('input', { type: 'text', 'aria-label': 'Zielwert in Prozent', placeholder: 'Zielwert in %', value: costs.target?.percent ?? '', onchange: (e) => set(() => { costs.target = { ...(costs.target ?? {}), percent: e.target.value.trim() || null }; }) })),
    h('h3', null, 'Ergebnis'), calcOut));
  return wrap;
}

function oneOffEditor(costs, text, set) {
  const o = (costs.oneOff ??= { mode: null });
  return h('fieldset', null, h('legend', null, 'Veredelung (Pflicht)'),
    h('div', { class: 'fields' }, text(costs, 'finishingPerPiece', 'Netto-Druck je Stück'),
      h('div', { class: 'field' }, h('label', null, 'Einmalkosten'), h('select', { 'aria-label': 'Einmalkosten-Art', value: o.mode ?? '', onchange: (e) => set(() => { costs.oneOff = { mode: e.target.value || null }; }) },
        h('option', { value: '' }, 'unbekannt'), h('option', { value: 'per_package' }, 'je Verkaufspaket (voll angesetzt)'), h('option', { value: 'distributed' }, 'auf Pakete verteilt (nur mit Beleg)'))),
      o.mode === 'per_package' ? text(o, 'amount', 'Einmalkosten je Verkaufspaket') : null,
      o.mode === 'distributed' ? [text(o, 'total', 'Einmalkosten gesamt'), text(o, 'packages', 'Verbindlich abgenommene Pakete'), text(o, 'proof', 'Beleg der verbindlichen Abnahme')] : null));
}

function stepTable(steps) {
  return h('div', { class: 'tablewrap' }, h('table', null,
    h('thead', null, h('tr', null, ['Schritt', 'Rechenweg', 'Wert'].map((t) => h('th', null, t)))),
    h('tbody', null, steps.map((s) => h('tr', null, h('td', null, s.label), h('td', { class: 'small muted' }, s.formula), h('td', null, s.value))))));
}
