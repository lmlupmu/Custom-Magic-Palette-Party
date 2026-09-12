/* =====================================================
 * sw.js  Service Worker：离线可用（cache-first）
 * 版本升级时修改 CACHE_VERSION 即可让旧缓存失效
 * ===================================================== */

const CACHE_VERSION = 'fengwu-party-v11';

/* 预缓存清单：应用外壳全部静态资源 */
const PRECACHE = [
  './',
  'index.html',
  'css/style.css',
  'js/data.js',
  'js/game.js',
  'js/workshop.js',
  'js/audio.js',
  'js/assistant.js',
  'js/main.js',
  'manifest.json',
  'favicon.svg',
  'images/assistant-avatar-new.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET' || !e.request.url.startsWith('http')) return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok) {
        const copy = res.clone();
        caches.open(CACHE_VERSION).then(cache => cache.put(e.request, copy));
      }
      return res;
    }).catch(() => caches.match('./')))
  );
});
