const CACHE='words-shell-v46';
const SHELL=['./','./index.html','./streak.js','./manifest.webmanifest','./icon-words-v3-180.png','./icon-words-v3-512.png','./achievements/first.webp','./achievements/student.webp','./achievements/rhythm.webp','./achievements/practice.webp','./achievements/habit.webp','./achievements/speaker.webp','./achievements/explorer.webp','./achievements/linguist.webp','./achievements/master.webp','./achievements/expert.webp','./achievements/legend.webp'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  event.respondWith(fetch(event.request).then(response=>{const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));return response}).catch(()=>caches.match(event.request).then(response=>response||caches.match('./index.html'))));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list.length?list[0].focus():clients.openWindow('./')))});
