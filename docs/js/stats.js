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

// [{ lv: 1, total, learned, mastered }, ...] for each HSK level in the word list.
export function levelProgress(words, progressById) {
  const levels = [...new Set(words.map((w) => w.lv))].sort((a, b) => a - b);
  return levels.map((lv) => ({ lv, ...countGroup(words.filter((w) => w.lv === lv), progressById) }));
}

export function levelsDone(words, progressById) {
  return levelProgress(words, progressById).filter((l) => l.learned === l.total).map((l) => l.lv);
}

// One tile per theme for the progress map. A theme is 'done' when every word is learned,
// the first theme that is not done is 'current', and the rest are 'locked'.
export function themeProgress(themes, words, progressById) {
  const byTheme = new Map(themes.map((t) => [t.id, []]));
  for (const w of words) byTheme.get(w.theme)?.push(w);
  let currentGiven = false;
  return themes.slice().sort((a, b) => a.order - b.order).map((t) => {
    const c = countGroup(byTheme.get(t.id), progressById);
    let status = 'locked';
    if (c.total > 0 && c.learned === c.total) status = 'done';
    else if (!currentGiven) { status = 'current'; currentGiven = true; }
    return {
      id: t.id, name: t.name, order: t.order, ...c,
      learnedShare: c.total ? c.learned / c.total : 0,
      masteredShare: c.total ? c.mastered / c.total : 0,
      status,
    };
  });
}

export function themesDone(themes, words, progressById) {
  return themeProgress(themes, words, progressById).filter((t) => t.status === 'done').map((t) => t.id);
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
