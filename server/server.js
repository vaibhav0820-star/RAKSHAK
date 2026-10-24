// RAKSHAK Emergency Coordination Hub: Static PWA + REST API + SQLite + Live SSE Events
const express = require('express'), fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), https = require('https');
try {
  const envPath = path.join(__dirname, '..', '.env');
  if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') process.loadEnvFile(envPath);
} catch (e) {}
const PORT = +process.env.PORT || 3000, SPORT = +process.env.HTTPS_PORT || 3443, PIN = process.env.ADMIN_PIN || '';
const DATA = path.join(__dirname, '..', 'data'); fs.mkdirSync(DATA, { recursive: true });

let DatabaseSync;
try {
  ({ DatabaseSync } = require('node:sqlite'));
} catch (e) {
  console.error('\nRAKSHAK requires Node.js 22.13 or newer (built-in SQLite). Found ' + process.version + '. Download LTS from https://nodejs.org\n');
  process.exit(1);
}

// Use rakshak.db; transparently migrate from legacy safehaven.db if present
const DB_PATH = path.join(DATA, 'rakshak.db');
const LEGACY_DB = path.join(DATA, 'safehaven.db');
if (!fs.existsSync(DB_PATH) && fs.existsSync(LEGACY_DB)) {
  try { fs.copyFileSync(LEGACY_DB, DB_PATH); console.log('  Migrated legacy safehaven.db → rakshak.db'); } catch(e) {}
}
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode=WAL');

// Base Documents Table (for live synced states)
db.exec(`
CREATE TABLE IF NOT EXISTS docs(
  path TEXT PRIMARY KEY,
  coll TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS i_coll ON docs(coll);

CREATE TABLE IF NOT EXISTS shelters(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  med INTEGER DEFAULT 0,
  kits INTEGER DEFAULT 0,
  mat INTEGER DEFAULT 0,
  water INTEGER DEFAULT 0,
  food INTEGER DEFAULT 0,
  beds INTEGER DEFAULT 0,
  la REAL,
  lo REAL
);

CREATE TABLE IF NOT EXISTS supply_requests(
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  name TEXT NOT NULL,
  item TEXT NOT NULL,
  qty INTEGER NOT NULL,
  urgency TEXT NOT NULL,
  shelter TEXT NOT NULL,
  room TEXT,
  status TEXT NOT NULL,
  notes TEXT,
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS i_sup_uid ON supply_requests(uid);

CREATE TABLE IF NOT EXISTS loc_history(
  uid TEXT NOT NULL,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  acc REAL,
  ts INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS i_loc_uid ON loc_history(uid);

CREATE TABLE IF NOT EXISTS health_records(
  id TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  bp TEXT,
  temp REAL,
  pulse INTEGER,
  spo2 INTEGER,
  sugar INTEGER,
  notes TEXT,
  created INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS i_hr_uid ON health_records(uid);
`);

// Seamlessly migrate legacy schemas if missing new columns
try { db.exec('ALTER TABLE shelters ADD COLUMN water INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE shelters ADD COLUMN food INTEGER DEFAULT 0'); } catch(e){}
try { db.exec('ALTER TABLE shelters ADD COLUMN beds INTEGER DEFAULT 0'); } catch(e){}

// Seed default relief shelters with water, food, beds, and medical kits
if (!db.prepare('SELECT COUNT(*) c FROM shelters').get().c) {
  const ins = db.prepare('INSERT INTO shelters(name, med, kits, mat, water, food, beds, la, lo) VALUES(?,?,?,?,?,?,?,?,?)');
  [
    ['MANIT Community Relief Hub', 3, 25, 8, 450, 320, 50, 23.2156, 77.4094],
    ['District Hospital Emergency Annex', 8, 40, 15, 800, 600, 95, 23.2599, 77.4126],
    ['Govt Relief School Camp', 1, 35, 3, 300, 250, 40, 23.2332, 77.4300]
  ].forEach(r => ins.run(...r));
}

