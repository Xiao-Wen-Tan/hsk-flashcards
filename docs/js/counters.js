// Counters for Today, the check-in screen and Stats (spec of 2026-10-03, section 2). All of them
// come from the answers, speak events and check-ins the app saves. Pure functions, so Node tests them.
//   events       saved events (store.allEvents() or store.eventsFrom(day)), with Undo still in them
//   checkedDays  the checked-in study days, such as ['2026-10-05', '2026-10-06']
// Definitions:
//   accuracy   the share of a day's quiz answers that were right (right or Know it), a whole percent
//   minutes    the gaps between a day's answers and speak events, each at most 5 minutes
//              (minutesOf and timedEvents in stats.js)
//   spoken     the words finished in speaking practice that were spoken, not skipped
//   study day  a day with any answer, speak event or check-in
//   perfect    a checked-in day with at least one answer, every one of them right
//   week       Monday to Sunday;  month  the calendar month
import { addDays, dayRange, mondayOf } from './dates.js';
import { PASS } from './srs.js';
import { answerEvents, minutesOf, totals } from './stats.js';
import { bestStreak } from './checkin.js';

const emptyDay = (day) => ({ day, newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, spoken: 0, minutes: 0 });
const round1 = (n) => Math.round(n * 10) / 10;
const sum = (rows, key) => rows.reduce((total, r) => total + r[key], 0);

// Each day's numbers, worked out in one pass, as a Map from day to
// { day, newWords, reviews, answers, right, accuracy, spoken, minutes }. Days without answers
// and speak events are absent. A day with speak events only has accuracy null.
export function statsByDay(events) {
  const byDay = new Map();
  const of = (day) => {
    if (!byDay.has(day)) byDay.set(day, { answers: [], speaks: [] });
    return byDay.get(day);
  };
  for (const e of answerEvents(events)) of(e.day).answers.push(e);
  for (const e of events) if (e.kind === 'speak') of(e.day).speaks.push(e);
  const out = new Map();
  for (const [day, { answers, speaks }] of byDay) {
    const right = answers.filter((e) => PASS.has(e.grade)).length;
    out.set(day, {
      day,
      newWords: answers.filter((e) => e.outcome === 'learned').length,
      reviews: answers.filter((e) => e.kind === 'review').length,
      answers: answers.length,
      right,
      accuracy: answers.length ? Math.round((100 * right) / answers.length) : null,
      spoken: speaks.filter((e) => e.result !== 'skip').length,
      minutes: minutesOf([...answers, ...speaks]),
    });
  }
  return out;
}

// One day's numbers. A day of 5 answers, 4 of them right, has accuracy 80.
export function dayStats(events, day) {
  return statsByDay(events.filter((e) => e.day === day)).get(day) ?? emptyDay(day);
}

// Today's numbers and the ring of the Today screen. plan is planDay's result for today and speak
// the speaking list's status (speakStatus in speaklist.js). The ring is the share of today's work
// that is done, where the work is every planned word to study and every word to speak. A word
// still to study will also be spoken, so it counts twice, unless it is on the speaking list
// already (skipped on an earlier day). For example, with 2 reviews studied and spoken, and 2
// reviews and 4 new words left, 4 of 16 are done and the ring is 0.25. With nothing to do at all
// the ring is full.
export function todayCounters({ events, plan, day, speak = { list: [], done: [], left: [] } }) {
  const toStudy = [...plan.reviews, ...plan.newWords];
  const listed = new Set(speak.list);
  const done = plan.reviewsDone + plan.newDone + speak.done.length;
  const left = toStudy.length + speak.left.length + toStudy.filter((id) => !listed.has(id)).length;
  return { ...dayStats(events, day), done, left, ring: left === 0 ? 1 : done / (done + left) };
}

// This week, Monday to Sunday. thisWeek('2026-10-07') gives 5 to 11 October.
export function thisWeek(today) {
  const from = mondayOf(today);
  return { from, to: addDays(from, 6) };
}

