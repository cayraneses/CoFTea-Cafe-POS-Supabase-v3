/* CoF/Tea Café POS service worker - app-shell offline support */
const VERSION='coftea-pos-offline-v5';
const APP_CACHE=`${VERSION}-app`;
const RUNTIME_CACHE=`${VERSION}-runtime`;
const APP_SHELL=[
  './',
  './index.html',
  './style.css',
  './renderer.js',
  './supabase-config.js',
  './supabase-api.js',
  './offline-adapter.js',
  './manifest.webmanifest',
  './coftea-logo-clean.png',
  './coftea-logo.png',
  './coftea-icon.png',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(APP_CACHE);
    // Cache each file independently. One optional/missing asset must never break installation.
    await Promise.allSettled(APP_SHELL.map(asset=>cache.add(new Request(asset,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('coftea-pos-')&&!k.startsWith(VERSION)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);

  // Supabase database/auth traffic must stay network-driven. IndexedDB handles offline business data.
  if(url.hostname.endsWith('.supabase.co'))return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(APP_CACHE);cache.put('./index.html',
  './style.css',fresh.clone());
        return fresh;
      }catch(_e){
        return (await caches.match('./index.html')) || (await caches.match('./')) || new Response('CoF/Tea POS is offline and the app shell is not cached yet.',{status:503,headers:{'Content-Type':'text/plain'}});
      }
    })());
    return;
  }

  // Same-origin files and the Supabase JS CDN are cache-first with background refresh.
  const cacheable=url.origin===self.location.origin || url.hostname==='cdn.jsdelivr.net';
  if(!cacheable)return;

  event.respondWith((async()=>{
    const cached=await caches.match(req);
    const update=fetch(req).then(async res=>{
      if(res && (res.ok || res.type==='opaque')){
        const cache=await caches.open(RUNTIME_CACHE);await cache.put(req,res.clone());
      }
      return res;
    }).catch(()=>null);
    if(cached){event.waitUntil(update);return cached;}
    return (await update) || new Response('',{status:504,statusText:'Offline'});
  })());
});

self.addEventListener('message',event=>{
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
