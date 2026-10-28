import { h, placeholderSvg } from './ui.mjs';
import { store } from './store.mjs';
import { FIELDS, ENUMS, TRI, enumLabel, coerce, setPath, getPath, emptyProduct } from './schema.mjs';
import { approvalState, approve, revoke, effectiveStatus, setStatus, exportEligibility, warnings, nextStep, globalNextSteps, dataProblems, priceProblems, exportProblems, GROUPS, GROUP_LABEL } from './rules.mjs';
import { checkPrice, grossFromNet } from './pricing.mjs';
import { formatMoney } from './decimal.mjs';
import { renderCalc } from './view-calc.js';
import { renderExport, renderReport, renderData, renderGuide, renderRecommend } from './view-misc.js';

const TABS = [['products', 'Produkte'], ['calc', 'Kalkulation (vertraulich)'], ['recommend', 'Empfehlungen'], ['export', 'Export'], ['report', 'Prüfbericht'], ['data', 'Daten (Import/Export)'], ['guide', 'Anleitung']];

export const state = {
  products: store.loadProducts(),
  costs: store.loadCosts(),
  user: store.loadUser(),
  tab: 'products',
  current: null,
  selected: new Set(),
  filter: { q: '', status: '', line: '', incomplete: false, export: '' },
  storageOk: true,
};

const main = document.getElementById('main');
const tabsEl = document.getElementById('tabs');
const bannerEl = document.getElementById('banner');
const userEl = document.getElementById('user');
userEl.value = state.user;
userEl.addEventListener('change', () => { state.user = userEl.value.trim(); store.saveUser(state.user); });

export const now = () => new Date().toISOString();

export function save() {
  state.storageOk = store.saveProducts(state.products) && store.saveCosts(state.costs);
  renderBanner();
}

export function commit(id, mutate) {
  const i = state.products.findIndex((p) => p.id === id);
  if (i < 0) return;
  const next = structuredClone(state.products[i]);
  mutate(next);
  state.products[i] = next;
  save();
}

export const ctx = { state, h, commit, save, now, rerender: () => render(), setProducts(list) { state.products = list; save(); render(); } };

function renderBanner() {
  const parts = [];
  if (state.products.length && state.products.every((p) => p.synthetic)) parts.push('Prototyp mit SYNTHETISCHEN Beispieldaten – es sind keine echten Römer- oder Rominox-Produkte importiert.');
  else if (state.products.some((p) => p.synthetic)) parts.push('Die Liste enthält synthetische Beispiele (Kennzeichnung „Beispiel“).');
  if (!state.storageOk) parts.push('Lokaler Speicher nicht verfügbar – Änderungen gehen beim Schließen verloren. Bitte regelmäßig unter „Daten“ exportieren.');
  bannerEl.textContent = parts.join(' ');
}

function renderTabs() {
  tabsEl.replaceChildren(...TABS.map(([k, label]) => h('button', { 'aria-current': String(state.tab === k), onclick: () => { state.tab = k; render(); } }, label)));
}

export function render() {
  renderBanner();
  renderTabs();
  const view = { products: renderProducts, calc: renderCalc, recommend: renderRecommend, export: renderExport, report: renderReport, data: renderData, guide: renderGuide }[state.tab];
  main.replaceChildren(view(ctx));
}

// ---------- Produkte ----------

const badge = (text, kind = '') => h('span', { class: `badge ${kind}` }, text);
const statusKind = { approved: 'ok', review: 'warn', candidate: '', excluded: 'bad' };

function filtered() {
  const f = state.filter;
  const q = f.q.trim().toLowerCase();
  return state.products.filter((p) => {
    if (q && ![p.id, p.sku, p.title, p.family, p.variant.label].some((x) => (x ?? '').toLowerCase().includes(q))) return false;
    if (f.status && effectiveStatus(p) !== f.status) return false;
    if (f.line && p.brandLine !== f.line) return false;
    if (f.incomplete && !(dataProblems(p).length || priceProblems(p).length || exportProblems(p).length)) return false;
    if (f.export === 'yes' && !exportEligibility(p).eligible) return false;
    if (f.export === 'no' && exportEligibility(p).eligible) return false;
    return true;
  });
}

