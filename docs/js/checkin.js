// Check-in streaks and calendars. `checked` is a list of checked-in study days ('YYYY-MM-DD').
import { addDays, dayRange, daysBetween, mondayOf } from './dates.js';

// Days in a row with a check-in, ending today. Before today's check-in the streak still
// counts up to yesterday, and one missed day resets it to 0. There is no streak freeze.
// For example, with check-ins on 3, 4 and 5 October the streak is 3 on 5 or 6 October and 0 on 7 October.
export function currentStreak(checked, today) {
  const set = new Set(checked);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}

export function bestStreak(checked) {
  const days = [...new Set(checked)].sort();
  let best = 0;
  let run = 0;
  days.forEach((day, i) => {
    run = i > 0 && daysBetween(days[i - 1], day) === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

// Monday to Sunday of today's week, for the home screen's week strip.
export function weekStrip(checked, today) {
  const set = new Set(checked);
  return dayRange(mondayOf(today), 7).map((day) => ({
    day, checkedIn: set.has(day), isToday: day === today, future: day > today,
  }));
}

// Every day of one month ('2026-10'), for the check-in screen's calendar.
export function monthCalendar(checked, month) {
  const set = new Set(checked);
  const first = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const nextMonth = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return dayRange(first, daysBetween(first, nextMonth)).map((day) => ({ day, checkedIn: set.has(day) }));
}
