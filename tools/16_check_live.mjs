// Step 16. Checks a deployed copy of the site from outside, after GitHub Pages has published it.
//   node tools/16_check_live.mjs https://xiao-wen-tan.github.io/hsk-flashcards/
// It reads RELEASE, WORDS_FILE and APP_FILES from the local docs/sw.js, then asks the site for
// every app file, the words file and the sounds of the first 20 words, and checks that the
// site serves the same release as the local files. Prints PASS or FAIL lines, exit code 1 on FAIL.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const base = process.argv[2];
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);

async function status(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    await res.arrayBuffer();
    return res.status;
  } catch (err) {
    return `error ${err.message}`;
  }
}

async function main() {
  if (!base || !/^https?:\/\/.+\/$/.test(base)) {
    check('usage: node tools/16_check_live.mjs https://<user>.github.io/hsk-flashcards/ (with the final /)', false);
    return;
  }
  const self = { addEventListener: () => {} };
  vm.runInNewContext(readFileSync('docs/sw.js', 'utf8'), { self, console });
  const { RELEASE, WORDS_FILE, APP_FILES } = self.swForTests;
  const live = await (await fetch(new URL('js/release.js', base))).text().catch(() => '');
  check(`the site serves release ${RELEASE}`, live.includes(`RELEASE = '${RELEASE}'`), (live.match(/RELEASE = '[^']*'/) ?? ['none'])[0]);
  const missing = [];
  for (const path of [...APP_FILES, 'sw.js']) {
    const s = await status(new URL(path, base));
    if (s !== 200) missing.push(`${path} ${s}`);
  }
  check(`all ${APP_FILES.length + 1} app files load`, missing.length === 0, missing.join(', '));
  const wordsRes = await fetch(new URL(WORDS_FILE, base)).catch(() => null);
  const data = wordsRes?.ok ? await wordsRes.json() : null;
  check(`the words file ${WORDS_FILE} loads`, Boolean(data), wordsRes ? String(wordsRes.status) : 'no answer');
  if (data) {
    const sounds = data.words.slice().sort((a, b) => a.ord - b.ord).slice(0, 20).flatMap((w) => [w.au, w.ex.au]);
    const bad = [];
    for (const au of sounds) {
      const s = await status(new URL(`audio/${au}`, base));
      if (s !== 200) bad.push(`${au} ${s}`);
    }
    check(`the ${sounds.length} sounds of the first 20 words load`, bad.length === 0, bad.join(', '));
  }
  const page = await (await fetch(base)).text().catch(() => '');
  check('the page asks search engines not to list it', page.includes('<meta name="robots" content="noindex, nofollow">'));
}

try {
  await main();
} catch (err) {
  check('the live check stopped', false, err.message);
}
console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
