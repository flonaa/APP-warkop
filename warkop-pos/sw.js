'use strict';

const CACHE_VERSION = '1.4.0';
const PRECACHE_NAME = `warkop-pos-precache-${CACHE_VERSION}`;
const RUNTIME_NAME = `warkop-pos-runtime-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './config.js',
  './manifest.webmanifest',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

const CDN_URLS = [
  'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',
  'https://cdn.jsdelivr.net/npm/jspdf-autotable@3.5.31/dist/jspdf.plugin.autotable.min.js',
  'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/dist/umd/supabase.min.js'
];

// Cache runtime juga dihangatkan saat pemasangan agar ekspor tetap siap tanpa jaringan.
const warmRuntimeCache = async () => {
  const cache = await caches.open(RUNTIME_NAME);
  await Promise.allSettled(CDN_URLS.map(async (url) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch(url, { mode: 'cors', cache: 'reload', signal: controller.signal });
      if (response && response.ok) await cache.put(url, response);
    } catch (error) {
      // CDN yang tidak terjangkau akan dicoba lagi lewat fetch handler.
    } finally {
      clearTimeout(timeout);
    }
  }));
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => warmRuntimeCache())
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('warkop-pos-') && key !== PRECACHE_NAME && key !== RUNTIME_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

const saveToRuntimeCache = (request, response) => {
  if (!response || (!response.ok && response.type !== 'opaque')) return response;
  caches.open(RUNTIME_NAME)
    .then((cache) => cache.put(request, response.clone()))
    .catch(() => {});
  return response;
};

const offlineFallback = () => new Response(
  '<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Warkop POS</title></head><body style="margin:0;display:grid;min-height:100vh;place-items:center;background:#15100c;color:#f6eee5;font-family:system-ui,sans-serif;text-align:center;padding:24px"><div><h1 style="font-size:20px">Aplikasi belum tersedia tanpa jaringan</h1><p style="color:#a8998a;font-size:14px">Buka aplikasi sekali lagi dengan koneksi internet, lalu coba kembali.</p></div></body></html>',
  { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
);

// Network-first untuk berkas lokal: saat online selalu ambil versi terbaru (maks 4 detik),
// lalu simpan ke cache. Saat offline atau jaringan lambat, pakai cache.
const networkFirst = (request, cacheKey) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  return fetch(request, { cache: 'no-cache', signal: controller.signal })
    .then((response) => {
      clearTimeout(timer);
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(PRECACHE_NAME).then((cache) => cache.put(cacheKey, copy)).catch(() => {});
      }
      return response;
    })
    .catch(() => {
      clearTimeout(timer);
      return caches.match(cacheKey);
    });
};

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!/^https?:$/.test(url.protocol)) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      networkFirst(request, './index.html')
        .catch(() => caches.match('./index.html'))
        .then((response) => response || offlineFallback())
        .catch(() => offlineFallback())
    );
    return;
  }

  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    event.respondWith(
      networkFirst(request, request)
        .catch(() => caches.match(request))
        .then((response) => response || offlineFallback())
        .catch(() => offlineFallback())
    );
    return;
  }

  // Hanya aset CDN yang di-cache. Request Supabase harus selalu ke jaringan.
  if (url.hostname !== 'cdn.jsdelivr.net') return;

  event.respondWith(
    caches.match(request)
      .then((cached) => cached || fetch(request).then((response) => saveToRuntimeCache(request, response)))
      .catch(() => new Response('', { status: 503, statusText: 'Offline' }))
  );
});
