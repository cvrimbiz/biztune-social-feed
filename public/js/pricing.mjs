// Preisrechnung. Zwei getrennte Wege:
//  1) grossFromNet / checkPrice: bestätigten Netto-Verkaufspreis korrekt in brutto umrechnen.
//  2) suggestPrice: neuen Netto-Verkaufspreis aus vollständigen Kostengrundlagen vorschlagen.
// Alles mit Dec (BigInt), keine Float-Arithmetik. Es werden keine Gebühren, Steuern
// oder Kosten unterstellt: Fehlendes wird als Blocker gemeldet.

import { Dec, ONE, ZERO } from './decimal.mjs';

export const ROUNDING = {
  gross: 'Brutto = Netto × (1 + Steuersatz ÷ 100), kaufmännisch auf ganze Cent gerundet (ab 0,5 Cent wird aufgerundet).',
  suggestion:
    'Der Netto-Vorschlag wird exakt gerechnet und dann auf den nächsten vollen Cent AUFGERUNDET, damit die Zielvorgabe nie unterschritten wird. ' +
    'Einzige Zwischenrundung: Divisionen für anteilige Einrichtung und Pauschalgebühren je Bestellung auf 6 Nachkommastellen (kaufmännisch). ' +
    'Der Brutto-Preis wird danach wie bei bestätigten Preisen gerundet.',
};

export const MARGIN_DEF = 'Marge = Gewinn ÷ Netto-Verkaufspreis (Anteil am Verkaufspreis).';
export const MARKUP_DEF = 'Aufschlag = Gewinn ÷ Gesamtkosten inkl. Gebühren (Anteil auf die Kosten).';
export const FEE_BASES = {
  net_price: 'Prozent vom Netto-Verkaufspreis',
  gross_price: 'Prozent vom Brutto-Verkaufspreis (inkl. Steuer)',
  fixed_per_order: 'Festbetrag je Bestellung (verteilt auf Verkaufseinheiten je Bestellung)',
};

function parseNonNeg(value, label, { max, positive } = {}) {
  if (value === null || value === undefined || value === '') return { error: `${label} fehlt` };
  const d = Dec.tryParse(value);
  if (!d) return { error: `${label} ist keine gültige Dezimalzahl ("${value}")` };
  if (d.isNeg()) return { error: `${label} darf nicht negativ sein` };
  if (positive && d.isZero()) return { error: `${label} muss größer als 0 sein` };
  if (max !== undefined && d.gt(max)) return { error: `${label} darf höchstens ${max} sein` };
  return { dec: d };
}

/** Bestätigter Nettopreis → Bruttopreis. Wirft bei ungültigen Eingaben. */
export function grossFromNet(net, taxRate) {
  const n = parseNonNeg(net, 'Nettopreis');
  if (n.error) throw new RangeError(n.error);
  const r = parseNonNeg(taxRate, 'Steuersatz', { max: 100 });
  if (r.error) throw new RangeError(r.error);
  const factor = ONE.add(r.dec.pct());
  const exact = n.dec.mul(factor);
  const gross = exact.round(2, 'half-up');
  return {
    net: n.dec.toString(),
    taxRate: r.dec.toString(),
    factor: factor.toString(),
    exact: exact.toString(),
    gross: gross.toString(),
    steps: [
      { label: 'Netto-Verkaufspreis', formula: '', value: n.dec.toString() },
      { label: 'Steuerfaktor', formula: `1 + ${r.dec.toString()} ÷ 100`, value: factor.toString() },
      { label: 'Brutto exakt', formula: `${n.dec.toString()} × ${factor.toString()}`, value: exact.toString() },
      { label: 'Brutto gerundet (Cent)', formula: 'kaufmännisch runden', value: gross.toString() },
    ],
    rounding: ROUNDING.gross,
  };
}

/**
 * Prüft die Preisangaben eines Produkts (price.net/taxRate/gross) auf Vollständigkeit
 * und Widerspruchsfreiheit. Liefert nie geratene Werte; `computedGross` ist nur ein Hinweis.
 */
export function checkPrice(price) {
  const problems = [];
  const net = Dec.tryParse(price?.net ?? null);
  const rate = Dec.tryParse(price?.taxRate ?? null);
  const gross = Dec.tryParse(price?.gross ?? null);
  if (!net) problems.push('Nettoverkaufspreis fehlt');
  else if (net.isNeg() || net.isZero()) problems.push('Nettoverkaufspreis muss größer als 0 sein');
  if (!rate) problems.push('Steuersatz fehlt');
  else if (rate.isNeg() || rate.gt(100)) problems.push('Steuersatz außerhalb 0–100 %');
  if (!gross) problems.push('Bruttoverkaufspreis fehlt');
  if (!price?.currency) problems.push('Währung fehlt');
  let computedGross = null;
  if (net && rate && !net.isNeg() && !rate.isNeg() && !rate.gt(100)) {
    computedGross = grossFromNet(net, rate).gross;
    if (gross && !gross.eq(computedGross)) {
      problems.push(`Brutto (${gross.toString()}) passt nicht zu Netto × Steuersatz (erwartet ${computedGross})`);
    }
  }
  return { ok: problems.length === 0, problems, computedGross };
}

