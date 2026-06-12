// Service worker for The Order's Quest — makes the adventure work offline
// once it has been opened (handy walking around Hong Kong with patchy signal).
// CORE (page + images) is precached reliably on install; MEDIA (audio) is
// fetched best-effort in the background and also cached on demand as it plays,
// so a single missing file can never break the install. Bump CACHE to v2/v3…
// whenever assets change, to retire the old cache.
const CACHE = 'miko-quest-v4';
const CORE = [
  "./",
  "miko-quest.html",
  "assets/andrea_hat.jpg",
  "assets/andrea_plain.jpg",
  "assets/andrea_sorted.jpg",
  "assets/image_1.jpg",
  "assets/image_10.png",
  "assets/image_2.jpg",
  "assets/image_4.jpg",
  "assets/image_54.jpg",
  "assets/image_55.jpg",
  "assets/image_56.jpg",
  "assets/image_57.jpg",
  "assets/image_58.jpg",
  "assets/image_59.jpg",
  "assets/image_60.jpg",
  "assets/image_61.jpg",
  "assets/image_62.jpg",
  "assets/image_63.jpg",
  "assets/image_64.jpg",
  "assets/image_65.jpg",
  "assets/image_66.jpg",
  "assets/image_67.jpg",
  "assets/image_68.jpg",
  "assets/image_69.jpg",
  "assets/image_70.jpg",
  "assets/image_71.jpg",
  "assets/image_72.jpg",
  "assets/image_73.jpg",
  "assets/image_9.jpg",
  "assets/michael_hat.jpg",
  "assets/michael_plain.jpg",
  "assets/michael_sorted.jpg",
  "assets/mikoIcon.png",
  "assets/miko_hat.jpg",
  "assets/miko_plain.jpg",
  "assets/miko_sorted.jpg",
  "assets/voldSprite.jpg",
  "assets/voldSpriteDead.jpg"
];
const MEDIA = [
  "assets/artifact.mp3",
  "assets/audio_38.mp3",
  "assets/audio_39.mp3",
  "assets/audio_40.mp3",
  "assets/cat.mp3",
  "assets/cat_1.mp3",
  "assets/clock.mp3",
  "assets/clock_1.mp3",
  "assets/countdown.mp3",
  "assets/dimsum.mp3",
  "assets/dobby_cat_to_manmo.mp3",
  "assets/dobby_dim_sum.mp3",
  "assets/dobby_greeting.mp3",
  "assets/dobby_manmo_to_peak.mp3",
  "assets/dobby_peak_to_clock.mp3",
  "assets/finish.mp3",
  "assets/gun.mp3",
  "assets/laugh.mp3",
  "assets/letter1.mp3",
  "assets/letter2.mp3",
  "assets/magic.mp3",
  "assets/manmo.mp3",
  "assets/manmo_1.mp3",
  "assets/map_cat.mp3",
  "assets/map_clock.mp3",
  "assets/map_final.mp3",
  "assets/map_manmo.mp3",
  "assets/map_peak.mp3",
  "assets/peak.mp3",
  "assets/peak_1.mp3",
  "assets/sorting.mp3",
  "assets/sword.mp3",
  "assets/victory.mp3",
  "assets/victory_1.mp3"
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE);                 // must succeed
    // Best-effort: don't let one failed audio file abort the install.
    await Promise.allSettled(MEDIA.map((u) => cache.add(u)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// Network-first for HTML so patches land on next reload; cache-first
// for assets so offline mode (walking around HK) stays snappy.
function isHtmlRequest(request) {
  if (request.mode === 'navigate') return true;
  const url = new URL(request.url);
  return url.pathname.endsWith('.html') || url.pathname === '/' ||
         url.pathname.endsWith('/');
}
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (isHtmlRequest(event.request)) {
    event.respondWith((async () => {
      try {
        const resp = await fetch(event.request, { cache: 'no-store' });
        if (resp && resp.status === 200) {
          const cache = await caches.open(CACHE);
          cache.put(event.request, resp.clone());
        }
        return resp;
      } catch (e) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        return (await caches.match('miko-quest.html')) ||
               new Response('Offline', { status: 503 });
      }
    })());
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const resp = await fetch(event.request);
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const cache = await caches.open(CACHE);
        cache.put(event.request, resp.clone());
      }
      return resp;
    } catch (e) {
      return cached;
    }
  })());
});
