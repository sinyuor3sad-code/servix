// Custom entry point that wraps the Next.js standalone server
// and serves /public files which Next.js standalone mode doesn't serve
const http = require('http');
const fs = require('fs');
const path = require('path');

const PUBLIC_DIR = path.join(__dirname, '..', '..', 'public');
const PORT = parseInt(process.env.PORT || '3002', 10);
const HOSTNAME = process.env.HOSTNAME || '0.0.0.0';

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain',
  '.xml': 'application/xml',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

// Start the original Next.js standalone server on a different port
process.env.PORT = String(PORT + 1);
process.env.HOSTNAME = '127.0.0.1';
require('./server.js');

// Create a proxy server that checks public/ first, then forwards to Next.js
const proxy = http.createServer((req, res) => {
  const pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  
  // Try public/ files first (except root / and _next paths)
  if (pathname !== '/' && !pathname.startsWith('/_next/') && !pathname.startsWith('/api/')) {
    const filePath = path.join(PUBLIC_DIR, pathname);
    try {
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        if (pathname === '/sw.js') {
          res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
          res.setHeader('Service-Worker-Allowed', '/');
        } else if (pathname === '/manifest.json') {
          res.setHeader('Cache-Control', 'public, max-age=86400');
        }
        
        res.setHeader('Content-Type', contentType);
        fs.createReadStream(filePath).pipe(res);
        return;
      }
    } catch (e) {
      // File doesn't exist, fall through to Next.js
    }
  }
  
  // Proxy to the Next.js standalone server
  const proxyReq = http.request({
    hostname: '127.0.0.1',
    port: PORT + 1,
    path: req.url,
    method: req.method,
    headers: req.headers,
  }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res);
  });
  
  proxyReq.on('error', (err) => {
    res.writeHead(502);
    res.end('Bad Gateway');
  });
  
  req.pipe(proxyReq);
});

proxy.listen(PORT, HOSTNAME, () => {
  console.log(`> SERVIX Admin proxy on ${HOSTNAME}:${PORT} → Next.js on 127.0.0.1:${PORT + 1}`);
});
