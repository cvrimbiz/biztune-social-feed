// Adaptergerüst Amazon (Seller Central, Händlerkonto vorhanden – es wird KEINE Verbindung aufgebaut).
// KEIN validiertes Zielschema: Amazon arbeitet mit kategorie-/produkttypspezifischen Vorlagen;
// Spaltennamen hier sind interne Namen.
import { availabilityClaim, firstImage, otherImages } from './common.mjs';

export const amazonAdapter = {
  id: 'amazon',
  name: 'Amazon (Marketplace) – Gerüst',
  schemaValidated: false,
  columns: ['seller_sku', 'gtin', 'asin', 'brand', 'family_ref', 'variant', 'title', 'description', 'price_gross', 'currency',
    'tax_rate_percent', 'sale_unit', 'pack_size', 'min_order_qty', 'finishing_config', 'image_main', 'image_additional',
    'availability_claim', 'availability_as_of', 'delivery_time', 'shipping_rule', 'product_link', 'food_flag', 'alcohol_flag'],
  // Zusätzliche Sperren: Amazon-Angebote brauchen i. d. R. Produktidentifikation und Marke – nichts wird erfunden.
  extraBlockers: (p) => {
    const r = [];
    if (!p.gtin) r.push('Amazon: GTIN fehlt (oder belegte GTIN-Befreiung – dafür gibt es noch kein Feld)');
    if (!p.brand) r.push('Amazon: Marke fehlt');
    return r;
  },
  mapProduct: (p) => ({
    seller_sku: p.sku ?? p.id,
    gtin: p.gtin,
    asin: p.asin,
    brand: p.brand,
    family_ref: p.family,
    variant: p.variant.label,
    title: p.title,
    description: p.description,
    price_gross: p.price.gross,
    currency: p.price.currency,
    tax_rate_percent: p.price.taxRate,
    sale_unit: p.sale.unit,
    pack_size: p.sale.packSize,
    min_order_qty: p.sale.minOrderQty,
    finishing_config: p.finishing.required === 'yes' ? p.finishing.offeredConfig : '',
    image_main: firstImage(p),
    image_additional: otherImages(p),
    availability_claim: availabilityClaim(p),
    availability_as_of: p.availability.asOf,
    delivery_time: p.shipping.deliveryTime,
    shipping_rule: p.shipping.rule,
    product_link: p.productUrl,
    food_flag: p.flags.food,
    alcohol_flag: p.flags.alcohol,
  }),
  missingTemplates: [
    'Aktuelle Original-Vorlage(n) für amazon.de aus dem eigenen Seller-Central-Konto (Produkttyp-/Kategorie-Vorlage, Datei-Upload) für jede betroffene Kategorie – bisher liegt keine vor.',
    'Welche Produkte bereits als ASIN im Katalog existieren (dann „Angebot zu bestehender ASIN“ statt neuer Produktseite) – Export der bisherigen Angebote/Inventarbericht aus dem Konto.',
    'Marken- und GTIN-Regeln je Kategorie (inkl. möglicher GTIN-Befreiung, Markenregistrierung/-freigabe) – interne GTINs und Marken bleiben leer, solange sie nicht belegt sind.',
    'Pflichtfelder je Produkttyp (z. B. Produktmerkmale/Aufzählungspunkte, Suchbegriffe, Gewicht/Maße, Herkunftsland, Gefahrgut-/Sicherheitsangaben) und erlaubte Werte.',
    'Variantenstruktur (Eltern-/Kind-Beziehung, Variationsthema je Kategorie).',
    'Versandmodell (Versand durch Händler oder FBA), Versandvorlage, Lagerbestandsangabe – Lieferantenverfügbarkeit ist kein eigener Bestand; Vorgehen klären.',
    'Bildvorgaben (Hintergrund, Größe, Anzahl) und ob Bilder per Link in der Vorlage übergeben werden können.',
    'Beschränkte/zulassungspflichtige Kategorien, Lebensmittel-/Alkoholregeln und ob das Konto dafür freigeschaltet ist.',
    'Preisangabe: brutto/netto, Mindestmenge/Paketverkauf (Verkaufseinheit „Set/Packung“ vs. Stück) und Preisvorgaben.',
  ],
  unknownRequiredFields: ['Produkttyp/Kategorie', 'Marke (belegt)', 'GTIN oder belegte Befreiung', 'Produktmerkmale/Bullet Points', 'Bestandsmenge', 'Versandvorlage', 'Verbindliche Spaltennamen der Vorlage'],
};
