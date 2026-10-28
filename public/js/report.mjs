// Produktbezogener Prüfbericht (Markdown). Enthält keine Kalkulationsdaten.
import { ENUMS, enumLabel } from './schema.mjs';
import { approvalState, dataProblems, priceProblems, exportProblems, effectiveStatus, exportEligibility, warnings, nextStep, GROUPS, GROUP_LABEL } from './rules.mjs';
import { formatMoney } from './decimal.mjs';
import { ADAPTERS } from './exporters/index.mjs';

const STATE_LABEL = { blocked: 'gesperrt (Angaben fehlen)', open: 'bereit zur Freigabe', granted: 'erteilt', stale: 'veraltet (nach Freigabe geändert)' };
const md = (s) => String(s ?? '').replace(/[\\`*_{}[\]<>|#]/g, '\\$&').replace(/\r?\n/g, ' ');

export function buildReport(products, nowIso) {
  const L = [];
  const synthetic = products.length > 0 && products.every((p) => p.synthetic);
  L.push('# Prüfbericht Social-Produktassistent', '');
  L.push(`Erstellt: ${nowIso}  `);
  L.push(`Produkte: ${products.length}`, '');
  if (synthetic) L.push('> **Alle Datensätze sind synthetische Beispiele.** Es wurden keine echten Römer- oder Rominox-Produkte importiert.', '');
  L.push('> Exporte sind interne Vorschauen: Es liegt keine validierte deutsche Originalvorlage von Meta oder TikTok Shop vor.', '');

  const counts = {};
  for (const p of products) counts[effectiveStatus(p)] = (counts[effectiveStatus(p)] ?? 0) + 1;
  L.push('## Übersicht', '', '| Status | Anzahl |', '|---|---|');
  for (const [k, v] of Object.entries(ENUMS.status)) L.push(`| ${v} | ${counts[k] ?? 0} |`);
  L.push('', '| ID | SKU | Status | Daten | Preis | Export | Exportfähig |', '|---|---|---|---|---|---|---|');
  for (const p of products) {
    const st = Object.fromEntries(GROUPS.map((g) => [g, approvalState(p, g).state]));
    L.push(`| ${md(p.id)} | ${md(p.sku) || '–'} | ${enumLabel('status', effectiveStatus(p))} | ${st.data} | ${st.price} | ${st.export} | ${exportEligibility(p).eligible ? 'ja (nur Vorschau)' : 'nein'} |`);
  }

  for (const p of products) {
    L.push('', `## ${md(p.id)} – ${md(p.title) || '(Titel fehlt)'}`, '');
    L.push(`- Status: **${enumLabel('status', effectiveStatus(p))}**${p.workflow.status === 'excluded' ? ` – Ausschlussgrund: ${md(p.workflow.exclusionReason) || 'FEHLT'}` : ''}`);
    L.push(`- Auswahlgruppe: ${enumLabel('brandLine', p.brandLine)}; Familie: ${md(p.family) || 'unbekannt'}; Variante: ${md(p.variant.label) || 'unbekannt'}`);
    L.push(`- Verkaufseinheit: ${md(p.sale.unit) || 'unbekannt'}, Paketinhalt ${p.sale.packSize ?? 'unbekannt'}, Mindestbestellmenge ${p.sale.minOrderQty ?? 'unbekannt'}`);
    L.push(`- Verkaufspreis: netto ${p.price.net ? formatMoney(p.price.net, p.price.currency ?? 'EUR') : 'unbekannt'}, Steuer ${p.price.taxRate ?? 'unbekannt'} %, brutto ${p.price.gross ? formatMoney(p.price.gross, p.price.currency ?? 'EUR') : 'unbekannt'} (${enumLabel('priceOrigin', p.price.origin)})`);
    L.push(`- Verfügbarkeit: ${enumLabel('availStatus', p.availability.status)}${p.availability.asOf ? `, Stand ${p.availability.asOf}` : ''}`);
    L.push(`- Quelle: ${md(p.source.name) || 'unbekannt'}${p.source.updatedAt ? `, ${p.source.updatedAt}` : ''}`);
    L.push('', '**Freigaben**', '');
    for (const g of GROUPS) L.push(`- ${GROUP_LABEL[g]}: ${STATE_LABEL[approvalState(p, g).state]}`);
    const lists = [['Fehlende/ungültige Produktdaten', dataProblems(p)], ['Fehlende/ungültige Preisangaben', priceProblems(p)], ['Fehlende/ungültige Exportangaben', exportProblems(p)]];
    for (const [title, items] of lists) {
      if (items.length) { L.push('', `**${title}**`, ''); items.forEach((i) => L.push(`- ${md(i.label)}${i.kind === 'invalid' ? ' (ungültig)' : ''}`)); }
    }
    const w = warnings(p);
    if (w.length) { L.push('', '**Hinweise**', ''); w.forEach((x) => L.push(`- ${md(x)}`)); }
    L.push('', '**Plattformexport (interne Vorschau)**', '');
    const el = exportEligibility(p);
    for (const a of ADAPTERS) L.push(`- ${a.name}: ${el.eligible ? 'Zeile würde in die Vorschau aufgenommen' : 'gesperrt'}`);
    if (!el.eligible) el.reasons.forEach((r) => L.push(`  - ${md(r)}`));
    L.push('', `**Nächster Schritt:** ${md(nextStep(p))}`);
  }
  L.push('');
  return L.join('\n');
}
