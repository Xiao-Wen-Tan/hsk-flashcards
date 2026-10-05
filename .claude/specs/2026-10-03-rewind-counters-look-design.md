# HSK Flashcards: going back, more counters and badges, and a bright look

Design approved by the user on 2026-10-03, part by part. It extends the original design in
`.claude/specs/2026-09-27-hsk-flashcards-design.md` and changes it where it says so. Everything here is
built inside the current app: plain ES modules in `docs/js/` with no npm packages (the project rule), the
logic as pure functions tested with `node --test`, and the screens calling `docs/js/study.js`.

## Decisions (the user's, 2026-10-03)

| Question | Decision |
|---|---|
| What happens when the learner goes back to a day | A full rewind. Word progress, reviews due, check-ins, the streak and badges return to how they were at the end of that day. A separate "Reset everything" clears all progress. |
| Rewards | More counters and more badges, and still no points or levels. This keeps the original rule "No points or levels" (2026-09-27). |
| Which counters | All four groups: today's numbers, week and month totals, all-time records, and next-goal countdowns. |
| Look | Bright and playful, always light. |
| Clear tones for single characters | Ask the Tone Perfect team (Michigan State University) for their recordings. This is a separate piece of work, outside this spec. |

## 1. Going back to a day, and resetting

**Where.** Settings has two new buttons, "Go back to a day" and "Reset everything".

**Going back.**
1. "Go back to a day" opens the check-in calendar. The learner taps a past day that has a check-in or any answer. Today and days after the last study day cannot be chosen.
2. A confirmation names what will be undone, for example "Undo 3 days: 36 new words and 120 reviews. Your streak becomes 5 days." It offers "Save a backup file first", which downloads the existing backup file.
3. On confirm, the app undoes every answer whose study day is after the chosen day, newest first. Each saved answer already holds the word's progress record from just before it (`before`) and just after it (`after`), see `Study.answer` in `docs/js/study.js`. Undoing an answer puts `before` back, or removes the word's record when `before` is empty because the word was new. Answers that an Undo event had already taken back are skipped.
4. Check-in records of days after the chosen day are removed. The streak becomes what it was at the end of the chosen day (the user's decision, 2026-10-03). The days from the day after the chosen day up to yesterday are stored as rewound (meta key `rewound`, a list of day ranges, also backed up to the Sheet), and `currentStreak` and `bestStreak` in `docs/js/checkin.js` skip rewound days instead of treating them as missed.
5. Badges earned after the chosen day are removed, and badges earned on or before it stay with their dates, because they held at the end of that day.
6. The undone answers and check-ins are deleted from the phone's storage, so counters and the Google Sheet see the rewound history. One event of kind "rewind" with the chosen day and the counts is written, so the Sheet's log shows that a rewind happened. The saved study session (meta key `session`, which lets a stopped session continue, release r007) is deleted too.
7. If the Google Sheet backup is set up, the app then replaces the Sheet's copy with the rewound progress, using the existing "Replace the Sheet with this phone's progress" step. A `resetPending` flag in the Sheet state makes the next backup a replacement even when the phone is offline at the time of the rewind, because the deleted events would otherwise make the ordinary backup stop with "mismatch" (`backUp` in `docs/js/sheet.js`).

**Example.** The learner studied on 1, 2, 3 and 4 October and, on 5 October, goes back to 2 October. The answers of 3 and 4 October are undone, the check-ins of 3 and 4 October are removed, 3 and 4 October are stored as rewound, the streak becomes 2 (and 3 after checking in on 5 October), and a "3-day streak" badge earned on 3 October is removed. On 5 October, Today plans the day from the progress as it stood at the end of 2 October, so the words first learned on 3 and 4 October come back as new words.

**Reset everything.** A confirmation offers the backup file first. Then all progress records, answers, check-ins, badges, rewound days and the saved session are deleted, and the settings (daily amounts, auto-play, the Sheet address and secret code) are kept. If the Sheet is set up, the app replaces the Sheet's copy with the empty progress.

**Logic module.** `docs/js/rewind.js` with pure functions, for example `rewindPlan(events, days, toDay)` that returns which progress records to put back or remove, which events and days to delete, and the counts for the confirmation. The store gets the deletes it needs in one commit, so a rewind either happens completely or not at all.

## 2. Counters and goal countdowns

All numbers come from the answers and check-ins the app already saves. Nothing new is collected.

**Today screen.**
- A large streak count.
- A ring that fills as the day's reviews and new words get done (the share of today's planned work that is done). It is not a score.
- Four tiles: new words, reviews, accuracy and minutes studied today.
- The two nearest goal countdowns as short lines.

