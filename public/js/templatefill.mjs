// Befüllen heruntergeladener Plattformvorlagen (CSV) aus der Arbeitsliste.
// Die Vorlage bleibt unverändert (Kopfzeilen, Hinweiszeilen, Spaltenreihenfolge); nur Datenzeilen werden ergänzt.
// Zuordnungen sind Vorschläge, die die Person bestätigt. Es wird NICHT geprüft, ob die Plattform die Datei annimmt.
import { parseCsv, rowsToCsv } from './csv.mjs';
import { canonicalRow, eligibility } from './exporters/common.mjs';
import { gateProblems, provenanceProblems } from './platform.mjs';

export const SOURCES = {
  offer_id: 'Artikel-/Angebots-ID', sku: 'SKU', gtin: 'GTIN', brand: 'Marke', family: 'Produktfamilie', variant: 'Variante',
  title: 'Titel', description: 'Beschreibung', product_link: 'Produktlink', landing_url: 'Landingpage-Link',
  image_main: 'Hauptbild-Link', image_additional: 'weitere Bild-Links', price_net: 'Netto-Verkaufspreis', price_gross: 'Brutto-Verkaufspreis',
  currency: 'Währung', tax_rate_percent: 'Steuersatz %', sale_unit: 'Verkaufseinheit', pack_size: 'Stück je Verkaufseinheit',
  min_order_qty: 'Mindestbestellmenge', finishing_config: 'Veredelungskonfiguration', availability_claim: 'Verfügbarkeitsaussage',
  availability_as_of: 'Verfügbarkeit Stand', shipping_rule: 'Versandregel', delivery_time: 'Lieferzeit', food_flag: 'Lebensmittel (yes/no)', alcohol_flag: 'Alkohol (yes/no)',
};

// Normalisierte Kopfzeilen → Quelle. Mehrdeutiges (z. B. nur „Preis“) wird bewusst NICHT automatisch zugeordnet.
const SYNONYMS = {
  offer_id: ['offerid', 'angebotsid', 'artikelid', 'id', 'itemid'],
  sku: ['sku', 'sellersku', 'sellersku', 'artikelnummer', 'externalproductid'],
  gtin: ['gtin', 'ean', 'upc', 'barcode', 'externalproductidgtin'],
  brand: ['brand', 'marke', 'brandname', 'hersteller'],
  family: ['family', 'produktfamilie', 'itemgroupid', 'groupid', 'parentsku', 'spu'],
  variant: ['variant', 'variante', 'variantenname'],
  title: ['title', 'titel', 'produkttitel', 'itemname', 'productname', 'produktname', 'producttitle'],
  description: ['description', 'beschreibung', 'produktbeschreibung', 'productdescription'],
  product_link: ['link', 'producturl', 'produktlink', 'produktseite'],
  landing_url: ['landingpage', 'landingpageurl', 'landingurl'],
  image_main: ['imagelink', 'mainimageurl', 'hauptbild', 'bildlink', 'mainimage', 'image1'],
  image_additional: ['additionalimagelink', 'weiterebilder', 'otherimageurl'],
  price_net: ['nettopreis', 'preisnetto', 'netprice'],
  price_gross: ['bruttopreis', 'preisbrutto', 'grossprice'],
  currency: ['currency', 'waehrung', 'whrung'],
  tax_rate_percent: ['steuersatz', 'mwst', 'taxrate', 'vat'],
  min_order_qty: ['mindestbestellmenge', 'minorderquantity', 'minimumorderquantity'],
  delivery_time: ['lieferzeit', 'deliverytime', 'handlingtime'],
};

export function normHeader(h) {
  return String(h).toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]/g, '');
}

export function parseTemplate(text, headerRow = 1) {
  const { rows, delimiter } = parseCsv(text);
  if (!rows.length) throw new RangeError('Vorlage ist leer');
  if (!Number.isInteger(headerRow) || headerRow < 1 || headerRow > rows.length) throw new RangeError(`Kopfzeile ${headerRow} existiert nicht (Datei hat ${rows.length} Zeilen)`);
  return { delimiter, preRows: rows.slice(0, headerRow - 1), headers: rows[headerRow - 1], dataRows: rows.slice(headerRow) };
}

/** Vorschlag je Spalte (Index → Quelle oder ''). Nur eindeutige Treffer. */
export function suggestMapping(headers) {
  const map = {};
  const lookup = new Map();
  for (const [key, syns] of Object.entries(SYNONYMS)) for (const s of syns) if (!lookup.has(s)) lookup.set(s, key);
  headers.forEach((h, i) => { map[i] = lookup.get(normHeader(h)) ?? ''; });
  return map;
}

/**
 * mapping[i]: '' (leer lassen) | Quellschlüssel | 'const:Text' (fester, von der Person eingegebener Wert).
 * opts.required: {index: true} – Pflichtspalten laut Plattform-Dokumentation; leere Pflichtwerte sperren das Produkt.
 * opts.provenance / opts.platformSettings: ohne vollständigen Herkunftsnachweis der Vorlage und bestätigte
 * Plattform-Voraussetzungen wird NICHTS erzeugt (blocked). Auch erzeugte Dateien bleiben interne Vorschau.
 */
export function fillTemplate(template, mapping, products, adapter, opts = {}) {
  const gate = [...provenanceProblems(opts.provenance), ...gateProblems(adapter.id, opts.platformSettings)];
  const required = opts.required ?? {};
  const unmapped = template.headers.map((h, i) => [h, i]).filter(([, i]) => !mapping[i]).map(([h]) => h);
  const unmappedRequired = template.headers.map((h, i) => [h, i]).filter(([, i]) => required[i] && !mapping[i]).map(([h]) => h);
  if (unmappedRequired.length) gate.push(`Pflichtspalten ohne Zuordnung: ${unmappedRequired.join(', ')}`);
  if (gate.length) return { blocked: true, gate, rows: [], csv: null, filled: 0, excluded: [], unmapped };

  const out = [...template.preRows, template.headers];
  const excluded = [];
  let filled = 0;
  for (const p of products) {
    const el = eligibility(adapter, p);
    if (!el.eligible) { excluded.push({ id: p.id, reasons: el.reasons }); continue; }
    const src = canonicalRow(p);
    src.asin = p.asin;
    const row = template.headers.map((_, i) => {
      const m = mapping[i] ?? '';
      if (m === '') return '';
      if (m.startsWith('const:')) return m.slice(6);
      return Object.hasOwn(SOURCES, m) ? (src[m] ?? '') : '';
    });
    const empty = template.headers.filter((_, i) => required[i] && String(row[i]).trim() === '');
    if (empty.length) { excluded.push({ id: p.id, reasons: [`Pflichtspalte leer: ${empty.join(', ')}`] }); continue; }
    out.push(row);
    filled++;
  }
  return { blocked: false, gate: [], rows: out, csv: rowsToCsv(out, { delimiter: template.delimiter }), filled, excluded, unmapped };
}
