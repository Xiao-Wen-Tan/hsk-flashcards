import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGE_GROUPS, badgeFacts, badgeLadder, badgeTitle, earnedBadges, newBadges } from '../../docs/js/badges.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const NONE = {
  bestStreak: 0, checkIns: 0, learned: 0, mastered: 0, totalWords: 5000, reviews: 0, minutes: 0, perfectDays: 0, spokenWell: 0,
  fullWeeks: 0, themesDone: [], groupsDone: [], perfectSession: false,
};

test('nothing earned at the start', () => {
  assert.deepEqual(earnedBadges(NONE), []);
});

test('streak badges at 3, 7, 14, 30, 60, 100, 200 and 365 days', () => {
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 2 }), []);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 7 }), ['streak-3', 'streak-7']);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 365 }),
    ['streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-60', 'streak-100', 'streak-200', 'streak-365']);
});

test('check-in badges at 10, 50 and 200', () => {
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 49 }), ['checkins-10']);
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 200 }), ['checkins-10', 'checkins-50', 'checkins-200']);
});

test('learned badges from 10 to every word', () => {
  assert.deepEqual(earnedBadges({ ...NONE, learned: 249 }), ['learned-10', 'learned-25', 'learned-50', 'learned-100']);
  assert.deepEqual(earnedBadges({ ...NONE, learned: 4000 }), ['learned-10', 'learned-25', 'learned-50', 'learned-100',
    'learned-250', 'learned-500', 'learned-1000', 'learned-2000', 'learned-3000', 'learned-4000']);
  assert.ok(earnedBadges({ ...NONE, learned: 5000 }).includes('learned-all'));
  assert.ok(!earnedBadges({ ...NONE, learned: 4999 }).includes('learned-all'));
});

test('mastered badges at 100, 500, 1000 and 2500', () => {
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 999 }), ['mastered-100', 'mastered-500']);
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 2500 }), ['mastered-100', 'mastered-500', 'mastered-1000', 'mastered-2500']);
});

test('reviews, minutes and perfect-day badges', () => {
  assert.deepEqual(earnedBadges({ ...NONE, reviews: 999, minutes: 300, perfectDays: 7 }),
    ['reviews-100', 'minutes-60', 'minutes-300', 'perfectday-1', 'perfectday-7']);
  assert.deepEqual(earnedBadges({ ...NONE, reviews: 10000, minutes: 2999.9, perfectDays: 30 }), [
    'reviews-100', 'reviews-1000', 'reviews-5000', 'reviews-10000', 'minutes-60', 'minutes-300', 'minutes-1000',
    'perfectday-1', 'perfectday-7', 'perfectday-30',
  ]);
});

test('full weeks give week-1, week-2 and so on', () => {
  assert.deepEqual(earnedBadges({ ...NONE, fullWeeks: 3 }), ['week-1', 'week-2', 'week-3']);
});

test('one badge per finished theme and level group, and one for a perfect session', () => {
  assert.deepEqual(earnedBadges({ ...NONE, themesDone: ['t01', 't02'], groupsDone: ['1-2', '3'], perfectSession: true }),
    ['theme-t01', 'theme-t02', 'hsk-1-2', 'hsk-3', 'perfect']);
});

test('badges already earned are not awarded again', () => {
  const facts = { ...NONE, bestStreak: 30, checkIns: 10 };
  assert.deepEqual(newBadges(facts, { 'streak-3': '2026-10-07', 'streak-7': '2026-10-11', 'streak-14': '2026-10-18', 'checkins-10': '2026-10-14' }),
    ['streak-30']);
});