function renderProducts() {
  const wrap = h('div');
  const nextBox = h('div', { class: 'card next' });
  const tableHost = h('div');
  const detailHost = h('div');
  const paint = () => {
    nextBox.replaceChildren(h('strong', null, 'Was muss ich als Nächstes tun?'), h('ol', { class: 'plain' }, globalNextSteps(state.products).map((s) => h('li', null, s))));
    tableHost.replaceChildren(productTable(paint));
    detailHost.replaceChildren(state.current ? productDetail(paint) : h('div', { class: 'card muted' }, 'Produkt in der Liste anklicken, um Details, fehlende Angaben und Freigaben zu sehen.'));
  };
  const f = state.filter;
  const search = h('input', { type: 'search', placeholder: 'Suche: ID, SKU, Titel, Familie, Variante', value: f.q, 'aria-label': 'Suche', oninput: (e) => { f.q = e.target.value; tableHost.replaceChildren(productTable(paint)); } });
  const sel = (label, key, opts) => h('select', { 'aria-label': label, onchange: (e) => { f[key] = e.target.value; paint(); }, value: f[key] }, h('option', { value: '' }, `${label}: alle`), Object.entries(opts).map(([k, v]) => h('option', { value: k }, v)));
  const bar = h('div', { class: 'row' },
    h('div', { class: 'grow' }, search),
    sel('Status', 'status', ENUMS.status),
    sel('Gruppe', 'line', ENUMS.brandLine),
    sel('Export', 'export', { yes: 'nur exportfähig (Vorschau)', no: 'nur gesperrt' }),
    h('label', null, h('input', { type: 'checkbox', checked: f.incomplete, onchange: (e) => { f.incomplete = e.target.checked; paint(); } }), ' Nur unvollständige'),
    h('button', { class: 'btn', onclick: () => {
      const id = (window.prompt('Neue stabile Artikel-/Angebots-ID (Buchstaben, Ziffern, . _ : -):') ?? '').trim();
      if (!id) return;
      const r = coerce(FIELDS[0], id);
      if (r.error) return window.alert(`ID ungültig: ${r.error}`);
      if (state.products.some((p) => p.id === id)) return window.alert('Diese ID existiert bereits.');
      state.products.push(emptyProduct(id)); state.current = id; save(); paint();
    } }, '+ Neues Produkt'));
  wrap.append(nextBox, bar, h('div', { class: 'grid2' }, tableHost, detailHost));
  paint();
  return wrap;
}

