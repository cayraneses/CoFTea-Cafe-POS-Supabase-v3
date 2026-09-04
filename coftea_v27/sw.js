const CACHE='coftea-pos-v1';
const ASSETS=['./','./index.html','./style.css','./renderer.js','./supabase-config.js','./supabase-api.js','./coftea-logo-clean.png','./coftea-icon.png','./manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin===location.origin)e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(x=>{const c=x.clone();caches.open(CACHE).then(cache=>cache.put(e.request,c));return x})));});
