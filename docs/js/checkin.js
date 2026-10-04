// Check-in streaks and calendars. `checked` is a list of checked-in study days ('YYYY-MM-DD').
import { addDays, dayRange, daysBetween, mondayOf } from './dates.js';

// `rewound` is the list of day ranges the learner went back over (meta 'rewound', written by
// rewind.js), such as [['2026-10-03', '2026-10-04']]. A rewound day neither counts in a streak
// nor breaks it, so after going back to a day the streak is what it was at the end of that day.
export function isRewound(day, rewound = []) {
  return rewound.some(([from, to]) => day >= from && day <= to);
}

// Days in a row with a check-in, ending today. Before today's check-in the streak still
// counts up to yesterday, and one missed day resets it to 0. There is no streak freeze.
// For example, with check-ins on 3, 4 and 5 October the streak is 3 on 5 or 6 October and 0 on 7 October.
export function currentStreak(checked, today, rewound = []) {
  const set = new Set(checked);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  for (;;) {
    if (set.has(day)) n += 1;
    else if (!isRewound(day, rewound)) break;
    day = addDays(day, -1);
  }
  return n;
}

// True when every day after `a` and before `b` is rewound, or there is no such day.
function joined(a, b, rewound) {
  for (let d = addDays(a, 1); d < b; d = addDays(d, 1)) if (!isRewound(d, rewound)) return false;
  return true;
}

export function bestStreak(checked, rewound = []) {
  const days = [...new Set(checked)].sort();
  let best = 0;
  let run = 0;
  days.forEach((day, i) => {
    run = i > 0 && joined(days[i - 1], day, rewound) ? run + 1 : 1;
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
