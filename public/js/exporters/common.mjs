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

/**
 * Einheitliche Quellfelder für Adapter und Vorlagenbefüllung (Positivliste –
 * enthält nie Kosten, Margen oder Gebühren).
 */
export function canonicalRow(p) {
  return {
    offer_id: p.id, sku: p.sku, gtin: p.gtin, brand: p.brand, family: p.family, variant: p.variant.label,
    title: p.title, description: p.description, product_link: p.productUrl, landing_url: p.landing.url,
    image_main: firstImage(p), image_additional: otherImages(p),
    price_net: p.price.net, price_gross: p.price.gross, currency: p.price.currency, tax_rate_percent: p.price.taxRate,
    sale_unit: p.sale.unit, pack_size: p.sale.packSize, min_order_qty: p.sale.minOrderQty,
    finishing_config: p.finishing.required === 'yes' ? p.finishing.offeredConfig : '',
    availability_claim: availabilityClaim(p), availability_as_of: p.availability.asOf,
    shipping_rule: p.shipping.rule, delivery_time: p.shipping.deliveryTime,
    food_flag: p.flags.food, alcohol_flag: p.flags.alcohol,
  };
}

/** Gründe, warum ein Produkt für diese Plattform (zusätzlich zu den allgemeinen Sperren) nicht exportiert wird. */
export function eligibility(adapter, p) {
  const el = exportEligibility(p);
  const extra = adapter.extraBlockers ? adapter.extraBlockers(p) : [];
  const reasons = [...el.reasons, ...extra];
  return { eligible: reasons.length === 0, reasons };
}

export function buildPreview(adapter, products) {
  const rows = [];
  const excluded = [];
  for (const p of products) {
    const el = eligibility(adapter, p);
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