function productTable(paint) {
  const rows = filtered();
  const allChecked = rows.length > 0 && rows.every((p) => state.selected.has(p.id));
  const head = h('tr', null,
    h('th', null, h('input', { type: 'checkbox', 'aria-label': 'Alle sichtbaren auswählen', checked: allChecked, onchange: (e) => { rows.forEach((p) => (e.target.checked ? state.selected.add(p.id) : state.selected.delete(p.id))); paint(); } })),
    ['ID / SKU', 'Titel · Variante', 'Gruppe', 'Status', 'Fehlt', 'Freigaben', 'Brutto'].map((t) => h('th', null, t)));
  const body = rows.map((p) => {
    const st = effectiveStatus(p);
    const miss = [dataProblems(p).length, priceProblems(p).length, exportProblems(p).length];
    const ap = GROUPS.map((g) => approvalState(p, g).state);
    return h('tr', { class: `pick${state.current === p.id ? ' current' : ''}`, onclick: () => { state.current = p.id; paint(); } },
      h('td', null, h('input', { type: 'checkbox', 'aria-label': `${p.id} auswählen`, checked: state.selected.has(p.id), onclick: (e) => e.stopPropagation(), onchange: (e) => { e.target.checked ? state.selected.add(p.id) : state.selected.delete(p.id); paint(); } })),
      h('td', null, h('strong', null, p.id), h('br'), h('span', { class: 'muted small' }, p.sku ?? 'SKU fehlt'), p.synthetic ? [h('br'), badge('Beispiel')] : null),
      h('td', null, p.title ?? h('em', { class: 'muted' }, 'Titel fehlt'), h('br'), h('span', { class: 'muted small' }, `${p.family ?? 'Familie ?'} · ${p.variant.label ?? 'Variante ?'}`)),
      h('td', null, enumLabel('brandLine', p.brandLine)),
      h('td', null, badge(ENUMS.status[st], statusKind[st])),
      h('td', { class: 'small', title: 'Fehlende/ungültige Angaben: Daten · Preis · Export' }, miss.join(' · ')),
      h('td', null, GROUPS.map((g, i) => badge(`${{ data: 'D', price: 'P', export: 'E' }[g]}${ap[i] === 'granted' ? ' ✓' : ap[i] === 'stale' ? ' !' : ' –'}`, ap[i] === 'granted' ? 'ok' : ap[i] === 'stale' ? 'warn' : ''))),
      h('td', null, p.price.gross ? formatMoney(p.price.gross, p.price.currency ?? 'EUR') : h('span', { class: 'muted' }, 'unbekannt')));
  });
  return h('div', null,
    h('div', { class: 'row small muted' }, `${rows.length} von ${state.products.length} Produkten · ${state.selected.size} ausgewählt · Fehlt = Daten · Preis · Export · Freigaben D/P/E (✓ erteilt, ! veraltet, – offen)`,
      state.selected.size ? bulkBar(paint) : null),
    h('div', { class: 'tablewrap' }, h('table', null, h('thead', null, head), h('tbody', null, body.length ? body : h('tr', null, h('td', { colspan: 8, class: 'muted' }, state.products.length ? 'Keine Treffer für diese Filter.' : 'Noch keine Produkte – siehe Reiter „Daten“.'))))));
}

function bulkBar(paint) {
  const statusSel = h('select', { 'aria-label': 'Status für Auswahl' }, Object.entries(ENUMS.status).map(([k, v]) => h('option', { value: k }, v)));
  const reason = h('input', { type: 'text', placeholder: 'Ausschlussgrund (nur bei „ausgeschlossen“)', 'aria-label': 'Ausschlussgrund' });
  const msg = h('span', { class: 'err', role: 'alert' });
  return h('span', { class: 'row' }, statusSel, reason,
    h('button', { class: 'btn', onclick: () => {
      const errs = [];
      for (const id of state.selected) {
        const p = state.products.find((x) => x.id === id);
        const r = setStatus(p, statusSel.value, reason.value);
        if (r.error) errs.push(`${id}: ${r.error}`); else commit(id, (q) => Object.assign(q, r.product));
      }
      if (errs.length) { msg.textContent = errs.join(' | '); } else paint();
    } }, 'Status für Auswahl setzen'), msg);
}

// ---------- Detail ----------

function fieldInput(p, def, repaint) {
  const cur = getPath(p, def.path);
  const err = h('div', { class: 'err', role: 'alert' });
  const id = `f-${def.path}`;
  let input;
  const apply = (raw) => {
    const r = coerce(def, raw);
    if (r.error) { err.textContent = r.error; input.classList.add('invalid'); return; }
    err.textContent = ''; input.classList.remove('invalid');
    commit(p.id, (q) => setPath(q, def.path, r.value));
    repaint();
  };
  if (def.type === 'enum' || def.type === 'tri') {
    const opts = def.type === 'tri' ? TRI : ENUMS[def.options];
    input = h('select', { id, value: cur ?? '', onchange: (e) => apply(e.target.value) }, h('option', { value: '' }, 'unbekannt'), Object.entries(opts).map(([k, v]) => h('option', { value: k }, v)));
  } else if (def.type === 'longtext' || def.type === 'urls') {
    input = h('textarea', { id, value: def.type === 'urls' ? (cur ?? []).join('\n') : (cur ?? ''), onchange: (e) => apply(e.target.value) });
  } else {
    input = h('input', { id, type: def.type === 'date' ? 'text' : 'text', placeholder: def.type === 'date' ? 'JJJJ-MM-TT' : '', value: cur ?? '', readOnly: def.path === 'id', onchange: (e) => apply(e.target.value) });
  }
  return h('div', { class: 'field' }, h('label', { for: id }, def.label), input, err);
}

