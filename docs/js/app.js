// At start-up the app opens the saved progress, loads the words file, registers the service
// worker, loads the plugins, and draws the screen that the address names ('#/today', '#/map', ...).
import { openIdbStore } from './store.js';
import { loadSettings } from './study.js';
import { studyDay } from './dates.js';
import { makePool } from './distractors.js';
import { RELEASE, WORDS_FILE } from './release.js';
import { PLUGINS } from './plugins.js';
import { createHooks, loadPlugins } from './hooks.js';
import { createPlayer } from './audio.js';
import { NAV, needsRedraw, parseRoute } from './view/route.js';
import { h, show } from './ui/dom.js';
import { setupUpdates } from './ui/update.js';
import { endSession, renderSession } from './ui/session.js';
import {
  renderBadges, renderCheckin, renderMap, renderStats, renderTheme, renderToday, renderWord,
} from './ui/screens.js';
import { renderSettings } from './ui/settings.js';

const app = {
  main: document.getElementById('main'),
  nav: document.getElementById('nav'),
  overlay: document.getElementById('overlay'),
  hooks: createHooks(),
  player: createPlayer(),
  study: null,
  lastResult: null,
  feedback: null,
  revealed: false,
  busy: false,
  drawnDay: null, // the study day the screen was last drawn on
};

app.settings = () => loadSettings(app.store);

// "Tap to continue": shown when the phone refuses to play sound until the next tap.
app.needTap = (retry) => {
  app.overlay.replaceChildren(h('button', {
    class: 'big',
    onclick: () => { app.overlay.hidden = true; retry(); },
  }, 'Tap to continue'));
  app.overlay.hidden = false;
};

// A short message at the bottom of the screen that goes away after 4 seconds.
app.note = (text) => {
  const el = h('div', { class: 'toast' }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
};

function drawNav(route) {
  const hidden = route.name === 'session';
  app.nav.hidden = hidden;
  if (hidden) return;
  // Tapping the tab of the screen already shown draws it again. The address does not change
  // then, so there is no hashchange. (Opened at './', the first tap on Today does change it.)
  app.nav.replaceChildren(...NAV.map((item) => h('a', {
    href: `#/${item.name}`,
    class: item.name === route.name ? 'active' : '',
    onclick: () => { if (window.location.hash === `#/${item.name}`) render(); },
  }, item.label)));
}

async function render() {
  const route = parseRoute(window.location.hash);
  if (route.name !== 'session' && app.study) await endSession(app, { quiet: true });
  app.drawnDay = studyDay();
  drawNav(route);
  try {
    switch (route.name) {
      case 'session': renderSession(app); break;
      case 'checkin': await renderCheckin(app); break;
      case 'map': await renderMap(app); break;
      case 'theme': await renderTheme(app, route.id, route.group); break;
      case 'word': await renderWord(app, route.id, route.group); break;
      case 'stats': await renderStats(app); break;
      case 'badges': await renderBadges(app); break;
      case 'settings': await renderSettings(app); break;
      default: await renderToday(app);
    }
  } catch (err) {
    console.error(err);
    show(app.main, h('h1', {}, 'Something went wrong'), h('p', {}, err.message));
  }
}

async function boot() {
  setupUpdates(document.getElementById('update'));
  try {
    app.store = await openIdbStore();
  } catch (err) {
    show(app.main, h('h1', {}, 'Cannot open saved progress'), h('p', {}, String(err)));
    return;
  }
  const res = await fetch(WORDS_FILE).catch(() => null);
  if (!res || !res.ok) {
    show(app.main, h('h1', {}, 'Word list missing'), h('p', {}, `The app could not load ${WORDS_FILE} (release ${RELEASE}).`));
    return;
  }
  app.data = await res.json();
  app.wordsById = new Map(app.data.words.map((w) => [w.id, w]));
  app.pool = makePool(app.data.words);
  await loadPlugins(PLUGINS, { on: app.hooks.on, store: app.store, data: app.data });
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      app.player.stop();
      app.hooks.emit('hidden', { store: app.store });
    } else {
      app.hooks.emit('open', { store: app.store, data: app.data });
      // Back from the background during a session, a tap restores sound (the design's "Tap to continue").
      if (app.study) app.needTap(() => renderSession(app));
      // Back on a new study day, the screen is drawn again, so Today shows the new day's reviews.
      else if (needsRedraw({ drawnDay: app.drawnDay, today: studyDay(), route: parseRoute(window.location.hash) })) render();
    }
  });
  await render();
  app.hooks.emit('open', { store: app.store, data: app.data });
}

boot();
