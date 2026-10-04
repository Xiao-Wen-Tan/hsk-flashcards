// Going back to a day, and resetting (spec of 2026-10-03, section 1).
//
// Going back to `toDay` undoes every answer of a later study day, newest first. Each saved answer
// holds the word's record from just before it (`before`) and just after it (`after`), see
// Study.answer in study.js. Undoing newest first ends with each word's `before` of its earliest
// undone answer that changed the record, so that record is put back, or the word's record is
// removed when that `before` is empty (the word was new). Answers that Undo had already taken
// back are skipped. The check-ins and badges after toDay are removed too, the days from toDay + 1
// to yesterday are stored as rewound (meta 'rewound', see checkin.js), and the streak becomes
// what it was at the end of toDay.
//
// For example, the learner studied on 1, 2, 3 and 4 October and, on 5 October, went back to
// 2 October. The answers and check-ins of 3 and 4 October are undone, 3 and 4 October are rewound, the streak is 2
// (3 after checking in on 5 October), and a 3-day streak badge of 3 October is removed.
import { addDays } from './dates.js';
import { currentStreak } from './checkin.js';
import { ANSWER_KINDS, liveEvents } from './stats.js';
import { plural } from './view/format.js';

// The events a rewind keeps whatever their day, which are settings changes and earlier rewinds
// and resets.
export const KEPT_KINDS = Object.freeze(['settings', 'rewind', 'reset']);

// The days the learner may go back to, oldest first. They are the days before today with a
// check-in or a live answer, and before the last such day, as going back to the last one would
// undo nothing.
export function rewindChoices({ events, days, today }) {
  const active = new Set(days.map((d) => d.day));
  for (const e of liveEvents(events)) if (ANSWER_KINDS.includes(e.kind)) active.add(e.day);
  const sorted = [...active].sort();
  const last = sorted.at(-1);
  return sorted.filter((day) => day < today && day < last);
}

// The rewound day ranges with from..to added, joined where they touch or overlap, oldest first.
// Nothing is added when `from` is after `to` (going back to yesterday).
export function addRange(rewound, from, to) {
  const ranges = rewound.map(([a, b]) => [a, b]);
  if (from <= to) ranges.push([from, to]);
  ranges.sort((x, y) => x[0].localeCompare(y[0]));
  const out = [];
  for (const [a, b] of ranges) {
    const prev = out.at(-1);
    if (prev && a <= addDays(prev[1], 1)) prev[1] = b > prev[1] ? b : prev[1];
    else out.push([a, b]);
  }
  return out;
}

// What going back to `toDay` on `today` changes, without changing anything:
//   put, remove   word records to put back, and word IDs whose record goes
//   eventSeqs     seq numbers of the events to delete (every event after toDay but KEPT_KINDS)
//   dayKeys       check-in days to delete
//   badges        the badges map that stays (badges earned on or before toDay)
//   rewound       the new rewound day ranges
//   counts        { days, newWords, reviews } undone, for the confirmation
//   streakAfter   the streak after going back
// events are all saved events (store.allEvents()), days the check-in records, badges the saved
// { badgeId: day } map and rewound the saved ranges. Throws when toDay is not before today, or
// when an undone answer was saved without its word records.
export function rewindPlan({ events, days, badges = {}, rewound = [], toDay, today }) {
  if (!(toDay < today)) throw new Error('Pick a day before today.');
  const undone = liveEvents(events).filter((e) => ANSWER_KINDS.includes(e.kind) && e.day > toDay)
    .sort((a, b) => a.seq - b.seq);
  const bad = undone.find((e) => !('before' in e) || !('after' in e));
  if (bad) throw new Error(`Answer ${bad.seq} cannot be undone, because it was saved without the word's records.`);
  const first = new Map();
  for (const e of undone) if (e.after !== null && !first.has(e.id)) first.set(e.id, e.before);
  const put = [];
  const remove = [];
  for (const [id, before] of first) {
    if (before) put.push(before);
    else remove.push(id);
  }
  const dayKeys = days.map((d) => d.day).filter((day) => day > toDay).sort();
  const ranges = addRange(rewound, addDays(toDay, 1), addDays(today, -1));
  const left = days.map((d) => d.day).filter((day) => day <= toDay);
  return {
    put,
    remove,
    eventSeqs: events.filter((e) => e.day > toDay && !KEPT_KINDS.includes(e.kind)).map((e) => e.seq),
    dayKeys,
    badges: Object.fromEntries(Object.entries(badges).filter(([, day]) => day <= toDay)),
    rewound: ranges,
    counts: {
      days: new Set([...undone.map((e) => e.day), ...dayKeys]).size,
      newWords: undone.filter((e) => e.outcome === 'learned').length,
      reviews: undone.filter((e) => e.kind === 'review').length,
    },
    streakAfter: currentStreak(left, today, ranges),
  };
}

// The confirmation, for example 'Undo 3 days: 36 new words and 120 reviews. Your streak becomes 5 days.'
export function confirmText(plan) {
  const { days, newWords, reviews } = plan.counts;
  return `Undo ${plural(days, 'day')}: ${plural(newWords, 'new word')} and ${plural(reviews, 'review')}. `
    + `Your streak becomes ${plural(plan.streakAfter, 'day')}.`;
}