const q = {
  get: db.prepare('SELECT data FROM docs WHERE path=?'),
  col: db.prepare('SELECT id, data FROM docs WHERE coll=?'),
  put: db.prepare('INSERT INTO docs(path, coll, id, data, updated) VALUES(?,?,?,?,?) ON CONFLICT(path) DO UPDATE SET data=excluded.data, updated=excluded.updated'),
  del: db.prepare('DELETE FROM docs WHERE path=?')
};

const clients = new Set();
const emit = m => {
  const s = 'data: ' + JSON.stringify(m) + '\n\n';
  clients.forEach(r => r.write(s));
};
setInterval(() => clients.forEach(r => r.write(': ping\n\n')), 25000);

const app = express();
app.use((req, res, next) => {
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'content-type,x-uid,x-admin-pin',
    'Access-Control-Allow-Methods': 'GET,PUT,PATCH,POST,DELETE,OPTIONS'
  });
  req.method === 'OPTIONS' ? res.sendStatus(204) : next();
});
app.use(express.json({ limit: '1mb' }));

const split = p => {
  const i = p.lastIndexOf('/');
  return [p.slice(0, i), p.slice(i + 1)];
};

// Health data privacy: only accessible by owning device
const own = (p, uid) => {
  const m = p.match(/^data\/users\/([^/]+)/);
  return !m || m[1] === uid;
};

const admin = (req, res, next) => PIN && req.get('x-admin-pin') !== PIN ? res.status(401).json({ error: 'pin' }) : next();

// Server-Sent Events (Live mesh synchronization)
app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.add(res);
  req.on('close', () => clients.delete(res));
});

// Generic Collection and Document sync endpoints
app.get('/api/col', (req, res) => {
  const c = String(req.query.c || '');
  if (!own(c, req.get('x-uid'))) return res.sendStatus(403);
  res.json(q.col.all(c).map(r => ({ id: r.id, data: JSON.parse(r.data) })));
});

app.get('/api/doc', (req, res) => {
  const p = String(req.query.p || '');
  if (!own(p, req.get('x-uid'))) return res.sendStatus(403);
  const r = q.get.get(p);
  r ? res.json(JSON.parse(r.data)) : res.sendStatus(404);
});

const writeDoc = (req, res, merge) => {
  const p = String(req.query.p || ''), uid = req.get('x-uid') || '';
  if (!p.includes('/') || !own(p, uid)) return res.sendStatus(403);
  if (!merge && p.startsWith('sos/') && p !== 'sos/' + uid) return res.sendStatus(403);
  const [c, id] = split(p), old = q.get.get(p);
  let d = req.body || {};
  if (merge && old) d = { ...JSON.parse(old.data), ...d };
  q.put.run(p, c, id, JSON.stringify(d), Date.now());
  emit({ p });
  res.json(d);
};

app.put('/api/doc', (req, res) => writeDoc(req, res, false));
app.patch('/api/doc', (req, res) => writeDoc(req, res, true));
app.delete('/api/doc', (req, res) => {
  const p = String(req.query.p || '');
  if (!own(p, req.get('x-uid') || '')) return res.sendStatus(403);
  q.del.run(p);
  emit({ p });
  res.sendStatus(204);
});

// Real-time location update from SOS-active devices
app.post('/api/location', (req, res) => {
  const uid = req.get('x-uid') || '';
  if (!uid) return res.sendStatus(403);
  const { lat, lng, acc } = req.body || {};
  if (typeof lat !== 'number' || typeof lng !== 'number') return res.status(400).json({ error: 'lat/lng required' });
  const docData = { lat, lng, acc: acc || 0, ts: Date.now(), uid };
  q.put.run('loc/' + uid, 'loc', uid, JSON.stringify(docData), Date.now());
  db.prepare('INSERT INTO loc_history(uid, lat, lng, acc, ts) VALUES(?,?,?,?,?)').run(uid, lat, lng, acc || 0, Date.now());
  // Keep rolling 30 coords per victim
  db.prepare('DELETE FROM loc_history WHERE uid=? AND ts < (SELECT ts FROM loc_history WHERE uid=? ORDER BY ts DESC LIMIT 1 OFFSET 29)').run(uid, uid);
  emit({ t: 'loc', uid, lat, lng, acc });
  res.json({ ok: true });
});

