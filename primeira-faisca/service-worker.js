const CACHE='primeira-faisca-v15-2';
const CORE=[
  './','./index.html','./manifest.webmanifest','./icon.svg',
  './style-v8.css?v=8.5','./style-v8-2.css?v=8.5','./style-v15.css?v=15.0',
  './data-cards-v3.js?v=8.5','./data-tarot-v3.js?v=8.5','./app-v8.js?v=8.5',
  './local-ai-v8-5.js?v=8.5','./app-v15.js?v=15.1'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  await Promise.allSettled(CORE.map(async asset=>{
    const response=await fetch(asset,{cache:'reload'});
    if(response.ok)await cache.put(asset,response);
  }));
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)));
  await self.clients.claim();
})()));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  const url=new URL(request.url);
  if(url.origin!==location.origin)return;
  if(request.mode==='navigate'){
    event.respondWith(fetch(request,{cache:'no-store'}).then(response=>{
      if(response.ok)caches.open(CACHE).then(cache=>cache.put('./index.html',response.clone()));
      return response;
    }).catch(()=>caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(request).then(cached=>{
    const network=fetch(request).then(response=>{
      if(response.ok&&/\.(?:js|css|svg|webmanifest)$/i.test(url.pathname))caches.open(CACHE).then(cache=>cache.put(request,response.clone()));
      return response;
    });
    if(cached){event.waitUntil(network.then(()=>undefined).catch(()=>undefined));return cached;}
    return network.catch(()=>caches.match('./index.html'));
  }));
});