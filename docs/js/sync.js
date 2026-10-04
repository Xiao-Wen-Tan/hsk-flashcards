// The Google Sheet backup joins the app here. hooks.js (Plan 4) calls install() at start-up,
// because plugins.js lists './sync.js'. The backup runs:
//   at the end of each session ('sessionEnd'),
//   when the app is closed or sent to the background ('hidden', with small keepalive requests
//     that the browser finishes even after the page is gone),
//   when the app opens and the last backup is 12 or more hours old, or the last try failed ('open'),
//   when the phone comes back online, and when "Back up now" is tapped in Settings.
// After "Go back to a day" or "Reset everything" ('rewound'), the next backup replaces the
// Sheet's copy (state.resetPending, see backUp in sheet.js), also when it waits until the phone
// is online again.
// A backup never makes a screen wait, and a failed one only changes the status line in Settings.
import {
  KEEPALIVE_PAGE_SIZE, PAGE_SIZE, PROBLEM_TEXT, backUp, checkCode, checkWebAppUrl, isDue, isReady, loadState, makeCode,
  makeDeviceId, postJson, restoreFromSheet, saveState, statusText, withSettings,
} from './sheet.js';
import { h } from './ui/dom.js';

// The backup without any page: Node tests call this directly.
export function createSync({ store, data, storage, fetchFn }) {
  let running = null;
  let again = null;

  // The saved state. The first call makes this browser's device ID and a secret code.
  function state() {
    const s = loadState(storage);
    if (!s.device || !s.code) {
      if (!s.device) s.device = makeDeviceId();
      if (!s.code) s.code = makeCode();
      saveState(storage, s);
    }
    return s;
  }

  const postFor = (s, keepalive = false) => (body) => postJson(s.url, body, { fetchFn, keepalive });
  const save = (s) => saveState(storage, s);

  function once({ keepalive = false, reset = false } = {}) {
    const s = state();
    // backUp saves its own copy of the state. A mark made while it runs (markReset after going
    // back or "Reset everything") must survive that copy, so the next run replaces the Sheet.
    // Each mark gets a new number, and a backup clears only the mark it started with.
    const started = s.resetMark ?? 0;
    const keepNewMark = (next) => {
      const mark = state().resetMark ?? 0;
      save(mark > started ? { ...next, resetPending: true, resetMark: mark } : next);
    };
    return backUp({
      store, words: data.words, themes: data.themes, state: s, post: postFor(s, keepalive), save: keepNewMark, reset,
      pageSize: keepalive ? KEEPALIVE_PAGE_SIZE : PAGE_SIZE,
    });
  }

  // One backup at a time. A call during a backup makes one more run after it, so changes
  // saved in the meantime are not left waiting.
  function run(options = {}) {
    if (running) {
      again = { ...(again ?? {}), ...options };
      return running;
    }
    running = (async () => {
      let result = await once(options);
      while (again) {
        const next = again;
        again = null;
        result = await once(next);
      }
      return result;
    })().finally(() => { running = null; });
    return running;
  }

  return {
    state,
    run,
    async pending() {
      return (await store.eventsSince(state().cursor)).length;
    },
    saveSettings({ url, code }) {
      save(withSettings(state(), { url, code }));
    },
    // Marks that the Sheet must be replaced by the phone's progress. Returns false, and marks
    // nothing, when the backup is not set up, or when another phone or browser backs up to the
    // Sheet (going back there must not replace the main phone's copy).
    markReset() {
      const s = state();
      if (!isReady(s) || s.problem === 'other-device') return false;
      save({ ...s, resetPending: true, resetMark: (s.resetMark ?? 0) + 1 });
      return true;
    },
    newCode() {
      save(withSettings(state(), { url: state().url, code: makeCode() }));
      return state().code;
    },
    async ping() {
      const s = state();
      const answer = await postFor(s)({ action: 'ping', code: s.code, device: s.device });
      if (!answer?.ok) throw new Error(PROBLEM_TEXT[answer?.error] ?? answer?.message ?? PROBLEM_TEXT.server);
      if (answer.device === 'other') return 'Connected, but another phone or browser backs up to this Sheet.';
      return `Connected. The Sheet has saved answers up to number ${answer.lastSeq}.`;
    },
    async restore() {
      if (running) await running;
      const s = state();
      return restoreFromSheet({ store, state: s, post: postFor(s), save });
    },
  };
}

