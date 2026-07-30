const CACHE='primeira-faisca-v14-0';
const ASSETS=[
  './','./index.html','./manifest.webmanifest','./icon.svg',
  './style-v8.css?v=8.5','./style-v8-2.css?v=8.5','./visual-v9.css?v=10.0','./design-v11.css?v=11.0','./design-v12.css?v=12.0','./design-v13.css?v=14.0','./design-v13-1.css?v=13.1','./design-v14.css?v=14.0',
  './assets/spark-orbit.svg?v=9.0','./assets/grain-v9.svg',
  './data-cards-v3.js?v=8.5','./data-tarot-v3.js?v=8.5','./app-v8.js?v=8.5',
  './local-ai-v8-5.js?v=14.0','./agent-v10.js?v=14.0','./design-v11.js?v=14.0','./ai-transport-guard-v11.js?v=14.0','./design-runtime-guard-v11.js?v=14.0',
  './gpt-oss-engine-v13.js?v=14.0','./design-v13.js?v=14.0','./floating-agent-v13.js?v=14.0','./browser-model-studio-v14.js?v=14.0','./runtime-repair-v14.js?v=14.0',
  './local-gpt-oss/start-faisca-ai.bat'
];
self.addEventListener('install',event=>event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  for(const asset of ASSETS){
    try{const response=await fetch(asset,{cache:'reload'});if(response.ok)await cache.put(asset,response);}catch{}
  }
  await self.skipWaiting();
})()));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==location.origin)return;
  event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{
    if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}
    return response;
  }).catch(()=>caches.match(event.request).then(cached=>cached||caches.match('./index.html'))));
});