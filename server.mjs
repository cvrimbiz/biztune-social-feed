// Minimaler lokaler Dateiserver (nur Node-Standardbibliothek, keine Abhängigkeiten).
// Hört ausschließlich auf 127.0.0.1, liefert nur public/ und data/ aus, nur GET/HEAD,
// hat keine API und ruft nichts im Internet auf.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(here, 'public');
const DATA = path.join(here, 'data');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.csv': 'text/csv; charset=utf-8', '.svg': 'image/svg+xml' };
const HEADERS = {
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self' data: https: http:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

export function createServer(port) {
  return http.createServer(async (req, res) => {
    const send = (code, body, type = 'text/plain; charset=utf-8') => { res.writeHead(code, { 'Content-Type': type, ...HEADERS }); res.end(req.method === 'HEAD' ? undefined : body); };
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'Nur GET erlaubt');
      const host = (req.headers.host ?? '').toLowerCase();
      if (host !== `127.0.0.1:${port}` && host !== `localhost:${port}`) return send(403, 'Ungültiger Host');
      let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (rel.includes('\0')) return send(400, 'Ungültiger Pfad');
      if (rel === '/') rel = '/index.html';
      const inData = rel.startsWith('/data/');
      const root = inData ? DATA : PUBLIC;
      const file = path.resolve(root, '.' + (inData ? rel.slice(5) : rel));
      if (!file.startsWith(root + path.sep)) return send(403, 'Zugriff verweigert');
      const type = TYPES[path.extname(file)];
      if (!type) return send(404, 'Nicht gefunden');
      return send(200, await readFile(file), type);
    } catch (e) {
      return send(e.code === 'ENOENT' || e.code === 'EISDIR' ? 404 : 400, 'Nicht gefunden');
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 5173;
  const server = createServer(port);
  server.on('error', (e) => {
    console.error(e.code === 'EADDRINUSE' ? `Port ${port} ist belegt. Anderen Port wählen, z. B. PORT=5174.` : e.message);
    process.exit(1);
  });
  server.listen(port, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${port}/`;
    console.log(`BizTune Social-Produktassistent läuft lokal: ${url}\nBeenden mit Strg+C.`);
    if (process.argv.includes('--open')) {
      const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
      exec(cmd, () => {});
    }
  });
}
