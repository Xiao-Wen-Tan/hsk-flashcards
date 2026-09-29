// Checks that a release is complete. sw.js and release.js must agree, every file of the site
// must be saved for offline use, and the app must load the newest words file, with stroke
// data for every character.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { RELEASE, WORDS_FILE } from '../../docs/js/release.js';
import { MEDIA_CACHE } from '../../docs/js/offline.js';
import { charsOf, strokeUrl } from '../../docs/js/strokes.js';

const DOCS = new URL('../../docs/', import.meta.url);

function swValues() {
  const self = { addEventListener: () => {} };
  vm.runInNewContext(readFileSync(new URL('sw.js', DOCS), 'utf8'), { self, console });
  return self.swForTests;
}

// Every file under docs/, as paths such as 'js/app.js'.
function siteFiles(dir = DOCS, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = new URL(name, dir);
    if (statSync(full).isDirectory()) out.push(...siteFiles(new URL(`${name}/`, dir), `${prefix}${name}/`));
    else out.push(`${prefix}${name}`);
  }
  return out;
}

// Files that are not saved at install: the worker itself, licence texts, the words files
// (the current one is saved separately), and audio and stroke files (saved as they are used).
const NOT_PRECACHED = (path) => path === 'sw.js' || path.endsWith('.txt') || path.startsWith('data/')
  || path.startsWith('audio/') || path.startsWith('strokes/');

test('sw.js repeats the release, the words file and the media cache name', () => {
  const sw = swValues();
  assert.equal(sw.RELEASE, RELEASE);
  assert.equal(sw.WORDS_FILE, WORDS_FILE);
  assert.equal(sw.MEDIA_CACHE, MEDIA_CACHE);
  assert.match(RELEASE, /^r\d{3}$/);
});

test('every app file is saved for offline use, and every saved file exists', () => {
  const listed = [...swValues().APP_FILES]; // copied, because arrays made inside vm fail deepEqual
  const onDisk = siteFiles().filter((p) => !NOT_PRECACHED(p));
  assert.deepEqual(listed.filter((p) => p !== './').sort(), onDisk.sort());
});

test('the app loads the newest words file, and each of its characters has stroke data', (t) => {
  const dataDir = new URL('data/', DOCS);
  const files = existsSync(dataDir) ? readdirSync(dataDir).filter((n) => /^words_v\d{3}\.json$/.test(n)).sort() : [];
  if (!files.length) {
    t.skip('no docs/data/words_vNNN.json yet (Plan 3 writes it)');
    return;
  }
  assert.equal(WORDS_FILE, `data/${files.at(-1)}`);
  const data = JSON.parse(readFileSync(new URL(WORDS_FILE, DOCS), 'utf8'));
  const missing = [...new Set(data.words.flatMap((w) => charsOf(w.hz)))]
    .filter((ch) => !existsSync(new URL(strokeUrl(ch), DOCS)));
  assert.deepEqual(missing, [], 'run python tools/12_vendor_strokes.py');
});
