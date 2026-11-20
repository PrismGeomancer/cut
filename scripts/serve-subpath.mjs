// Serves dist/ under a subpath (default /cut/) to prove the build works off the domain root.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
const [port = '4317', base = '/cut/', dir = 'dist'] = process.argv.slice(2);
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2', '.wasm': 'application/wasm', '.svg': 'image/svg+xml' };
createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (!url.pathname.startsWith(base)) { res.writeHead(404).end('outside base'); return; }
  let p = normalize(url.pathname.slice(base.length)).replace(/^(\.\.[/\\])+/, '');
  if (!p || p === '.' || p.endsWith('/')) p = (p === '.' ? '' : p) + 'index.html';
  try {
    const body = await readFile(join(dir, p));
    res.writeHead(200, { 'Content-Type': TYPES[extname(p)] ?? 'application/octet-stream' }).end(body);
  } catch { res.writeHead(404).end('not found'); }
}).listen(+port, () => console.log(`dist at http://localhost:${port}${base}`));
