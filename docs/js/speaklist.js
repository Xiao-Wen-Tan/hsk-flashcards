// The speaking list of a study day (speaking practice spec of 2026-10-03, section 2). Pure
// functions over the saved word records and events, so Node tests them.
//
// The list of a day holds every word studied that day, which is every word record whose
// lessonDay or lastReview is the day (new words, lessons that ended without passing, and reviewed
// words), and every word whose latest speak event before that day is a skip. It is done when
// every word in it has a speak event on that day. A speak event is saved once per finished word:
//   { day, kind: 'speak', id, result: 'pass' | 'skip' | 'listened', tries, check: { tones, heard }, ts }
import { liveEvents } from './stats.js';

export const SPEAK_RESULTS = Object.freeze(['pass', 'skip', 'listened']);

const speakEvents = (events) => events.filter((e) => e.kind === 'speak');

// The words whose latest speak event before `day` is a skip, oldest skip first.
function carried(speaks, day) {
  const last = new Map();
  for (const e of speaks) if (e.day < day) last.set(e.id, e);
  return [...last.values()].filter((e) => e.result === 'skip').sort((a, b) => a.seq - b.seq).map((e) => e.id);
}

// The IDs of the day's speaking list. The words studied that day come first, in the order they
// were first answered, then the words carried over from earlier skips.
//   speakList({ progress, events, day: '2026-10-06' }) gives ['w0013', 'w0014', ..., 'w0002']
export function speakList({ progress, events, day }) {
  const studied = new Set(progress.filter((p) => p.lessonDay === day || p.lastReview === day).map((p) => p.id));
  const order = [];
  for (const e of liveEvents(events.filter((x) => x.day === day))) {
    if (studied.has(e.id) && !order.includes(e.id)) order.push(e.id);
  }
  for (const id of [...studied].sort()) if (!order.includes(id)) order.push(id);
  for (const id of carried(speakEvents(events), day)) if (!order.includes(id)) order.push(id);
  return order;
}

// The day's list with what is done and what is left, as { list, done, left }. A word is done
// when it has a speak event on the day.
export function speakStatus({ progress, events, day }) {
  const list = speakList({ progress, events, day });
  const spoken = new Set(speakEvents(events).filter((e) => e.day === day).map((e) => e.id));
  return { list, done: list.filter((id) => spoken.has(id)), left: list.filter((id) => !spoken.has(id)) };
}

// True when the word was spoken well (result 'pass') on a day before `day`. Such a word starts
// at "Your turn" (speakflow.js).
export function spokenWellBefore(events, id, day) {
  return events.some((e) => e.kind === 'speak' && e.id === id && e.result === 'pass' && e.day < day);
}
