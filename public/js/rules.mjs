// Prüfregeln: fehlende Angaben, getrennte Freigaben, Exportsperren, nächste Schritte.
// Reine Funktionen ohne Seiteneffekte; Freigaben liefern neue Objekte zurück.

import { Dec } from './decimal.mjs';
import { checkPrice } from './pricing.mjs';
import { getPath, ENUMS } from './schema.mjs';

const has = (v) => v !== null && v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);

// Gültigkeit von Quelldaten: ältere Angaben gelten als veraltet und sperren. `today` ist für Tests überschreibbar.
export const config = { maxAgeDays: 30, today: () => new Date().toISOString().slice(0, 10) };

export function isStale(dateStr) {
  if (!dateStr) return false;
  const days = (Date.parse(config.today()) - Date.parse(dateStr)) / 86400000;
  return days > config.maxAgeDays;
}

export const GROUPS = ['data', 'price', 'export'];
export const GROUP_LABEL = { data: 'Produktdaten', price: 'Verkaufspreis', export: 'Plattformexport' };

export function dataProblems(p) {
  const out = [];
  const miss = (key, label, hint) => out.push({ key, label, hint, kind: 'missing' });
  const bad = (key, label, hint) => out.push({ key, label, hint, kind: 'invalid' });
  if (!has(p.id)) miss('id', 'Artikel-/Angebots-ID');
  if (!has(p.sku)) miss('sku', 'SKU');
  if (!has(p.family)) miss('family', 'Produktfamilie');
  if (!has(p.variant?.label)) miss('variant.label', 'Konkrete Variante');
  if (!has(p.title)) miss('title', 'Titel');
  if (!has(p.description)) miss('description', 'Beschreibung');
  if (!has(p.productUrl)) miss('productUrl', 'Produktlink');
  if (!has(p.imageUrls)) miss('imageUrls', 'Bildlink');
  const rs = p.imageRights?.status;
  if (rs === 'denied') bad('imageRights.status', 'Bildnutzung ist nicht erlaubt');
  else if (!rs) miss('imageRights.status', 'Bildrechte nicht bestätigt');
  else if (!has(p.imageRights?.evidence)) miss('imageRights.evidence', 'Nachweis der Bildrechte');
  if (!has(p.sale?.unit)) miss('sale.unit', 'Verkaufseinheit');
  if (!has(p.sale?.packSize)) miss('sale.packSize', 'Paketinhalt');
  if (!has(p.sale?.minOrderQty)) miss('sale.minOrderQty', 'Mindestbestellmenge');
  if (!has(p.sale?.components)) miss('sale.components', 'Feste Stückliste / Inhalt des Sets');
  const fr = p.finishing?.required;
  if (!fr) miss('finishing.required', 'Veredelungspflicht');
  else if (fr === 'yes') {
    if (!has(p.finishing?.offeredConfig)) miss('finishing.offeredConfig', 'Konkret angebotene Veredelungskonfiguration');
    if (p.finishing?.configComplete !== 'yes') bad('finishing.configComplete', 'Veredelungskonfiguration unvollständig', 'Pflichtveredelung muss vollständig festgelegt sein');
    for (const [k, l] of [['printPosition', 'Druckposition'], ['printColors', 'Druckfarben'], ['printArea', 'Druckfläche'], ['artworkProcess', 'Druckdaten-/Korrekturprozess']]) {
      if (!has(p.finishing?.[k])) miss(`finishing.${k}`, l);
    }
    if (!p.finishing?.oneOffIncluded) miss('finishing.oneOffIncluded', 'Angabe, ob Einmalkosten im Preis enthalten sind');
  }
  if (!has(p.source?.name)) miss('source.name', 'Quelle');
  if (!has(p.source?.updatedAt)) miss('source.updatedAt', 'Aktualisierungsdatum der Quelle');
  else if (isStale(p.source.updatedAt)) bad('source.updatedAt', `Quelldaten veraltet (älter als ${config.maxAgeDays} Tage)`);
  if (!p.flags?.food) miss('flags.food', 'Kennzeichnung Lebensmittel (ja/nein)');
  if (!p.flags?.alcohol) miss('flags.alcohol', 'Kennzeichnung Alkohol (ja/nein)');
  if (!p.flags?.chilled) miss('flags.chilled', 'Kennzeichnung Kühlpflicht (ja/nein)');
  if (!p.compliance?.status) miss('compliance.status', 'Prüfstatus Produkt-/Sicherheitsangaben');
  else if ((p.flags?.food === 'yes' || p.flags?.alcohol === 'yes' || p.flags?.chilled === 'yes') && p.compliance.status !== 'checked') {
    bad('compliance.status', 'Lebensmittel/Alkohol/Kühlware: Anforderungen müssen als „geprüft“ bestätigt sein (bis dahin gesperrt)');
  }
  if (p.flags?.food === 'yes') {
    for (const [k, l] of [['ingredients', 'Zutaten'], ['allergens', 'Allergene'], ['netContent', 'Füllmenge'], ['nutrition', 'Nährwerte oder belegte Ausnahme'],
      ['responsibleOperator', 'Verantwortlicher Lebensmittelunternehmer'], ['shelfLife', 'Haltbarkeit/Charge'], ['storage', 'Lager-/Verwendungshinweise']]) {
      if (!has(p.food?.[k])) miss(`food.${k}`, `Lebensmittel: ${l}`);
    }
  }
  return out;
}