// Latest live locations for admin map
app.get('/api/locations', (req, res) => {
  const locs = q.col.all('loc').map(r => JSON.parse(r.data));
  res.json(locs);
});

// Victim movement trail history for map polyline
app.get('/api/location/history/:uid', (req, res) => {
  const rows = db.prepare('SELECT lat, lng, acc, ts FROM loc_history WHERE uid=? ORDER BY ts ASC').all(req.params.uid);
  res.json(rows);
});

// Daily Health Records API
app.get('/api/health', (req, res) => {
  const uid = req.get('x-uid');
  if (!uid) return res.json([]);
  const rows = db.prepare('SELECT * FROM health_records WHERE uid=? ORDER BY created DESC').all(uid);
  res.json(rows);
});

app.post('/api/health', (req, res) => {
  const uid = req.get('x-uid');
  if (!uid) return res.sendStatus(403);
  const b = req.body || {};
  const id = 'hr_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  db.prepare('INSERT INTO health_records(id, uid, bp, temp, pulse, spo2, sugar, notes, created) VALUES(?,?,?,?,?,?,?,?,?)').run(
    id,
    uid,
    String(b.bp || ''),
    b.temp ? +b.temp : null,
    b.pulse ? +b.pulse : null,
    b.spo2 ? +b.spo2 : null,
    b.sugar ? +b.sugar : null,
    String(b.notes || ''),
    Date.now()
  );
  res.json({ ok: true, id });
});

// Offline OpenStreetMap Tile Server
const TILES_DIR = path.join(DATA, 'tiles');
app.get('/api/tiles/:z/:x/:y.png', async (req, res) => {
  const { z, x, y } = req.params;
  const tileFile = path.join(TILES_DIR, z, x, `${y}.png`);

  if (fs.existsSync(tileFile)) {
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return fs.createReadStream(tileFile).pipe(res);
  }

  // Attempt online fetch and cache if connection exists
  try {
    const upstream = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;
    const r = await fetch(upstream, {
      signal: AbortSignal.timeout(2000),
      headers: { 'User-Agent': 'RAKSHAK-Disaster-Mesh/1.0' }
    });
    if (r.ok) {
      const buf = Buffer.from(await r.arrayBuffer());
      fs.mkdirSync(path.dirname(tileFile), { recursive: true });
      fs.writeFileSync(tileFile, buf);
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buf);
    }
  } catch (e) {}

  // High-aesthetic SVG fallback tile (offline dark grid)
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.send(`<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
    <rect width="256" height="256" fill="#111622"/>
    <path d="M0 0h256v256H0z" fill="none" stroke="#1e293b" stroke-width="1"/>
    <path d="M64 0v256M128 0v256M192 0v256M0 64h256M0 128h256M0 192h256" stroke="#172033" stroke-width="0.5"/>
    <circle cx="128" cy="128" r="2" fill="#ef4444" opacity="0.4"/>
    <text x="10" y="22" fill="#475569" font-family="system-ui, sans-serif" font-size="10" font-weight="bold">RAKSHAK MESH</text>
    <text x="10" y="38" fill="#334155" font-family="monospace" font-size="9">z${z} ${x},${y}</text>
  </svg>`);
});

// Mount Gemma 4 AI endpoints
require('./ai')(app);

// Shelters & Supplies API
const shl = () => db.prepare('SELECT * FROM shelters ORDER BY id').all();
app.get('/api/shelters', (req, res) => res.json(shl()));

const saveShelter = (req, res) => {
  const b = req.body || {};
  const v = [
    String(b.name || 'Shelter'),
    +b.med || 0,
    +b.kits || 0,
    +b.mat || 0,
    +b.water || 0,
    +b.food || 0,
    +b.beds || 0,
    +b.la || 0,
    +b.lo || 0
  ];
  if (req.params.id) {
    db.prepare('UPDATE shelters SET name=?, med=?, kits=?, mat=?, water=?, food=?, beds=?, la=?, lo=? WHERE id=?').run(...v, req.params.id);
  } else {
    db.prepare('INSERT INTO shelters(name, med, kits, mat, water, food, beds, la, lo) VALUES(?,?,?,?,?,?,?,?,?)').run(...v);
  }
  emit({ t: 'shelters' });
  res.json(shl());
};