**Check-in screen.** Today's four numbers, with a note when one is a personal best ("Best accuracy this week!", "Most words in a day!"), then the calendar.

**Stats screen**, four sections in this order.
1. This week and this month: words learned, reviews, study days and minutes, with a bar chart of the last 7 days and one of the last 30 days.
2. All-time records: best streak, perfect days, total reviews, words learned, words mastered, study days and total minutes.
3. Progress per HSK level, as now.
4. All goal countdowns, nearest first.

**Definitions.**
- **Minutes studied** on a day add up the gaps between that day's answers, each gap counted as at most 5 minutes, so a break does not count. This is the rule of `minutesOf` in `docs/js/sheet.js`, which moves to `docs/js/stats.js` so both use one function. Answers at 19:00:00, 19:00:20 and 19:40:00 give 5.3 minutes.
- **Accuracy** of a day is the share of that day's quiz answers that were right (right or "Know it"), shown as a whole percent.
- **A perfect day** is a checked-in day on which every quiz answer was right.
- **Week** runs Monday to Sunday, as the week strip on Today. **Month** is the calendar month.
- **Goal countdowns** are worked out for: the current theme tile on the progress map ("8 more words to finish Food & Drink"), the next streak badge ("3 days to the 30-day badge"), the next words-learned badge, the next level group ("120 more words to finish HSK 3"), and the next reviews and minutes badges. Each has a distance in the same unit it names. Today shows the two with the smallest share left to go.

**Logic module.** `docs/js/counters.js` (today, week, month, all-time, personal bests) and `docs/js/goals.js` (countdowns), pure functions over events, days and progress.

## 3. More badges

The existing badges stay, and these are added (in `docs/js/config.js` and `docs/js/badges.js`).
- Streaks: 3, 14, 60 and 200 days (joining 7, 30, 100 and 365).
- Words learned: 10, 25, 250 and 4000 (joining 50, 100, 500, 1000, 2000, 3000 and every word).
- Perfect days: 1, 7 and 30.
- Reviews answered: 100, 1,000, 5,000 and 10,000.
- Minutes studied: 60, 300, 1,000 and 3,000.
- "Full week": a check-in on every day from Monday to Sunday. It is one badge with a count (×3 after three full weeks).

**Badges screen.** Badges not yet earned show greyed out with a progress bar, for example "17 / 30 days", so the next one is always in sight. A newly earned badge pops up with a short animation on the check-in screen.

## 4. The look: bright and playful

- **Always light**, also when the phone is in dark mode. The `prefers-color-scheme: dark` rules in `docs/css/app.css` are removed. White background, dark text, and one cheerful main colour (a warm orange-red) for buttons and the streak.
- **A colour per theme.** The 30 themes cycle through 6 bright colours, used on the progress-map tiles and as a thin band at the top of each card.
- **Shapes.** Rounded cards with soft shadows, large rounded buttons, and tap targets of at least 48 pixels.
- **Feedback.** A right answer flashes green with a small bounce and a wrong one flashes red with a small shake. The day's ring fills smoothly. Confetti bursts on check-in and new badges pop up. The confetti is a small script in `docs/js/ui/`, with no package. All motion is short and is switched off when the phone asks for reduced motion (`prefers-reduced-motion`).
- **Unchanged.** The order of the screens, the bottom bar, the quizzes and the cards stay as they are, so nothing the learner already knows moves.

## 5. Testing and release

- Tests are written first for the new logic: `rewind.js` (what is undone, the counts, the badge recount, an Undo inside the undone days, a rewind to the first study day), `counters.js` (the definitions above with worked days), `goals.js` and the new badges.
- The browser checks (`tests/browser/check.mjs`) gain a rewind check: study two days in the smoke site, go back to the first, and see the second day's words return as new words and the streak drop to 1.
- The release test and the publish check run as for every release. Everything ships as one new release (the next RELEASE number), so the phone shows "Update available, tap to reload".

## Amendments (2026-10-03, later the same day)

- The streak after going back follows the user's decision recorded in step 4 of section 1 (rewound days do not count as missed), which replaces the earlier wording "the streak follows from the remaining check-ins".
- The speaking practice panel (`.claude/specs/2026-10-03-speaking-practice-design.md`) adds speak events. Going back removes those after the chosen day like any other event, and speaking badges are kept or removed by date like the others.

## Not in this spec

- Points, levels, a streak freeze or leaderboards (the user chose counters without points).
- The single-character tone recordings, which wait for the Tone Perfect team's answer.