export function priceProblems(p) {
  const out = [];
  const miss = (key, label) => out.push({ key, label, kind: 'missing' });
  const bad = (key, label) => out.push({ key, label, kind: 'invalid' });
  const c = checkPrice(p.price);
  for (const msg of c.problems) {
    const key = /Netto/.test(msg) && !/Brutto/.test(msg) ? 'price.net' : /Steuer/.test(msg) ? 'price.taxRate' : /Währung/.test(msg) ? 'price.currency' : 'price.gross';
    (/fehlt$/.test(msg) ? miss : bad)(key, msg);
  }
  if (!p.price?.origin) miss('price.origin', 'Herkunft des Preises (Datenbank oder lokaler Vorschlag)');
  else if (p.price.origin === 'database' && p.price.confirmed !== 'yes') bad('price.confirmed', 'Preis ist in der Datenbank nicht als bestätigt markiert');
  if (!has(p.sale?.packSize)) miss('sale.packSize', 'Paketinhalt (Preisbezug)');
  if (!has(p.sale?.minOrderQty)) miss('sale.minOrderQty', 'Mindestbestellmenge (Preisbezug)');
  return out;
}

function sameDec(a, b) {
  const x = Dec.tryParse(a ?? null), y = Dec.tryParse(b ?? null);
  return !!x && !!y && x.eq(y);
}

