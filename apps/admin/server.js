const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const path = require('path');
const fs = require('fs');

const app = next({ dir: path.join(__dirname), dev: false });
const handle = app.getRequestHandler();

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

app.prepare().then(() => {
  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Try to serve from public/ first
    if (pathname !== '/' && !pathname.startsWith('/_next/') && !pathname.startsWith('/api/')) {
      const publicPath = path.join(PUBLIC_DIR, pathname);
      if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
        const ext = path.extname(publicPath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        // Special headers for SW
        if (pathname === '/sw.js') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Service-Worker-Allowed', '/');
        } else if (pathname === '/manifest.json') {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(publicPath).pipe(res);
        return;
      }
    }

    // Fall through to Next.js
    handle(req, res, parsedUrl);
  }).listen(process.env.PORT || 3002, process.env.HOSTNAME || '0.0.0.0', () => {
    console.log(`> SERVIX Admin ready on port ${process.env.PORT || 3002}`);
  });
});
