const V='oro-v3', BASE=['./','estilo.css','js/app.js','js/trampas.js','js/tramo.js','js/vision.js','js/camara.js','js/mapa.js','js/textos.js','js/teselas.js','js/zona.js','js/gps.js','js/fuentes.js','ejemplo.jpg','vendor/pbf.js','vendor/images/layers.png','vendor/images/layers-2x.png','js/diario.js','manifest.webmanifest','icono.svg','icono.png','vendor/leaflet.js','vendor/leaflet.css','vendor/fuente.woff2','vendor/ort.wasm.min.mjs','vendor/ort-wasm-simd-threaded.mjs','vendor/ort-wasm-simd-threaded.wasm','models/segformer.onnx'];
self.addEventListener('install',e=>e.waitUntil(caches.open(V).then(c=>c.addAll(BASE.map(u=>new Request(u,{cache:'reload'})))).then(()=>skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==V&&n!=='teselas').map(n=>caches.delete(n)))).then(()=>clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET')return;
 if(u.origin===location.origin){e.respondWith(caches.match(e.request,{ignoreSearch:true}).then(r=>r||fetch(e.request)));return}
 if(u.pathname==='/planet'){e.respondWith(caches.open('teselas').then(c=>fetch(e.request).then(n=>{if(n.ok)c.put(e.request,n.clone());return n}).catch(()=>c.match(e.request))));return}
 if(/tile|elevation/.test(u.hostname+u.pathname))e.respondWith(caches.open('teselas').then(async c=>{const r=await c.match(e.request);if(r)return r;const n=await fetch(e.request);
  if(n.ok||n.type==='opaque'){c.put(e.request,n.clone());c.keys().then(k=>{if(k.length>600)k.slice(0,k.length-600).forEach(q=>c.delete(q))})}return n}));
});
