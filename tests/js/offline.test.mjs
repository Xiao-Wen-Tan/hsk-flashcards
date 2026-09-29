import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_CACHE, cacheFiles, countCached } from '../../docs/js/offline.js';

// A stand-in for the browser's Cache Storage with one cache per name.
function fakeCaches(saved = []) {
  const caches = new Map();
  return {
    names: () => [...caches.keys()],
    async open(name) {
      if (!caches.has(name)) {
        const files = new Map(saved.map((url) => [url, 'old']));
        caches.set(name, {
          files,
          async match(url) { return files.get(url); },
          async put(url, res) { files.set(url, res); },
        });
      }
      return caches.get(name);
    },
    get: (name) => caches.get(name),
  };
}

test('only missing files are fetched, and one bad file does not stop the rest', async () => {
  const cachesApi = fakeCaches(['audio/w/a.mp3']);
  const fetched = [];
  const fetchFn = async (url) => {
    fetched.push(url);
    return url.includes('bad') ? { ok: false, status: 404 } : { ok: true, url };
  };
  const seen = [];
  const tally = await cacheFiles(['audio/w/a.mp3', 'audio/w/b.mp3', 'audio/w/bad.mp3', 'strokes/7231.json'],
    { cachesApi, fetchFn, onProgress: (p) => seen.push(p) });
  assert.deepEqual(tally, { total: 4, done: 3, failed: 1 });
  assert.deepEqual(fetched.sort(), ['audio/w/b.mp3', 'audio/w/bad.mp3', 'strokes/7231.json']);
  assert.deepEqual(cachesApi.names(), [MEDIA_CACHE]);
  assert.equal(seen.length, 4);
  assert.equal(await countCached(['audio/w/a.mp3', 'audio/w/b.mp3', 'audio/w/bad.mp3'], { cachesApi }), 2);
});

test('a long download can be stopped', async () => {
  const cachesApi = fakeCaches();
  let calls = 0;
  const urls = Array.from({ length: 50 }, (_, i) => `audio/w/${i}.mp3`);
  const tally = await cacheFiles(urls, {
    cachesApi, concurrency: 1, fetchFn: async () => { calls += 1; return { ok: true }; }, shouldStop: () => calls >= 5,
  });
  assert.equal(calls, 5);
  assert.equal(tally.done, 5);
});
