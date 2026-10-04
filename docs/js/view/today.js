// The Today screen: streak, this week's check-ins, what is due and the Start button.
import { currentStreak, weekStrip } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { WEEKDAY_LETTERS, plural } from './format.js';

// plan is Plan 2's planDay result (from previewDay), checkedDays the checked-in study days, and
// resumable is true when a session stopped earlier today can continue (canContinue in study.js).
// With 150 reviews waiting and the default settings, the note says that new words are halved.
export function todayView({ plan, checkedDays, today, settings, resumable = false }) {
  const checkedInToday = checkedDays.includes(today);
  const reviews = plan.reviews.length;
  const newWords = plan.newWords.length;
  const nothingLeft = reviews === 0 && newWords === 0;
  let note = null;
  if (plan.quota === 0 && settings.newPerDay > 0) {
    note = `New words are paused until the waiting reviews (${plan.backlog}) are down to ${2 * settings.reviewCap}.`;
  } else if (plan.quota < settings.newPerDay) {
    note = `New words are halved today because ${plan.backlog} reviews are waiting.`;
  }
  let status;
  if (nothingLeft && checkedInToday) status = 'Done for today. See you tomorrow!';
  else if (nothingLeft) status = 'Nothing is due. Tap Start to check in.';
  else status = `${plural(reviews, 'review')} and ${plural(newWords, 'new word')} today.`;
  return {
    streak: currentStreak(checkedDays, today),
    week: weekStrip(checkedDays, today).map((d) => ({ ...d, letter: WEEKDAY_LETTERS[weekdayIndex(d.day)] })),
    reviews,
    newWords,
    note,
    status,
    checkedInToday,
    canStart: !(nothingLeft && checkedInToday),
    startLabel: resumable || plan.reviewsDone + plan.newDone > 0 ? 'Continue' : 'Start',
  };
}
