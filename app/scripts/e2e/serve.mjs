// Static server for the exported web app: /repro/lote → repro/lote.html
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(process.argv[2]);
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.ttf': 'font/ttf', '.png': 'image/png', '.ico': 'image/x-icon' };
http.createServer((req, res) => {
  const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const tries = [p, p + '.html', path.join(p, 'index.html'), '/index.html'].map((t) => path.join(root, t));
  const file = tries.find((f) => f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile());
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(8098, '127.0.0.1');
