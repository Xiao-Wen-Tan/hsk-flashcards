// Closing a study day checks in the day when its work is done, then awards any new badges. The
// study session calls it when it ends (Study.finish in study.js). Plan 7's speaking panel will call it
// too, so the day is checked in from whichever screen finishes last.
//
//   const r = await closeDay({ store, data, day: '2026-10-05' });
//   // { day, checkedIn, justCheckedIn, streak, newBadges: ['learned-10'], left }
import { normalizeSettings } from './config.js';
import { badgeFacts, newBadges } from './badges.js';
import { currentStreak } from './checkin.js';
import { isDayDone, planDay } from './plan.js';

// What is left of `day` (planDay's plan) and whether the day can be checked in. This is the one
// place that decides it. Plan 7 adds the speaking list here (read from `store`, which is unused
// until then), so the callers never change.
export async function dayStatus({ store, data, day, settings, progress }) {
  const left = planDay({ words: data.words, progress, today: day, settings });
  return { left, done: isDayDone(left) };
}

// Checks in `day` when it is done and not checked in yet, and awards the badges that the saved
// progress, check-ins and events now earn, dated `day`. perfectSession is true when the session
// that just ended was perfect (session.js sessionSummary). settings default to the saved ones.
export async function closeDay({ store, data, day, settings, now = new Date(), perfectSession = false }) {
  const amounts = settings ?? normalizeSettings(await store.getMeta('settings'));
  const progress = await store.allProgress();
  const { left, done } = await dayStatus({ store, data, day, settings: amounts, progress });
  const days = await store.allDays();
  let checkedIn = days.some((d) => d.day === day);
  let justCheckedIn = false;
  if (!checkedIn && done) {
    const record = { day, at: now.toISOString(), reviews: left.reviewsDone, newWords: left.newDone };
    await store.commit({ days: [record], event: { day, kind: 'checkin', ts: now.toISOString() } });
    days.push(record);
    checkedIn = true;
    justCheckedIn = true;
  }
  const rewound = (await store.getMeta('rewound')) ?? [];
  const facts = badgeFacts({ data, progress, days, events: await store.allEvents(), rewound, perfectSession });
  const earned = (await store.getMeta('badges')) ?? {};
  const fresh = newBadges(facts, earned);
  if (fresh.length) {
    const updated = { ...earned };
    for (const id of fresh) updated[id] = day;
    await store.commit({ meta: { badges: updated }, event: { day, kind: 'badges', badges: fresh, ts: now.toISOString() } });
  }
  const streak = currentStreak(days.map((d) => d.day), day, rewound);
  return { day, checkedIn, justCheckedIn, streak, newBadges: fresh, left };
}