/** Probleme, die nur den Plattformexport betreffen (ohne Freigabestände). */
export function exportProblems(p) {
  const out = [];
  const miss = (key, label) => out.push({ key, label, kind: 'missing' });
  const bad = (key, label) => out.push({ key, label, kind: 'invalid' });
  if (p.workflow?.status === 'excluded') bad('workflow.status', 'Produkt ist ausgeschlossen');
  if (p.inquiryOnly === 'yes') bad('inquiryOnly', 'Anfrageartikel – ohne Festpreis nicht exportierbar');
  else if (!p.inquiryOnly) miss('inquiryOnly', 'Angabe, ob Anfrageartikel (ja/nein)');
  if (!has(p.shipping?.rule)) miss('shipping.rule', 'Versandregel');
  if (!has(p.shipping?.deliveryTime)) miss('shipping.deliveryTime', 'Lieferzeit');
  const as = p.availability?.status;
  if (!as) miss('availability.status', 'Verfügbarkeit');
  else if (as === 'out_of_stock') bad('availability.status', 'Produkt ist nicht verfügbar');
  else if (as === 'on_request') bad('availability.status', 'Verfügbarkeit nur auf Anfrage – nicht kaufbar');
  if (as && !has(p.availability?.evidence)) miss('availability.evidence', 'Beleg der Verfügbarkeit');
  if (as && !has(p.availability?.asOf)) miss('availability.asOf', 'Stand der Verfügbarkeit');
  else if (as && isStale(p.availability.asOf)) bad('availability.asOf', `Verfügbarkeitsstand veraltet (älter als ${config.maxAgeDays} Tage)`);
  if (as === 'own_stock') {
    if (!has(p.availability?.reservedQty)) miss('availability.reservedQty', 'Reservierter eigener Bestand (Stückzahl)');
    if (!has(p.availability?.location)) miss('availability.location', 'Lagerort des Bestands');
    if (!has(p.availability?.sla)) miss('availability.sla', 'Zusage/SLA zur Bestandsreservierung');
  }
  if (p.availability?.capacityConfirmed !== 'yes') miss('availability.capacityConfirmed', 'Bestätigte Lieferfähigkeit (auch saisonal/Produktionskapazität)');
  if (!has(p.logistics?.weightGrams)) miss('logistics.weightGrams', 'Versandgewicht');
  if (!has(p.logistics?.dimensionsMm)) miss('logistics.dimensionsMm', 'Maße');
  if (has(p.asin) && !has(p.asinProof)) bad('asin', 'ASIN ohne Nachweis der Produktidentität');
  const l = p.landing ?? {};
  if (!has(l.url)) miss('landing.url', 'Landingpage-Link');
  if (!has(l.checkedAt)) miss('landing.checkedAt', 'Datum der Landingpage-Prüfung');
  else if (isStale(l.checkedAt)) bad('landing.checkedAt', `Landingpage-Prüfung veraltet (älter als ${config.maxAgeDays} Tage)`);
  if (has(l.url) && has(l.checkedAt)) {
    if (!has(l.variant)) miss('landing.variant', 'Dort kaufbare Variante');
    else if (has(p.variant?.label) && l.variant.trim().toLowerCase() !== p.variant.label.trim().toLowerCase()) {
      bad('landing.variant', `Landingpage bietet Variante „${l.variant}“, Angebot ist „${p.variant.label}“`);
    }
    if (!has(l.qty)) miss('landing.qty', 'Dort bestellbare Mindestmenge');
    else if (has(p.sale?.minOrderQty) && l.qty !== p.sale.minOrderQty) {
      bad('landing.qty', `Landingpage erlaubt Menge ${l.qty}, Angebot verlangt Mindestmenge ${p.sale.minOrderQty}`);
    }
    if (!has(l.price)) miss('landing.price', 'Dort angezeigter Bruttopreis');
    else if (has(p.price?.gross) && !sameDec(l.price, p.price.gross)) {
      bad('landing.price', `Landingpage zeigt ${l.price}, Angebot nennt ${p.price.gross}`);
    }
  }
  return out;
}

