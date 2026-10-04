// Closing a study day checks in the day when its work is done, then awards any new badges. The
// study session calls it when it ends (Study.finish in study.js), and so does the speaking panel
// (speaking.js), so the day is checked in from whichever screen finishes last.
//
//   const r = await closeDay({ store, data, day: '2026-10-05' });
//   // { day, checkedIn, justCheckedIn, streak, newBadges: ['learned-10'], left, speak }
import { normalizeSettings } from './config.js';
import { badgeFacts, newBadges } from './badges.js';
import { currentStreak } from './checkin.js';
import { isDayDone, planDay } from './plan.js';
import { speakStatus } from './speaklist.js';

// What is left of `day` and whether the day can be checked in. This is the one place that
// decides it. The learning (planDay's plan) and the speaking list (speakStatus in speaklist.js)
// must both be done (speaking practice spec of 2026-10-03, section 6). events are all saved
// events, read from `store` when not given.
export async function dayStatus({ store, data, day, settings, progress, events }) {
  const left = planDay({ words: data.words, progress, today: day, settings });
  const speak = speakStatus({ progress, events: events ?? (await store.allEvents()), day });
  return { left, speak, done: isDayDone(left) && speak.left.length === 0 };
}

// Checks in `day` when it is done and not checked in yet, and awards the badges that the saved
// progress, check-ins and events now earn, dated `day`. perfectSession is true when the session
// that just ended was perfect (session.js sessionSummary). settings default to the saved ones.
export async function closeDay({ store, data, day, settings, now = new Date(), perfectSession = false }) {
  const amounts = settings ?? normalizeSettings(await store.getMeta('settings'));
  const progress = await store.allProgress();
  // Every event is read once. The check-in event written below does not change the badge
  // numbers, which count answers and speak events and take check-ins from `days`.
  const events = await store.allEvents();
  const { left, speak, done } = await dayStatus({ store, data, day, settings: amounts, progress, events });
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
  const facts = badgeFacts({ data, progress, days, events, rewound, perfectSession });
  const earned = (await store.getMeta('badges')) ?? {};
  const fresh = newBadges(facts, earned);
  if (fresh.length) {
    const updated = { ...earned };
    for (const id of fresh) updated[id] = day;
    await store.commit({ meta: { badges: updated }, event: { day, kind: 'badges', badges: fresh, ts: now.toISOString() } });
  }
  const streak = currentStreak(days.map((d) => d.day), day, rewound);
  return { day, checkedIn, justCheckedIn, streak, newBadges: fresh, left, speak };
}
