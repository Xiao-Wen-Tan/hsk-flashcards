// The progress map, a theme's word list, Stats, Badges and the check-in screen.
// All functions take saved data and return plain objects, so Node can test them.
import { CONFIG } from '../config.js';
import { bestStreak, monthCalendar } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { accuracy, activity, forecast, groupById, levelProgress, mapSections, totals, wordsOfGroup } from '../stats.js';
import { badgeTitle } from '../badges.js';
import { hrefOf } from './route.js';
import { isLearned, isMastered } from '../srs.js';
import { WEEKDAY_SHORT, monthTitle, percent, plural } from './format.js';

const STATUS_LABEL = Object.freeze({ done: 'Done', current: 'Now', locked: 'Locked' });

// One section per level group (HSK 1-2, then 3, 4, 5 and 6), each with a tile per theme that
// has words in that group, in theme order. A tile's counts are of that group's words only,
// and it opens the list of those words. A started tile (see stats.js mapSections) shows its
// learned share, for example '40%', where the other tiles show Done, Now or Locked.
export function mapView(data, progressById) {
  return mapSections(data.themes, data.words, progressById).map((s) => ({
    id: s.id,
    title: s.label,
    done: s.done,
    statusLabel: s.done ? STATUS_LABEL.done : '',
    counts: `${s.learned} of ${s.total} learned`,
    tiles: s.tiles.map((t) => ({
      id: t.id,
      name: t.name,
      href: hrefOf({ name: 'theme', id: t.id, group: s.id }),
      status: t.status,
      statusLabel: t.status === 'started' ? percent(t.learnedShare) : STATUS_LABEL[t.status],
      learnedPct: percent(t.learnedShare),
      masteredPct: percent(t.masteredShare),
      counts: `${t.learned} of ${t.total} learned, ${t.mastered} mastered`,
    })),
  }));
}

// A word's place for the theme list: 'New', 'Step 3' or 'Mastered'.
export function wordStatus(p) {
  if (isMastered(p)) return 'Mastered';
  if (isLearned(p)) return `Step ${p.step}`;
  return 'New';
}

// The words of one theme in teaching order, or null when the theme does not exist. With a
// level group ID, for example '3', only that group's words, as a map tile shows them, under
// the name 'Food & Drink, HSK 3'. An unknown group gives null.
export function themeWordsView(data, themeId, progressById, groupId) {
  const theme = data.themes.find((t) => t.id === themeId);
  const group = groupId === undefined ? null : groupById(groupId);
  if (!theme || group === undefined) return null;
  const inTheme = data.words.filter((w) => w.theme === themeId);
  const words = (group ? wordsOfGroup(inTheme, group) : inTheme).sort((a, b) => a.ord - b.ord)
    .map((w) => ({
      id: w.id, hz: w.hz, py: w.py, enShort: w.enShort, status: wordStatus(progressById.get(w.id)),
      href: hrefOf({ name: 'word', id: w.id, group: groupId }),
    }));
  return { id: theme.id, name: group ? `${theme.name}, ${group.label}` : theme.name, words };
}

// The word screen's Back link, to the list the word was opened from: '#/theme/t05/3' for the
// HSK 3 list of t05, or '#/theme/t05' for the whole theme.
export function wordBackHref(word, groupId) {
  return hrefOf({ name: 'theme', id: word.theme, group: groupId });
}

