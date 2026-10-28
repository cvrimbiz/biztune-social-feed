// Erzeugt docs/pruefbericht-beispiel.md aus den synthetischen Beispieldaten.
import { readFile, writeFile } from 'node:fs/promises';
import { parseWorklist } from '../public/js/io.mjs';
import { buildReport } from '../public/js/report.mjs';

const text = await readFile(new URL('../data/sample-products.json', import.meta.url), 'utf8');
const { products } = parseWorklist(text, { filename: 'sample-products.json', keepApprovals: true });
await writeFile(new URL('../docs/pruefbericht-beispiel.md', import.meta.url), buildReport(products, '2026-10-24 (Beispiel, synthetisch)'));
console.log('docs/pruefbericht-beispiel.md geschrieben');
