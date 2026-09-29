// Milestone badges. A badge ID is a short text, for example 'streak-7', 'learned-all',
// 'theme-t05', 'level-1' or 'perfect'. Earned badges are kept in the meta store as
// { badgeId: dayEarned }, so each one is awarded once.
import { CONFIG } from './config.js';

// The facts object looks like { bestStreak, checkIns, learned, mastered, totalWords, themesDone: ['t01'],
//          levelsDone: [1], perfectSession: true or false }
export function earnedBadges(facts) {
  const ids = [];
  const { badges } = CONFIG;
  for (const n of badges.streak) if (facts.bestStreak >= n) ids.push(`streak-${n}`);
  for (const n of badges.checkIns) if (facts.checkIns >= n) ids.push(`checkins-${n}`);
  for (const n of badges.learned) if (facts.learned >= n) ids.push(`learned-${n}`);
  if (facts.totalWords > 0 && facts.learned >= facts.totalWords) ids.push('learned-all');
  for (const n of badges.mastered) if (facts.mastered >= n) ids.push(`mastered-${n}`);
  for (const t of facts.themesDone) ids.push(`theme-${t}`);
  for (const lv of facts.levelsDone) ids.push(`level-${lv}`);
  if (facts.perfectSession) ids.push('perfect');
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
    case 'learned': return value === 'all' ? 'Every word learned' : `${value} words learned`;
    case 'mastered': return `${value} words mastered`;
    case 'theme': return `Finished ${themes.find((t) => t.id === value)?.name ?? value}`;
    case 'level': return `HSK ${value} finished`;
    case 'perfect': return 'Perfect session';
    default: return id;
  }
}
