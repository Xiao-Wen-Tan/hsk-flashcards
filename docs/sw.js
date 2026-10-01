// The service worker is a script the browser keeps next to the app. It answers the app's
// requests from the phone's storage, so the app opens and runs without internet.
//   App files and the words file are saved when this version installs and are answered
//     from the cache 'app-<RELEASE>'. A new RELEASE makes a new cache, and the old one is
//     deleted once the new version takes over.
//   Audio and stroke files are answered from the cache 'media-v1' when saved there, and
//     otherwise fetched and then saved, so every played file is kept. Their names change
//     when their content changes, so this cache never needs clearing.
// A new version waits until the learner taps "Update available, tap to reload", which
// sends the message 'skipWaiting'.
// RELEASE and WORDS_FILE repeat docs/js/release.js, and tests/js/release.test.mjs checks them.
const RELEASE = 'r004';
const WORDS_FILE = 'data/words_v001.json';
const MEDIA_CACHE = 'media-v1';
const APP_CACHE = `app-${RELEASE}`;
const APP_FILES = [
  './',
  'index.html',
  'credits.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/app.js',
  'js/audio.js',
  'js/badges.js',
  'js/checkin.js',
  'js/config.js',
  'js/curriculum.js',
  'js/dates.js',
  'js/distractors.js',
  'js/hooks.js',
  'js/offline.js',
  'js/pinyin.js',
  'js/plan.js',
  'js/plugins.js',
  'js/release.js',
  'js/rng.js',
  'js/session.js',
  'js/sheet.js',
  'js/srs.js',
  'js/stats.js',
  'js/store.js',
  'js/strokes.js',
  'js/study.js',
  'js/sync.js',
  'js/ui/card.js',
  'js/ui/dom.js',
  'js/ui/screens.js',
  'js/ui/session.js',
  'js/ui/settings.js',
  'js/ui/update.js',
  'js/view/card.js',
  'js/view/files.js',
  'js/view/format.js',
  'js/view/progress.js',
  'js/view/quiz.js',
  'js/view/route.js',
  'js/view/settings.js',
  'js/view/today.js',
  'vendor/hanzi-writer-3.7.3.esm.js',
];

// Which rule answers a request. url and scope are full addresses, where scope is the
// folder of this file ('https://<user>.github.io/hsk-flashcards/').
// routeFor('https://x.io/app/audio/w/w0001_3fa2b1c9.mp3', 'https://x.io/app/') gives 'media'.
function routeFor(url, scope) {
  if (!url.startsWith(scope)) return 'network';
  const path = url.slice(scope.length).split(/[?#]/)[0];
  if (path.startsWith('audio/') || path.startsWith('strokes/')) return 'media';
  if (path === '' || path === WORDS_FILE || APP_FILES.includes(path)) return 'app';
  return 'network';
}

async function install() {
  const cache = await caches.open(APP_CACHE);
  await cache.addAll(APP_FILES);
  try {
    await cache.add(WORDS_FILE); // missing before Plan 3 ends, and the app says so
  } catch (err) {
    console.warn('Words file not saved:', err);
  }
}

async function activate() {
  for (const name of await caches.keys()) {
    if (name.startsWith('app-') && name !== APP_CACHE) await caches.delete(name);
  }
  await self.clients.claim();
}

async function fromApp(request) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok && request.url.endsWith(WORDS_FILE)) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function fromMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

function onFetch(event) {
  const { request } = event;
  if (request.method !== 'GET') return;
  const route = routeFor(request.url, self.registration.scope);
  if (route === 'app') event.respondWith(fromApp(request));
  else if (route === 'media') event.respondWith(fromMedia(request));
}

self.addEventListener('install', (event) => event.waitUntil(install()));
self.addEventListener('activate', (event) => event.waitUntil(activate()));
self.addEventListener('fetch', onFetch);
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Read by tests/js/sw.test.mjs, which runs this file in Node with stand-ins for the browser.
self.swForTests = { RELEASE, WORDS_FILE, MEDIA_CACHE, APP_CACHE, APP_FILES, routeFor, install, activate, onFetch };