export function install({ on, store, data, storage = globalThis.localStorage, fetchFn = (...args) => globalThis.fetch(...args) }) {
  const sync = createSync({ store, data, storage, fetchFn });
  const quietly = (options) => { sync.run(options).catch((err) => console.warn('Backup failed:', err)); };
  on('sessionEnd', () => { quietly(); });
  on('hidden', () => { quietly({ keepalive: true }); });
  on('open', () => { if (isDue(sync.state())) quietly(); });
  on('rewound', () => { if (sync.markReset()) quietly(); });
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('online', () => quietly());
  on('settings', ({ container }) => drawSettings(container, sync));
  return sync;
}

// The "Google Sheet backup" section of Settings.
async function drawSettings(container, sync) {
  const s = sync.state();
  const status = h('p', { class: 'muted' });
  const message = h('p', { class: 'sheet-message', role: 'status' });
  const urlInput = h('input', {
    type: 'url', name: 'sheetUrl', class: 'wide', value: s.url, autocomplete: 'off',
    placeholder: 'https://script.google.com/macros/s/.../exec',
  });
  const codeBox = h('input', { type: 'text', name: 'sheetCode', class: 'wide code', value: s.code, autocomplete: 'off', spellcheck: 'false' });
  const replaceButton = h('button', { class: 'small' }, 'Replace the Sheet with this phone\'s progress');

  async function refresh() {
    const now = sync.state();
    status.textContent = statusText(now, await sync.pending());
    codeBox.value = now.code;
    replaceButton.hidden = !['other-device', 'mismatch'].includes(now.problem);
  }

  // A button that runs `work`, shows its answer (or its error) and then refreshes the status.
  function action(button, work) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      message.textContent = 'Working...';
      try {
        message.textContent = (await work()) ?? '';
      } catch (err) {
        message.textContent = err.message;
      } finally {
        button.disabled = false;
        await refresh();
      }
    });
    return button;
  }
  const button = (label, work) => action(h('button', { class: 'small' }, label), work);
  const backupResult = (r) => (r.state.problem ? 'Not backed up. See the note above.' : `Backed up. ${r.sent} change${r.sent === 1 ? '' : 's'} sent.`);

  action(replaceButton, async () => {
    if (!window.confirm('Replace everything in the Google Sheet with the progress on this phone?')) return 'Nothing changed.';
    return backupResult(await sync.run({ reset: true }));
  });

  container.append(
    h('h2', {}, 'Google Sheet backup'),
    status,
    h('label', { class: 'field' }, 'Web app address (from the Sheet owner)', urlInput),
    h('label', { class: 'field' }, 'Secret code (the Sheet owner pastes it into the script)', codeBox),
    button('Save address and code', async () => {
      sync.saveSettings({ url: checkWebAppUrl(urlInput.value), code: checkCode(codeBox.value) });
      return 'Saved. Tap "Test connection" to check it.';
    }),
    h('div', { class: 'row' },
      button('Copy code', async () => {
        await navigator.clipboard.writeText(sync.state().code);
        return 'Code copied.';
      }),
      typeof navigator.share === 'function' ? button('Share code', async () => {
        await navigator.share({ title: 'HSK Flashcards secret code', text: sync.state().code });
        return 'Code shared.';
      }) : null,
      button('Make a new code', async () => {
        if (!window.confirm('A new code stops the backup until the new code is pasted into the script in the Sheet. Make a new code?')) return 'Nothing changed.';
        sync.newCode();
        return 'New code made. Send it to the Sheet owner.';
      })),
    h('div', { class: 'row' },
      button('Test connection', () => sync.ping()),
      button('Back up now', async () => backupResult(await sync.run())),
      button('Restore from Google Sheet', async () => {
        if (!window.confirm('Replace all progress on this phone with the progress saved in the Google Sheet?')) return 'Nothing changed.';
        const { counts } = await sync.restore();
        const text = `Restored ${counts.progress} words, ${counts.days} check-in days and ${counts.events} answers.`;
        window.alert(text);
        window.location.hash = '#/today';
        return text;
      })),
    replaceButton,
    message);
  await refresh();
}
