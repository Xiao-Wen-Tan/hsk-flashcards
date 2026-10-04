// Small text helpers shared by the screens. They never touch the page.
import { weekdayIndex } from '../dates.js';

// Part-of-speech labels of the words file, spelled out for a beginner.
const POS_NAMES = Object.freeze({
  'n.': 'noun', 'v.': 'verb', 'adj.': 'adjective', 'adv.': 'adverb', 'm.': 'measure word',
  'pron.': 'pronoun', 'prep.': 'preposition', 'conj.': 'conjunction', 'part.': 'particle',
  'num.': 'number', 'int.': 'interjection',
});

// posText(['v.', 'n.']) gives 'verb, noun'. An empty list gives ''.
export function posText(pos) {
  return pos.map((p) => POS_NAMES[p] ?? p).join(', ');
}

// percent(0.254) gives '25%'.
export function percent(share) {
  return `${Math.round(share * 100)}%`;
}

// plural(1, 'review') gives '1 review', plural(3, 'review') gives '3 reviews'.
// Numbers of 1,000 and more get thousands commas: plural(2500, 'more word') is '2,500 more words'.
export function plural(n, one, many = `${one}s`) {
  const shown = typeof n === 'number' ? n.toLocaleString('en-US') : n;
  return `${shown} ${n === 1 ? one : many}`;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

// shortDate('2026-10-05') gives 'Mon 5 Oct'.
export function shortDate(day) {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS[weekdayIndex(day)]} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

// monthTitle('2026-10') gives 'October 2026'.
export function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export const WEEKDAY_LETTERS = Object.freeze(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
export const WEEKDAY_SHORT = Object.freeze(WEEKDAYS);

// Six bright colours of the bright look (spec of 2026-10-03, section 4): orange, yellow, green,
// blue, violet and pink. The themes take them in turn, and the confetti uses them too.
export const THEME_COLORS = Object.freeze(['#ff6b35', '#ffb703', '#38b000', '#3a86ff', '#8338ec', '#ff006e']);

// A theme's colour, for its map tiles and the band at the top of its cards. The themes take the
// six colours in turn by their order, so themes 1, 7, 13, 19 and 25 are orange and theme 6 is
// pink. themes is the words file's theme list. An unknown theme gets the first colour.
export function themeColor(themeId, themes = []) {
  const order = themes.find((t) => t.id === themeId)?.order ?? 1;
  return THEME_COLORS[(order - 1) % THEME_COLORS.length];
}
