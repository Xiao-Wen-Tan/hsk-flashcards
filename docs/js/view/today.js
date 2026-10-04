// The Today screen: streak, this week's check-ins, the day's ring, what is due, the four
// counters of today, the two nearest goals and the Start button.
import { currentStreak, weekStrip } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { WEEKDAY_LETTERS, percent, plural } from './format.js';
import { speakButton } from './speak.js';

// The four tiles of a day's numbers (counters.js dayStats), for Today and the check-in screen.
// Accuracy shows '-' before the first answer, and minutes are whole minutes.
export function tilesOf(s) {
  return [
    { label: 'new words', value: String(s.newWords) },
    { label: 'reviews', value: String(s.reviews) },
    { label: 'accuracy', value: s.accuracy === null ? '-' : `${s.accuracy}%` },
    { label: 'minutes', value: String(Math.round(s.minutes)) },
  ];
}

// plan is Plan 2's planDay result (from previewDay), checkedDays the checked-in study days, and
// resumable is true when a session stopped earlier today can continue (canContinue in study.js).
// rewound is the meta 'rewound' list of day ranges, which the streak skips. counters is
// counters.js todayCounters' result and goals the nearest goals (goals.js nearest). speak is
// the day's speaking list (speakStatus in speaklist.js), shown as the "Speaking practice"
// button under Start. The day is checked in when the learning and the speaking are both done.
// With 150 reviews waiting and the default settings, the note says that new words are halved.
export function todayView({
  plan, checkedDays, today, settings, resumable = false, rewound = [], counters = null, goals = [],
  speak = { list: [], done: [], left: [] },
}) {
  const checkedInToday = checkedDays.includes(today);
  const reviews = plan.reviews.length;
  const newWords = plan.newWords.length;
  const nothingLeft = reviews === 0 && newWords === 0;
  const speakingLeft = speak.left.length > 0 && !checkedInToday;
  let note = null;
  if (plan.quota === 0 && settings.newPerDay > 0) {
    note = `New words are paused until the waiting reviews (${plan.backlog}) are down to ${2 * settings.reviewCap}.`;
  } else if (plan.quota < settings.newPerDay) {
    note = `New words are halved today because ${plan.backlog} reviews are waiting.`;
  }
  let status;
  if (nothingLeft && checkedInToday) status = 'Done for today. See you tomorrow!';
  else if (nothingLeft && speakingLeft) status = 'Learning done. Speaking practice is left before today\'s check-in.';
  else if (nothingLeft) status = 'Nothing is due. Tap Start to check in.';
  else status = `${plural(reviews, 'review')} and ${plural(newWords, 'new word')} today.`;
  return {
    streak: currentStreak(checkedDays, today, rewound),
    week: weekStrip(checkedDays, today).map((d) => ({ ...d, letter: WEEKDAY_LETTERS[weekdayIndex(d.day)] })),
    ring: counters ? counters.ring : null,
    ringPct: counters ? percent(counters.ring) : null,
    tiles: counters ? tilesOf(counters) : [],
    goals: goals.map((g) => g.text),
    reviews,
    newWords,
    note,
    status,
    checkedInToday,
    canStart: !(nothingLeft && (checkedInToday || speakingLeft)),
    startLabel: resumable || plan.reviewsDone + plan.newDone > 0 ? 'Continue' : 'Start',
    speak: speakButton(speak),
  };
}
