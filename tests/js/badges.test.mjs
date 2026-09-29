import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeTitle, earnedBadges, newBadges } from '../../docs/js/badges.js';

const NONE = { bestStreak: 0, checkIns: 0, learned: 0, mastered: 0, totalWords: 5000, themesDone: [], groupsDone: [], perfectSession: false };

test('nothing earned at the start', () => {
  assert.deepEqual(earnedBadges(NONE), []);
});

test('streak badges at 7, 30, 100 and 365 days', () => {
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 6 }), []);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 7 }), ['streak-7']);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 365 }), ['streak-7', 'streak-30', 'streak-100', 'streak-365']);
});

test('check-in badges at 10, 50 and 200', () => {
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 49 }), ['checkins-10']);
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 200 }), ['checkins-10', 'checkins-50', 'checkins-200']);
});

test('learned badges from 50 to all words', () => {
  assert.deepEqual(earnedBadges({ ...NONE, learned: 499 }), ['learned-50', 'learned-100']);
  assert.deepEqual(earnedBadges({ ...NONE, learned: 3000 }),
    ['learned-50', 'learned-100', 'learned-500', 'learned-1000', 'learned-2000', 'learned-3000']);
  assert.ok(earnedBadges({ ...NONE, learned: 5000 }).includes('learned-all'));
  assert.ok(!earnedBadges({ ...NONE, learned: 4999 }).includes('learned-all'));
});

test('mastered badges at 100, 500, 1000 and 2500', () => {
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 999 }), ['mastered-100', 'mastered-500']);
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 2500 }), ['mastered-100', 'mastered-500', 'mastered-1000', 'mastered-2500']);
});

test('one badge per finished theme and level group, and one for a perfect session', () => {
  assert.deepEqual(earnedBadges({ ...NONE, themesDone: ['t01', 't02'], groupsDone: ['1-2', '3'], perfectSession: true }),
    ['theme-t01', 'theme-t02', 'hsk-1-2', 'hsk-3', 'perfect']);
});

test('badges already earned are not awarded again', () => {
  const facts = { ...NONE, bestStreak: 30, checkIns: 10 };
  assert.deepEqual(newBadges(facts, { 'streak-7': '2026-10-11', 'checkins-10': '2026-10-14' }), ['streak-30']);
});

test('titles for the badge screen', () => {
  const themes = [{ id: 't05', name: 'Food & Drink' }];
  assert.equal(badgeTitle('streak-7'), '7-day streak');
  assert.equal(badgeTitle('checkins-50'), '50 check-ins');
  assert.equal(badgeTitle('learned-all'), 'Every word learned');
  assert.equal(badgeTitle('learned-500'), '500 words learned');
  assert.equal(badgeTitle('mastered-100'), '100 words mastered');
  assert.equal(badgeTitle('theme-t05', themes), 'Finished Food & Drink');
  assert.equal(badgeTitle('hsk-1-2'), 'Finished HSK 1-2');
  assert.equal(badgeTitle('hsk-6'), 'Finished HSK 6');
  assert.equal(badgeTitle('perfect'), 'Perfect session');
});
