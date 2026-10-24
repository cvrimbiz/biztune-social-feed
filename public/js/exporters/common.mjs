// Gemeinsame Exportlogik. Exporte arbeiten ausschließlich mit der Produktliste
// (Arbeitsliste) und einer festen Spaltenliste je Adapter – Kalkulationsdaten
// kommen hier nie an, weil sie in einem getrennten Speicher liegen und diese
// Funktionen sie nicht kennen.

import { toCsv } from '../csv.mjs';
import { exportEligibility } from '../rules.mjs';

export const PREVIEW_BANNER = 'INTERNE VORSCHAU – NICHT FÜR PLATTFORM-IMPORT: Zielschema (deutsche Originalvorlage) nicht validiert.';

export function availabilityClaim(p) {
  switch (p.availability?.status) {
    case 'own_stock': return 'eigener Bestand (belegt)';
    case 'supplier_available': return 'Lieferantenverfügbarkeit – kein eigener Bestand';
    default: return '';
  }
}

export function firstImage(p) { return p.imageUrls?.[0] ?? ''; }
export function otherImages(p) { return (p.imageUrls ?? []).slice(1).join(' | '); }

export function buildPreview(adapter, products) {
  const rows = [];
  const excluded = [];
  for (const p of products) {
    const el = exportEligibility(p);
    if (!el.eligible) { excluded.push({ id: p.id, sku: p.sku, title: p.title, reasons: el.reasons }); continue; }
    rows.push({ _interne_vorschau: 'NICHT FÜR IMPORT – Zielschema nicht validiert', ...adapter.mapProduct(p) });
  }
  return {
    previewOnly: true,
    banner: PREVIEW_BANNER,
    adapter: adapter.id,
    adapterName: adapter.name,
    schemaValidated: adapter.schemaValidated,
    synthetic: products.length > 0 && products.every((p) => p.synthetic),
    columns: ['_interne_vorschau', ...adapter.columns],
    rows,
    excluded,
    missingTemplates: adapter.missingTemplates,
    unknownRequiredFields: adapter.unknownRequiredFields,
  };
}

export function previewCsv(preview) { return toCsv(preview.columns, preview.rows); }
export function previewJson(preview) { return JSON.stringify(preview, null, 2) + '\n'; }

export function previewFilename(preview, ext) {
  return `VORSCHAU-INTERN${preview.synthetic ? '-SYNTHETISCH' : ''}_${preview.adapter}.${ext}`;
}
