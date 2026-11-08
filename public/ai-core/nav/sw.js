const CACHE='izakhono-nav-v2';
const CORE=['./','./index.html','./manifest.webmanifest','./health.json'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(CORE)).then(()=>self.skipWaiting()));
});

self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys()
    .then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});

// Offline map downloads are explicit: only same-origin owned NAV tile URLs
// are accepted, bounded to the route corridor limit used by the client.
self.addEventListener('message',event=>{
  const data=event.data||{};
  if(data.type!=='CACHE_URLS'||!Array.isArray(data.urls))return;
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    const urls=[...new Set(data.urls)].slice(0,1200);
    let saved=0;
    for(const value of urls){
      let url;
      try{url=new URL(value,self.location.origin);}catch{continue;}
      if(url.origin!==self.location.origin||!url.pathname.startsWith('/tiles/'))continue;
      try{
        const response=await fetch(url,{cache:'no-store'});
        if(response.ok&&response.type!=='opaque'){
          await cache.put(url,response.clone());
          saved++;
        }
      }catch{}
    }
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
    for(const client of clients)client.postMessage({type:'CACHE_URLS_RESULT',requested:urls.length,saved});
  })());
});

self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;

  // Never cache API responses, health probes or runtime identity.
  if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/v1/')||
     url.pathname==='/health'||url.pathname==='/tiles/health')return;

  if(url.pathname.startsWith('/tiles/')){
    event.respondWith((async()=>{
      const cache=await caches.open(CACHE);
      const saved=await cache.match(request);
      if(saved)return saved;
      return fetch(request);
    })());
    return;
  }

  if(request.mode==='navigate'){
    event.respondWith(fetch(request).catch(()=>caches.match('./index.html')));
    return;
  }

  event.respondWith(caches.match(request).then(hit=>hit||fetch(request).then(response=>{
    if(response.ok){
      const copy=response.clone();
      caches.open(CACHE).then(cache=>cache.put(request,copy)).catch(()=>{});
    }
    return response;
  })));
});
