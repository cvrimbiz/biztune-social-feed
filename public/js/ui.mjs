// Kleine DOM-Helfer. Inhalte werden ausschließlich als Text eingefügt (nie als HTML).

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  let value;
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'value') value = v;
    else if (['checked', 'disabled', 'selected', 'open', 'readOnly'].includes(k)) el[k] = true;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  if (value !== undefined) el.value = value;
  return el;
}

export function download(filename, text, mime = 'text/plain') {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = h('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function placeholderSvg(label) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 150 110');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', label);
  const t1 = document.createElementNS(ns, 'text');
  t1.setAttribute('x', '75'); t1.setAttribute('y', '52'); t1.setAttribute('text-anchor', 'middle'); t1.setAttribute('font-size', '13'); t1.setAttribute('fill', 'currentColor');
  t1.textContent = 'Beispielbild';
  const t2 = document.createElementNS(ns, 'text');
  t2.setAttribute('x', '75'); t2.setAttribute('y', '70'); t2.setAttribute('text-anchor', 'middle'); t2.setAttribute('font-size', '10'); t2.setAttribute('fill', 'currentColor');
  t2.textContent = '(synthetisch)';
  svg.append(t1, t2);
  return svg;
}

export function readFileText(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Datei konnte nicht gelesen werden'));
    r.readAsText(file, 'utf-8');
  });
}
