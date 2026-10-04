// The progress map, a theme's word list, Stats, Badges and the check-in screen.
// All functions take saved data and return plain objects, so Node can test them.
import { monthCalendar } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { accuracy, forecast, groupById, levelProgress, mapSections, wordsOfGroup } from '../stats.js';
import { allTime, bars, periodTotals, thisMonth, thisWeek } from '../counters.js';
import { badgeLadder, badgeTitle } from '../badges.js';
import { hrefOf } from './route.js';
import { isLearned, isMastered } from '../srs.js';
import { WEEKDAY_LETTERS, WEEKDAY_SHORT, monthTitle, percent, plural, themeColor } from './format.js';
import { tilesOf } from './today.js';

const STATUS_LABEL = Object.freeze({ done: 'Done', current: 'Now', locked: 'Locked' });

// One section per level group (HSK 1-2, then 3, 4, 5 and 6), each with a tile per theme that
// has words in that group, in theme order. A tile's counts are of that group's words only,
// and it opens the list of those words. A started tile (see stats.js mapSections) shows its
// learned share, for example '40%', where the other tiles show Done, Now or Locked. A tile has
// the colour of its theme (themeColor in format.js).
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
      color: themeColor(t.id, data.themes),
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

const grouped = (n) => Number(n).toLocaleString('en-US'); // 1234 gives '1,234'

// The four numbers of a week or month as tiles.
function periodTiles(t) {
  return [
    { label: 'words learned', value: grouped(t.newWords) },
    { label: 'reviews', value: grouped(t.reviews) },
    { label: 'study days', value: grouped(t.studyDays) },
    { label: 'minutes', value: grouped(Math.round(t.minutes)) },
  ];
}

// The Stats screen, in the four sections of the spec of 2026-10-03:
//   1. periods (this week, Monday to Sunday, and this calendar month), bars7 and bars30 (new words
//      and reviews per day), and the reviews due in the next 7 days and the 7-day accuracy that
//      the screen showed before
//   2. records, the all-time records
//   3. levels, the progress per HSK level
//   4. goals, every goal countdown nearest first (goals.js goals)
// events are all saved events, rewound the meta 'rewound' day ranges.
export function statsView({ data, progressList, events, checkedDays, today, rewound = [], goals = [] }) {
  const byId = new Map(progressList.map((p) => [p.id, p]));
  const week = thisWeek(today);
  const month = thisMonth(today);
  const all = allTime({ events, checkedDays, progress: progressList, rewound });
  const acc = accuracy(events, today);
  return {
    periods: [
      { title: 'This week', numbers: periodTiles(periodTotals(events, checkedDays, week.from, week.to)) },
      { title: monthTitle(today.slice(0, 7)), numbers: periodTiles(periodTotals(events, checkedDays, month.from, month.to)) },
    ],
    bars7: bars(events, checkedDays, today, 7).map((r) => ({ ...r, label: WEEKDAY_LETTERS[weekdayIndex(r.day)] })),
    bars30: bars(events, checkedDays, today, 30),
    forecast: forecast(progressList, today).map((r, i) => ({
      ...r, label: i === 0 ? 'Today' : WEEKDAY_SHORT[weekdayIndex(r.day)],
    })),
    accuracy: acc.rate === null
      ? 'No reviews in the last 7 days.'
      : `${percent(acc.rate)} right (${acc.right} of ${acc.answered} reviews).`,
    records: [
      { label: 'Best streak', value: plural(all.bestStreak, 'day') },
      { label: 'Perfect days', value: grouped(all.perfectDays) },
      { label: 'Reviews answered', value: grouped(all.reviews) },
      { label: 'Words learned', value: `${grouped(all.learned)} of ${grouped(data.words.length)}` },
      { label: 'Words mastered', value: grouped(all.mastered) },
      { label: 'Study days', value: grouped(all.studyDays) },
      { label: 'Minutes studied', value: grouped(Math.round(all.minutes)) },
    ],
    levels: levelProgress(data.words, byId).map((l) => ({
      label: `HSK ${l.lv}`,
      text: `${l.learned} of ${l.total} learned, ${l.mastered} mastered`,
      learnedPct: percent(l.learned / l.total),
      masteredPct: percent(l.mastered / l.total),
    })),
    goals: goals.map((g) => g.text),
  };
}

// The Badges screen, group by group (badgeLadder in badges.js). earned is the saved
// { badgeId: dayEarned } map (store meta 'badges') and facts is badgeFacts()'s result. Each
// group's next badge gets pct, its progress as a bar width such as '57%', or null for no bar.
export function badgesView({ earned, facts, themes }) {
  const saved = earned ?? {};
  return {
    count: Object.keys(saved).length,
    groups: badgeLadder(facts, saved, themes).map((g) => ({
      ...g,
      next: g.next && { ...g.next, pct: g.next.share === null ? null : percent(g.next.share) },
    })),
  };
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
// opened from the streak on the Today screen. counters is the day's numbers (counters.js
// dayStats) and bests the personal-best notes (counters.js personalBests). confetti is true
// right after the day was checked in.
export function checkinView({ result, checkedDays, today, themes, counters = null, bests = [] }) {
  const month = today.slice(0, 7);
  const view = {
    title: 'Check-in',
    lines: [],
    numbers: counters ? tilesOf(counters) : [],
    bests,
    badges: [],
    confetti: Boolean(result?.justCheckedIn),
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
