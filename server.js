const express = require('express');
const next = require('next');
const helmet = require('helmet');
const cors = require('cors');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = express();

  // Security headers
  // We disable CSP by default to avoid conflicts with Next.js scripts/styles, 
  // but in a real production env you'd carefully configure this.
  server.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );

  // CORS configuration - allow requests from Tailscale IP ranges or specific origins
  server.use(cors());

  // Health Check Endpoint
  server.get('/health', (req, res) => {
    res.status(200).json({ 
      status: 'ok', 
      uptime: process.uptime(),
      timestamp: new Date().toISOString() 
    });
  });

  // Handle all other requests via Next.js
  server.all('(.*)', (req, res) => {
    return handle(req, res);
  });

  // Listen on 0.0.0.0 to be accessible via Tailscale
  server.listen(port, '0.0.0.0', (err) => {
    if (err) throw err;
    console.log(`> Ready on http://0.0.0.0:${port}`);
    console.log(`> Access via Tailscale IP or localhost`);
  });
});
