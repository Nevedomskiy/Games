import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const port = Number(process.env.PORT || 5173);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://local').pathname);
    let target = path.resolve(root, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!target.startsWith(root + path.sep) || pathname.split('/').some(segment => segment.startsWith('.')) || pathname.includes('node_modules')) { res.writeHead(403); res.end(); return; }
    if ((await stat(target)).isDirectory()) target = path.join(target, 'index.html');
    if (!(await stat(target)).isFile()) throw new Error('not a file');
    res.writeHead(200, { 'Content-Type': mime[path.extname(target)] || 'application/octet-stream', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(await readFile(target));
  } catch { res.writeHead(404); res.end('Not found'); }
});
server.listen(port, '0.0.0.0', () => console.log(`Games development server listening on port ${port}`));
