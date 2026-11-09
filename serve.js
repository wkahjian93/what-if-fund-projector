// Local preview of docs/ on port 5195.
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, 'docs');
const types = {'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.pdf': 'application/pdf'};
http.createServer((req, res) => {
  if (req.url.startsWith('/__samples/')) { // local test run only: lets the browser test load a quotation from samples/
    const f = path.join(__dirname, 'samples', path.basename(decodeURIComponent(req.url.slice(11))));
    if (!fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    res.writeHead(200, {'Content-Type': 'application/pdf'}); return fs.createReadStream(f).pipe(res);
  }
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  const file = path.join(root, rel);
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, {'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store'});
  fs.createReadStream(file).pipe(res);
}).listen(5195, '127.0.0.1', () => console.log('http://localhost:5195'));