/**
 * Preisvorschlag. Eingabe:
 *  packSize (Stück je Verkaufseinheit), taxRate (%), finishingRequired ('yes'|'no'|null),
 *  costs { purchaseNetPerPiece, finishingPerPiece, setupTotal, setupAllocationUnits,
 *          packagingPerUnit, handlingPerUnit, shippingSubsidyPerUnit,
 *          fees: null | [{name, basis, ratePercent | amount+unitsPerOrder}] },
 *  target { type: 'margin'|'markup', percent }.
 * null/leer = unbekannt → Blocker. Ausdrücklich "0" bedeutet "bekannt, kostet nichts".
 */
export function suggestPrice(input) {
  const blockers = [];
  const steps = [];
  const costs = input?.costs ?? {};
  const take = (value, label, opts) => {
    const r = parseNonNeg(value, label, opts);
    if (r.error) { blockers.push(r.error); return null; }
    return r.dec;
  };

  const pack = take(input?.packSize, 'Stück je Verkaufseinheit', { positive: true });
  if (pack && !pack.round(0).eq(pack)) { blockers.push('Stück je Verkaufseinheit muss eine ganze Zahl sein'); }
  const tax = take(input?.taxRate, 'Steuersatz', { max: 100 });
  const purchase = take(costs.purchaseNetPerPiece, 'Einkauf netto je Stück');
  const packaging = take(costs.packagingPerUnit, 'Verpackung je Verkaufseinheit');
  const handling = take(costs.handlingPerUnit, 'Handling je Verkaufseinheit');
  const subsidy = take(costs.shippingSubsidyPerUnit, 'Versandzuschuss je Verkaufseinheit');

  let finishing = ZERO;
  let setup = ZERO;
  const fr = input?.finishingRequired;
  if (fr !== 'yes' && fr !== 'no') {
    blockers.push('Veredelungspflicht unbekannt – ohne diese Angabe ist keine Kalkulation möglich');
  } else if (fr === 'yes') {
    const per = take(costs.finishingPerPiece, 'Veredelung je Stück (Veredelung ist Pflicht)');
    const total = take(costs.setupTotal, 'Einrichtungskosten gesamt (Veredelung ist Pflicht)');
    const units = take(costs.setupAllocationUnits, 'Verkaufseinheiten, auf die die Einrichtung verteilt wird', { positive: true });
    if (per && pack) finishing = per.mul(pack);
    if (total && units) setup = total.div(units, 6, 'half-up');
  }

  // Gebühren
  let fn = ZERO; // Anteil vom Netto-VK
  let fg = ZERO; // Anteil vom Brutto-VK
  let fixed = ZERO; // je Verkaufseinheit
  const feeLines = [];
  if (costs.fees === null || costs.fees === undefined) {
    blockers.push('Gebühren unbekannt – bitte Gebühren eintragen oder ausdrücklich "keine Gebühren" bestätigen');
  } else if (!Array.isArray(costs.fees)) {
    blockers.push('Gebührenliste ist ungültig');
  } else {
    costs.fees.forEach((fee, i) => {
      const nm = fee?.name ? String(fee.name) : `Gebühr ${i + 1}`;
      if (!fee?.basis || !(fee.basis in FEE_BASES)) { blockers.push(`${nm}: Berechnungsbasis fehlt`); return; }
      if (fee.basis === 'fixed_per_order') {
        const amt = take(fee.amount, `${nm}: Betrag je Bestellung`);
        const upo = take(fee.unitsPerOrder, `${nm}: Verkaufseinheiten je Bestellung`, { positive: true });
        if (amt && upo) {
          const per = amt.div(upo, 6, 'half-up');
          fixed = fixed.add(per);
          feeLines.push({ name: nm, basis: fee.basis, text: `${amt.toString()} ÷ ${upo.toString()} = ${per.toString()} je Verkaufseinheit` });
        }
      } else {
        const rate = take(fee.ratePercent, `${nm}: Satz in %`, { max: 100 });
        if (rate) {
          if (fee.basis === 'net_price') fn = fn.add(rate.pct());
          else fg = fg.add(rate.pct());
          feeLines.push({ name: nm, basis: fee.basis, text: `${rate.toString()} % ${fee.basis === 'net_price' ? 'vom Netto' : 'vom Brutto'}` });
        }
      }
    });
  }

  // Ziel
  const type = input?.target?.type;
  let tp = null;
  if (type !== 'margin' && type !== 'markup') blockers.push('Zielart fehlt (Marge oder Aufschlag)');
  else tp = take(input?.target?.percent, type === 'margin' ? 'Zielmarge in %' : 'Zielaufschlag in %');
  if (type === 'margin' && tp && tp.gte(100)) { blockers.push('Zielmarge muss unter 100 % liegen'); tp = null; }

  if (blockers.length) return { ok: false, blockers, steps, rounding: ROUNDING.suggestion };

  // Kosten je Verkaufseinheit (netto)
  const purchaseUnit = purchase.mul(pack);
  const C = purchaseUnit.add(finishing).add(setup).add(packaging).add(handling).add(subsidy);
  steps.push({ label: 'Einkauf je Verkaufseinheit', formula: `${purchase} × ${pack} Stück`, value: purchaseUnit.toString() });
  if (fr === 'yes') {
    steps.push({ label: 'Veredelung je Verkaufseinheit', formula: `${costs.finishingPerPiece} × ${pack} Stück`, value: finishing.toString() });
    steps.push({ label: 'Anteilige Einrichtung', formula: `${costs.setupTotal} ÷ ${costs.setupAllocationUnits} (6 Stellen)`, value: setup.toString() });
  } else {
    steps.push({ label: 'Veredelung', formula: 'nicht erforderlich', value: '0' });
  }
  steps.push({ label: 'Verpackung', formula: '', value: packaging.toString() });
  steps.push({ label: 'Handling', formula: '', value: handling.toString() });
  steps.push({ label: 'Versandzuschuss', formula: '', value: subsidy.toString() });
  steps.push({ label: 'Kosten ohne Gebühren (C)', formula: 'Summe der obigen Positionen', value: C.toString() });
  feeLines.forEach((f) => steps.push({ label: `Gebühr: ${f.name}`, formula: `${FEE_BASES[f.basis]}: ${f.text}`, value: '' }));

  const t = tax;
  const phi = fn.add(fg.mul(ONE.add(t.pct()))); // Gebührenanteil bezogen auf Netto-VK
  const base = C.add(fixed);
  steps.push({ label: 'Gebührenanteil φ (vom Netto-VK)', formula: `Netto-% + Brutto-% × (1 + ${t}/100)`, value: phi.toString() });
  steps.push({ label: 'Feste Gebühren je Verkaufseinheit (F)', formula: '', value: fixed.toString() });

  let numerator;
  let denominator;
  if (type === 'margin') {
    const m = tp.pct();
    numerator = base;
    denominator = ONE.sub(phi).sub(m);
    steps.push({ label: 'Formel Marge', formula: 'P = (C + F) ÷ (1 − φ − Marge)', value: `${numerator} ÷ ${denominator}` });
  } else {
    const k = tp.pct();
    const onePlusK = ONE.add(k);
    numerator = onePlusK.mul(base);
    denominator = ONE.sub(onePlusK.mul(phi));
    steps.push({ label: 'Formel Aufschlag', formula: 'P = (1 + Aufschlag) × (C + F) ÷ (1 − (1 + Aufschlag) × φ)', value: `${numerator} ÷ ${denominator}` });
  }
  if (denominator.lte(0)) {
    return { ok: false, blockers: ['Zielvorgabe ist bei diesen Gebühren rechnerisch nicht erreichbar (Nenner ≤ 0)'], steps, rounding: ROUNDING.suggestion };
  }
  if (numerator.lte(0)) {
    return { ok: false, blockers: ['Gesamtkosten sind 0 – kein belastbarer Preisvorschlag'], steps, rounding: ROUNDING.suggestion };
  }

  const net = numerator.div(denominator, 2, 'ceil');
  steps.push({ label: 'Netto-Vorschlag (aufgerundet auf Cent)', formula: 'aufrunden', value: net.toString() });

  const feeTotal = net.mul(phi).add(fixed);
  const profit = net.sub(C).sub(feeTotal);
  const totalCost = C.add(feeTotal);
  const marginPct = profit.mul(100).div(net, 2, 'half-up');
  const markupPct = profit.mul(100).div(totalCost, 2, 'half-up');
  const g = grossFromNet(net, t);
  steps.push({ label: 'Gebühren in € bei diesem Preis', formula: `${net} × φ + F`, value: feeTotal.toString() });
  steps.push({ label: 'Gewinn', formula: 'Netto − C − Gebühren', value: profit.toString() });
  steps.push({ label: 'Tatsächliche Marge', formula: `${MARGIN_DEF}`, value: `${marginPct.toString()} %` });
  steps.push({ label: 'Tatsächlicher Aufschlag', formula: `${MARKUP_DEF}`, value: `${markupPct.toString()} %` });
  g.steps.forEach((s) => steps.push({ ...s, label: `Brutto: ${s.label}` }));

  return {
    ok: true,
    blockers: [],
    steps,
    netPrice: net.toString(),
    grossPrice: g.gross,
    costBase: C.toString(),
    feeTotal: feeTotal.toString(),
    profit: profit.toString(),
    marginPercent: marginPct.toString(),
    markupPercent: markupPct.toString(),
    rounding: ROUNDING.suggestion,
  };
}
