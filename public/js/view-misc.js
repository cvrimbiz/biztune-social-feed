import { h, download, readFileText } from './ui.mjs';
import { ADAPTERS, buildPreview, previewCsv, previewJson, previewFilename, PREVIEW_BANNER } from './exporters/index.mjs';
import { buildReport } from './report.mjs';
import { serializeJson, serializeCsv, parseWorklist, planImport, applyImport } from './io.mjs';
import { store } from './store.mjs';
import { ENUMS } from './schema.mjs';
import { globalNextSteps } from './rules.mjs';
import { rankAll } from './recommend.mjs';
import { parseTemplate, suggestMapping, fillTemplate, SOURCES } from './templatefill.mjs';

const scopeProducts = (state, scope) => (scope === 'selected' ? state.products.filter((p) => state.selected.has(p.id)) : state.products);

function scopeSelect(state, onchange, value) {
  return h('select', { 'aria-label': 'Umfang', value, onchange: (e) => onchange(e.target.value) },
    h('option', { value: 'all' }, `Alle Produkte (${state.products.length})`),
    h('option', { value: 'selected' }, `Nur Auswahl (${state.selected.size})`));
}

// ---------- Export ----------
let exportScope = 'all';
let shown = null;

export function renderExport(ctx) {
  const { state } = ctx;
  const wrap = h('div');
  const out = h('div');
  wrap.append(h('div', { class: 'card' }, h('h2', null, 'Plattformexport (interne Vorschau)'),
    h('div', { class: 'preview' }, PREVIEW_BANNER),
    h('p', { class: 'small' }, 'Meta und TikTok haben getrennte Adapter. Exportiert werden nur Produkte mit gültiger Freigabe „Plattformexport“ (und gültigen Freigaben für Daten und Preis), Festpreis, bestätigtem Preis, vollständiger Konfiguration und geprüfter Landingpage. Kalkulationsfelder werden nie exportiert. Es wird nichts an Plattformen gesendet.'),
    h('div', { class: 'row' }, 'Umfang: ', scopeSelect(state, (v) => { exportScope = v; shown = null; ctx.rerender(); }, exportScope))));
  const products = scopeProducts(state, exportScope);
  for (const a of ADAPTERS) {
    const prev = buildPreview(a, products);
    const card = h('div', { class: 'card' }, h('h3', null, a.name),
      h('div', { class: 'preview' }, 'INTERNE VORSCHAU – Zielschema nicht validiert'),
      h('p', null, `${prev.rows.length} Produkt(e) exportfähig für die Vorschau, ${prev.excluded.length} gesperrt.`),
      h('div', { class: 'row' },
        h('button', { class: 'btn', onclick: () => { shown = a.id; ctx.rerender(); } }, 'Vorschau anzeigen'),
        h('button', { class: 'btn', disabled: !prev.rows.length, onclick: () => download(previewFilename(prev, 'csv'), previewCsv(prev), 'text/csv') }, 'CSV-Vorschau laden'),
        h('button', { class: 'btn', disabled: !prev.rows.length, onclick: () => download(previewFilename(prev, 'json'), previewJson(prev), 'application/json') }, 'JSON-Vorschau laden')),
      h('details', null, h('summary', null, 'Fehlende Originalvorlagen / Angaben'),
        h('p', { class: 'small' }, 'Vorlagen und Dokumente, die noch fehlen:'), h('ul', { class: 'plain small' }, a.missingTemplates.map((t) => h('li', null, t))),
        h('p', { class: 'small' }, 'Bisher unbekannte Pflichtfelder:'), h('ul', { class: 'plain small' }, a.unknownRequiredFields.map((t) => h('li', null, t)))));
    card.append(templateSection(ctx, a, products));
    if (shown === a.id) {
      card.append(
        h('h3', null, 'Vorschau-Zeilen'),
        prev.rows.length ? table(prev.columns, prev.rows) : h('p', { class: 'muted' }, 'Keine exportfähigen Produkte.'),
        h('h3', null, 'Gesperrte Produkte'),
        prev.excluded.length ? h('ul', { class: 'plain small' }, prev.excluded.map((e) => h('li', null, h('strong', null, e.id), ': ', e.reasons.join('; ')))) : h('p', { class: 'muted' }, 'Keine.'));
    }
    out.append(card);
  }
  wrap.append(out);
  return wrap;
}