export function fingerprint(p, group) {
  const paths = {
    data: ['id', 'sku', 'gtin', 'family', 'variant.label', 'title', 'description', 'productUrl', 'imageUrls',
      'imageRights.status', 'imageRights.evidence', 'sale.unit', 'sale.packSize', 'sale.minOrderQty',
      'finishing.required', 'finishing.offeredConfig', 'finishing.configComplete', 'source.name', 'source.updatedAt',
      'flags.food', 'flags.alcohol', 'flags.chilled', 'compliance.status', 'sale.components', 'brand', 'asin', 'asinProof',
      'finishing.printPosition', 'finishing.printColors', 'finishing.printArea', 'finishing.artworkProcess', 'finishing.oneOffIncluded',
      'food.ingredients', 'food.allergens', 'food.netContent', 'food.nutrition', 'food.responsibleOperator', 'food.shelfLife', 'food.storage'],
    price: ['id', 'price.net', 'price.taxRate', 'price.gross', 'price.currency', 'price.origin', 'price.confirmed',
      'sale.unit', 'sale.packSize', 'sale.minOrderQty', 'variant.label'],
    export: ['id', 'variant.label', 'price.gross', 'sale.minOrderQty', 'inquiryOnly', 'shipping.rule', 'shipping.deliveryTime',
      'availability.status', 'availability.evidence', 'availability.asOf', 'landing.url', 'landing.checkedAt',
      'landing.variant', 'landing.qty', 'landing.price', 'availability.reservedQty', 'availability.location', 'availability.sla',
      'availability.capacityConfirmed', 'logistics.weightGrams', 'logistics.dimensionsMm'],
  }[group];
  const text = JSON.stringify(paths.map((k) => getPath(p, k) ?? null));
  let h = 0x811c9dc5; // FNV-1a 32 Bit
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/**
 * Zustand einer der drei getrennten Freigaben:
 * blocked (Pflichtangaben fehlen/ungültig), open (freigabebereit), granted, stale (Daten nach Freigabe geändert).
 */
export function approvalState(p, group) {
  let problems = group === 'data' ? dataProblems(p) : group === 'price' ? priceProblems(p) : exportProblems(p);
  if (group === 'export') {
    const extra = [];
    for (const g of ['data', 'price']) {
      if (approvalState(p, g).state !== 'granted') extra.push({ key: `approvals.${g}`, label: `Freigabe „${GROUP_LABEL[g]}“ fehlt oder ist veraltet`, kind: 'approval' });
    }
    problems = [...problems, ...extra];
  }
  if (problems.length) return { state: 'blocked', problems };
  const a = p.approvals?.[group];
  if (!a?.approved) return { state: 'open', problems: [] };
  return a.fingerprint === fingerprint(p, group) ? { state: 'granted', problems: [] } : { state: 'stale', problems: [] };
}

export function approve(p, group, by, nowIso) {
  if (!GROUPS.includes(group)) return { error: 'Unbekannte Freigabe' };
  if (!by || !by.trim()) return { error: 'Bitte zuerst oben den Namen der freigebenden Person eintragen.' };
  const st = approvalState(p, group);
  if (st.state === 'blocked') return { error: `Freigabe „${GROUP_LABEL[group]}“ nicht möglich: ${st.problems.map((x) => x.label).join('; ')}` };
  const next = structuredClone(p);
  next.approvals[group] = { approved: true, by: by.trim().slice(0, 100), at: nowIso, fingerprint: fingerprint(p, group) };
  return { product: next };
}

export function revoke(p, group) {
  const next = structuredClone(p);
  next.approvals[group] = { approved: false, by: null, at: null, fingerprint: null };
  if (next.workflow.status === 'approved') next.workflow.status = 'review';
  return next;
}

export function effectiveStatus(p) {
  const s = p.workflow?.status ?? 'candidate';
  if (s === 'excluded') return 'excluded';
  if (s === 'approved') return GROUPS.every((g) => approvalState(p, g).state === 'granted') ? 'approved' : 'review';
  return s;
}

export function setStatus(p, status, reason) {
  if (!ENUMS.status[status]) return { error: 'Unbekannter Status' };
  if (status === 'excluded' && !(reason ?? p.workflow.exclusionReason)?.trim()) {
    return { error: 'Für „ausgeschlossen“ ist ein Ausschlussgrund erforderlich.' };
  }
  if (status === 'approved') {
    const missing = GROUPS.filter((g) => approvalState(p, g).state !== 'granted').map((g) => GROUP_LABEL[g]);
    if (missing.length) return { error: `„Freigegeben“ erfordert alle drei Freigaben. Es fehlt: ${missing.join(', ')}.` };
  }
  const next = structuredClone(p);
  next.workflow.status = status;
  if (status === 'excluded') next.workflow.exclusionReason = (reason ?? p.workflow.exclusionReason).trim();
  return { product: next };
}

/** Alle Gründe, warum ein Produkt nicht in einen Plattformexport darf. */
export function exportEligibility(p) {
  const st = approvalState(p, 'export');
  const reasons = st.state === 'blocked' ? st.problems.map((x) => x.label) : [];
  if (st.state === 'open') reasons.push('Freigabe „Plattformexport“ fehlt');
  if (st.state === 'stale') reasons.push('Freigabe „Plattformexport“ ist veraltet (Angaben wurden danach geändert)');
  return { eligible: reasons.length === 0, reasons };
}

export function warnings(p) {
  const w = [];
  if (p.availability?.status === 'supplier_available') w.push('Lieferantenverfügbarkeit ist kein eigener Lagerbestand – nicht als „auf Lager“ ausweisen.');
  if (p.price?.origin === 'proposal') w.push('Preis ist ein lokaler Vorschlag und noch kein bestätigter Datenbankpreis.');
  if (p.flags?.alcohol === 'yes') w.push('Alkohol: Plattformregeln und Altersvorgaben wurden nicht geprüft.');
  if (p.flags?.food === 'yes') w.push('Lebensmittel: Kennzeichnungs-/Plattformregeln wurden nicht geprüft (Grundpreisangabe, Registrierung, Rückgabe/Widerruf, Verpackungsrollen separat prüfen).');
  if (p.flags?.chilled === 'yes') w.push('Kühlware: Versand-/Plattformanforderungen nicht geprüft.');
  if (p.sale?.minOrderQty > 1) w.push(`Mindestbestellmenge ${p.sale.minOrderQty} Verkaufseinheiten – Landingpage und Feed müssen dies abbilden.`);
  if (p.workflow?.status === 'excluded' && !has(p.workflow.exclusionReason)) w.push('Ausschlussgrund fehlt.');
  return w;
}

export function nextStep(p) {
  if (p.workflow?.status === 'excluded') {
    return p.workflow.exclusionReason ? `Ausgeschlossen (${p.workflow.exclusionReason}) – nichts zu tun.` : 'Ausschlussgrund eintragen.';
  }
  if (p.inquiryOnly === 'yes') return 'Anfrageartikel: nicht exportierbar. Festpreis und Bestellbarkeit klären – oder ausschließen.';
  const data = approvalState(p, 'data');
  if (data.state === 'blocked') return `Produktdaten ergänzen: ${data.problems.slice(0, 3).map((x) => x.label).join('; ')}${data.problems.length > 3 ? ` (+${data.problems.length - 3})` : ''}.`;
  if (data.state !== 'granted') return 'Produktdaten prüfen und „Produktdaten freigeben“.';
  const price = approvalState(p, 'price');
  if (price.state === 'blocked') return `Verkaufspreis klären: ${price.problems.slice(0, 3).map((x) => x.label).join('; ')}.`;
  if (price.state !== 'granted') return 'Verkaufspreis prüfen und „Verkaufspreis freigeben“.';
  const exp = approvalState(p, 'export');
  if (exp.state === 'blocked') return `Für den Export fehlt: ${exp.problems.slice(0, 3).map((x) => x.label).join('; ')}.`;
  if (exp.state !== 'granted') return 'Versand, Verfügbarkeit und Landingpage geprüft? Dann „Plattformexport freigeben“.';
  if (effectiveStatus(p) !== 'approved') return 'Alle drei Freigaben liegen vor – Status auf „freigegeben“ setzen.';
  return 'Fertig vorbereitet. Echte Plattformvorlage fehlt noch (nur interne Vorschau möglich).';
}

export function globalNextSteps(products) {
  const steps = [];
  if (!products.length) return ['Noch keine Produkte. Beispieldaten laden (Reiter „Daten“) oder eine Arbeitsliste importieren.'];
  const count = (fn) => products.filter(fn).length;
  const cand = count((p) => effectiveStatus(p) === 'candidate');
  const dataBlocked = count((p) => p.workflow.status !== 'excluded' && approvalState(p, 'data').state === 'blocked');
  const rights = count((p) => p.workflow.status !== 'excluded' && p.imageRights?.status !== 'confirmed');
  const dataOpen = count((p) => ['open', 'stale'].includes(approvalState(p, 'data').state));
  const priceOpen = count((p) => ['open', 'stale'].includes(approvalState(p, 'price').state));
  const expOpen = count((p) => ['open', 'stale'].includes(approvalState(p, 'export').state));
  const inquiry = count((p) => p.inquiryOnly === 'yes' && p.workflow.status !== 'excluded');
  if (cand) steps.push(`${cand} Kandidat(en) sichten und entscheiden: weiter prüfen („Prüfung nötig“) oder ausschließen (mit Grund).`);
  if (dataBlocked) steps.push(`Bei ${dataBlocked} Produkt(en) fehlen Produktdaten – in der Liste „Nur unvollständige“ filtern und ergänzen bzw. von Bot-/Preisdatenbank nachliefern lassen.`);
  if (rights) steps.push(`Bei ${rights} Produkt(en) sind die Bildrechte nicht bestätigt – Bilder dürfen ohne Bestätigung nicht in Feeds.`);
  if (inquiry) steps.push(`${inquiry} Anfrageartikel können nicht exportiert werden – Festpreis klären oder ausschließen.`);
  if (dataOpen) steps.push(`${dataOpen} Produkt(e) sind bereit für die Freigabe „Produktdaten“.`);
  if (priceOpen) steps.push(`${priceOpen} Produkt(e) sind bereit für die Freigabe „Verkaufspreis“.`);
  if (expOpen) steps.push(`${expOpen} Produkt(e) sind bereit für die Freigabe „Plattformexport“.`);
  steps.push('Originalvorlagen von Meta und TikTok Shop (deutsch, kategoriespezifisch) beschaffen – bis dahin sind Exporte nur interne Vorschau (Reiter „Export“).');
  return steps;
}
