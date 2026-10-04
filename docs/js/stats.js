// Numbers for the Stats screen, the progress map and badges. All functions are pure:
// they take progress records, events and days and return plain objects.
import { CONFIG } from './config.js';
import { addDays, dayRange } from './dates.js';
import { PASS, isLearned, isMastered } from './srs.js';

// Events without the ones taken back by Undo. An undo event { kind: 'undo', target: 12 }
// removes event 12, and is itself left out.
export function liveEvents(events) {
  const undone = new Set(events.filter((e) => e.kind === 'undo').map((e) => e.target));
  return events.filter((e) => e.kind !== 'undo' && !undone.has(e.seq));
}

// The event kinds that are quiz answers (session.js card types). A learning card has no answer.
export const ANSWER_KINDS = Object.freeze(['review', 'reask', 'check', 'final']);

// The quiz answers among events, without the ones Undo took back.
export function answerEvents(events) {
  return liveEvents(events).filter((e) => ANSWER_KINDS.includes(e.kind));
}

// The minutes studied add up the gaps between the times of `events`, each gap counted as at
// most 5 minutes, so a break does not count. The caller picks the events, for example one
// day's answers. Answers at 19:00:00, 19:00:20 and 19:40:00 give 20 s + 5 min = 5.3 minutes.
export function minutesOf(events) {
  const times = events.map((e) => Date.parse(e.ts)).filter(Number.isFinite).sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < times.length; i += 1) ms += Math.min(times[i] - times[i - 1], 5 * 60 * 1000);
  return Math.round(ms / 6000) / 10;
}

export function totals(progressList) {
  let learned = 0;
  let mastered = 0;
  for (const p of progressList) {
    if (isLearned(p)) learned += 1;
    if (isMastered(p)) mastered += 1;
  }
  return { learned, mastered };
}

function countGroup(words, progressById) {
  let learned = 0;
  let mastered = 0;
  for (const w of words) {
    const p = progressById.get(w.id);
    if (isLearned(p)) learned += 1;
    if (isMastered(p)) mastered += 1;
  }
  return { total: words.length, learned, mastered };
}

// [{ lv: 1, total, learned, mastered }, ...] for each HSK level in the word list, for the Stats screen.
export function levelProgress(words, progressById) {
  const levels = [...new Set(words.map((w) => w.lv))].sort((a, b) => a - b);
  return levels.map((lv) => ({ lv, ...countGroup(words.filter((w) => w.lv === lv), progressById) }));
}

// The level groups of the learning order, as the user decided on 2026-09-29. HSK 1 and 2
// are learned together, then HSK 3, 4, 5 and 6 each on its own. tools/themes.py LEVEL_GROUPS repeats them.
export const LEVEL_GROUPS = Object.freeze([
  { id: '1-2', label: 'HSK 1-2', levels: [1, 2] },
  { id: '3', label: 'HSK 3', levels: [3] },
  { id: '4', label: 'HSK 4', levels: [4] },
  { id: '5', label: 'HSK 5', levels: [5] },
  { id: '6', label: 'HSK 6', levels: [6] },
].map((g) => Object.freeze(g)));

// The level group with this ID, for example groupById('3'), or undefined.
export function groupById(id) {
  return LEVEL_GROUPS.find((g) => g.id === id);
}

export function wordsOfGroup(words, group) {
  return words.filter((w) => group.levels.includes(w.lv));
}

// The IDs of the level groups whose words are all learned, for example ['1-2'].
export function groupsDone(words, progressById) {
  return LEVEL_GROUPS.filter((g) => {
    const c = countGroup(wordsOfGroup(words, g), progressById);
    return c.total > 0 && c.learned === c.total;
  }).map((g) => g.id);
}

// The progress map. Words are taught level group first, then theme (see ord), so the map has
// one section per level group that has words, in group order. A section lists the themes
// with words in that group, in theme order, and a tile counts only that group's words of
// its theme. A tile is 'done' when all those words are learned, 'current' when it holds the
// next new word (the lowest ord not learned yet), 'started' when some of its words are
// learned, and 'locked' when none is. A section is done when all its words are learned.
// A tile can be started without being current when a failed lesson sends the next new word
// back to an earlier tile.
// For example, with Food & Drink's 3 HSK 1-2 words learned and its 1 HSK 3 word not, the
// HSK 1-2 section shows Food & Drink done (3 of 3) and the HSK 3 section shows it at 0 of 1.
export function mapSections(themes, words, progressById) {
  const next = words.filter((w) => !isLearned(progressById.get(w.id)))
    .reduce((a, w) => (a === null || w.ord < a.ord ? w : a), null);
  const ordered = themes.slice().sort((a, b) => a.order - b.order);
  return LEVEL_GROUPS.map((g) => {
    const inGroup = wordsOfGroup(words, g);
    const section = countGroup(inGroup, progressById);
    const tiles = ordered.map((t) => {
      const members = inGroup.filter((w) => w.theme === t.id);
      if (!members.length) return null;
      const c = countGroup(members, progressById);
      let status = 'locked';
      if (c.learned === c.total) status = 'done';
      else if (next && members.includes(next)) status = 'current';
      else if (c.learned > 0) status = 'started';
      return {
        id: t.id, name: t.name, order: t.order, ...c,
        learnedShare: c.learned / c.total,
        masteredShare: c.mastered / c.total,
        status,
      };
    }).filter(Boolean);
    return { id: g.id, label: g.label, ...section, done: section.total > 0 && section.learned === section.total, tiles };
  }).filter((s) => s.total > 0);
}

// The IDs of the themes whose words, in every level group, are all learned.
export function themesDone(themes, words, progressById) {
  return themes.slice().sort((a, b) => a.order - b.order).filter((t) => {
    const c = countGroup(words.filter((w) => w.theme === t.id), progressById);
    return c.total > 0 && c.learned === c.total;
  }).map((t) => t.id);
}

// Reviews answered and words learned on each of the last `days` study days, oldest first.
export function activity(events, checkedDays, today, days = CONFIG.statsDays.activity) {
  const checked = new Set(checkedDays);
  const rows = new Map(dayRange(addDays(today, -(days - 1)), days)
    .map((day) => [day, { day, reviews: 0, learned: 0, checkedIn: checked.has(day) }]));
  for (const e of liveEvents(events)) {
    const row = rows.get(e.day);
    if (!row) continue;
    if (e.kind === 'review') row.reviews += 1;
    if (e.outcome === 'learned') row.learned += 1;
  }
  return [...rows.values()];
}

// Reviews due on each of the next `days` days. Overdue words count on today.
export function forecast(progressList, today, days = CONFIG.statsDays.forecast) {
  const rows = dayRange(today, days).map((day) => ({ day, due: 0 }));
  const last = rows[rows.length - 1].day;
  for (const p of progressList) {
    if (!isLearned(p) || p.due > last) continue;
    const row = p.due <= today ? rows[0] : rows.find((r) => r.day === p.due);
    row.due += 1;
  }
  return rows;
}

// Share of scheduled reviews answered right (right or Know it) over the last `days` days.
// rate is null when there were no reviews.
export function accuracy(events, today, days = CONFIG.statsDays.accuracy) {
  const from = addDays(today, -(days - 1));
  const reviews = liveEvents(events).filter((e) => e.kind === 'review' && e.day >= from && e.day <= today);
  const right = reviews.filter((e) => PASS.has(e.grade)).length;
  return { answered: reviews.length, right, rate: reviews.length ? right / reviews.length : null };
}
