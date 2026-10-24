// CSV lesen/schreiben (RFC 4180, Semikolon als Standardtrenner für deutsches Excel)
// mit Schutz gegen Formelausführung (CSV-Injection).

const TRIGGER = /^[\s ]*[=+\-@|\t\r]/;

/** Entschärft Zellen, die eine Tabellenkalkulation als Formel deuten könnte. */
export function guardCell(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return TRIGGER.test(s) ? `'${s}` : s;
}

/** Gegenstück beim Einlesen eigener Exporte: entfernt nur den von guardCell gesetzten Apostroph. */
export function unguardCell(s) {
  return s.startsWith("'") && TRIGGER.test(s.slice(1)) ? s.slice(1) : s;
}

function quote(s, delimiter) {
  return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(columns, rows, { delimiter = ';', bom = true } = {}) {
  const lines = [columns.map((c) => quote(guardCell(c), delimiter)).join(delimiter)];
  for (const row of rows) {
    lines.push(columns.map((c) => quote(guardCell(row[c]), delimiter)).join(delimiter));
  }
  return (bom ? '﻿' : '') + lines.join('\r\n') + '\r\n';
}

export function detectDelimiter(headerLine) {
  const counts = [';', ',', '\t'].map((d) => [d, headerLine.split(d).length - 1]);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0][1] > 0 ? counts[0][0] : ';';
}

/** Gibt {rows: string[][]} zurück; wirft bei nicht geschlossenen Anführungszeichen. */
export function parseCsv(text, { maxRows = 5000 } = {}) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const delimiter = detectDelimiter(firstLine);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  const pushField = () => { row.push(field); field = ''; };
  const pushRow = () => {
    pushField();
    if (!(row.length === 1 && row[0] === '')) rows.push(row);
    row = [];
    if (rows.length > maxRows + 1) throw new RangeError(`Mehr als ${maxRows} Zeilen – Datei zu groß`);
  };
  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
        inQuotes = false; i++; continue;
      }
      field += ch; i++; continue;
    }
    if (ch === '"' && field === '') { inQuotes = true; i++; continue; }
    if (ch === delimiter) { pushField(); i++; continue; }
    if (ch === '\r') { if (text[i + 1] === '\n') i++; pushRow(); i++; continue; }
    if (ch === '\n') { pushRow(); i++; continue; }
    field += ch; i++;
  }
  if (inQuotes) throw new SyntaxError('Anführungszeichen wurden nicht geschlossen');
  if (field !== '' || row.length) pushRow();
  return { rows, delimiter };
}
