// Offline support. App files are network-first (so a new deploy shows up on
// the next load) with the cache as the offline fallback. Google Fonts are
// cache-first since their URLs are versioned.

const VERSION = 'v2';
const APP_CACHE = `kbhiit-app-${VERSION}`;
const FONT_CACHE = 'kbhiit-fonts';

const APP_FILES = [
  './',
  './index.html',
  './css/app.css',
  './js/app.js',
  './js/audio.js',
  './js/model.js',
  './js/player.js',
  './js/wakelock.js',
  './js/workouts.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=IBM+Plex+Mono:wght@400;500&display=swap';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const app = await caches.open(APP_CACHE);
      await app.addAll(APP_FILES);
      // Best effort: pre-cache the fonts so the first offline run looks right.
      try {
        const fonts = await caches.open(FONT_CACHE);
        const res = await fetch(FONT_CSS);
        if (res.ok) {
          const css = await res.clone().text();
          await fonts.put(FONT_CSS, res);
          const urls = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((m) => m[1]);
          await Promise.all(urls.map((u) => fetch(u, { mode: 'cors' }).then((r) => r.ok && fonts.put(u, r)).catch(() => {})));
        }
      } catch {}
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('kbhiit-app-') && k !== APP_CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      (async () => {
        const cache = await caches.open(FONT_CACHE);
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })(),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(APP_CACHE);
      try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      } catch {
        return (await cache.match(req, { ignoreSearch: true })) ||
          (req.mode === 'navigate' ? await cache.match('./index.html') : Response.error());
      }
    })(),
  );
});
