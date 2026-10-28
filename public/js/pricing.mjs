// Preisrechnung. Zwei getrennte Wege:
//  1) grossFromNet / checkPrice: bestätigten Netto-Verkaufspreis korrekt in brutto umrechnen.
//  2) suggestPrice: neuen Netto-Verkaufspreis aus vollständigen Kostengrundlagen vorschlagen.
// Alles mit Dec (BigInt), keine Float-Arithmetik. Es werden keine Gebühren, Steuern
// oder Kosten unterstellt: Fehlendes wird als Blocker gemeldet.

import { Dec, ONE, ZERO } from './decimal.mjs';

export const ROUNDING = {
  gross: 'Brutto = Netto × (1 + Steuersatz ÷ 100), kaufmännisch auf ganze Cent gerundet (ab 0,5 Cent wird aufgerundet).',
  suggestion:
    'Gesucht wird der kleinste Netto-Preis in vollen Cent, für den die Bedingung erfüllt ist (nicht ein gerundeter Näherungswert). Die Bedingung wird mit exakter Dezimalrechnung am tatsächlich gerundeten Brutto-Preis (kaufmännisch auf Cent) geprüft und bei Bedarf um einen Cent erhöht. ' +
    'Einzige Zwischenrundung: Divisionen für Einmalkosten-Verteilung und Pauschalgebühren je Bestellung auf 6 Nachkommastellen (kaufmännisch).',
};

