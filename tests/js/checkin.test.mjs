import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestStreak, currentStreak, monthCalendar, weekStrip } from '../../docs/js/checkin.js';

const CHECKED = ['2026-10-03', '2026-10-04', '2026-10-05'];

test('the streak counts days in a row up to today', () => {
  assert.equal(currentStreak(CHECKED, '2026-10-05'), 3);
});

test('before today\'s check-in the streak still counts up to yesterday', () => {
  assert.equal(currentStreak(CHECKED, '2026-10-06'), 3);
});

test('one missed day resets the streak, with no freeze', () => {
  assert.equal(currentStreak(CHECKED, '2026-10-07'), 0);
  assert.equal(currentStreak([...CHECKED, '2026-10-07'], '2026-10-07'), 1);
  assert.equal(currentStreak([], '2026-10-07'), 0);
});

test('the streak runs across month ends', () => {
  assert.equal(currentStreak(['2026-09-29', '2026-09-30', '2026-10-01'], '2026-10-01'), 3);
});

test('best streak is the longest run ever', () => {
  assert.equal(bestStreak(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-06']), 3);
  assert.equal(bestStreak([]), 0);
});

test('the week strip runs Monday to Sunday', () => {
  const strip = weekStrip(CHECKED, '2026-10-07'); // a Wednesday
  assert.deepEqual(strip.map((d) => d.day), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    '2026-10-09', '2026-10-10', '2026-10-11']);
  assert.deepEqual(strip.map((d) => d.checkedIn), [true, false, false, false, false, false, false]);
  assert.equal(strip[2].isToday, true);
  assert.equal(strip[3].future, true);
});

test('the month calendar has every day of the month', () => {
  const oct = monthCalendar(CHECKED, '2026-10');
  assert.equal(oct.length, 31);
  assert.deepEqual(oct.filter((d) => d.checkedIn).map((d) => d.day), CHECKED);
  assert.equal(monthCalendar([], '2028-02').length, 29);
  assert.equal(monthCalendar([], '2026-12').at(-1).day, '2026-12-31');
});