app.post('/api/shelters', admin, saveShelter);
app.put('/api/shelters/:id', admin, saveShelter);
app.delete('/api/shelters/:id', admin, (req, res) => {
  db.prepare('DELETE FROM shelters WHERE id=?').run(req.params.id);
  emit({ t: 'shelters' });
  res.json(shl());
});

// Quick Volunteer stock increment/decrement
app.patch('/api/shelters/:id/stock', (req, res) => {
  const { field, delta } = req.body || {};
  const validFields = ['med', 'kits', 'mat', 'water', 'food', 'beds'];
  if (!validFields.includes(field) || typeof delta !== 'number') {
    return res.status(400).json({ error: 'Invalid field or delta' });
  }
  db.prepare(`UPDATE shelters SET ${field} = MAX(0, ${field} + ?) WHERE id = ?`).run(delta, req.params.id);
  emit({ t: 'shelters' });
  res.json(shl());
});

// Supply Requests API (Module 2: Users request items from phone, volunteers fulfill)
app.get('/api/supplies/requests', (req, res) => {
  const uid = req.get('x-uid');
  const isAdmin = !PIN || req.get('x-admin-pin') === PIN;
  let rows;
  if (isAdmin || req.query.all === '1') {
    rows = db.prepare('SELECT * FROM supply_requests ORDER BY created DESC').all();
  } else if (uid) {
    rows = db.prepare('SELECT * FROM supply_requests WHERE uid=? ORDER BY created DESC').all(uid);
  } else {
    rows = [];
  }
  res.json(rows);
});

app.post('/api/supplies/request', (req, res) => {
  const b = req.body || {};
  const uid = req.get('x-uid') || 'anon';
  const id = 'req_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const ins = db.prepare('INSERT INTO supply_requests(id, uid, name, item, qty, urgency, shelter, room, status, notes, created, updated) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)');
  ins.run(
    id,
    uid,
    String(b.name || 'Anonymous'),
    String(b.item || 'General Supplies'),
    Math.max(1, +b.qty || 1),
    String(b.urgency || 'Standard'),
    String(b.shelter || 'Nearest Hub'),
    String(b.room || ''),
    'Pending',
    String(b.notes || ''),
    Date.now(),
    Date.now()
  );
  emit({ t: 'supplies', id });
  res.json({ id, status: 'Pending' });
});

app.patch('/api/supplies/requests/:id', (req, res) => {
  const { status, notes } = req.body || {};
  if (!status) return res.status(400).json({ error: 'Status required' });
  db.prepare('UPDATE supply_requests SET status=?, notes=COALESCE(?, notes), updated=? WHERE id=?').run(status, notes || null, Date.now(), req.params.id);
  emit({ t: 'supplies', id: req.params.id });
  res.json({ ok: true, id: req.params.id, status });
});

app.delete('/api/supplies/requests/:id', admin, (req, res) => {
  db.prepare('DELETE FROM supply_requests WHERE id=?').run(req.params.id);
  emit({ t: 'supplies', id: req.params.id });
  res.sendStatus(204);
});

// Admin Overview & Control Console
app.get('/api/admin/overview', admin, (req, res) => {
  const all = db.prepare('SELECT path, coll, id, data, updated FROM docs').all();
  const supplyReqs = db.prepare('SELECT * FROM supply_requests ORDER BY created DESC').all();
  const locs = all.filter(r => r.coll === 'loc').map(r => JSON.parse(r.data));
  const health = db.prepare('SELECT * FROM health_records ORDER BY created DESC LIMIT 50').all();
  res.json({
    shelters: shl(),
    sos: all.filter(r => r.coll === 'sos').map(r => ({ id: r.id, ...JSON.parse(r.data) })),
    supplies: supplyReqs,
    locations: locs,
    health,
    docs: all.length
  });
});

