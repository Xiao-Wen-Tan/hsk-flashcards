// Keeps audio and stroke files on the phone in the browser's Cache Storage. The service
// worker (sw.js) reads the same cache, so a saved file plays without internet.
// The cache API and fetch are passed in, so Node can test this with stand-ins.
export const MEDIA_CACHE = 'media-v1'; // sw.js uses the same name

// Saves every file of `urls` that is not saved yet, 4 at a time. It never throws for one
// bad file. It counts it in `failed` and goes on. onProgress gets { total, done, failed }.
// shouldStop() lets the Settings screen stop a long download.
export async function cacheFiles(urls, {
  cachesApi = globalThis.caches, fetchFn = globalThis.fetch, concurrency = 4,
  onProgress = () => {}, shouldStop = () => false,
} = {}) {
  const cache = await cachesApi.open(MEDIA_CACHE);
  const tally = { total: urls.length, done: 0, failed: 0 };
  let next = 0;
  async function worker() {
    while (next < urls.length && !shouldStop()) {
      const url = urls[next];
      next += 1;
      try {
        if (!(await cache.match(url))) {
          const res = await fetchFn(url);
          if (!res.ok) throw new Error(`${res.status}`);
          await cache.put(url, res);
        }
        tally.done += 1;
      } catch {
        tally.failed += 1;
      }
      onProgress({ ...tally });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return tally;
}

// How many of `urls` are saved already.
export async function countCached(urls, { cachesApi = globalThis.caches } = {}) {
  const cache = await cachesApi.open(MEDIA_CACHE);
  let n = 0;
  for (const url of urls) if (await cache.match(url)) n += 1;
  return n;
}
