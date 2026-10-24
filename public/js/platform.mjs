// Plattform-Voraussetzungen (Konto, Berechtigung, Kaufweg) und Herkunftsnachweis der Originalvorlage.
// Nichts davon wird automatisch angenommen: Alles startet als „unbekannt“ und sperrt das Befüllen
// einer Plattformvorlage, bis eine Person es bestätigt hat.

export const CHECKS = {
  tiktok: [
    ['account', 'BizTune-Zulassung für TikTok Shop Deutschland bestätigt'],
    ['category', 'Kategorie-Zulassung und aktuelle Gebühr für die Produkte bestätigt'],
    ['checkout', 'Checkout/Kaufweg geklärt'],
    ['template', 'Originalvorlage vom lokalen Prüfer abgenommen'],
  ],
  meta: [
    ['account', 'DE-Konto, Shop und Berechtigung für Produkt-Tags/Checkout bestätigt'],
    ['channel', 'Kaufweg geklärt (Katalog, Website-Weiterleitung, Anfrage oder In-App-Kauf)'],
    ['template', 'Katalogdaten-Vorlage vom lokalen Prüfer abgenommen'],
  ],
  amazon: [
    ['account', 'Verkäuferkonto und Unternehmensverifikation für amazon.de bestätigt'],
    ['category', 'Kategorie-/Markenzulassung für die Produkte bestätigt'],
    ['fulfilment', 'Versandmodell entschieden (Händlerversand oder FBA)'],
    ['listing', 'Neuanlage oder Angebot zu bestehender ASIN geklärt'],
    ['template', 'Kategorie-/Produkttypvorlage vom lokalen Prüfer abgenommen'],
  ],
};

export function gateProblems(adapterId, settings) {
  const s = settings?.[adapterId] ?? {};
  return (CHECKS[adapterId] ?? []).filter(([k]) => s[k] !== 'yes').map(([, l]) => `Nicht bestätigt: ${l}`);
}

export const PROVENANCE_FIELDS = [
  ['category', 'Kategorie / Produkttyp der Vorlage'],
  ['purpose', 'Zweck (z. B. Neuanlage, Angebot zu bestehender ASIN, Update)'],
  ['downloadedAt', 'Download-/Versionsdatum (JJJJ-MM-TT)'],
  ['origin', 'Herkunft (z. B. Seller Central → Katalog → Datei hochladen)'],
];

export function provenanceProblems(prov) {
  const p = prov ?? {};
  const out = [];
  if (p.marketDE !== true) out.push('Vorlage ist nicht als Vorlage für den deutschen Markt (DE) bestätigt');
  for (const [k, l] of PROVENANCE_FIELDS) if (!p[k] || !String(p[k]).trim()) out.push(`Herkunftsangabe fehlt: ${l}`);
  if (p.downloadedAt && !/^\d{4}-\d{2}-\d{2}$/.test(p.downloadedAt)) out.push('Download-Datum: Format JJJJ-MM-TT erwartet');
  if (!p.sha256) out.push('Prüfsumme (SHA-256) der Originaldatei fehlt');
  return out;
}

export async function sha256Hex(buffer) {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
