const CACHE='words-shell-v113';
const SHELL=['./','./index.html','./streak.js','./manifest.webmanifest','./icon-words-v3-180.png','./icon-words-v3-512.png','./launch-cards.webp','./achievements/first.webp','./achievements/student.webp','./achievements/rhythm.webp','./achievements/practice.webp','./achievements/habit.webp','./achievements/speaker.webp','./achievements/explorer.webp','./achievements/linguist.webp','./achievements/master.webp','./achievements/expert.webp','./achievements/legend.webp','./achievements/locked-1.webp','./achievements/locked-3.webp','./achievements/locked-7.webp','./achievements/locked-14.webp','./achievements/locked-21.webp','./achievements/locked-30.webp','./achievements/locked-50.webp','./achievements/locked-75.webp','./achievements/locked-100.webp','./achievements/locked-180.webp','./achievements/locked-365.webp'];
SHELL.push('./launch-branch.webp');
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==location.origin)return;
  if(event.request.mode==='navigate'){
    const network=fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put('./index.html',copy));}return response});
    event.respondWith(Promise.race([network,new Promise(resolve=>setTimeout(()=>resolve(caches.match('./index.html')),1800))]).then(response=>response||network).catch(()=>caches.match('./index.html')));
    event.waitUntil(network.catch(()=>{}));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||caches.match(new URL(event.request.url).pathname.endsWith('/')?'./index.html':event.request).then(shell=>{
    const network=fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response});
    if(shell){event.waitUntil(network.catch(()=>{}));return shell;}
    return network.catch(()=>caches.match('./index.html'));
  })));
});
self.addEventListener('notificationclick',event=>{event.notification.close();event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>list.length?list[0].focus():clients.openWindow('./')))});
