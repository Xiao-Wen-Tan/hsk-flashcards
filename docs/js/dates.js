// Study days are plain 'YYYY-MM-DD' texts. Day arithmetic is done in UTC, where every day
// has 24 hours, so daylight-saving changes can never add or lose a day.
import { CONFIG } from './config.js';

const DAY_MS = 86400000;
const pad = (n, width = 2) => String(n).padStart(width, '0');

function toUTC(day) {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUTC(ms) {
  const d = new Date(ms);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function isDay(text) {
  return typeof text === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(text) && fromUTC(toUTC(text)) === text;
}

// The study day for a moment in local time. Before 04:00 it is still the day before,
// so a session at 01:30 on 6 October counts for 5 October.
// It reads the local clock fields instead of subtracting 4 hours, because on a
// daylight-saving morning 4 hours of real time is not 4 hours on the clock.
export function studyDay(date = new Date(), startHour = CONFIG.dayStartHour) {
  const local = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return date.getHours() < startHour ? addDays(local, -1) : local;
}

export function addDays(day, n) {
  return fromUTC(toUTC(day) + n * DAY_MS);
}

// Whole days from `from` to `to`. daysBetween('2026-10-05', '2026-10-08') === 3.
export function daysBetween(from, to) {
  return Math.round((toUTC(to) - toUTC(from)) / DAY_MS);
}

// Monday is 0 and Sunday is 6.
export function weekdayIndex(day) {
  return (new Date(toUTC(day)).getUTCDay() + 6) % 7;
}

export function mondayOf(day) {
  return addDays(day, -weekdayIndex(day));
}

// dayRange('2026-10-30', 3) gives ['2026-10-30', '2026-10-31', '2026-11-01'].
export function dayRange(first, count) {
  return Array.from({ length: count }, (_, i) => addDays(first, i));
}