const tpl = {}; // je Adapter: {text, name, headerRow, mapping, msg}

function templateSection(ctx, a, products) {
  const t = (tpl[a.id] ??= { headerRow: 1 });
  const box = h('details', { open: !!t.text }, h('summary', null, 'Heruntergeladene Original-Vorlage (CSV) befüllen'));
  box.append(h('p', { class: 'small' }, 'Vorlage von der Plattform laden (als CSV; Excel-Vorlagen zuerst als CSV speichern – dabei können Formatierungen/Auswahllisten der Plattform verloren gehen, siehe docs/ROADMAP.md). Die Datei bleibt unverändert, es werden nur Datenzeilen für exportfähige Produkte ergänzt. Zuordnungen sind Vorschläge – bitte prüfen. Ob die Plattform die Datei annimmt, wird NICHT geprüft.'));
  const msg = h('p', { class: 'err', role: 'alert' }, t.msg ?? '');
  const load = (text, name) => {
    try {
      const tmpl = parseTemplate(text, t.headerRow);
      const key = tmpl.headers.join('|');
      const saved = store.loadMappings()[`${a.id}:${key}`];
      Object.assign(t, { text, name, template: tmpl, mapping: saved ?? suggestMapping(tmpl.headers), msg: '' });
    } catch (e) { Object.assign(t, { template: null, msg: `Vorlage nicht lesbar: ${e.message}` }); }
    ctx.rerender();
  };
  box.append(h('div', { class: 'row' },
    h('input', { type: 'file', accept: '.csv,text/csv', 'aria-label': `Vorlage ${a.name}`, onchange: async (e) => { const f = e.target.files?.[0]; if (f && f.size <= 5_000_000) { t.name = f.name; load(await readFileText(f), f.name); } else if (f) { t.msg = 'Datei zu groß'; ctx.rerender(); } } }),
    h('label', { class: 'small' }, 'Kopfzeile in Zeile ', h('input', { type: 'text', value: String(t.headerRow), 'aria-label': 'Kopfzeile', onchange: (e) => { t.headerRow = Number(e.target.value) || 1; if (t.text) load(t.text, t.name); } }))), msg);
  if (t.template) {
    const m = t.mapping;
    const persist = () => { const all = store.loadMappings(); all[`${a.id}:${t.template.headers.join('|')}`] = m; store.saveMappings(all); };
    box.append(h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['Spalte der Vorlage', 'Befüllen mit', 'Oder fester Wert'].map((x) => h('th', null, x)))),
      h('tbody', null, t.template.headers.map((hd, i) => h('tr', null,
        h('td', null, hd || h('em', { class: 'muted' }, '(ohne Name)')),
        h('td', null, h('select', { 'aria-label': `Zuordnung ${hd}`, value: m[i]?.startsWith('const:') ? '' : (m[i] ?? ''), onchange: (e) => { m[i] = e.target.value; persist(); ctx.rerender(); } },
          h('option', { value: '' }, '– leer lassen –'), Object.entries(SOURCES).map(([k, l]) => h('option', { value: k }, l)))),
        h('td', null, h('input', { type: 'text', 'aria-label': `Festwert ${hd}`, value: m[i]?.startsWith('const:') ? m[i].slice(6) : '', onchange: (e) => { m[i] = e.target.value ? `const:${e.target.value}` : ''; persist(); ctx.rerender(); } }))))))));
    const res = fillTemplate(t.template, m, products, a);
    box.append(h('p', { class: 'small' }, `${res.filled} Produkt(e) würden eingetragen, ${res.excluded.length} sind gesperrt. Nicht befüllte Spalten: ${res.unmapped.length ? res.unmapped.join(', ') : 'keine'} – diese bleiben leer und müssen ggf. von Hand ergänzt werden.`),
      h('div', { class: 'preview' }, 'INTERNE VORSCHAU – Zielschema nicht validiert'),
      h('button', { class: 'btn', disabled: !res.filled, onclick: () => download(`VORSCHAU-INTERN_${a.id}_befuellt.csv`, res.csv, 'text/csv') }, 'Befüllte Vorlage (Vorschau) laden'));
  }
  return box;
}

function table(cols, rows) {
  return h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, h('tr', null, cols.map((c) => h('th', null, c)))), h('tbody', null, rows.map((r) => h('tr', null, cols.map((c) => h('td', null, String(r[c] ?? ''))))))));
}

