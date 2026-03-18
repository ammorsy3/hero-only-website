const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const IMAGES_DIR = path.join(__dirname, 'images');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) fs.mkdirSync(IMAGES_DIR);

// Serve static files (HTML, CSS, JS, images)
app.use(express.static(__dirname));
app.use('/images', express.static(IMAGES_DIR));

// Return sorted list of PNG files in /images
app.get('/api/images', (req, res) => {
  const files = fs.readdirSync(IMAGES_DIR)
    .filter(f => f.toLowerCase().endsWith('.png'))
    .sort((a, b) => {
      const statA = fs.statSync(path.join(IMAGES_DIR, a));
      const statB = fs.statSync(path.join(IMAGES_DIR, b));
      return statB.mtimeMs - statA.mtimeMs; // newest first
    })
    .map(f => `/images/${f}`);

  res.json(files);
});

// Server-Sent Events — push updates when files change
const sseClients = new Set();

app.get('/api/watch', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.flushHeaders();
  res.write('data: connected\n\n');

  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// Watch images directory for changes
let debounceTimer;
fs.watch(IMAGES_DIR, () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    for (const client of sseClients) {
      client.write('data: refresh\n\n');
    }
  }, 300);
});

app.listen(PORT, () => {
  console.log(`Gallery running at http://localhost:${PORT}`);
  console.log(`Drop PNG files into the /images folder to add them to the gallery.`);
});
