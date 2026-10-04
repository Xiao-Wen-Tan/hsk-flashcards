import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rewindCalendar, startMonth } from '../../docs/js/view/rewind.js';

// Days that can be chosen, from rewindChoices in rewind.js. Today is Monday 5 October 2026.
const CHOICES = ['2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02'];
const TODAY = '2026-10-05';

test('the calendar opens on the month of the newest day that can be chosen', () => {
  assert.equal(startMonth(CHOICES, TODAY), '2026-10');
  assert.equal(startMonth(['2026-09-29'], TODAY), '2026-09');
  assert.equal(startMonth([], TODAY), '2026-10');
});

test('only the days that can be chosen are buttons, and the month buttons skip to months with such days', () => {
  const oct = rewindCalendar({ choices: CHOICES, month: '2026-10', today: TODAY });
  assert.equal(oct.title, 'October 2026');
  assert.deepEqual([oct.prev, oct.next], ['2026-09', null]);
  const cells = oct.weeks.flat().filter(Boolean);
  assert.deepEqual(cells.filter((c) => c.choosable).map((c) => c.day), ['2026-10-01', '2026-10-02']);
  assert.equal(cells.find((c) => c.isToday).day, TODAY);
  assert.deepEqual(oct.weeks[0].map((c) => c && c.date), [null, null, null, 1, 2, 3, 4]); // 1 October is a Thursday
  const sep = rewindCalendar({ choices: CHOICES, month: '2026-09', today: TODAY });
  assert.deepEqual([sep.prev, sep.next], [null, '2026-10']);
  assert.deepEqual(sep.weeks.flat().filter((c) => c?.choosable).map((c) => c.date), [29, 30]);
});
