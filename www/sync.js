// Connects the app to the RAKSHAK Emergency Coordination Hub (live SSE sync + offline cache).
// Operates zero-internet over local Wi-Fi mesh on standard mobile browsers.
(function () {
  const NATIVE = location.hostname === 'localhost' && !location.port;
  window.SHNATIVE = NATIVE;
  if (window.claude) return;

  let uid = null, BASE = '';
  try {
    uid = localStorage.getItem('rakshak_uid') || localStorage.getItem('shuid');
    if (NATIVE) BASE = localStorage.getItem('rakshak_server') || localStorage.getItem('shserver') || '';
  } catch (e) {}

  if (!uid) {
    uid = 'r_' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
    try {
      localStorage.setItem('rakshak_uid', uid);
    } catch (e) {}
  }

  window.SHBASE = () => BASE;
  window.RAKSHAK_UID = () => uid;

  const api = async (m, u, b) => {
    const c = new AbortController(), t = setTimeout(() => c.abort(), 8000);
    try {
      const r = await fetch(BASE + u, {
        method: m,
        signal: c.signal,
        headers: {
          'content-type': 'application/json',
          'x-uid': uid
        },
        body: b === undefined ? undefined : JSON.stringify(b)
      });
      if (!r.ok) throw new Error(r.status);
      return r.status === 204 ? null : r.json();
    } finally {
      clearTimeout(t);
    }
  };

  const E = encodeURIComponent, subs = [];
  let es = null, down = false;

  const fire = s =>
    s.k === 'doc'
      ? api('GET', '/api/doc?p=' + E(s.p)).then(
          d => s.cb({ exists: true, data: () => d }),
          e => { if (e.message === '404') s.cb({ exists: false, data: () => null }); }
        )
      : api('GET', '/api/col?c=' + E(s.p)).then(
          l => s.cb({ docs: l.map(x => ({ id: x.id, data: () => x.data })) }),
          () => {}
        );

  const doc = p => ({
    set: v => api('PUT', '/api/doc?p=' + E(p), v),
    update: v => api('PATCH', '/api/doc?p=' + E(p), v),
    delete: () => api('DELETE', '/api/doc?p=' + E(p)),
    onSnapshot(cb) {
      const s = { k: 'doc', p, cb };
      subs.push(s);
      fire(s);
    }
  });

  const col = c => ({
    doc: id => doc(c + '/' + id),
    onSnapshot(cb) {
      const s = { k: 'col', p: c, cb };
      subs.push(s);
      fire(s);
    }
  });

  async function shelters() {
    try {
      const l = await api('GET', '/api/shelters');
      const m = l.map(s => ({
        id: s.id,
        n: s.name,
        med: s.med,
        kits: s.kits,
        mat: s.mat,
        water: s.water || 0,
        food: s.food || 0,
        beds: s.beds || 0,
        la: s.la,
        lo: s.lo
      }));
      if (window.SH) SH.splice(0, SH.length, ...m);
      localStorage.setItem('shsh', JSON.stringify(m));
      if (typeof render === 'function') render();
    } catch (e) {}
  }

  async function syncSupplies() {
    if (typeof loadSupplies === 'function') {
      await loadSupplies();
      if (typeof render === 'function') render();
    }
  }

  function conn() {
    if (es) return;
    es = new EventSource(BASE + '/api/events');
    es.onopen = () => {
      if (down) {
        down = false;
        dispatchEvent(new Event('online'));
      }
      subs.forEach(fire);
      shelters();
      syncSupplies();
    };
    es.onerror = () => {
      if (!down) {
        down = true;
        dispatchEvent(new Event('offline'));
      }
    };
    es.onmessage = e => {
      try {
        const m = JSON.parse(e.data);
        if (m.t === 'shelters') return shelters();
        if (m.t === 'supplies') return syncSupplies();
        if (m.t === 'loc') {
          if (typeof onLiveLocationUpdate === 'function') onLiveLocationUpdate(m);
        }
        if (!m.p) return;
        const c = m.p.slice(0, m.p.lastIndexOf('/'));
        subs.forEach(s => {
          if ((s.k === 'doc' && s.p === m.p) || (s.k === 'col' && s.p === c)) fire(s);
        });
      } catch (err) {}
    };
  }

  window.claude = {
    use: async n => {
      if (n === 'user') return { id: async () => uid };
      if (n === 'db') {
        if (NATIVE && !BASE) return null;
        conn();
        return { collection: col, doc };
      }
    }
  };

  // RAKSHAK Client API Helpers
  window.RAKSHAK_API = {
    sendLocation: async (lat, lng, acc) => api('POST', '/api/location', { lat, lng, acc }),
    getLocations: async () => api('GET', '/api/locations'),
    getLocationHistory: async (userId) => api('GET', `/api/location/history/${userId}`),
    saveHealthRecord: async (data) => api('POST', '/api/health', data),
    getHealthRecords: async () => api('GET', '/api/health'),
    requestSupply: async (data) => api('POST', '/api/supplies/request', data),
    getSupplyRequests: async (all = false) => api('GET', '/api/supplies/requests' + (all ? '?all=1' : '')),
    updateSupplyRequest: async (id, status, notes) => api('PATCH', `/api/supplies/requests/${id}`, { status, notes }),
    quickStockUpdate: async (shelterId, field, delta) => api('PATCH', `/api/shelters/${shelterId}/stock`, { field, delta })
  };

  if (NATIVE) {
    const norm = v => {
      v = v.trim().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      if (!v) return '';
      if (!/:\d+$/.test(v)) v += ':3000';
      return 'http://' + v;
    };
    const btn = 'padding:10px 14px;border-radius:10px;border:1px solid #ef4444;font:inherit;cursor:pointer;';
    function setup() {
      if (document.getElementById('shsetup')) return;
      const o = document.createElement('div');
      o.id = 'shsetup';
      o.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.75);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:20px;font:15px system-ui,sans-serif';
      o.innerHTML = `<div style="background:#181b24;color:#f1f5f9;border:1px solid #262b38;border-radius:16px;padding:20px;max-width:380px;width:100%;box-shadow:0 12px 30px rgba(0,0,0,.5)">
        <h3 style="margin:0 0 6px;color:#ef4444">Connect to RAKSHAK Hub</h3>
        <p style="margin:0 0 12px;color:#94a3b8;font-size:13px">Enter the local hotspot IP shown on the host laptop (e.g. 192.168.1.5:3000 or 172.168.5.54:3443).</p>
        <input id="shs" inputmode="url" autocapitalize="off" autocomplete="off" placeholder="192.168.1.5:3000" style="width:100%;box-sizing:border-box;padding:11px;background:#0f1117;border:1px solid #262b38;color:#fff;border-radius:10px;font:inherit">
        <div id="shm" style="min-height:18px;font-size:13px;color:#ef4444;margin:8px 0"></div>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button id="shc" style="${btn}background:#181b24;color:#94a3b8;border-color:#262b38">Cancel</button>
          <button id="shk" style="${btn}background:#ef4444;color:#fff;font-weight:700">Connect</button>
        </div>
      </div>`;
      document.body.appendChild(o);
      const i = o.querySelector('#shs'), m = o.querySelector('#shm');
      i.value = BASE.replace(/^https?:\/\//, '');
      o.querySelector('#shc').onclick = () => {
        try { sessionStorage.shskip = 1; } catch (e) {}
        o.remove();
      };
      o.querySelector('#shk').onclick = async () => {
        const u = norm(i.value);
        if (!u) { m.textContent = 'Enter the server address'; return; }
        m.style.color = '#94a3b8';
        m.textContent = 'Verifying local hotspot connection...';
        try {
          const c = new AbortController();
          setTimeout(() => c.abort(), 5000);
          const r = await fetch(u + '/api/shelters', { signal: c.signal });
          if (!r.ok) throw 0;
          localStorage.setItem('rakshak_server', u);
          localStorage.setItem('shserver', u);
          location.reload();
        } catch (e) {
          m.style.color = '#ef4444';
          m.textContent = 'Cannot reach ' + u + '. Make sure phone is on the laptop Wi-Fi hotspot.';
        }
      };
    }

    addEventListener('DOMContentLoaded', () => {
      const g = document.createElement('button');
      g.textContent = '\u2699';
      g.setAttribute('aria-label', 'Server settings');
      g.style.cssText = 'position:fixed;top:calc(env(safe-area-inset-top,0px) + 6px);right:8px;z-index:9998;width:32px;height:32px;border-radius:50%;border:0;background:rgba(0,0,0,.35);color:#fff;font-size:18px;line-height:32px;padding:0;cursor:pointer';
      g.onclick = setup;
      document.body.appendChild(g);
      let sk = 0;
      try { sk = sessionStorage.shskip; } catch (e) {}
      if (!BASE && !sk) setup();
    });
  }
})();