export const MARGIN_DEF = 'Marge m = Gewinn ÷ Netto-Erlös nach Gebühren (Gewinn = Netto-Erlös − Gebühren − Kosten C).';
export const MARKUP_DEF = 'Aufschlag u = Gewinn ÷ Kosten C (Gebühren werden vom Erlös abgezogen, nicht auf C aufgeschlagen).';
export const FEE_BASES = {
  gross_item: 'Prozent vom Brutto-Artikelpreis',
  gross_total: 'Prozent vom Brutto-Artikelpreis + Brutto-Versandumsatz',
  net_item: 'Prozent vom Netto-Artikelpreis',
  net_total: 'Prozent vom Netto-Artikelpreis + Netto-Versandumsatz',
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
 * Preisvorschlag nach Übergabedokument (Stand 24.10.2026).
 *  C = n × (Netto-Einstand + Netto-Druck je Stück) + Einmalkosten je Verkaufspaket + Netto-Verpackung + Netto-Handling + Netto-Versandkosten
 *  Netto-Erlös R = (G + S) ÷ (1 + t) mit Brutto-Artikelpreis G und Brutto-Versandumsatz S (einheitliche, bestätigte Steuer t)
 *  Gebühren F(G,S) linear (Prozent je Basis + Festbeträge)
 *  Aufschlag u:  R − F ≥ C × (1 + u)       Marge m:  (R − F) × (1 − m) ≥ C
 * Eingabe: { packSize, taxRate, finishingRequired, shippingTaxSame ('yes'), today,
 *   costs: { source, validUntil, purchaseNetPerPiece, finishingPerPiece, oneOff: {mode:'per_package', amount} |
 *            {mode:'distributed', total, packages, proof}, packagingPerUnit, handlingPerUnit, shippingCostNetPerUnit,
 *            shippingRevenueGross, fees: null | [{name, basis, ratePercent | amount+unitsPerOrder}] },
 *   target: { type: 'margin'|'markup', percent } }
 * Leer/null = unbekannt → Blocker. Ausdrücklich "0" = bekannt und kostenlos.
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
  if (pack && !pack.round(0).eq(pack)) blockers.push('Stück je Verkaufseinheit muss eine ganze Zahl sein');
  const tax = take(input?.taxRate, 'Steuersatz', { max: 100 });
  const purchase = take(costs.purchaseNetPerPiece, 'Netto-Einstand je Stück');
  const packaging = take(costs.packagingPerUnit, 'Netto-Verpackung je Verkaufseinheit');
  const handling = take(costs.handlingPerUnit, 'Netto-Handling je Verkaufseinheit');
  const shipCost = take(costs.shippingCostNetPerUnit, 'Netto-Versandkosten je Verkaufseinheit');
  const S = take(costs.shippingRevenueGross, 'Brutto-Versandumsatz je Verkaufseinheit (0, wenn kein Versand berechnet wird)');
  if (S && !S.isZero() && input?.shippingTaxSame !== 'yes') blockers.push('Steuer auf Versandumsatz nicht als gleich bestätigt – gemischte/abweichende Steuern erfordern eine eigene bestätigte Rechnung');

  // Quelle und Gültigkeit der Kostenregel
  if (!costs.source || !String(costs.source).trim()) blockers.push('Quelle der Kostenregel fehlt');
  if (!costs.validUntil) blockers.push('Gültigkeit der Kostenregel fehlt');
  else if (!/^\d{4}-\d{2}-\d{2}$/.test(costs.validUntil)) blockers.push('Gültigkeit der Kostenregel: Datum JJJJ-MM-TT erwartet');
  else if (input?.today && costs.validUntil < input.today) blockers.push(`Kostenregel ist abgelaufen (gültig bis ${costs.validUntil})`);

  let finishing = ZERO;
  let oneOff = ZERO;
  const fr = input?.finishingRequired;
  if (fr !== 'yes' && fr !== 'no') {
    blockers.push('Veredelungspflicht unbekannt – ohne diese Angabe ist keine Kalkulation möglich');
  } else if (fr === 'yes') {
    const per = take(costs.finishingPerPiece, 'Netto-Druck je Stück (Veredelung ist Pflicht)');
    if (per && pack) finishing = per.mul(pack);
    const o = costs.oneOff;
    if (!o || !o.mode) blockers.push('Einmalkosten je Verkaufspaket fehlen (Veredelung ist Pflicht; „0“ nur, wenn belegt)');
    else if (o.mode === 'per_package') { const a = take(o.amount, 'Einmalkosten je Verkaufspaket'); if (a) oneOff = a; }
    else if (o.mode === 'distributed') {
      const total = take(o.total, 'Einmalkosten gesamt');
      const pk = take(o.packages, 'Verbindlich abgenommene Pakete', { positive: true });
      if (!o.proof || !String(o.proof).trim()) blockers.push('Verteilung der Einmalkosten ohne Beleg der verbindlichen Abnahme nicht zulässig');
      if (total && pk && o.proof) oneOff = total.div(pk, 6, 'half-up');
    } else blockers.push('Unbekannte Art der Einmalkosten');
  }

  // Gebühren als lineare Funktion der Brutto-Artikelpreises G:  F = alpha × G + beta
  let alpha = ZERO; let beta = ZERO;
  const t1 = tax ? ONE.add(tax.pct()) : null;
  const feeLines = [];
  if (costs.fees === null || costs.fees === undefined) {
    blockers.push('Gebühren unbekannt – bitte Gebühren eintragen oder ausdrücklich „keine Gebühren“ bestätigen');
  } else if (!Array.isArray(costs.fees)) {
    blockers.push('Gebührenliste ist ungültig');
  } else {
    costs.fees.forEach((fee, i) => {
      const nm = fee?.name ? String(fee.name) : `Gebühr ${i + 1}`;
      if (!fee?.basis || !(fee.basis in FEE_BASES)) { blockers.push(`${nm}: Berechnungsbasis fehlt`); return; }
      if (fee.basis === 'fixed_per_order') {
        const amt = take(fee.amount, `${nm}: Betrag je Bestellung`);
        const upo = take(fee.unitsPerOrder, `${nm}: Verkaufseinheiten je Bestellung`, { positive: true });
        if (amt && upo) { const per = amt.div(upo, 6, 'half-up'); beta = beta.add(per); feeLines.push({ name: nm, text: `${amt} ÷ ${upo} = ${per} je Verkaufseinheit` }); }
        return;
      }
      const a = take(fee.ratePercent, `${nm}: Satz in %`, { max: 100 });
      if (!a || !S || !t1) return;
      const r = a.pct();
      if (fee.basis === 'gross_item') alpha = alpha.add(r);
      else if (fee.basis === 'gross_total') { alpha = alpha.add(r); beta = beta.add(r.mul(S)); }
      else if (fee.basis === 'net_item') alpha = alpha.add(r.div(t1, 8));
      else { alpha = alpha.add(r.div(t1, 8)); beta = beta.add(r.mul(S).div(t1, 8)); }
      feeLines.push({ name: nm, text: `${a} % – ${FEE_BASES[fee.basis]}` });
    });
  }

  const type = input?.target?.type;
  let tp = null;
  if (type !== 'margin' && type !== 'markup') blockers.push('Zielart fehlt (Marge oder Aufschlag)');
  else tp = take(input?.target?.percent, type === 'margin' ? 'Zielmarge in %' : 'Zielaufschlag in %');
  if (type === 'margin' && tp && tp.gte(100)) { blockers.push('Zielmarge muss unter 100 % liegen'); tp = null; }

  if (blockers.length) return { ok: false, blockers, steps, rounding: ROUNDING.suggestion };

  const purchaseUnit = purchase.mul(pack);
  const C = purchaseUnit.add(finishing).add(oneOff).add(packaging).add(handling).add(shipCost);
  steps.push({ label: 'Einstand je Verkaufseinheit', formula: `${purchase} × ${pack} Stück`, value: purchaseUnit.toString() });
  steps.push(fr === 'yes' ? { label: 'Druck je Verkaufseinheit', formula: `${costs.finishingPerPiece} × ${pack} Stück`, value: finishing.toString() } : { label: 'Veredelung', formula: 'nicht erforderlich', value: '0' });
  if (fr === 'yes') steps.push({ label: 'Einmalkosten je Verkaufspaket', formula: costs.oneOff.mode === 'distributed' ? `${costs.oneOff.total} ÷ ${costs.oneOff.packages} (belegt: ${costs.oneOff.proof})` : 'voll angesetzt', value: oneOff.toString() });
  steps.push({ label: 'Verpackung', formula: '', value: packaging.toString() });
  steps.push({ label: 'Handling', formula: '', value: handling.toString() });
  steps.push({ label: 'Netto-Versandkosten', formula: '', value: shipCost.toString() });
  steps.push({ label: 'Kosten C', formula: 'Summe der obigen Positionen', value: C.toString() });
  if (C.lte(0)) return { ok: false, blockers: ['Kosten C sind 0 – kein belastbarer Preisvorschlag'], steps, rounding: ROUNDING.suggestion };
  feeLines.forEach((f) => steps.push({ label: `Gebühr: ${f.name}`, formula: f.text, value: '' }));
  steps.push({ label: 'Gebührenfunktion', formula: 'F(G) = α × G + β (je Basis umgerechnet, nicht addiert)', value: `α=${alpha}, β=${beta}` });

  const k = t1;
  const feeAt = (G) => alpha.mul(G).add(beta);
  // lhs = (G+S) − k×F   (entspricht k × (R − F))
  const lhsAt = (G) => G.add(S).sub(k.mul(feeAt(G)));
  const okAt = (P) => {
    const G = P.mul(k).round(2, 'half-up');
    const lhs = lhsAt(G);
    return type === 'margin' ? lhs.mul(ONE.sub(tp.pct())).gte(k.mul(C)) : lhs.gte(k.mul(C).mul(ONE.add(tp.pct())));
  };

  // Schätzung (Näherung nur als Startpunkt der exakten Suche)
  const denom = ONE.sub(k.mul(alpha));
  if (denom.lte(0)) return { ok: false, blockers: ['Zielvorgabe ist bei diesen Gebühren rechnerisch nicht erreichbar (Nenner ≤ 0)'], steps, rounding: ROUNDING.suggestion };
  const kNeed = type === 'margin' ? k.mul(C).div(ONE.sub(tp.pct()), 8, 'half-up') : k.mul(C).mul(ONE.add(tp.pct()));
  const gEst = kNeed.add(k.mul(beta)).sub(S).div(denom, 6, 'half-up');
  if (gEst.lte(0)) return { ok: false, blockers: ['Versandumsatz deckt die Anforderung bereits – Artikelpreis rechnerisch ≤ 0, kein belastbarer Vorschlag'], steps, rounding: ROUNDING.suggestion };
  const CENT = new Dec(1n, 2);
  let P = gEst.div(k, 2, 'floor').sub(CENT.mul(3));
  if (P.lt(CENT)) P = CENT;
  for (let i = 0; i < 20 && P.gt(CENT) && okAt(P.sub(CENT)); i++) P = P.sub(CENT);
  let guard = 0;
  while (!okAt(P)) { P = P.add(CENT); if (++guard > 200) return { ok: false, blockers: ['Preissuche ohne Ergebnis – bitte Eingaben prüfen'], steps, rounding: ROUNDING.suggestion }; }
  const minimal = P.lte(CENT) || !okAt(P.sub(CENT));
  if (!okAt(P) || !minimal) return { ok: false, blockers: ['Interne Prüfung der Ungleichung fehlgeschlagen'], steps, rounding: ROUNDING.suggestion };

  const g = grossFromNet(P, tax);
  const G = Dec.parse(g.gross);
  const F = feeAt(G);
  const lhs = lhsAt(G);
  const profitK = lhs.sub(k.mul(C)); // k × Gewinn
  const R = G.add(S).div(k, 4, 'half-up');
  const profit = profitK.div(k, 4, 'half-up');
  const marginPct = profitK.mul(100).div(lhs, 2, 'half-up');
  const markupPct = profitK.mul(100).div(k.mul(C), 2, 'half-up');
  steps.push({ label: 'Netto-Preis (kleinster Cent-Preis, der die Bedingung erfüllt)', formula: type === 'margin' ? '(R − F) × (1 − m) ≥ C' : 'R − F ≥ C × (1 + u)', value: P.toString() });
  g.steps.forEach((s2) => steps.push({ ...s2, label: `Brutto: ${s2.label}` }));
  steps.push({ label: 'Netto-Erlös R', formula: `(${G} + ${S}) ÷ ${k}`, value: R.toString() });
  steps.push({ label: 'Gebühren F in € (am gerundeten Brutto)', formula: `α × ${G} + β`, value: F.toString() });
  steps.push({ label: 'Gewinn', formula: 'R − F − C', value: profit.toString() });
  steps.push({ label: 'Tatsächliche Marge', formula: MARGIN_DEF, value: `${marginPct} %` });
  steps.push({ label: 'Tatsächlicher Aufschlag', formula: MARKUP_DEF, value: `${markupPct} %` });
  steps.push({ label: 'Prüfung', formula: 'Ungleichung erneut exakt geprüft; ein Cent weniger würde sie verletzen', value: 'bestanden' });

  return {
    ok: true,
    blockers: [],
    steps,
    netPrice: P.toString(),
    grossPrice: g.gross,
    netRevenue: R.toString(),
    costBase: C.toString(),
    feeTotal: F.toString(),
    profit: profit.toString(),
    marginPercent: marginPct.toString(),
    markupPercent: markupPct.toString(),
    rounding: ROUNDING.suggestion,
  };
}
