// The Session screen. It asks Plan 2's Study controller for each card and sends it every
// answer. The screen itself only remembers the feedback of the last multiple-choice answer
// (app.feedback), so the full learning card can be shown before the learner taps Next.
import { Study } from '../study.js';
import { askPersistentStorage } from '../store.js';
import { cacheFiles } from '../offline.js';
import { filesForWords, soonWords } from '../view/files.js';
import { feedbackFor, gradeFor, progressLabel, questionView } from '../view/quiz.js';
import { cardElement, playSound } from './card.js';
import { h, show } from './dom.js';

const autoplayOn = (app) => app.study.settings.autoplay !== false;

// Start (or continue) today's session. The tap on Start also lets Chrome play sound.
export async function startSession(app) {
  app.player.stop();
  app.study = await Study.start({ store: app.store, data: app.data });
  app.feedback = null;
  app.revealed = false;
  const progress = await app.store.allProgress();
  const soon = soonWords({ words: app.data.words, progress, plan: app.study.plan, settings: app.study.settings });
  cacheFiles(filesForWords(soon)).catch((err) => console.warn('Saving files failed:', err));
  window.location.hash = '#/session';
}

// End the session, finished or not, and show the check-in screen unless `quiet`.
export async function endSession(app, { quiet = false } = {}) {
  const study = app.study;
  if (!study) return;
  app.study = null;
  app.player.stop();
  const result = await study.finish();
  app.lastResult = result;
  await app.hooks.emit('sessionEnd', { store: app.store, result });
  askPersistentStorage().catch(() => {});
  if (!quiet) window.location.hash = '#/checkin';
}

function header(app) {
  const study = app.study;
  return h('div', { class: 'session-top' },
    h('button', {
      class: 'small',
      onclick: () => { if (window.confirm('Stop for now? Your answers so far are saved.')) endSession(app); },
    }, 'Stop'),
    h('span', { class: 'muted' }, progressLabel(study.state)),
    h('button', {
      class: 'small',
      disabled: !study.canUndo,
      onclick: async () => {
        app.player.stop();
        app.feedback = null;
        app.revealed = false;
        await study.undo();
        renderSession(app);
      },
    }, 'Undo'));
}

// Saves one answer. app.busy ignores a second tap while the first is being saved.
async function answer(app, grade, feedback) {
  if (app.busy) return;
  app.busy = true;
  try {
    app.player.stop();
    await app.study.answer(grade);
    app.feedback = feedback;
    app.revealed = false;
  } finally {
    app.busy = false;
  }
  renderSession(app);
}

function next(app) {
  app.player.stop();
  app.feedback = null;
  renderSession(app);
}

export function renderSession(app) {
  const study = app.study;
  if (!study) {
    window.location.hash = '#/today';
    return;
  }
  if (study.finished && !app.feedback) {
    endSession(app);
    return;
  }
  const main = app.main;
  // After a multiple-choice answer the screen shows the result, the full learning card and Next.
  // That card plays the word once, because the question has just played it.
  if (app.feedback) {
    const { word, fb } = app.feedback;
    show(main, header(app),
      h('div', { class: fb.right ? 'banner right' : 'banner wrong' }, fb.message),
      cardElement(app, word, { autoplay: autoplayOn(app), afterAnswer: true }),
      h('button', { class: 'big', onclick: () => next(app) }, 'Next'));
    return;
  }
  const card = study.card;
  const word = app.wordsById.get(card.id);
  const step = study.byId.get(card.id)?.step ?? 0;
  const view = questionView({ card, word, pool: app.pool, day: study.day, step });
  if (view.kind === 'learn') {
    show(main, header(app), h('p', { class: 'heading' }, view.heading),
      cardElement(app, word, { autoplay: autoplayOn(app) }),
      h('button', { class: 'big', onclick: () => { app.player.stop(); study.next(); renderSession(app); } }, 'Next'));
    return;
  }
  if (view.kind === 'recall') {
    // A recall card shows characters, pinyin and sound. Reveal then shows the full card with the ratings.
    if (!app.revealed) {
      show(main, header(app), h('p', { class: 'heading' }, view.heading),
        h('div', { class: 'hz big-hz', lang: 'zh-CN' }, view.hz),
        h('div', { class: 'py' }, view.py),
        h('button', { class: 'small', onclick: () => playSound(app, view.sound, 2) }, 'Play sound'),
        h('p', { class: 'prompt' }, view.prompt),
        h('button', { class: 'big', onclick: () => { app.revealed = true; renderSession(app); } }, 'Reveal'));
      if (autoplayOn(app)) playSound(app, view.sound, 2);
      return;
    }
    show(main, header(app), h('p', { class: 'heading' }, view.heading),
      cardElement(app, word, { autoplay: false }),
      h('div', { class: 'grades' }, view.grades.map((g) => h('button', {
        class: `big grade-${g.grade}`,
        onclick: () => answer(app, g.grade, null),
      }, g.label))));
    return;
  }
  // A listening or pinyin question has four choices. The pinyin question shows the characters
  // but never tests them. The listening question hides them (view.hz is null).
  const choiceButtons = view.choices.map((text, i) => h('button', {
    class: 'choice',
    lang: view.kind === 'pinyin' ? 'zh-Latn-pinyin' : 'en',
    onclick: () => answer(app, gradeFor(view, i), { word, fb: feedbackFor(view, i) }),
  }, text));
  show(main, header(app), h('p', { class: 'heading' }, view.heading),
    view.hz ? h('div', { class: 'hz big-hz', lang: 'zh-CN' }, view.hz) : null,
    view.kind === 'pinyin' ? h('div', { class: 'en' }, view.en) : null,
    view.sound ? h('button', { class: 'small', onclick: () => playSound(app, view.sound, 2) }, 'Play sound') : null,
    h('p', { class: 'prompt' }, view.prompt),
    h('div', { class: 'choices' }, choiceButtons));
  if (view.sound && autoplayOn(app)) playSound(app, view.sound, 2);
}
