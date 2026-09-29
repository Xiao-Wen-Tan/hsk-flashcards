// Milestone badges. A badge ID is a short text, for example 'streak-7', 'learned-all',
// 'theme-t05', 'hsk-1-2' or 'perfect'. Earned badges are kept in the meta store as
// { badgeId: dayEarned }, so each one is awarded once.
import { CONFIG } from './config.js';

// The facts object looks like { bestStreak, checkIns, learned, mastered, totalWords, themesDone: ['t01'],
//          groupsDone: ['1-2'], perfectSession: true or false }
// groupsDone holds the finished level groups (stats.js LEVEL_GROUPS), which replaced the
// separate HSK 1 and HSK 2 badges (the user's decision of 2026-09-29).
export function earnedBadges(facts) {
  const ids = [];
  const { badges } = CONFIG;
  for (const n of badges.streak) if (facts.bestStreak >= n) ids.push(`streak-${n}`);
  for (const n of badges.checkIns) if (facts.checkIns >= n) ids.push(`checkins-${n}`);
  for (const n of badges.learned) if (facts.learned >= n) ids.push(`learned-${n}`);
  if (facts.totalWords > 0 && facts.learned >= facts.totalWords) ids.push('learned-all');
  for (const n of badges.mastered) if (facts.mastered >= n) ids.push(`mastered-${n}`);
  for (const t of facts.themesDone) ids.push(`theme-${t}`);
  for (const g of facts.groupsDone) ids.push(`hsk-${g}`);
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
    case 'hsk': return `Finished HSK ${value}`;
    case 'perfect': return 'Perfect session';
    default: return id;
  }
}
