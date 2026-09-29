// Browser checks in a headless Chrome, driven through the Chrome DevTools Protocol (the
// interface Chrome opens with --remote-debugging-port). No npm package is needed, because
// Node 24 has fetch and WebSocket built in.
//
//   node tests/browser/check.mjs store     the IndexedDB store page (project folder served on 8124)
//   node tests/browser/check.mjs day       a whole first day on the smoke site (served on 8123)
//   node tests/browser/check.mjs offline   the same site with its server stopped
//   node tests/browser/check.mjs update    after RELEASE was raised in the smoke copy
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
const PORT = 9333;
const SITE = 'http://localhost:8123/';
const STORE_PAGE = 'http://localhost:8124/tests/browser/store-idb.html';

async function openPage(url) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const waiting = new Map();
  const errors = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
  const page = {
    send,
    errors,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
    async until(expression, ms = 10000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try { if (await page.eval(expression)) return; } catch { /* page still loading */ }
        await page.sleep(150);
      }
      throw new Error(`Timed out waiting for ${expression}`);
    },
    text: () => page.eval("document.getElementById('main').innerText.split(String.fromCharCode(10)).filter(Boolean).join(' | ')"),
    async close() {
      ws.close();
      await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
    },
  };
  return page;
}

const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

// Counts every sound the page starts, so the check can see "plays twice".
const COUNT_PLAYS = `window.__plays = []; const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { __plays.push(this.src.replace(location.origin, '')); return play.call(this); }; true`;
const CLICK = (label) => `[...document.querySelectorAll('button')].find((b) => b.textContent === '${label}').click()`;

async function store() {
  const page = await openPage(STORE_PAGE);
  await page.until("!!document.getElementById('out') && document.title !== 'running'", 20000);
  const lines = (await page.eval("document.getElementById('out').textContent")).split('\n');
  for (const line of lines) results.push(line);
  await page.close();
}

async function day() {
  const page = await openPage(SITE);
  await page.until("!!document.querySelector('.start')", 20000);
  check('Today shows the day\'s counts and Start', /12 \| new words/.test(await page.text()), await page.text());
  await page.eval(COUNT_PLAYS);
  await page.eval("document.querySelector('.start').click()");
  await page.until("location.hash === '#/session' && !!document.querySelector('.session-top')");
  const seen = {};
  let strokes = 0;
  let listenHz = 0; // listening questions that showed characters
  let learnPlays = null; // sounds started by the first new word's card
  let afterPlays = null; // sounds started by the first card after an answer
  for (let i = 0; i < 300 && (await page.eval('location.hash')) === '#/session'; i += 1) {
    const kind = await page.eval(`(() => { const m = document.getElementById('main');
      if (!m.querySelector('.session-top')) return 'wait';
      if (m.querySelector('.banner')) return 'feedback';
      if (m.querySelector('.choice')) return m.querySelector('.en') ? 'pinyin' : 'listen';
      if ([...m.querySelectorAll('button')].some((b) => b.textContent === 'Reveal')) return 'recall';
      if (m.querySelector('.grades')) return 'grades';
      return m.querySelector('.card') ? 'learn' : 'other'; })()`);
    seen[kind] = (seen[kind] ?? 0) + 1;
    if ((kind === 'learn' && !learnPlays) || (kind === 'feedback' && !afterPlays)) {
      // Let the card's sound run out. Two silent one-second plays and the pause take under 3 s.
      // __mark is where the sounds of this card start (set before the tap that opened it).
      await page.sleep(3500);
      const plays = await page.eval('__plays.slice(window.__mark ?? 0)');
      if (kind === 'learn') learnPlays = plays;
      else afterPlays = plays;
    }
    if (kind === 'listen') listenHz += await page.eval("document.querySelectorAll('#main .hz').length");
    if (kind === 'learn' && !strokes) {
      await page.eval(CLICK('Stroke order'));
      await page.until("document.querySelectorAll('.strokes svg').length > 0").catch(() => {});
      strokes = await page.eval("document.querySelectorAll('.strokes svg').length");
    }
    await page.eval('window.__mark = __plays.length; true');
    if (kind === 'listen' || kind === 'pinyin') {
      // Tap the right answer. The word is found in the words file by the characters a pinyin
      // question shows, or by the sound a listening question played, as it hides the characters.
      // The choice with that word's pinyin or short meaning is tapped.
      await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
        const data = await (await fetch(WORDS_FILE)).json();
        const shown = document.querySelector('.big-hz');
        const heard = __plays[__plays.length - 1];
        const w = shown ? data.words.find((x) => x.hz === shown.textContent) : data.words.find((x) => '/audio/' + x.au === heard);
        const want = document.querySelector('.en') ? w.py : w.enShort;
        const b = [...document.querySelectorAll('.choice')].find((c) => c.textContent === want) ?? document.querySelector('.choice');
        b.click(); })()`);
    } else if (kind === 'recall') await page.eval(CLICK('Reveal'));
    else if (kind === 'grades') await page.eval("document.querySelector('.grades button').click()");
    else if (kind === 'learn' || kind === 'feedback') await page.eval(CLICK('Next'));
    await page.sleep(100);
  }
  check('the session shows learning cards, listening checks and pinyin checks',
    seen.learn === 12 && seen.listen >= 12 && seen.pinyin >= 12, JSON.stringify(seen));
  check('stroke order draws the character', strokes > 0, `${strokes} drawings`);
  check('the listening question hides the characters', seen.listen > 0 && listenHz === 0, `${listenHz} of ${seen.listen} showed them`);
  check('a new word\'s card plays its sound twice', learnPlays?.length === 2 && learnPlays[0] === learnPlays[1], JSON.stringify(learnPlays));
  check('the card after an answer plays its sound once', afterPlays?.length === 1, JSON.stringify(afterPlays));
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await page.sleep(300);
  const checkin = await page.text();
  check('the check-in screen says Checked in! with a 1-day streak', /Checked in! \| 1 day streak \| 12 new words learned/.test(checkin), checkin.slice(0, 120));
  check('the service worker controls the page', await page.eval('!!navigator.serviceWorker.controller'));
  const media = await page.eval("caches.open('media-v1').then((c) => c.keys()).then((k) => k.length)");
  check('today\'s and tomorrow\'s sound and stroke files were saved', media > 0, `${media} files`);
  await page.eval(`window.__plays = []; location.hash = '#/map'; true`);
  await page.sleep(500);
  const firstId = await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
    const data = await (await fetch(WORDS_FILE)).json(); return data.words.slice().sort((a, b) => a.ord - b.ord)[0].id; })()`);
  await page.eval(`location.hash = '#/word/${firstId}'; true`);
  await page.sleep(4000);
  const plays = await page.eval('__plays');
  check('a word card left alone plays its sound twice', plays.length === 2 && plays[0] === plays[1], JSON.stringify(plays));
  for (const hash of ['#/map', '#/stats', '#/badges', '#/settings', '#/today']) {
    await page.eval(`location.hash = '${hash}'; true`);
    await page.sleep(700);
    check(`${hash} draws`, (await page.text()).length > 20);
  }
  check('Today now says the day is done', /Done for today/.test(await page.text()));
  const installable = await page.send('Page.getInstallabilityErrors');
  check('Chrome finds the app installable', installable.installabilityErrors.length === 0, JSON.stringify(installable.installabilityErrors));
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