// ---------- Bericht ----------
let reportScope = 'all';
let reportText = '';

export function renderReport(ctx) {
  const { state } = ctx;
  const pre = h('pre', { class: 'report' }, reportText || 'Noch kein Bericht erzeugt.');
  return h('div', { class: 'card' }, h('h2', null, 'Produktbezogener Prüfbericht'),
    h('p', { class: 'small' }, 'Zeigt je Produkt Status, fehlende Angaben, Freigaben, Exportsperren und den nächsten Schritt. Enthält keine Kalkulationsdaten.'),
    h('div', { class: 'row' }, scopeSelect(state, (v) => { reportScope = v; }, reportScope),
      h('button', { class: 'btn primary', onclick: () => { reportText = buildReport(scopeProducts(state, reportScope), ctx.now()); pre.textContent = reportText; } }, 'Bericht erzeugen'),
      h('button', { class: 'btn', onclick: () => reportText && download('pruefbericht.md', reportText, 'text/markdown') }, 'Als Markdown laden')),
    pre);
}

// ---------- Daten ----------
let imp = null; // {text, filename, keepApprovals, parsed, plan, replace:Set, source}
let dataScope = 'all';

async function fetchText(url) {
  const r = await fetch(url, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return r.text();
}

function startImport(ctx, text, filename, source = 'file') {
  imp = { text, filename, keepApprovals: imp?.keepApprovals ?? false, source, replace: new Set() };
  reparse(ctx);
}

function reparse(ctx) {
  imp.parsed = parseWorklist(imp.text, { filename: imp.filename, keepApprovals: imp.keepApprovals });
  imp.plan = planImport(ctx.state.products, imp.parsed.products);
  ctx.rerender();
}

export function renderData(ctx) {
  const { state } = ctx;
  const wrap = h('div');
  const msg = h('p', { class: 'small', role: 'status' });

  const exp = h('div', { class: 'card' }, h('h2', null, 'Arbeitsliste exportieren'),
    h('p', { class: 'small' }, 'Die interne Arbeitsliste enthält Produktdaten, Verkaufspreise, Status und Freigaben – keine vertraulichen Kalkulationswerte. CSV nutzt Semikolon (deutsches Excel) und schützt Zellen gegen Formelausführung.'),
    h('div', { class: 'row' }, scopeSelect(state, (v) => { dataScope = v; }, dataScope),
      h('button', { class: 'btn', onclick: () => download('arbeitsliste.json', serializeJson(scopeProducts(state, dataScope), ctx.now()), 'application/json') }, 'JSON laden'),
      h('button', { class: 'btn', onclick: () => download('arbeitsliste.csv', serializeCsv(scopeProducts(state, dataScope)), 'text/csv') }, 'CSV laden')));

  const fileInput = h('input', { type: 'file', accept: '.json,.csv,text/csv,application/json', 'aria-label': 'Arbeitsliste auswählen', onchange: async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5_000_000) { msg.textContent = 'Datei ist zu groß (mehr als 5 MB).'; return; }
    try { startImport(ctx, await readFileText(f), f.name); } catch (err) { msg.textContent = err.message; }
  } });
  const backup = store.loadBackup();
  const imports = h('div', { class: 'card' }, h('h2', null, 'Arbeitsliste importieren'),
    h('p', { class: 'small' }, 'Importierte Dateien sind reine Daten. Es wird zuerst eine Vorschau gezeigt; vorhandene Produkte werden nicht überschrieben, solange Sie das nicht ausdrücklich je Produkt wählen. Vor jeder Änderung wird eine Sicherung angelegt.'),
    h('div', { class: 'row' }, fileInput,
      h('button', { class: 'btn', onclick: async () => {
        try { startImport(ctx, await fetchText('/data/sample-products.json'), 'sample-products.json', 'sample'); } catch (err) { msg.textContent = `Beispieldaten nicht ladbar: ${err.message}`; }
      } }, 'Synthetische Beispieldaten laden')),
    msg, imp ? importPanel(ctx) : null);

  const safety = h('div', { class: 'card' }, h('h2', null, 'Sicherung und Löschen'),
    h('div', { class: 'row' },
      h('button', { class: 'btn', disabled: !backup, onclick: () => {
        if (!backup || !window.confirm('Liste auf die letzte Sicherung (vor dem letzten Import) zurücksetzen? Die aktuelle Liste wird ersetzt.')) return;
        ctx.setProducts(backup);
      } }, backup ? `Sicherung wiederherstellen (${backup.length} Produkte)` : 'Keine Sicherung vorhanden'),
      h('button', { class: 'btn', onclick: () => {
        if (!window.confirm('ALLE lokalen Daten (Arbeitsliste, Kalkulation, Sicherung) löschen? Vorher exportieren!')) return;
        store.clearAll(); state.products = []; state.costs = {}; state.current = null; state.selected.clear(); ctx.rerender();
      } }, 'Alle lokalen Daten löschen')));
  wrap.append(exp, imports, safety);
  return wrap;
}

