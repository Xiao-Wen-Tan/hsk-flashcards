// The calendar of the "Go back to a day" screen (ui/rewind.js). It never touches the page, so
// Node can test it. choices are the days that can be chosen (rewindChoices in rewind.js).
import { calendarWeeks } from './progress.js';
import { monthTitle } from './format.js';

// The month to show first, which is the month of the newest day that can be chosen, or today's
// month.
export function startMonth(choices, today) {
  return (choices.at(-1) ?? today).slice(0, 7);
}

// One month ('2026-10') as weeks of 7 cells from Monday, with null outside the month. A cell is
// { day, date, isToday, choosable }. prev and next are the nearest earlier and later months that
// have a day to choose, or null, for the Earlier and Later buttons.
export function rewindCalendar({ choices, month, today }) {
  const months = [...new Set(choices.map((day) => day.slice(0, 7)))].sort();
  const weeks = calendarWeeks(choices, month, today).map((week) => week.map((c) => c && {
    day: c.day, date: c.date, isToday: c.isToday, choosable: c.checkedIn,
  }));
  return {
    month,
    title: monthTitle(month),
    weeks,
    prev: months.filter((m) => m < month).at(-1) ?? null,
    next: months.find((m) => m > month) ?? null,
  };
}
