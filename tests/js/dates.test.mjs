// US Central time has daylight saving. Clocks jump from 02:00 to 03:00 on 8 March 2026
// and fall back from 02:00 to 01:00 on 1 November 2026. Each test file runs in its own
// process, so setting TZ here affects only this file.
process.env.TZ = 'America/Chicago';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayRange, daysBetween, isDay, mondayOf, studyDay, weekdayIndex } from '../../docs/js/dates.js';

test('the time zone for this file is in effect', () => {
  assert.equal(new Date(2026, 0, 15, 12).getTimezoneOffset(), 360);
  assert.equal(new Date(2026, 6, 15, 12).getTimezoneOffset(), 300);
});

test('a study day starts at 04:00 local time', () => {
  assert.equal(studyDay(new Date(2026, 9, 6, 1, 30)), '2026-10-05');
  assert.equal(studyDay(new Date(2026, 9, 6, 3, 59, 59)), '2026-10-05');
  assert.equal(studyDay(new Date(2026, 9, 6, 4, 0)), '2026-10-06');
  assert.equal(studyDay(new Date(2026, 9, 6, 23, 59)), '2026-10-06');
});

test('the cutoff crosses month and year ends', () => {
  assert.equal(studyDay(new Date(2026, 10, 1, 0, 10)), '2026-10-31');
  assert.equal(studyDay(new Date(2027, 0, 1, 2, 0)), '2026-12-31');
});

test('the spring-forward morning keeps the right study day', () => {
  // 03:30 on 8 March is still 7 March. 04:30 is 8 March, although only 3.5 real hours
  // have passed since midnight.
  assert.equal(studyDay(new Date(2026, 2, 8, 3, 30)), '2026-03-07');
  assert.equal(studyDay(new Date(2026, 2, 8, 4, 30)), '2026-03-08');
});

test('the fall-back morning keeps the right study day', () => {
  // 03:59 on 1 November is 5 real hours after midnight but still before 04:00 on the clock.
  assert.equal(studyDay(new Date(2026, 10, 1, 3, 59)), '2026-10-31');
  assert.equal(studyDay(new Date(2026, 10, 1, 4, 0)), '2026-11-01');
});

test('day arithmetic ignores daylight saving', () => {
  assert.equal(addDays('2026-03-07', 1), '2026-03-08');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-10-31', 2), '2026-11-02');
  assert.equal(addDays('2026-12-08', 60), '2027-02-06');
  assert.equal(addDays('2026-10-05', -5), '2026-09-30');
  assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
  assert.equal(daysBetween('2026-10-15', '2026-10-05'), -10);
});

test('weekdays, Mondays and ranges', () => {
  assert.equal(weekdayIndex('2026-10-05'), 0); // Monday
  assert.equal(weekdayIndex('2026-10-11'), 6); // Sunday
  assert.equal(mondayOf('2026-10-11'), '2026-10-05');
  assert.deepEqual(dayRange('2026-10-30', 3), ['2026-10-30', '2026-10-31', '2026-11-01']);
});

test('isDay accepts only real calendar days', () => {
  assert.ok(isDay('2028-02-29'));
  assert.ok(!isDay('2027-02-29'));
  assert.ok(!isDay('2026-10-5'));
  assert.ok(!isDay(20261005));
});
