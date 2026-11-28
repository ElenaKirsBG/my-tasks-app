/* «Ежедневник» — работа без интернета. Страница берётся из сети (обновления приходят сразу),
   без связи — из кэша. В кэш попадают только нормальные ответы (не страница входа, не перенаправления).
   Дела здесь не хранятся и не трогаются: они лежат в памяти браузера. */
const V = 'ezhednevnik-1.4.0';
const CORE = ['./', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];
const good = r => r && r.ok && !r.redirected && r.type !== 'opaqueredirect';
async function put(key, res) { try { if (good(res)) await (await caches.open(V)).put(key, res); } catch (e) {} }

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(Promise.all(CORE.map(async u => { try { await put(u, await fetch(new Request(u, { cache: 'reload', credentials: 'same-origin' }))); } catch (er) {} })));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => (k.startsWith('ezhednevnik-') || k.startsWith('planner-')) && k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => { put('./', res.clone()); return res; })
      .catch(async () => (await caches.match('./')) || Response.error()));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => { put(req, res.clone()); return res; })));
});

/* пуш-напоминание с сервера (приложение может быть закрыто) */
self.addEventListener('push', e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (er) { d = { title: 'Ежедневник', body: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.title || 'Ежедневник', {
    body: d.body || '', tag: d.tag || 'diary', renotify: true,
    icon: 'icon-192.png', badge: 'icon-192.png', vibrate: [200, 100, 200], data: { d: d.d || '' }
  }));
});
/* нажатие на уведомление — открыть «Ежедневник» на нужном дне */
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const day = (e.notification.data || {}).d || '', scope = self.registration.scope;
  e.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const c = all.find(w => w.url.startsWith(scope));
    if (c) { await c.focus(); if (day) c.postMessage({ openDay: day }); return; }
    await self.clients.openWindow(scope + (day ? '?d=' + day : ''));
  })());
});