function imagePreview(p) {
  if (!p.imageUrls.length) return h('div', { class: 'muted small' }, 'Kein Bildlink vorhanden.');
  return h('div', { class: 'thumb' }, p.imageUrls.map((u) => {
    const host = new URL(u).hostname;
    const fig = h('figure');
    if (host.endsWith('.invalid')) fig.append(placeholderSvg('Platzhalter'), h('figcaption', null, `${u} (Beispielbild, wird nicht geladen)`));
    else {
      const slot = h('div');
      slot.append(h('button', { class: 'btn', onclick: () => { slot.replaceChildren(h('img', { src: u, alt: p.title ?? p.id, referrerpolicy: 'no-referrer', loading: 'lazy' })); } }, `Vorschau von ${host} laden`));
      fig.append(slot, h('figcaption', null, u));
    }
    return fig;
  }));
}

function link(url) {
  return url ? h('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, url) : h('span', { class: 'muted' }, 'unbekannt');
}

function productDetail(paint) {
  const p = state.products.find((x) => x.id === state.current);
  if (!p) return h('div');
  const st = effectiveStatus(p);
  const fieldsByGroup = new Map();
  for (const d of FIELDS) { if (d.ui === false) continue; (fieldsByGroup.get(d.group) ?? fieldsByGroup.set(d.group, []).get(d.group)).push(d); }

  const reason = h('input', { type: 'text', placeholder: 'Ausschlussgrund', value: p.workflow.exclusionReason ?? '', 'aria-label': 'Ausschlussgrund' });
  const statusSel = h('select', { 'aria-label': 'Status', value: p.workflow.status ?? 'candidate' }, Object.entries(ENUMS.status).map(([k, v]) => h('option', { value: k }, v)));
  const statusMsg = h('div', { class: 'err', role: 'alert' });

  const all = [['Produktdaten', dataProblems(p)], ['Verkaufspreis', priceProblems(p)], ['Plattformexport', exportProblems(p)]];
  const w = warnings(p);
  const c = checkPrice(p.price);
  const canGross = !!Dec_ok(p.price.net) && !!Dec_ok(p.price.taxRate);
  let grossInfo = null;
  if (canGross) { try { grossInfo = grossFromNet(p.price.net, p.price.taxRate); } catch { grossInfo = null; } }

  const approvalBox = (g) => {
    const s = approvalState(p, g);
    const a = p.approvals[g];
    const label = { blocked: 'gesperrt – Angaben fehlen', open: 'bereit zur Freigabe', granted: 'erteilt', stale: 'veraltet – Angaben wurden nach der Freigabe geändert' }[s.state];
    const err = h('div', { class: 'err', role: 'alert' });
    return h('div', { class: 'approval' },
      h('div', { class: 'row' }, h('strong', null, `Freigabe ${GROUP_LABEL[g]}`), badge(label, s.state === 'granted' ? 'ok' : s.state === 'stale' ? 'warn' : s.state === 'blocked' ? 'bad' : '')),
      a?.approved ? h('div', { class: 'small muted' }, `von ${a.by} am ${a.at}`) : null,
      s.state === 'blocked' ? h('ul', { class: 'plain small' }, s.problems.map((x) => h('li', { class: 'bad' }, x.label))) : null,
      h('div', { class: 'row' },
        h('button', { class: 'btn primary', disabled: s.state === 'blocked' || s.state === 'granted', onclick: () => {
          const r = approve(p, g, state.user, now());
          if (r.error) { err.textContent = r.error; return; }
          commit(p.id, (q) => Object.assign(q, r.product)); paint();
        } }, s.state === 'stale' ? 'Erneut freigeben' : 'Freigeben'),
        a?.approved ? h('button', { class: 'btn', onclick: () => { commit(p.id, (q) => Object.assign(q, revoke(p, g))); paint(); } }, 'Freigabe zurücknehmen') : null),
      err);
  };

  return h('div', { class: 'card' },
    h('h2', null, `${p.title ?? '(Titel fehlt)'}`),
    h('div', { class: 'row' }, badge(ENUMS.status[st], statusKind[st]), p.synthetic ? badge('Beispiel (synthetisch)') : null, h('span', { class: 'muted small' }, `${p.id} · ${p.family ?? 'Familie unbekannt'} · ${p.variant.label ?? 'Variante unbekannt'}`)),
    h('div', { class: 'card next' }, h('strong', null, 'Nächster Schritt: '), nextStep(p)),
    imagePreview(p),
    h('div', { class: 'small' }, 'Produktlink: ', link(p.productUrl)),
    h('div', { class: 'small' }, `Konkrete Verkaufseinheit: ${p.sale.unit ?? '?'} mit ${p.sale.packSize ?? '?'} Stück, Mindestbestellung ${p.sale.minOrderQty ?? '?'} Verkaufseinheit(en)${p.finishing.required === 'yes' ? `; Veredelung: ${p.finishing.offeredConfig ?? 'Konfiguration fehlt'}` : ''}`),
    w.length ? h('ul', { class: 'plain' }, w.map((x) => h('li', { class: 'warn' }, x))) : null,

    h('h3', null, 'Status'),
    h('div', { class: 'row' }, statusSel, h('div', { class: 'grow' }, reason),
      h('button', { class: 'btn', onclick: () => {
        const r = setStatus(p, statusSel.value, reason.value);
        if (r.error) { statusMsg.textContent = r.error; return; }
        commit(p.id, (q) => Object.assign(q, r.product)); paint();
      } }, 'Status setzen')),
    statusMsg,

    h('h3', null, 'Freigaben (getrennt)'), GROUPS.map(approvalBox),

    h('h3', null, 'Fehlende Angaben und Sperrgründe'),
    all.every(([, l]) => !l.length) ? h('p', { class: 'muted' }, 'Keine fehlenden Angaben.') : all.map(([t, l]) => l.length ? h('div', null, h('strong', { class: 'small' }, t), h('ul', { class: 'plain small' }, l.map((x) => h('li', { class: x.kind === 'missing' ? 'warn' : 'bad' }, `${x.label}${x.kind === 'invalid' ? ' (ungültig)' : ' (fehlt)'}`)))) : null),

    h('h3', null, 'Preisprüfung'),
    h('p', { class: 'small' },
      c.ok ? `Netto ${formatMoney(p.price.net, p.price.currency)} + ${p.price.taxRate} % Steuer = Brutto ${formatMoney(p.price.gross, p.price.currency)} – konsistent.` : c.problems.join('; ') + '.'),
    grossInfo && (!p.price.gross || p.price.gross !== grossInfo.gross) ? h('button', { class: 'btn', onclick: () => { commit(p.id, (q) => { q.price.gross = grossInfo.gross; }); paint(); } }, `Brutto ${grossInfo.gross} aus Netto × Steuersatz übernehmen`) : null,

    h('h3', null, 'Angaben bearbeiten'),
    [...fieldsByGroup].map(([group, defs]) => h('fieldset', null, h('legend', null, group), h('div', { class: 'fields' }, defs.map((d) => fieldInput(p, d, paint))))),
    h('div', { class: 'row' }, h('button', { class: 'btn', onclick: () => {
      if (!window.confirm(`Produkt ${p.id} wirklich aus der lokalen Liste löschen?`)) return;
      state.products = state.products.filter((x) => x.id !== p.id); delete state.costs[p.id]; state.selected.delete(p.id); state.current = null; save(); paint();
    } }, 'Produkt aus lokaler Liste löschen')));
}

function Dec_ok(v) { return v !== null && v !== undefined && v !== ''; }

render();
