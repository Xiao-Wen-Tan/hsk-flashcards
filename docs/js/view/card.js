// What the learning card shows. The same card is used for a new word and after every
// quiz answer. It never touches the page, so Node can test it.
import { charsOf } from '../strokes.js';
import { posText, themeColor } from './format.js';

export const AUDIO_BASE = 'audio/';

// The example sentence cut into plain and highlighted parts. A pattern word such as
// 虽然…但是… is highlighted half by half, because the sentence writes its halves apart.
// highlightParts('我爱我的家。', '爱') gives
//   [{ text: '我', hl: false }, { text: '爱', hl: true }, { text: '我的家。', hl: false }].
export function highlightParts(sentence, hz) {
  const heads = hz.split('…').filter(Boolean).sort((a, b) => b.length - a.length);
  const parts = [];
  let plain = '';
  let i = 0;
  while (i < sentence.length) {
    const head = heads.find((h) => sentence.startsWith(h, i));
    if (head) {
      if (plain) parts.push({ text: plain, hl: false });
      plain = '';
      parts.push({ text: head, hl: true });
      i += head.length;
    } else {
      plain += sentence[i];
      i += 1;
    }
  }
  if (plain) parts.push({ text: plain, hl: false });
  return parts;
}

// How many times the word plays when the card opens. A new word's card (and a word opened
// from the map) plays it twice. The card after a quiz answer plays it once, because the
// question has just played it (the user's decision of 2026-09-28).
export const PLAYS_NEW = 2;
export const PLAYS_AFTER_ANSWER = 1;

// Everything the learning card shows for one word of the words file.
// learningCard(apple).plays is 2, learningCard(apple, { afterAnswer: true }).plays is 1.
// color is the colour of the word's theme (themeColor), for the band at the top of the card.
export function learningCard(word, { afterAnswer = false, themes = [] } = {}) {
  return {
    id: word.id,
    color: themeColor(word.theme, themes),
    hz: word.hz,
    py: word.py,
    pos: posText(word.pos),
    en: word.en,
    wordAudio: AUDIO_BASE + word.au,
    chars: charsOf(word.hz),
    sentence: highlightParts(word.ex.hz, word.hz),
    sentencePy: word.ex.py,
    sentenceEn: word.ex.en,
    sentenceAudio: AUDIO_BASE + word.ex.au,
    plays: afterAnswer ? PLAYS_AFTER_ANSWER : PLAYS_NEW,
  };
}
