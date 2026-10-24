const C="rakshak-v2",A=["./","index.html","admin.html","manifest.webmanifest","sync.js","ai-core.js","assistant.js","kb.json","leaflet/leaflet.css","leaflet/leaflet.js","icons/icon-192.png","icons/icon-512.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(A)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==C).map(x=>caches.delete(x)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{if(e.request.method!=="GET"||new URL(e.request.url).pathname.startsWith("/api"))return;
e.respondWith(fetch(e.request).then(r=>{if(new URL(e.request.url).origin===location.origin){const k=r.clone();caches.open(C).then(c=>c.put(e.request,k))}return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match("index.html"))))});