app.delete('/api/admin/sos/:id', admin, (req, res) => {
  q.del.run('sos/' + req.params.id);
  q.del.run('loc/' + req.params.id);
  emit({ p: 'sos/' + req.params.id });
  res.sendStatus(204);
});

app.delete('/api/admin/user/:uid', admin, (req, res) => {
  db.prepare('DELETE FROM docs WHERE coll=? OR path=?').run('data/users/' + req.params.uid, 'sos/' + req.params.uid);
  db.prepare('DELETE FROM supply_requests WHERE uid=?').run(req.params.uid);
  db.prepare('DELETE FROM loc_history WHERE uid=?').run(req.params.uid);
  db.prepare('DELETE FROM health_records WHERE uid=?').run(req.params.uid);
  q.del.run('loc/' + req.params.uid);
  emit({ p: 'sos/' + req.params.uid });
  emit({ t: 'supplies' });
  res.sendStatus(204);
});

app.get('/api/admin/export', admin, (req, res) => {
  res.attachment('rakshak-export.json').json({
    platform: 'RAKSHAK Emergency Coordination Platform',
    exported: new Date().toISOString(),
    shelters: shl(),
    supplies: db.prepare('SELECT * FROM supply_requests').all(),
    health: db.prepare('SELECT * FROM health_records').all(),
    locations: db.prepare('SELECT * FROM loc_history').all(),
    docs: db.prepare('SELECT path, data, updated FROM docs').all().map(r => ({ ...r, data: JSON.parse(r.data) }))
  });
});

// Static App Files (with PWA service-worker cache headers)
app.use(express.static(path.join(__dirname, '..', 'www'), {
  setHeaders: (r, f) => {
    if (f.endsWith('sw.js')) r.setHeader('Cache-Control', 'no-cache');
  }
}));

// Network interfaces & Self-signed TLS (Allows phone camera/GPS without internet)
const ips = Object.values(os.networkInterfaces()).flat().filter(i => i.family === 'IPv4' && !i.internal).map(i => i.address);
http.createServer(app).listen(PORT, '0.0.0.0');

let cert;
try {
  const f = path.join(DATA, 'cert.json'), c = fs.existsSync(f) && JSON.parse(fs.readFileSync(f));
  if (process.env.TLS_KEY && process.env.TLS_CERT) {
    cert = { private: fs.readFileSync(process.env.TLS_KEY), cert: fs.readFileSync(process.env.TLS_CERT) };
  } else if (c && c.ips === ips.join()) {
    cert = c;
  } else {
    const alt = [{ type: 2, value: 'localhost' }, ...ips.map(ip => ({ type: 7, ip }))];
    cert = require('selfsigned').generate([{ name: 'commonName', value: 'RAKSHAK' }], {
      days: 825,
      keySize: 2048,
      algorithm: 'sha256',
      extensions: [{ name: 'subjectAltName', altNames: alt }]
    });
    cert = { private: cert.private, cert: cert.cert, ips: ips.join() };
    fs.writeFileSync(f, JSON.stringify(cert));
  }
  https.createServer({ key: cert.private, cert: cert.cert }, app).listen(SPORT, '0.0.0.0');
} catch (e) {
  console.log('HTTPS disabled:', e.message);
}

console.log('\n======================================================');
console.log('  🛡️  RAKSHAK Local Emergency Coordination Hub Running');
console.log('======================================================');
console.log('  Primary AI Engine : gemma4:e2b (Ollama local)');
console.log('  Laptop Operator   : http://localhost:' + PORT);
console.log('  Admin Dashboard   : http://localhost:' + PORT + '/admin.html' + (PIN ? ' (PIN protected)' : ''));
ips.forEach(ip => {
  console.log('  Mobile Network    : https://' + ip + ':' + SPORT + '   (Phones: GPS + Triage)');
  console.log('                      http://' + ip + ':' + PORT);
});
console.log('======================================================\n');

if (ips[0]) {
  try {
    require('qrcode-terminal').generate('https://' + ips[0] + ':' + SPORT, { small: true });
  } catch (e) {}
}
