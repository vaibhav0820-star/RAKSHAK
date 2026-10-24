const fs = require('fs');
const path = require('path');
const https = require('https');

function lon2tile(lon, zoom) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, zoom));
}
function lat2tile(lat, zoom) {
  return Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
}

const TILE_DIR = path.join(__dirname, '..', 'data', 'tiles');

async function downloadTile(z, x, y) {
  const dir = path.join(TILE_DIR, String(z), String(x));
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${y}.png`);
  if (fs.existsSync(file)) return true;

  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
  return new Promise((resolve) => {
    https.get(url, { headers: { 'User-Agent': 'RAKSHAK-Emergency-Mesh/1.0' } }, (res) => {
      if (res.statusCode === 200) {
        const stream = fs.createWriteStream(file);
        res.pipe(stream);
        stream.on('finish', () => resolve(true));
      } else {
        resolve(false);
      }
    }).on('error', () => resolve(false));
  });
}

async function cacheArea() {
  const lat = 23.23, lon = 77.42; // Bhopal central disaster response test area
  let count = 0;
  for (let z of [11, 12, 13, 14]) {
    const cx = lon2tile(lon, z);
    const cy = lat2tile(lat, z);
    const radius = z <= 12 ? 2 : 3;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        const ok = await downloadTile(z, cx + dx, cy + dy);
        if (ok) count++;
      }
    }
  }
  console.log(`Pre-cached ${count} offline OpenStreetMap tiles into ${TILE_DIR}`);
}

cacheArea().catch(console.error);
