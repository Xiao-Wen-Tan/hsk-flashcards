// Draws the learning card: characters, pinyin, part of speech, meaning, the replay button,
// the "Stroke order" button and the example sentence with its own play button.
import { learningCard } from '../view/card.js';
import { animateWord } from '../strokes.js';
import { h } from './dom.js';

// Plays a sound and turns a refusal into the "Tap to continue" screen (app.needTap).
export function playSound(app, url, times) {
  app.player.play(url, times).catch((err) => {
    if (err && err.name === 'NotAllowedError') app.needTap(() => playSound(app, url, times));
    else app.note('Sound is not on this phone yet. It plays when the phone is online.');
  });
}

// The card element for one word. With autoplay, the word's sound plays at once, twice on a
// new word's card and once on the card after a quiz answer (afterAnswer). "Play again"
// plays it the same number of times.
export function cardElement(app, word, { autoplay, afterAnswer = false }) {
  const c = learningCard(word, { afterAnswer, themes: app.data.themes });
  const strokes = h('div', { class: 'strokes', hidden: true });
  const strokeButton = h('button', {
    class: 'small',
    onclick: async () => {
      strokes.hidden = false;
      strokes.replaceChildren(h('p', { class: 'muted' }, 'Loading...'));
      try {
        await animateWord(strokes, c.hz);
      } catch (err) {
        strokes.replaceChildren(h('p', { class: 'muted' }, err.message));
      }
    },
  }, 'Stroke order');
  const el = h('section', { class: 'card', style: `--theme:${c.color}` },
    h('div', { class: 'hz', lang: 'zh-CN' }, c.hz),
    h('div', { class: 'py' }, c.py),
    c.pos ? h('div', { class: 'pos' }, c.pos) : null,
    h('div', { class: 'en' }, c.en),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => playSound(app, c.wordAudio, c.plays) }, 'Play again'),
      strokeButton),
    strokes,
    h('div', { class: 'example' },
      h('div', { class: 'ex-hz', lang: 'zh-CN' }, c.sentence.map((p) => (p.hl ? h('mark', {}, p.text) : p.text))),
      h('div', { class: 'ex-py' }, c.sentencePy),
      h('div', { class: 'ex-en' }, c.sentenceEn),
      h('button', { class: 'small', onclick: () => playSound(app, c.sentenceAudio, 1) }, 'Play sentence')));
  if (autoplay) playSound(app, c.wordAudio, c.plays);
  return el;
}