function importPanel(ctx) {
  const { state } = ctx;
  const { parsed, plan } = imp;
  const apply = (replaceIds) => {
    store.saveBackup(state.products);
    const next = applyImport(state.products, plan, replaceIds, { keepApprovals: imp.keepApprovals });
    const addedIds = new Set(plan.added.map((p) => p.id));
    state.products = next;
    if (imp.source === 'sample') mergeSampleCosts(ctx, addedIds).finally(() => { imp = null; ctx.setProducts(state.products); });
    else { imp = null; ctx.setProducts(state.products); }
  };
  return h('div', { class: 'card' }, h('h3', null, `Vorschau: ${imp.filename}`),
    h('label', { class: 'small' }, h('input', { type: 'checkbox', checked: imp.keepApprovals, onchange: (e) => { imp.keepApprovals = e.target.checked; reparse(ctx); } }),
      ' Freigaben aus der Datei übernehmen (Standard: aus – Freigaben erteilt nur eine Person in dieser Anwendung)'),
    h('p', null, `${parsed.total} Datensätze gelesen · ${plan.added.length} neu · ${plan.same.length} unverändert · ${plan.changed.length} abweichend · ${parsed.errors.length} Fehler`),
    parsed.errors.length ? [h('strong', { class: 'err' }, 'Fehler (betroffene Datensätze werden übersprungen):'), h('ul', { class: 'plain small' }, parsed.errors.slice(0, 50).map((e) => h('li', { class: 'bad' }, e))), parsed.errors.length > 50 ? h('p', { class: 'small' }, `… und ${parsed.errors.length - 50} weitere`) : null] : null,
    parsed.warnings.length ? [h('strong', null, 'Hinweise:'), h('ul', { class: 'plain small' }, parsed.warnings.slice(0, 30).map((e) => h('li', { class: 'warn' }, e)))] : null,
    plan.changed.length ? [h('strong', null, 'Abweichende Produkte – ersetzen? (Standard: nein, vorhandene Version bleibt)'),
      h('ul', { class: 'plain small' }, plan.changed.map((c) => h('li', null, h('label', null, h('input', { type: 'checkbox', checked: imp.replace.has(c.incoming.id), onchange: (e) => { e.target.checked ? imp.replace.add(c.incoming.id) : imp.replace.delete(c.incoming.id); } }), ` ${c.incoming.id}: geänderte Felder: ${c.fields.slice(0, 8).join(', ')}${c.fields.length > 8 ? ' …' : ''}`))))] : null,
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', disabled: !plan.added.length && !plan.changed.length, onclick: () => apply(imp.replace) }, `Importieren (${plan.added.length} neu${imp.replace.size ? `, ${imp.replace.size} ersetzen` : ''})`),
      h('button', { class: 'btn', onclick: () => { imp = null; ctx.rerender(); } }, 'Abbrechen')));
}

async function mergeSampleCosts(ctx, addedIds) {
  try {
    const data = JSON.parse(await fetchText('/data/sample-costs.json'));
    for (const [id, c] of Object.entries(data.costs ?? {})) {
      if (addedIds.has(id) && !ctx.state.costs[id]) ctx.state.costs[id] = c; // vorhandene Kalkulation nie überschreiben
    }
  } catch { /* Beispielkosten sind optional */ }
}