// The Stats screen. events are the answers of the last 30 study days (store.eventsFrom).
export function statsView({ data, progressList, events, checkedDays, today }) {
  const byId = new Map(progressList.map((p) => [p.id, p]));
  const { learned, mastered } = totals(progressList);
  const rows = activity(events, checkedDays, today);
  const top = Math.max(1, ...rows.map((r) => r.reviews + r.learned));
  const acc = accuracy(events, today);
  return {
    learned,
    mastered,
    total: data.words.length,
    levels: levelProgress(data.words, byId).map((l) => ({
      label: `HSK ${l.lv}`,
      text: `${l.learned} of ${l.total} learned, ${l.mastered} mastered`,
      learnedPct: percent(l.learned / l.total),
      masteredPct: percent(l.mastered / l.total),
    })),
    activity: rows.map((r) => ({ ...r, height: (r.reviews + r.learned) / top })),
    forecast: forecast(progressList, today).map((r, i) => ({
      ...r, label: i === 0 ? 'Today' : WEEKDAY_SHORT[weekdayIndex(r.day)],
    })),
    accuracy: acc.rate === null
      ? 'No reviews in the last 7 days.'
      : `${percent(acc.rate)} right (${acc.right} of ${acc.answered} reviews).`,
  };
}

// The next milestone of each counted badge kind that is not earned yet.
function upcoming(facts) {
  const { badges } = CONFIG;
  const next = (list, have) => list.find((n) => n > have);
  const out = [];
  const s = next(badges.streak, facts.bestStreak);
  if (s) out.push({ title: badgeTitle(`streak-${s}`), have: `best streak so far: ${facts.bestStreak}` });
  const c = next(badges.checkIns, facts.checkIns);
  if (c) out.push({ title: badgeTitle(`checkins-${c}`), have: `${facts.checkIns} so far` });
  const l = next(badges.learned, facts.learned);
  if (l && l < facts.totalWords) out.push({ title: badgeTitle(`learned-${l}`), have: `${facts.learned} so far` });
  else if (facts.learned < facts.totalWords) out.push({ title: badgeTitle('learned-all'), have: `${facts.learned} of ${facts.totalWords}` });
  const m = next(badges.mastered, facts.mastered);
  if (m) out.push({ title: badgeTitle(`mastered-${m}`), have: `${facts.mastered} so far` });
  return out;
}

// The Badges screen. earned is the saved { badgeId: dayEarned } map (store meta 'badges').
export function badgesView({ earned, data, progressList, checkedDays }) {
  const list = Object.entries(earned ?? {})
    .sort(([a, da], [b, db]) => da.localeCompare(db) || a.localeCompare(b))
    .map(([id, day]) => ({ id, day, title: badgeTitle(id, data.themes) }));
  const facts = {
    bestStreak: bestStreak(checkedDays),
    checkIns: checkedDays.length,
    ...totals(progressList),
    totalWords: data.words.length,
  };
  return { earned: list, upcoming: upcoming(facts) };
}

// A month as weeks of 7 cells from Monday, with null before the 1st and after the last day.
export function calendarWeeks(checkedDays, month, today) {
  const days = monthCalendar(checkedDays, month)
    .map((d) => ({ ...d, isToday: d.day === today, date: Number(d.day.slice(8)) }));
  const cells = [...Array(weekdayIndex(days[0].day)).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// The check-in screen. result is Study.finish()'s result, or null when the screen is
// opened from the streak on the Today screen.
export function checkinView({ result, checkedDays, today, themes }) {
  const month = today.slice(0, 7);
  const view = {
    title: 'Check-in',
    lines: [],
    badges: [],
    streak: result ? result.streak : null,
    monthTitle: monthTitle(month),
    weeks: calendarWeeks(checkedDays, month, today),
  };
  if (!result) return view;
  const s = result.summary;
  if (result.justCheckedIn) view.title = 'Checked in!';
  else if (result.checkedIn) view.title = 'Already checked in today';
  else view.title = 'Not checked in yet';
  if (s.reviews) view.lines.push(`${plural(s.reviews, 'review')}, ${s.firstRight} right first time.`);
  if (s.learned) view.lines.push(`${plural(s.learned, 'new word')} learned.`);
  if (s.failed) view.lines.push(`${plural(s.failed, 'new word')} will come back next time.`);
  if (!result.checkedIn) {
    view.lines.push(`Still left today: ${plural(result.left.reviews.length, 'review')} and ${plural(result.left.newWords.length, 'new word')}.`);
  }
  view.badges = result.newBadges.map((id) => badgeTitle(id, themes));
  return view;
}
