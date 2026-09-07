// Offline obal.
//
// Všechno bere nejdřív ze sítě a cache slouží jen jako záloha pro chvíle bez
// signálu. Opačné pořadí (cache první) je rychlejší, ale znamená, že po
// nahrání opravy vidí telefon dál starou verzi, dokud někdo nezvýší číslo
// cache. Tahle aplikace je malá, takže se ta rychlost stejně neprojeví,
// a "opravil jsem to, ale synovi to pořád padá" je horší problém.
const CACHE = 'slovicka-v2';
const FILES = ['./', './index.html', './kontrola.html', './style.css', './app.js',
               './manifest.webmanifest'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return r;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