// ---------- Anleitung ----------
export function renderGuide(ctx) {
  const steps = globalNextSteps(ctx.state.products);
  return h('div', null,
    h('div', { class: 'card next' }, h('h2', null, 'Was muss ich als Nächstes tun?'), h('ol', null, steps.map((s) => h('li', null, s)))),
    h('div', { class: 'card' }, h('h2', null, 'So arbeiten Sie mit dem Assistenten'),
      h('ol', null,
        h('li', null, 'Daten laden: Reiter „Daten“ → Arbeitsliste importieren (später aus dem Bot-/Preisdatenbank-Projekt) oder synthetische Beispiele laden.'),
        h('li', null, 'Kandidaten sichten: Reiter „Produkte“, filtern, mit Kästchen auswählen. Status setzen: Kandidat, Prüfung nötig, freigegeben, ausgeschlossen (mit Grund).'),
        h('li', null, 'Fehlende Angaben ergänzen: Im Detail stehen „Fehlende Angaben und Sperrgründe“. Unbekanntes bleibt leer – nichts schätzen.'),
        h('li', null, 'Drei getrennte Freigaben erteilen: Produktdaten → Verkaufspreis → Plattformexport. Ändern sich Angaben danach, wird die Freigabe „veraltet“.'),
        h('li', null, 'Preis: bestätigte Preise werden nur in brutto umgerechnet. Ein neuer Preis kann im vertraulichen Bereich „Kalkulation“ vorgeschlagen werden und gilt dann als unbestätigt.'),
        h('li', null, 'Export: Reiter „Export“ erzeugt nur interne Vorschauen, bis echte deutsche Plattformvorlagen vorliegen.'),
        h('li', null, 'Sichern: Arbeitsliste regelmäßig als JSON exportieren. Der Browser-Speicher gehört zu diesem Rechner und Browser.'))),
    h('div', { class: 'card' }, h('h2', null, 'Grenzen'),
      h('ul', null,
        h('li', null, 'Keine Verbindung zu Händlerkonten, keine Veröffentlichung, keine Bestellungen, keine Shop- oder Datenbankänderung.'),
        h('li', null, 'Lieferantenverfügbarkeit ist kein eigener Lagerbestand.'),
        h('li', null, `Status-Begriffe: ${Object.values(ENUMS.status).join(', ')}.`))));
}

// ---------- Empfehlungen ----------
let recPlatform = 'meta';

export function renderRecommend(ctx) {
  const { state } = ctx;
  const ranked = rankAll(state.products).filter((r) => !r.scores[recPlatform].hardStop).sort((a, b) => b.scores[recPlatform].score - a.scores[recPlatform].score || a.p.id.localeCompare(b.p.id));
  const stopped = rankAll(state.products).filter((r) => r.scores[recPlatform].hardStop);
  return h('div', null,
    h('div', { class: 'card' }, h('h2', null, 'Empfehlungen: Was ist für welchen Shop startklar?'),
      h('p', { class: 'small' }, 'Die Bewertung (0–100) misst nur den Vorbereitungsstand und die einfache Verkaufbarkeit anhand der vorhandenen Daten: exportfähig, bestätigter Preis, Mindestmenge 1, keine Pflichtveredelung, belegte Verfügbarkeit, Bildrechte, GTIN; Abzüge für Alkohol/Lebensmittel. Nachfrage, bisherige Verkäufe und Margen fließen NICHT ein, weil dafür keine Daten vorliegen – es ist keine Marktprognose.'),
      h('div', { class: 'row' }, h('select', { 'aria-label': 'Plattform', value: recPlatform, onchange: (e) => { recPlatform = e.target.value; ctx.rerender(); } }, ADAPTERS.map((a) => h('option', { value: a.id }, a.name))),
        h('button', { class: 'btn', onclick: () => { state.selected.clear(); ranked.slice(0, 10).forEach((r) => state.selected.add(r.p.id)); state.tab = 'products'; ctx.rerender(); } }, 'Top 10 in „Produkte“ auswählen'))),
    h('div', { class: 'tablewrap' }, h('table', null,
      h('thead', null, h('tr', null, ['#', 'Produkt', 'Eignung', 'Dafür', 'Dagegen'].map((x) => h('th', null, x)))),
      h('tbody', null, ranked.map((r, i) => { const s = r.scores[recPlatform]; return h('tr', null, h('td', null, String(i + 1)), h('td', null, h('strong', null, r.p.id), ' ', r.p.title ?? ''), h('td', null, String(s.score)), h('td', { class: 'small' }, s.plus.join('; ')), h('td', { class: 'small' }, s.minus.join('; '))); })))),
    stopped.length ? h('p', { class: 'small muted' }, `Nicht bewertbar (ausgeschlossen oder Anfrageartikel): ${stopped.map((r) => r.p.id).join(', ')}`) : null);
}
