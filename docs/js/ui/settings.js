// The Settings screen: daily amounts, auto-play, backup file and restore, saved storage,
// "Download all audio", going back to a day and resetting, the Google Sheet section that Plan 5
// adds through hooks, and credits.
import { RELEASE, WORDS_FILE } from '../release.js';
import { studyDay } from '../dates.js';
import { askPersistentStorage } from '../store.js';
import { resetAll } from '../rewind.js';
import { cacheFiles, countCached } from '../offline.js';
import { filesForWords } from '../view/files.js';
import { backupFileName, backupText, parseBackup, settingsFromForm, settingsView } from '../view/settings.js';
import { h, show } from './dom.js';

function numberField(label, name, value, [min, max]) {
  return h('label', { class: 'field' }, `${label} (${min} to ${max})`,
    h('input', { type: 'number', name, min, max, value, inputmode: 'numeric' }));
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// "Download backup file", also offered before going back to a day and before a reset.
export async function saveBackupFile(app) {
  download(backupFileName(studyDay()), backupText(await app.store.dump(), { release: RELEASE }));
}

// The confirmation of "Reset everything", drawn in the page, which offers the backup file first.
function resetPanel(app, area) {
  area.replaceChildren(
    h('p', { class: 'confirm-text' }, 'This deletes all progress on this phone: every learned word, answer, check-in, '
      + 'badge and the streak. The daily amounts, auto-play and the Google Sheet address stay. If the Google Sheet '
      + 'backup is set up, the Sheet is replaced by the empty progress too.'),
    h('button', { class: 'small', onclick: () => saveBackupFile(app) }, 'Save a backup file first'),
    h('button', {
      class: 'big danger',
      onclick: async (e) => {
        e.target.disabled = true;
        try {
          await resetAll({ store: app.store });
        } catch (err) {
          app.note(err.message);
          e.target.disabled = false;
          return;
        }
        app.lastResult = null; // the last session's result no longer holds
        await app.hooks.emit('rewound', { store: app.store });
        app.note('Everything was reset.');
        window.location.hash = '#/today';
      },
    }, 'Yes, reset everything'),
    h('button', { class: 'small', onclick: () => area.replaceChildren() }, 'Cancel'));
}

export async function renderSettings(app) {
  const saved = await app.settings();
  const v = settingsView(saved);
  const status = h('p', { class: 'muted' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const next = settingsFromForm({ newPerDay: f.get('newPerDay'), reviewCap: f.get('reviewCap'), autoplay: f.get('autoplay') === 'on' }, saved);
      await app.store.commit({ meta: { settings: next }, event: { day: studyDay(), kind: 'settings', settings: next } });
      status.textContent = `Saved: ${next.newPerDay} new words and up to ${next.reviewCap} reviews a day.`;
      form.newPerDay.value = next.newPerDay;
      form.reviewCap.value = next.reviewCap;
    },
  },
  numberField('New words per day', 'newPerDay', v.newPerDay, v.newRange),
  numberField('Most reviews per day', 'reviewCap', v.reviewCap, v.capRange),
  h('label', { class: 'field check' }, h('input', { type: 'checkbox', name: 'autoplay', checked: v.autoplay }), ' Play sounds automatically'),
  h('button', { class: 'big', type: 'submit' }, 'Save'), status);

  const protectedText = h('p', {});
  const showProtection = async () => {
    const on = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    protectedText.textContent = on ? 'Saved progress is protected from automatic clearing.' : 'Saved progress is not protected yet.';
  };
  showProtection();

  const allFiles = filesForWords(app.data.words);
  const audioText = h('p', { class: 'muted' }, 'Checking saved files...');
  countCached(allFiles).then((n) => { audioText.textContent = `${n} of ${allFiles.length} sound and stroke files are on this phone.`; });
  let stop = false;
  const downloadButton = h('button', {
    class: 'big',
    onclick: async () => {
      stop = false;
      downloadButton.disabled = true;
      const t = await cacheFiles(allFiles, {
        onProgress: (p) => { audioText.textContent = `Saving: ${p.done} of ${p.total} files${p.failed ? `, ${p.failed} failed` : ''}.`; },
        shouldStop: () => stop,
      });
      audioText.textContent = `${t.done} of ${t.total} files saved${t.failed ? `, ${t.failed} failed (try again online)` : ''}.`;
      downloadButton.disabled = false;
    },
  }, 'Download all audio (about 150 MB)');

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    onchange: async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const { dump, exported } = parseBackup(await file.text());
        const when = exported ? exported.slice(0, 10) : 'an unknown day';
        if (!window.confirm(`Replace all progress on this phone with the backup from ${when}?`)) return;
        await app.store.restore(dump);
        window.alert('Backup restored.');
        window.location.hash = '#/today';
      } catch (err) {
        window.alert(err.message);
      } finally {
        fileInput.value = '';
      }
    },
  });

  const pluginArea = h('div', {});
  const resetArea = h('div', { class: 'confirm' });
  show(app.main, h('h1', {}, 'Settings'),
    h('h2', {}, 'Daily amounts and sound'), form,
    h('h2', {}, 'Offline'), audioText, downloadButton,
    h('button', { class: 'small', onclick: () => { stop = true; } }, 'Stop downloading'),
    h('h2', {}, 'Your progress'), protectedText,
    h('button', { class: 'small', onclick: async () => { await askPersistentStorage(); showProtection(); } }, 'Protect saved progress'),
    h('button', { class: 'small', onclick: () => saveBackupFile(app) }, 'Download backup file'),
    h('label', { class: 'field' }, 'Restore from a backup file', fileInput),
    h('h2', {}, 'Go back or start again'),
    h('p', { class: 'muted' }, 'Going back to a day undoes everything after it. Resetting deletes all progress.'),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => { window.location.hash = '#/rewind'; } }, 'Go back to a day'),
      h('button', { class: 'small', onclick: () => resetPanel(app, resetArea) }, 'Reset everything')),
    resetArea,
    pluginArea,
    h('h2', {}, 'About'),
    h('p', { class: 'muted' }, `Release ${RELEASE}, word list ${WORDS_FILE.replace('data/', '')}.`),
    h('a', { href: 'credits.html' }, 'Credits and licences'));
  await app.hooks.emit('settings', { container: pluginArea, store: app.store });
}