// This calendar month. thisMonth('2026-10-07') gives 1 to 31 October.
export function thisMonth(today) {
  const from = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

function studyDays(byDay, checkedDays, inRange = () => true) {
  return new Set([...byDay.keys(), ...checkedDays].filter(inRange)).size;
}

// Totals from `from` to `to`, both included, as { newWords, reviews, spoken, studyDays, minutes }.
export function periodTotals(events, checkedDays, from, to) {
  const inRange = (day) => day >= from && day <= to;
  const byDay = statsByDay(events.filter((e) => inRange(e.day)));
  const days = [...byDay.values()];
  return {
    newWords: sum(days, 'newWords'),
    reviews: sum(days, 'reviews'),
    spoken: sum(days, 'spoken'),
    studyDays: studyDays(byDay, checkedDays, inRange),
    minutes: round1(sum(days, 'minutes')),
  };
}

// The last `n` days up to today, oldest first, for a bar chart of new words and reviews. height
// is the day's new words and reviews as a share of the busiest day's.
export function bars(events, checkedDays, today, n) {
  const first = addDays(today, -(n - 1));
  const byDay = statsByDay(events.filter((e) => e.day >= first && e.day <= today));
  const checked = new Set(checkedDays);
  const rows = dayRange(first, n).map((day) => {
    const s = byDay.get(day) ?? emptyDay(day);
    return { day, newWords: s.newWords, reviews: s.reviews, minutes: s.minutes, checkedIn: checked.has(day) };
  });
  const top = Math.max(1, ...rows.map((r) => r.newWords + r.reviews));
  return rows.map((r) => ({ ...r, height: (r.newWords + r.reviews) / top }));
}

function perfectOf(byDay, checkedDays) {
  return [...new Set(checkedDays)].sort().filter((day) => {
    const s = byDay.get(day);
    return Boolean(s) && s.answers > 0 && s.right === s.answers;
  });
}

// The checked-in days on which every quiz answer was right, oldest first.
export function perfectDays(events, checkedDays) {
  return perfectOf(statsByDay(events), checkedDays);
}

// How many calendar weeks, Monday to Sunday, have a check-in on all 7 days.
export function fullWeeks(checkedDays) {
  const set = new Set(checkedDays);
  const mondays = new Set(checkedDays.map(mondayOf));
  return [...mondays].filter((monday) => dayRange(monday, 7).every((day) => set.has(day))).length;
}

// The all-time records of the Stats screen. progress is the list of saved word records, and
// rewound the meta 'rewound' day ranges (see checkin.js).
export function allTime({ events, checkedDays, progress, rewound = [] }) {
  const byDay = statsByDay(events);
  const days = [...byDay.values()];
  return {
    bestStreak: bestStreak(checkedDays, rewound),
    perfectDays: perfectOf(byDay, checkedDays).length,
    reviews: sum(days, 'reviews'),
    ...totals(progress),
    studyDays: studyDays(byDay, checkedDays),
    minutes: round1(sum(days, 'minutes')),
  };
}

// Notes for the check-in screen when one of today's four numbers is a personal best. New words
// and reviews are compared with every earlier day, accuracy and minutes with the earlier days of
// this week. Only a number higher than all of them counts, and there must be one to beat.
export function personalBests({ events, today }) {
  const byDay = statsByDay(events);
  const now = byDay.get(today);
  if (!now) return [];
  const earlier = [...byDay.values()].filter((d) => d.day < today);
  const week = earlier.filter((d) => d.day >= mondayOf(today));
  const beats = (list, key) => list.length > 0 && list.every((d) => now[key] > d[key]);
  const out = [];
  if (now.newWords > 0 && beats(earlier, 'newWords')) out.push('Most words in a day!');
  if (now.reviews > 0 && beats(earlier, 'reviews')) out.push('Most reviews in a day!');
  if (now.accuracy !== null && beats(week.filter((d) => d.accuracy !== null), 'accuracy')) out.push('Best accuracy this week!');
  if (now.minutes > 0 && beats(week, 'minutes')) out.push('Most minutes this week!');
  return out;
}