async function offline() {
  const page = await openPage(`${SITE}#/today`);
  await page.sleep(3000);
  check('the app opens with the server stopped', /day streak/.test(await page.text()), (await page.text()).slice(0, 80));
  const firstId = await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
    const data = await (await fetch(WORDS_FILE)).json(); return data.words.slice().sort((a, b) => a.ord - b.ord)[0].id; })()`);
  await page.eval(`location.hash = '#/word/${firstId}'; true`);
  await page.sleep(1500);
  check('a word card opens offline', /Stroke order/.test(await page.text()));
  const played = await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
    const data = await (await fetch(WORDS_FILE)).json(); const w = data.words.find((x) => x.id === '${firstId}');
    return new Promise((resolve) => { const a = new Audio('audio/' + w.au); a.onended = () => resolve('ended');
      a.onerror = () => resolve('error'); a.play().catch((e) => resolve('refused ' + e.name)); }); })()`);
  check('its saved sound plays offline', played === 'ended', played);
  await page.eval(CLICK('Stroke order'));
  await page.sleep(2500);
  check('its stroke order draws offline', (await page.eval("document.querySelectorAll('.strokes svg').length")) > 0);
  await page.close();
}

async function update() {
  const page = await openPage(`${SITE}#/today`);
  await page.sleep(5000);
  const banner = await page.eval("(() => { const b = document.getElementById('update'); return b.hidden ? 'hidden' : b.textContent; })()");
  check('the update message appears', banner === 'Update available, tap to reload', banner);
  await page.eval("document.getElementById('update').click()");
  await page.sleep(4000);
  const names = await page.eval('caches.keys()');
  check('after the tap only the new app cache is left', names.filter((n) => n.startsWith('app-')).length === 1, JSON.stringify(names));
  check('progress is kept after the update', /1 day streak/.test(await page.text()), (await page.text()).slice(0, 60));
  await page.close();
}

const mode = process.argv[2];
const modes = { store, day, offline, update };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update');
} else {
  try {
    await modes[mode]();
  } catch (err) {
    results.push(`FAIL ${mode} stopped: ${err.message}`);
  }
}
console.log(results.join('\n'));
// exitCode, not process.exit(), which can crash Node on Windows while a socket is closing.
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
