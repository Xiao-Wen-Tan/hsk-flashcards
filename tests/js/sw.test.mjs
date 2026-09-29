// Runs docs/sw.js in Node with small stand-ins for the browser's service worker API, and
// checks which requests it answers from which cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SCOPE = 'https://learner.github.io/hsk-flashcards/';

function fakeCaches() {
  const stores = new Map();
  const keyOf = (req) => (typeof req === 'string' ? new URL(req, SCOPE).href : req.url).split('?')[0];
  const api = {
    stores,
    async open(name) {
      if (!stores.has(name)) {
        const files = new Map();
        stores.set(name, {
          files,
          async match(req) { return files.get(keyOf(req)); },
          async put(req, res) { files.set(keyOf(req), res); },
          async add(url) { throw new TypeError(`404 ${url}`); },
          async addAll(urls) { for (const u of urls) files.set(keyOf(u), new Response(`cached ${u}`)); },
        });
      }
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  return api;
}

function loadSw({ fetchImpl } = {}) {
  const handlers = {};
  const caches = fakeCaches();
  const fetched = [];
  const self = {
    registration: { scope: SCOPE },
    clients: { claim: async () => {} },
    skipWaiting: () => { self.skipped = true; },
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
  const context = {
    self, caches, console: { warn: () => {} }, Response, URL,
    fetch: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      fetched.push(url);
      return fetchImpl ? fetchImpl(url) : new Response(`net ${url}`);
    },
  };
  vm.runInNewContext(readFileSync(new URL('../../docs/sw.js', import.meta.url), 'utf8'), context);
  return { sw: self.swForTests, handlers, caches, fetched, self };
}

// Sends one GET request through the fetch handler. Returns the response, or null when the
// worker leaves the request to the browser.
async function get(handlers, path, mode = 'no-cors') {
  let answer = null;
  handlers.fetch({ request: { url: SCOPE + path, method: 'GET', mode }, respondWith: (p) => { answer = p; } });
  return answer ? answer : null;
}

test('requests are sorted into app files, media files and the rest', () => {
  const { sw } = loadSw();
  assert.equal(sw.routeFor(`${SCOPE}`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}index.html?source=pwa`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}js/study.js`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}${sw.WORDS_FILE}`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}audio/w/w0026_6ce06b7e.mp3`, SCOPE), 'media');
  assert.equal(sw.routeFor(`${SCOPE}strokes/82f9.json`, SCOPE), 'media');
  assert.equal(sw.routeFor(`${SCOPE}data/words_v000.json`, SCOPE), 'network');
  assert.equal(sw.routeFor('https://script.google.com/macros/s/x/exec', SCOPE), 'network');
});

test('install saves the app files, and a missing words file does not stop it', async () => {
  const { sw, caches } = loadSw();
  await sw.install();
  const cache = caches.stores.get(sw.APP_CACHE);
  assert.equal(cache.files.size, sw.APP_FILES.length); // the words file is not among them
  assert.ok(await cache.match('index.html'));
  assert.equal(await cache.match(sw.WORDS_FILE), undefined);
});

test('app files come from the cache, and the page itself works offline', async () => {
  const { sw, handlers, fetched } = loadSw({ fetchImpl: () => { throw new TypeError('offline'); } });
  await sw.install();
  const res = await get(handlers, 'js/study.js');
  assert.equal(await res.text(), 'cached js/study.js');
  const page = await get(handlers, '', 'navigate');
  assert.equal(await page.text(), 'cached ./');
  assert.deepEqual(fetched, []);
});

test('an audio file is fetched once, kept, and then played from the phone', async () => {
  const { sw, handlers, caches, fetched } = loadSw();
  const first = await get(handlers, 'audio/w/w0026_6ce06b7e.mp3');
  assert.equal(await first.text(), `net ${SCOPE}audio/w/w0026_6ce06b7e.mp3`);
  const second = await get(handlers, 'audio/w/w0026_6ce06b7e.mp3');
  assert.ok(second);
  assert.equal(fetched.length, 1);
  assert.ok(caches.stores.has(sw.MEDIA_CACHE));
});

test('other requests and non-GET requests are left to the browser', async () => {
  const { handlers } = loadSw();
  assert.equal(await get(handlers, 'data/other.json'), null);
  let answered = false;
  handlers.fetch({ request: { url: `${SCOPE}js/app.js`, method: 'POST' }, respondWith: () => { answered = true; } });
  assert.equal(answered, false);
});

test('a new release deletes the old app cache and keeps the media cache', async () => {
  const { sw, caches } = loadSw();
  await caches.open('app-r000');
  await caches.open(sw.MEDIA_CACHE);
  await caches.open(sw.APP_CACHE);
  await sw.activate();
  assert.deepEqual((await caches.keys()).sort(), [sw.APP_CACHE, sw.MEDIA_CACHE].sort());
});

test('the update banner\'s message lets the new version take over', () => {
  const { handlers, self } = loadSw();
  handlers.message({ data: 'skipWaiting' });
  assert.equal(self.skipped, true);
});
