// Milestone badges. A badge ID is a short text, for example 'streak-7', 'learned-all',
// 'reviews-1000', 'minutes-60', 'spoken-10', 'perfectday-7', 'week-2', 'theme-t05', 'hsk-1-2' or 'perfect'.
// Earned badges are kept in the meta store as { badgeId: dayEarned }, so each one is awarded once.
import { CONFIG } from './config.js';
import { allTime, fullWeeks } from './counters.js';
import { LEVEL_GROUPS, groupsDone, themesDone, wordsOfGroup } from './stats.js';
import { isLearned } from './srs.js';

// The badge groups, in the order of the Badges screen. `fact` names the number (or list) in the
// facts object that earns them. The kinds:
//   steps  one badge per step of `steps`, for example 'streak-14' at a best streak of 14. The
//          learned group also has 'learned-all' when every word of the course is learned.
//   count  'week-1', 'week-2', ... one per calendar week with a check-in on every day, shown as
//          one badge 'Full week ×N'
//   list   one per finished theme ('theme-t05') or level group ('hsk-1-2')
//   once   'perfect', a session with at least 30 reviews, all right first time
// The speaking group counts the words spoken well in the speaking panel (speak events with the
// result 'pass'), each word once.
export const BADGE_GROUPS = Object.freeze([
  { id: 'streak', title: 'Streaks', kind: 'steps', fact: 'bestStreak', steps: CONFIG.badges.streak, unit: 'days' },
  { id: 'checkins', title: 'Check-ins', kind: 'steps', fact: 'checkIns', steps: CONFIG.badges.checkIns, unit: 'check-ins' },
  { id: 'learned', title: 'Words learned', kind: 'steps', fact: 'learned', steps: CONFIG.badges.learned, unit: 'words' },
  { id: 'mastered', title: 'Words mastered', kind: 'steps', fact: 'mastered', steps: CONFIG.badges.mastered, unit: 'words' },
  { id: 'reviews', title: 'Reviews answered', kind: 'steps', fact: 'reviews', steps: CONFIG.badges.reviews, unit: 'reviews' },
  { id: 'minutes', title: 'Minutes studied', kind: 'steps', fact: 'minutes', steps: CONFIG.badges.minutes, unit: 'minutes' },
  { id: 'spoken', title: 'Speaking', kind: 'steps', fact: 'spokenWell', steps: CONFIG.badges.spoken, unit: 'words' },
  { id: 'perfectday', title: 'Perfect days', kind: 'steps', fact: 'perfectDays', steps: CONFIG.badges.perfectDays, unit: 'days' },
  { id: 'week', title: 'Full weeks', kind: 'count', fact: 'fullWeeks', steps: null, unit: 'weeks' },
  { id: 'theme', title: 'Themes', kind: 'list', fact: 'themesDone', steps: null, unit: 'words' },
  { id: 'hsk', title: 'Level groups', kind: 'list', fact: 'groupsDone', steps: null, unit: 'words' },
  { id: 'perfect', title: 'Perfect session', kind: 'once', fact: 'perfectSession', steps: null, unit: '' },
].map((g) => Object.freeze(g)));

const WEEK_RULE = 'A check-in on every day from Monday to Sunday';
const PERFECT_RULE = `${CONFIG.perfectMinReviews} reviews or more in one session, all right first time`;
const grouped = (n) => Number(n).toLocaleString('en-US'); // 1000 gives '1,000'

// The badges the facts earn, in group order. The facts object looks like
// { bestStreak, checkIns, learned, mastered, totalWords, reviews, minutes, perfectDays, fullWeeks,
//   themesDone: ['t01'], groupsDone: ['1-2'], perfectSession: true or false, spokenWell } (see badgeFacts),
// where spokenWell is the number of different words spoken well (speak result 'pass').
// groupsDone holds the finished level groups (stats.js LEVEL_GROUPS), which replaced the
// separate HSK 1 and HSK 2 badges (the user's decision of 2026-09-29).
export function earnedBadges(facts) {
  const ids = [];
  for (const g of BADGE_GROUPS) {
    const have = facts[g.fact];
    if (g.kind === 'steps') {
      for (const n of g.steps) if (have >= n) ids.push(`${g.id}-${n}`);
      if (g.id === 'learned' && facts.totalWords > 0 && have >= facts.totalWords) ids.push('learned-all');
    } else if (g.kind === 'count') {
      for (let n = 1; n <= (have ?? 0); n += 1) ids.push(`${g.id}-${n}`);
    } else if (g.kind === 'list') {
      for (const item of have ?? []) ids.push(`${g.id}-${item}`);
    } else if (have) {
      ids.push(g.id);
    }
  }
  return ids;
}

export function newBadges(facts, earned = {}) {
  return earnedBadges(facts).filter((id) => !(id in earned));
}

// A short English title for the badge screen. themes is the data file's theme list.
export function badgeTitle(id, themes = []) {
  const [kind, value] = id.split(/-(.+)/);
  switch (kind) {
    case 'streak': return `${value}-day streak`;
    case 'checkins': return `${value} check-ins`;
    case 'learned': return value === 'all' ? 'Every word learned' : `${grouped(value)} words learned`;
    case 'mastered': return `${grouped(value)} words mastered`;
    case 'reviews': return `${grouped(value)} reviews answered`;
    case 'minutes': return `${grouped(value)} minutes studied`;
    case 'spoken': return `${grouped(value)} words spoken well`;
    case 'perfectday': return value === '1' ? '1 perfect day' : `${value} perfect days`;
    case 'week': return value === '1' ? 'Full week' : `Full week ×${value}`;
    case 'theme': return `Finished ${themes.find((t) => t.id === value)?.name ?? value}`;
    case 'hsk': return `Finished HSK ${value}`;
    case 'perfect': return 'Perfect session';
    default: return id;
  }
}