test('titles for the badge screen', () => {
  const themes = [{ id: 't05', name: 'Food & Drink' }];
  assert.equal(badgeTitle('streak-3'), '3-day streak');
  assert.equal(badgeTitle('checkins-50'), '50 check-ins');
  assert.equal(badgeTitle('learned-all'), 'Every word learned');
  assert.equal(badgeTitle('learned-500'), '500 words learned');
  assert.equal(badgeTitle('learned-4000'), '4,000 words learned');
  assert.equal(badgeTitle('mastered-100'), '100 words mastered');
  assert.equal(badgeTitle('reviews-1000'), '1,000 reviews answered');
  assert.equal(badgeTitle('minutes-60'), '60 minutes studied');
  assert.equal(badgeTitle('perfectday-1'), '1 perfect day');
  assert.equal(badgeTitle('perfectday-7'), '7 perfect days');
  assert.equal(badgeTitle('week-1'), 'Full week');
  assert.equal(badgeTitle('week-3'), 'Full week ×3');
  assert.equal(badgeTitle('theme-t05', themes), 'Finished Food & Drink');
  assert.equal(badgeTitle('hsk-1-2'), 'Finished HSK 1-2');
  assert.equal(badgeTitle('hsk-6'), 'Finished HSK 6');
  assert.equal(badgeTitle('perfect'), 'Perfect session');
});

test('the Badges screen shows the groups in this order', () => {
  assert.deepEqual(BADGE_GROUPS.map((g) => g.id),
    ['streak', 'checkins', 'learned', 'mastered', 'reviews', 'minutes', 'spoken', 'perfectday', 'week', 'theme', 'hsk', 'perfect']);
});

