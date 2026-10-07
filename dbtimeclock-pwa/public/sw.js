/* DB Crew service worker — T1.1 (2026-07-28)
   Navigation: network-first (a fresh build wins), cache fallback so the app
   still opens with no signal. Same-origin assets: cache-first. Cross-origin
   (the Apps Script API, JobTread's CDN, FCM): never touched. */
var CACHE = 'dbtc-t2-8-1';
var SHELL = ['./', './index.html', './config.js', './manifest.json',
             './app-icon-180.png', './app-icon-192.png', './app-icon-512.png', './app-icon-maskable.png',
             './fonts/archivo-700.woff2', './fonts/archivo-800.woff2',
             './fonts/barlow-400.woff2', './fonts/barlow-600.woff2', './fonts/barlow-700.woff2',
             './fonts/plexmono-600.woff2'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put('./index.html', copy); });
        return res;
      }).catch(function () { return caches.match('./index.html'); })
    );
    return;
  }
  e.respondWith(caches.match(req).then(function (hit) {
    return hit || fetch(req).then(function (res) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    });
  }));
});

/* A push arriving while the app is closed. FCM delivers the payload as a raw
   push event here — the browser will not display anything on its own, so this
   handler is what actually puts the nudge on the lock screen. Exactly one
   notification per push: we are the only thing that shows it. */
self.addEventListener('push', function (e) {
  var p = {};
  try { p = e.data ? e.data.json() : {}; }
  catch (err) { p = { notification: { title: 'DB Crew', body: e.data ? e.data.text() : '' } }; }
  var n = p.notification || {};
  var d = p.data || {};
  // The tag and the kind ride in data (sendPush_ puts them there): a schedule
  // line must not replace a photo nudge, and it need not stay on screen.
  e.waitUntil(self.registration.showNotification(n.title || 'DB Crew', {
    body: n.body || '',
    icon: 'app-icon-192.png',
    badge: 'app-icon-192.png',
    tag: d.tag || n.tag || 'dbtc-before',
    renotify: true,
    requireInteraction: d.kind !== 'schedule',
    data: d
  }));
});

/* Tapping the before-photo reminder opens the app straight onto the camera;
   tapping a schedule line opens My jobs. */
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  var data = e.notification.data || {};
  var schedule = data.kind === 'schedule';
  e.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) {
      if ('focus' in list[i]) {
        list[i].postMessage(schedule ? { kind: 'open-tab', tab: 'jobs' } : { kind: 'open-before-photo', data: data });
        return list[i].focus();
      }
    }
    if (clients.openWindow) return clients.openWindow(schedule ? './?tab=jobs' : './?shoot=before');
  }));
});