// The unfinished theme with the fewest words left (all level groups), as { id, have, need }.
function nextTheme(data, byId) {
  const count = new Map(data.themes.map((t) => [t.id, { id: t.id, have: 0, need: 0 }]));
  for (const w of data.words) {
    const c = count.get(w.theme);
    if (!c) continue;
    c.need += 1;
    if (isLearned(byId.get(w.id))) c.have += 1;
  }
  let best = null;
  for (const t of data.themes.slice().sort((a, b) => a.order - b.order)) {
    const c = count.get(t.id);
    if (!c.need || c.have === c.need) continue;
    if (!best || c.need - c.have < best.need - best.have) best = c;
  }
  return best;
}

// The first level group that is not finished, as { id, have, need }.
function nextGroup(words, byId) {
  for (const g of LEVEL_GROUPS) {
    const list = wordsOfGroup(words, g);
    const have = list.filter((w) => isLearned(byId.get(w.id))).length;
    if (list.length && have < list.length) return { id: g.id, have, need: list.length };
  }
  return null;
}

// Everything the badges need, from what the app saves. days are the check-in records
// (store.allDays()), events the saved events (store.allEvents()), and rewound the meta 'rewound'
// day ranges. perfectSession is true when the session that just ended was perfect.
export function badgeFacts({ data, progress, days, events, rewound = [], perfectSession = false }) {
  const checked = days.map((d) => d.day);
  const byId = new Map(progress.map((p) => [p.id, p]));
  const all = allTime({ events, checkedDays: checked, progress, rewound });
  return {
    bestStreak: all.bestStreak,
    checkIns: checked.length,
    learned: all.learned,
    mastered: all.mastered,
    totalWords: data.words.length,
    reviews: all.reviews,
    minutes: all.minutes,
    perfectDays: all.perfectDays,
    spokenWell: new Set(events.filter((e) => e.kind === 'speak' && e.result === 'pass').map((e) => e.id)).size,
    fullWeeks: fullWeeks(checked),
    themesDone: themesDone(data.themes, data.words, byId),
    groupsDone: groupsDone(data.words, byId),
    nextTheme: nextTheme(data, byId),
    nextGroup: nextGroup(data.words, byId),
    perfectSession,
  };
}

function progressOf(id, have, need, unit, themes) {
  const h = Math.floor(have);
  return { id, title: badgeTitle(id, themes), text: `${grouped(h)} / ${grouped(need)} ${unit}`, share: Math.min(1, h / need) };
}

// The Badges screen, group by group. Each group has its earned badges with their days, and the
// next badge of the group greyed out with its progress, for example { title: '30-day streak', text: '17 / 30 days',
// share: 0.57 }. A group whose badges are all earned has next: null. share is null where there
// is nothing to count, as for the next full week and the perfect session.
export function badgeLadder(facts, earned = {}, themes = []) {
  const got = (id) => ({ id, title: badgeTitle(id, themes), day: earned[id] });
  return BADGE_GROUPS.map((g) => {
    let list = [];
    let next = null;
    if (g.kind === 'steps') {
      const have = facts[g.fact] ?? 0;
      let steps = g.steps;
      if (g.id === 'learned') steps = steps.filter((n) => n < facts.totalWords);
      list = steps.map((n) => `${g.id}-${n}`).filter((id) => id in earned).map(got);
      // A step already reached but not yet saved (badges are saved when a session ends) is not
      // shown as the next one, so the screen never reads "7 / 3 days".
      const step = steps.find((n) => !(`${g.id}-${n}` in earned) && n > have);
      if (step) next = progressOf(`${g.id}-${step}`, have, step, g.unit, themes);
      if (g.id === 'learned') {
        if ('learned-all' in earned) list.push(got('learned-all'));
        else if (!step && facts.totalWords > 0) next = progressOf('learned-all', have, facts.totalWords, g.unit, themes);
      }
    } else if (g.kind === 'count') {
      const n = Object.keys(earned).filter((id) => id.startsWith(`${g.id}-`)).length;
      if (n) list = [got(`${g.id}-${n}`)];
      next = { id: `${g.id}-${n + 1}`, title: badgeTitle(`${g.id}-${n + 1}`), text: WEEK_RULE, share: null };
    } else if (g.kind === 'list') {
      list = Object.keys(earned).filter((id) => id.startsWith(`${g.id}-`))
        .sort((a, b) => earned[a].localeCompare(earned[b]) || a.localeCompare(b)).map(got);
      const upcoming = g.id === 'theme' ? facts.nextTheme : facts.nextGroup;
      if (upcoming) next = progressOf(`${g.id}-${upcoming.id}`, upcoming.have, upcoming.need, g.unit, themes);
    } else if (g.id in earned) {
      list = [got(g.id)];
    } else {
      next = { id: g.id, title: badgeTitle(g.id), text: PERFECT_RULE, share: null };
    }
    return { id: g.id, title: g.title, earned: list, next };
  });
}