test('the facts come from the saved words, check-ins and events', () => {
  // On 5 October 2 words are learned, every answer right. On 6 October there are 2 reviews, one wrong.
  const events = [
    { seq: 1, day: '2026-10-05', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-05T19:00:00Z' },
    { seq: 2, day: '2026-10-05', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-05T19:00:30Z' },
    { seq: 3, day: '2026-10-06', kind: 'review', grade: 'wrong', ts: '2026-10-06T19:00:00Z' },
    { seq: 4, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:02:00Z' },
  ];
  const progress = data.words.filter((w) => w.theme === 't01').map((w) => learnedProgress(w.id, '2026-10-05'));
  const days = [{ day: '2026-10-05' }, { day: '2026-10-06' }];
  assert.deepEqual(badgeFacts({ data, progress, days, events, perfectSession: true }), {
    bestStreak: 2, checkIns: 2, learned: 12, mastered: 0, totalWords: 61, reviews: 2, minutes: 2.5, perfectDays: 1, spokenWell: 0, fullWeeks: 0,
    themesDone: ['t01'], groupsDone: [], perfectSession: true,
    // The unfinished theme with the fewest words left, and the first unfinished level group.
    nextTheme: { id: 't02', have: 0, need: 10 }, nextGroup: { id: '1-2', have: 12, need: 61 },
  });
  const rewound = [['2026-10-02', '2026-10-03']];
  const gap = [{ day: '2026-10-01' }, { day: '2026-10-04' }];
  assert.equal(badgeFacts({ data, progress: [], days: gap, events: [], rewound }).bestStreak, 2);
});

test('the ladder shows the earned badges of each group and the next one with its progress', () => {
  const facts = {
    ...NONE, bestStreak: 17, checkIns: 17, learned: 30, totalWords: 61, reviews: 150, minutes: 75.5, perfectDays: 2, fullWeeks: 1,
    themesDone: ['t01'], nextTheme: { id: 't02', have: 4, need: 10 }, nextGroup: { id: '1-2', have: 30, need: 61 },
  };
  const earned = {
    'streak-3': '2026-10-03', 'streak-7': '2026-10-07', 'streak-14': '2026-10-14', 'checkins-10': '2026-10-10',
    'learned-10': '2026-10-01', 'learned-25': '2026-10-03', 'reviews-100': '2026-10-09', 'minutes-60': '2026-10-15',
    'perfectday-1': '2026-10-01', 'week-1': '2026-10-11', 'theme-t01': '2026-10-01',
  };
  const byId = Object.fromEntries(badgeLadder(facts, earned, data.themes).map((g) => [g.id, g]));
  assert.deepEqual(byId.streak.earned.map((b) => [b.title, b.day]),
    [['3-day streak', '2026-10-03'], ['7-day streak', '2026-10-07'], ['14-day streak', '2026-10-14']]);
  assert.deepEqual(byId.streak.next, { id: 'streak-30', title: '30-day streak', text: '17 / 30 days', share: 17 / 30 });
  assert.deepEqual(byId.learned.next, { id: 'learned-50', title: '50 words learned', text: '30 / 50 words', share: 0.6 });
  assert.equal(byId.minutes.next.text, '75 / 300 minutes');
  assert.deepEqual([byId.mastered.earned, byId.mastered.next.text], [[], '0 / 100 words']);
  // Full weeks show as one badge with a count, and the next one has no progress bar.
  assert.deepEqual(byId.week.earned.map((b) => [b.title, b.day]), [['Full week', '2026-10-11']]);
  assert.deepEqual(byId.week.next, { id: 'week-2', title: 'Full week ×2', text: 'A check-in on every day from Monday to Sunday', share: null });
  assert.deepEqual(byId.theme.earned.map((b) => b.title), ['Finished Starter Kit']);
  assert.deepEqual(byId.theme.next, { id: 'theme-t02', title: 'Finished Greetings & Courtesy', text: '4 / 10 words', share: 0.4 });
  assert.deepEqual(byId.hsk.next, { id: 'hsk-1-2', title: 'Finished HSK 1-2', text: '30 / 61 words', share: 30 / 61 });
  assert.deepEqual(byId.perfect.next,
    { id: 'perfect', title: 'Perfect session', text: '30 reviews or more in one session, all right first time', share: null });
  const all = badgeLadder({ ...facts, checkIns: 200 }, { 'checkins-10': 'a', 'checkins-50': 'b', 'checkins-200': 'c', 'week-1': 'd', 'week-2': 'e', 'week-3': 'f' });
  assert.equal(all.find((g) => g.id === 'checkins').next, null);
  assert.deepEqual(all.find((g) => g.id === 'week').earned, [{ id: 'week-3', title: 'Full week ×3', day: 'f' }]);
});

test('with 55 of the fixture\'s 61 words learned, the next learned badge is the one for every word', () => {
  const ladder = badgeLadder({ ...NONE, learned: 55, totalWords: 61 }, { 'learned-10': 'a', 'learned-25': 'b', 'learned-50': 'c' });
  assert.deepEqual(ladder.find((g) => g.id === 'learned').next,
    { id: 'learned-all', title: 'Every word learned', text: '55 / 61 words', share: 55 / 61 });
});

test('a step already reached but not yet saved is not shown as the next badge', () => {
  // Right after the update a learner with the 7-day badge and a best streak of 9 has not been
  // given the new 3-day badge yet (badges are saved when a session ends). The next badge shown
  // is the 14-day streak, not "7 / 3 days".
  const streak = badgeLadder({ ...NONE, bestStreak: 9 }, { 'streak-7': 'a' }).find((g) => g.id === 'streak');
  assert.deepEqual([streak.next.id, streak.next.text], ['streak-14', '9 / 14 days']);
});

test('the speaking badges count the words spoken well, each word once', () => {
  assert.deepEqual(earnedBadges({ ...NONE, spokenWell: 99 }), ['spoken-10', 'spoken-50']);
  assert.deepEqual(earnedBadges({ ...NONE, spokenWell: 1000 }), ['spoken-10', 'spoken-50', 'spoken-100', 'spoken-500', 'spoken-1000']);
  assert.equal(badgeTitle('spoken-10'), '10 words spoken well');
  assert.equal(badgeTitle('spoken-1000'), '1,000 words spoken well');
  // 我 is spoken well twice and 你 once, 他 is skipped and 好 only listened to, which makes 2 words spoken well.
  const speak = (seq, id, result) => ({ seq, day: '2026-10-05', kind: 'speak', id, result, tries: 1, check: { tones: 1, heard: null } });
  const events = [speak(1, 'w0001', 'pass'), speak(2, 'w0002', 'pass'), speak(3, 'w0003', 'skip'), speak(4, 'w0009', 'listened'),
    { ...speak(5, 'w0001', 'pass'), day: '2026-10-06' }];
  assert.equal(badgeFacts({ data, progress: [], days: [], events }).spokenWell, 2);
  const ladder = badgeLadder({ ...NONE, spokenWell: 2 }, {});
  assert.deepEqual(ladder.find((g) => g.id === 'spoken').next, { id: 'spoken-10', title: '10 words spoken well', text: '2 / 10 words', share: 0.2 });
});
