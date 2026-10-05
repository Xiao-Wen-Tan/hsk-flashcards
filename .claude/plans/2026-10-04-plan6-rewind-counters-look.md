# HSK Flashcards Plan 6: Going Back to a Day, More Counters and Badges, and a Bright Look Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the learner go back to an earlier study day or reset everything, show more counters, goal countdowns and badges, and give the app a bright look that is always light, all as release r008.

**Architecture:** The logic goes into small pure modules in `docs/js/`, which Node tests directly. `counters.js` works out the numbers of a day, a week, a month and all time from the saved events. `goals.js` works out the goal countdowns. `closeday.js` holds the check-in and the badges, which `Study.finish` used to do, so Plan 7's speaking panel can share it. `rewind.js` works out and performs going back to a day and resetting. `badges.js` gets one table of badge groups that drives earning, titles and the greyed "next badge" list. The store learns to delete events, check-in days and meta values inside the same single commit as a new event, so going back happens completely or not at all. The screens in `docs/js/ui/` only read saved data, call these modules and draw. The Google Sheet backup (Plan 5) replaces the Sheet's copy after going back or resetting, through a new `rewound` hook and a flag that waits while the phone is offline.

**Tech Stack:** Node v24.16.0 (`node:test`), plain JavaScript ES modules with no npm packages (the project rule), IndexedDB, plain CSS, Python 3.10 with pytest, and headless Google Chrome 154 driven through the Chrome DevTools Protocol for the browser checks.

**Spec:** `.claude/specs/2026-10-03-rewind-counters-look-design.md`, all of it, including its Amendments section. The approved overall plan is `~/.claude/plans/continue-to-work-on-staged-riddle.md`, Step 3, "Plan 6". This plan only keeps Plan 7 (`.claude/specs/2026-10-03-speaking-practice-design.md`) possible. It does not build the speaking panel.

**Where this plan sits:**
- Plans 1 to 5 built the word list, the app, the screens, offline use and the Google Sheet backup.
- Release r007 (commit `716936f` on `main`) made a stopped study session continue (meta key `session`) and redraws Today on a new day (`needsRedraw` in `docs/js/view/route.js`).
- Plan 6 (this plan) is release r008.
- Plan 7, the speaking practice panel, will be release r009. It needs three things from this plan, and all three are here. Going back removes every event after the chosen day except settings, rewind and reset events, so later speak events go too. `closeDay` has one function, `dayStatus`, that decides whether a day can be checked in, so Plan 7 adds its speaking condition there without changing the callers. `BADGE_GROUPS` takes a speaking group as one more row.

**Before you start.**
1. `main` must hold release r007. Run `git --git-dir=~/git/hsk-flashcards.git log --oneline -1 main`. It must print `716936f fix: a stopped session continues, and Today is redrawn on a new day, release r007`, or a later commit.
2. Make the worktree outside Box, because Box is slow with the 13,000 files of the repository:
```bash
git --git-dir=~/git/hsk-flashcards.git worktree add ~/git/hsk-wt-plan6 -b plan6-rewind-counters-look main
cd ~/git/hsk-wt-plan6
```
Every command of this plan runs from `~/git/hsk-wt-plan6`.
3. Check the starting point. `node --test "tests/js/*.test.mjs"` must give `ℹ tests 250`, `ℹ pass 250`, `ℹ fail 0`, and `python -m pytest tests -q` must give `247 passed, 5 skipped`.

**A tool pitfall.** File-writing tools turn a typed unicode escape (a backslash, `u` and four hex digits) into the character itself. This plan writes the character `×` directly (in `badges.js` and its test) and needs no escapes. After writing a file, `grep -n '\\u' FILE` should find nothing new.

---

## Facts verified before writing this plan (2026-10-03)

Each fact was checked by running the command or reading the file named. All code of this plan ran in a scratch worktree, `~/git/hsk-wt-plan6-draft`, made from branch `fix-resume-redraw` at commit `716936f` (release r007). Nothing was written into the project folder except this plan file.

- **Starting point.** At `716936f`, `node --test "tests/js/*.test.mjs"` gave `ℹ tests 250`, `ℹ pass 250` and `python -m pytest tests -q` gave `247 passed, 5 skipped`.
- **Each task, applied from this plan's own text.** A script took the code blocks of this file task by task, applied them to a second fresh worktree at `716936f`, and ran every `Run:` command of the plan. Each test failed first with the failure the plan names, and passed after the code. After Task 15 the JavaScript tests gave `ℹ tests 306`, `ℹ pass 306`, `ℹ fail 0`, and pytest still gave `247 passed, 5 skipped`. All 52 files the plan changes were byte for byte the same as in the scratch worktree where the code was first written.
- **Browser checks in headless Chrome 154**, run on that tree built from this plan's text, with the smoke site of `tools/14_smoke_site.py` (which serves the real words file, `data/words_v002.json`) and a fresh profile in `%TEMP%\hskchk9`. `store` gave 9 `PASS` lines (7 before, plus the 2 new ones for deletes and for `clear`). `day` gave 23 `PASS` lines, the same checks as r007. `sheet` gave 10. The new `rewind` gave 13 and the new `look` gave 7. `offline` gave 4 and `update` gave 3. Every run ended with exit code 0, with no `FAIL` line.
- **What the new browser checks showed.** On day 2, with the page's clock moved one day ahead, the session checked in with "2 day streak" and 40 confetti pieces. "Go back to a day" offered only day 1, and its confirmation read `Undo 1 day: 12 new words and 12 reviews. Your streak becomes 1 day.` Afterwards Today read "1 day streak", "12 reviews" and "12 new words", and the 12 planned new words were exactly the 12 words learned on day 2. The stand-in Sheet then held 28 Log rows, one per event left on the phone. With Chrome in dark mode the page stayed white (`rgb(255, 255, 255)`) with dark text (`rgb(29, 27, 26)`). The smallest button or bottom-bar tab on Today, Map, Stats, Badges and Settings was 48 pixels high. With reduced motion, `burst()` made 0 confetti pieces and the right-answer banner had no animation.
- **The publish check.** `python tools/15_publish_check.py` in the scratch worktree printed `13189 tracked files, docs/ 177.6 MB` and `OK, nothing private or oversized found`.
- **Reading every event costs time as the log grows.** The counters, the goals and the badges need every saved event. In Chrome on this PC, reading 67,500 made-up events (450 days of 150 answers each, about 15 months of daily study) from IndexedDB took 0.4 to 0.8 seconds, and working out the badge facts over them took about 55 milliseconds. A phone is slower. Today, Stats, Badges, the check-in screen and every session end read all events. For the first months this is fast. If the screens feel slow after many months, a later plan can keep each finished day's totals instead (not part of this plan).
- **The 450-day simulation test still runs in about 22 seconds.** It ends 450 sessions, and every session end now reads all events. Two changes in Task 1 keep it fast. The test store (`MemoryStore`) keeps each saved event frozen and hands out the same objects instead of copying them (with copies the test took 67 seconds), and a commit only filters the event list when it deletes events (without that guard it took 141 seconds).
- **Existing tests whose expected values change.** The spec adds badges at 10 and 25 words and perfect-day badges, so a first study day of 12 words, every answer right, now also earns "10 words learned" and "1 perfect day". This changes two expected badge lists in `tests/js/study.test.mjs` ("a finished theme earns its badge once" and "learning the last HSK 1 and 2 words ...") and one list of titles in `tests/js/flow.test.mjs` (Task 5). Every existing test in `study.test.mjs` is kept and passes. The other changed tests are `tests/js/badges.test.mjs` (new steps), `tests/js/hooks.test.mjs` (the hook list), the badges and stats tests of `tests/js/view-progress.test.mjs` (new screens), the minutes test of `tests/js/sheet.test.mjs` (`minutesOf` moves to `stats.js`), and the 30-day activity test of `tests/js/stats.test.mjs` (its function is replaced by `bars`).

## Choices this plan makes where the spec is silent

Each choice is made in one place, named in brackets. These are for the user to see, and each can be changed later.

1. **What "a study day" counts in the counters.** A day with any quiz answer or a check-in. (`studyDays` in `counters.js`)
2. **A perfect day needs at least one answer.** The spec says "a checked-in day on which every quiz answer was right". A day checked in with nothing due has no answers, and it does not count. (`perfectDays` in `counters.js`)
3. **Which personal bests the check-in screen names.** New words and reviews are compared with every earlier day ("Most words in a day!", "Most reviews in a day!"). Accuracy and minutes are compared with the earlier days of this week ("Best accuracy this week!", "Most minutes this week!"). Only a number higher than all of them counts, and there must be at least one earlier day to beat. The spec gives the first and third phrases as examples. The other two are this plan's wording. (`personalBests` in `counters.js`)
4. **How the tiles show numbers.** Minutes are whole minutes (7.6 shows as 8). Accuracy shows `-` before the day's first answer. (`tilesOf` in `view/today.js`)
5. **What the day's ring counts.** The reviews and new words of today's plan. Done is `reviewsDone + newDone`, and left is the reviews and new words still planned, as `planDay` reports them. With nothing planned the ring is full. (`todayCounters` in `counters.js`)
6. **The bar charts show new words plus reviews per day,** as the old 30-day chart did, with checked-in days in the main colour. (`bars` in `counters.js`)
7. **Stats keeps two old parts.** The reviews due in the next 7 days and the accuracy of the last 7 days stay, at the end of the first section, so the screen still has exactly the spec's four sections. The old top row (learned, mastered, words in all) moves into the all-time records. (`statsView` in `view/progress.js`)
8. **The Badges screen shows, per group, the earned badges and the next one.** It does not list every badge not yet earned. For themes the next one is the unfinished theme with the fewest words left (counting every level group, because the theme badge needs them all). For level groups it is the first unfinished group. The next full week and the perfect session are greyed without a progress bar, with their rule as text, because there is no count to show. (`badgeLadder` in `badges.js`)
9. **The goal countdowns.** The theme goal names the current tile of the progress map by its theme name only, for example "8 more words to finish Greetings & Courtesy". The streak goal counts from today's streak, because the next streak badge needs that many days in a row, so a broken streak shows the whole run again. Each goal's "share left" is the part of its target still to go, and Today shows the two smallest. (`goals` in `goals.js`)
10. **Which days can be chosen to go back to.** Days before today with a check-in or an answer, and before the last such day, because going back to the last study day would undo nothing. (`rewindChoices` in `rewind.js`)
11. **"Go back to a day" opens its own calendar screen** (`#/rewind`), in the style of the check-in calendar, with Earlier and Later buttons for the months. Only the days that can be chosen are buttons. The bottom bar does not change. (`docs/js/ui/rewind.js`)
12. **The confirmations are drawn in the page, not as a browser dialog,** because each offers three choices: "Save a backup file first", the action, and "Cancel". (`ui/rewind.js`, `resetPanel` in `ui/settings.js`)
13. **The store can delete meta values.** A commit takes `removeMeta`, a list of meta names, so going back and resetting delete the saved session (meta `session`) instead of leaving an empty value. (`checkCommit` in `store.js`)
14. **The Sheet's Daily tab counts minutes from the day's answers only,** the same `minutesOf` as the app. Before, it also counted the times of check-ins, badges and settings changes. (`dailyRow` in `sheet.js`)
15. **The Sheet's Dashboard streaks skip rewound days,** like the app's. (`summaryOf` in `sheet.js`)
16. **The flag that the Sheet must be replaced is only set when the backup is set up,** and a restore from the Sheet clears it. (`markReset` in `sync.js`, `restoreFromSheet` in `sheet.js`)
17. **The colours.** The main colour is the warm orange-red `#d63c1f`, which has a contrast of 4.6 to 1 with white text, enough for normal-size button text. The six theme colours are orange `#ff6b35`, yellow `#ffb703`, green `#38b000`, blue `#3a86ff`, violet `#8338ec` and pink `#ff006e`. They are used only as bands and pieces, never behind text. (`app.css`, `THEME_COLORS` in `view/format.js`)
18. **The old 30-day function `activity` is removed from `stats.js`,** because `bars` replaces it. (Task 12)

---

## Words used in this plan

- **Event.** One saved line of the phone's log, such as one answer, an Undo, a check-in, new badges or a settings change. Each has a `kind`, a study `day` and a time `ts`.
- **seq.** The number the store gives each event, 1, 2, 3 and so on. It only ever goes up, also after a reset.
- **Answer.** An event of kind `review`, `reask`, `check` or `final`, the four kinds of quiz card (`ANSWER_KINDS` in `stats.js`). A learning card has no answer.
- **Live.** Not taken back by Undo. An undo event names the seq of the answer it takes back.
- **`before` and `after`.** Every answer saves the word's progress record from just before it and just after it (`Study.answer` in `study.js`). `after` is `null` when the answer did not change the record.
- **Check-in record.** One saved record per checked-in study day, in the store's `days` list.
- **Meta.** Single saved values by name: `settings`, `badges` (badge ID to the day earned), `session` (the stopped study session of release r007) and, new in this plan, `rewound`.
- **Commit.** One write to the store. It always adds exactly one event, and everything in it is saved together or not at all.
- **Rewound days.** The days after the day the learner went back to, up to yesterday. They are kept as a list of day ranges in meta `rewound`, such as `[['2026-10-03', '2026-10-04']]`, and a streak neither counts nor breaks on them.
- **Study day.** The date the app counts a moment for. A new study day starts at 04:00 (`studyDay` in `dates.js`).
- **Smoke site.** A local copy of `docs/` that `tools/14_smoke_site.py` builds in `.claude/scratch/smoke_vNNN/` for the browser checks.

## File map

| File | What changes |
|---|---|
| `docs/js/store.js` | Deletes and `clear` inside a commit, `allEvents()`, frozen events in `MemoryStore` (Task 1) |
| `docs/js/stats.js` | `ANSWER_KINDS`, `answerEvents`, `minutesOf` moved here (Task 2); `activity` removed (Task 12) |
| `docs/js/sheet.js` | Uses `minutesOf` from `stats.js` (Task 2); the `rewound` meta key, rewind and reset in the log, the replacement flag (Task 10) |
| `docs/js/checkin.js` | Streaks skip rewound days (Task 3) |
| `docs/js/counters.js` | New. Day, week, month and all-time numbers, bars, perfect days, full weeks, personal bests (Task 4) |
| `docs/js/config.js` | The new badge steps (Task 5); `statsDays.activity` removed (Task 12) |
| `docs/js/badges.js` | `BADGE_GROUPS`, `badgeFacts`, `badgeLadder` (Task 5) |
| `docs/js/goals.js` | New. Goal countdowns (Task 6) |
| `docs/js/closeday.js` | New. Check-in and badges at the end of a day (Task 7) |
| `docs/js/study.js` | `Study.finish` uses `badgeFacts` (Task 5), then `closeDay` (Task 7) |
| `docs/js/rewind.js` | New. Choosing a day, the plan of a rewind, the confirmation text (Task 8); `rewindTo` and `resetAll` (Task 9) |
| `docs/js/hooks.js`, `docs/js/sync.js` | The `rewound` hook, and the backup that replaces the Sheet after it (Task 10) |
| `docs/js/view/today.js` | The ring, the four tiles and the two nearest goals (Task 11) |
| `docs/js/view/progress.js` | The Badges view (Task 5), the check-in numbers (Task 11), the Stats sections (Task 12), theme colours on map tiles (Task 14) |
| `docs/js/view/format.js` | `THEME_COLORS` (Task 11), `themeColor` (Task 14) |
| `docs/js/ui/confetti.js` | New. Confetti with no package (Task 11) |
| `docs/js/ui/screens.js` | Today, Check-in, Stats and Badges draw the new parts (Tasks 5, 11, 12, 14) |
| `docs/js/view/rewind.js`, `docs/js/ui/rewind.js` | New. The "Go back to a day" calendar and screen (Task 13) |
| `docs/js/ui/settings.js`, `docs/js/view/route.js`, `docs/js/app.js` | The two new Settings buttons and the `#/rewind` route (Task 13) |
| `docs/js/view/card.js`, `docs/js/ui/card.js` | The theme band at the top of each card (Task 14) |
| `docs/css/app.css`, `docs/index.html`, `docs/manifest.webmanifest` | The bright, always-light look (Task 14) |
| `docs/js/release.js`, `docs/sw.js` | Release r008, and every new file in `APP_FILES` (Tasks 4, 6, 7, 8, 11, 13, 15) |
| `tests/js/*.test.mjs` | New tests for every new module, and the changed tests listed above |
| `tests/browser/store-idb.js`, `tests/browser/check.mjs` | Two new store checks (Task 1), the new `rewind` and `look` modes (Task 15) |

`docs/` is public. This plan adds only app code and styles to it.

---

### Task 1: Deletes inside one commit, and every event (`docs/js/store.js`)

Going back to a day must delete answers, check-in days and the saved session in the same write as the new "rewind" event, so it happens completely or not at all. "Reset everything" must empty whole stores. Today a commit can only put records and remove word records.

A commit now takes four more lists. Worked example, going back from 5 October to 3 October:
`commit({ removeEvents: [2, 3], removeDays: ['2026-10-04'], removeMeta: ['session'], remove: ['w0001'], event: { day: '2026-10-05', kind: 'rewind', to: '2026-10-03' } })`
deletes events 2 and 3, the check-in of 4 October, the saved session and the record of `w0001`, and adds the rewind event as seq 4. Inside the commit the stores named in `clear` are emptied first, then the deletes run, then the puts, and the event is added last. In IndexedDB, `clear()` empties a store but does not reset its key generator, so the event after a reset still gets the next seq. The Sheet backup relies on that, and the browser check of this task proves it in Chrome.

`allEvents()` returns every event, oldest first. The counters and badges read it. In the test store (`MemoryStore`) each saved event is frozen once and handed out as it is, because copying tens of thousands of events at every session end made the 450-day simulation test take minutes. A caller that tries to change an event gets a `TypeError`.

**Files:**
- Modify: `docs/js/store.js`
- Test: `tests/js/store.test.mjs`, `tests/browser/store-idb.js`

- [ ] **Step 1: Write the failing tests**

Append to the end of `tests/js/store.test.mjs`:

```js
test('allEvents gives every event, oldest first', async () => {
  const store = new MemoryStore();
  await store.commit({ event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-03', kind: 'settings' }) });
  assert.deepEqual((await store.allEvents()).map((e) => [e.seq, e.day]), [[1, '2026-10-04'], [2, '2026-10-03']]);
});

test('events, days and meta keys are deleted in the same commit as the new event', async () => {
  // A rewind (rewind.js) deletes the answers and check-ins after the chosen day and writes one event.
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', '2026-10-03')], days: [{ day: '2026-10-03' }], event: ev({ day: '2026-10-03' }) });
  await store.commit({ days: [{ day: '2026-10-04' }], meta: { session: { day: '2026-10-04' } }, event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-04', kind: 'checkin' }) });
  const seq = await store.commit({
    removeEvents: [2, 3], removeDays: ['2026-10-04'], removeMeta: ['session'], remove: ['w0001'],
    event: { day: '2026-10-05', kind: 'rewind', to: '2026-10-03' },
  });
  assert.equal(seq, 4);
  assert.deepEqual((await store.allEvents()).map((e) => e.seq), [1, 4]);
  assert.deepEqual((await store.allDays()).map((d) => d.day), ['2026-10-03']);
  assert.equal(await store.getMeta('session'), undefined);
  assert.deepEqual(await store.allProgress(), []);
});

test('clear empties progress, events and days, keeps meta, and seq keeps rising', async () => {
  // "Reset everything" keeps the settings, and its event gets the next seq, so the Sheet backup
  // never sees an old seq number again.
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { settings: { newPerDay: 8 } }, event: ev() });
  await store.commit({ event: ev() });
  const seq = await store.commit({ clear: ['progress', 'events', 'days'], meta: { badges: {} }, event: { day: DAY, kind: 'reset' } });
  assert.equal(seq, 3);
  assert.deepEqual((await store.allEvents()).map((e) => [e.seq, e.kind]), [[3, 'reset']]);
  assert.deepEqual([await store.allProgress(), await store.allDays()], [[], []]);
  assert.deepEqual(await store.getMeta('settings'), { newPerDay: 8 });
  assert.deepEqual(await store.getMeta('badges'), {});
});

test('a commit puts after it deletes, so a word can be cleared and written again', async () => {
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  const again = { ...learnedProgress('w0002', DAY), step: 3 };
  await store.commit({ clear: ['progress'], progress: [again], event: ev({ kind: 'reset' }) });
  assert.deepEqual(await store.allProgress(), [again]);
});

test('bad deletes are refused and write nothing', async () => {
  const store = new MemoryStore();
  await store.commit({ event: ev() });
  await assert.rejects(store.commit({ removeEvents: ['1'], event: ev() }), /removeEvents takes seq numbers/);
  await assert.rejects(store.commit({ removeDays: ['2026-13-01'], event: ev() }), /removeDays takes study days/);
  await assert.rejects(store.commit({ removeMeta: [7], event: ev() }), /removeMeta takes meta names/);
  await assert.rejects(store.commit({ clear: ['meta'], event: ev() }), /clear takes progress, events or days/);
  assert.deepEqual((await store.allEvents()).map((e) => e.seq), [1]);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/store.test.mjs`
Expected: `ℹ tests 14`, `ℹ pass 9`, `ℹ fail 5`, with errors such as `TypeError: store.allEvents is not a function` and `Missing expected rejection`.

- [ ] **Step 3: Write the store**

Replace the whole of `docs/js/store.js` with:

```js
// Saved progress. Four stores:
//   progress  one record per word (see srs.js), keyed by word ID
//   events    a log of every answer, undo, check-in and badge, keyed by seq
//   days      one record per checked-in study day, keyed by day
//   meta      settings, earned badges and other single values, keyed by name
//
// Both stores below (MemoryStore for tests, IdbStore for the browser) offer the same
// async methods:
//   allProgress(), getProgress(id)
//   commit({ progress, remove, days, meta, removeEvents, removeDays, removeMeta, clear, event })
//     writes everything in one go and returns the event's seq. Every change goes with exactly
//     one event, so the log always explains the saved state. Inside the commit the stores
//     named in `clear` ('progress', 'events', 'days') are emptied first, then the deletes run
//     (word IDs in `remove`, seq numbers in `removeEvents`, study days in `removeDays`, meta
//     names in `removeMeta`), then the puts, and the event is added last.
//   eventsSince(seq)  events with a larger seq, oldest first (for the Sheet backup, Plan 5)
//   eventsFrom(day)   events of that study day and later, oldest first (for stats)
//   allEvents()       every event, oldest first (for counters, badges and going back to a day)
//   allDays(), getMeta(key), dump(), restore(dump)
// seq numbers start at 1 and only ever go up, also after a restore or a clear.
import { isDay } from './dates.js';

export const STORE_NAMES = Object.freeze(['progress', 'events', 'days', 'meta']);

const copy = (value) => (value === undefined ? undefined : structuredClone(value));

// A saved event never changes, so MemoryStore keeps each one frozen and allEvents() hands out
// the frozen events themselves. Copying tens of thousands of events at every session end made
// the 450-day simulation test take minutes. A caller that tries to change one gets a TypeError.
function frozen(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) frozen(v);
  }
  return value;
}

// Checks a commit before anything is written, so a bad commit changes nothing.
export const CLEARABLE = Object.freeze(['progress', 'events', 'days']);

export function checkCommit({
  progress = [], remove = [], days = [], meta = {}, removeEvents = [], removeDays = [], removeMeta = [], clear = [], event,
} = {}) {
  if (!event || typeof event.kind !== 'string' || !isDay(event.day)) {
    throw new Error('A commit needs an event with a kind and a study day');
  }
  if ('seq' in event) throw new Error('The store gives events their seq');
  for (const p of progress) {
    if (typeof p?.id !== 'string' || !Number.isInteger(p.step) || p.step < 0 || p.step > 9) {
      throw new Error(`Bad progress record ${JSON.stringify(p)}`);
    }
  }
  if (!remove.every((id) => typeof id === 'string')) throw new Error('remove takes word IDs');
  if (!days.every((d) => isDay(d?.day))) throw new Error('Bad day record');
  if (typeof meta !== 'object' || meta === null || Array.isArray(meta)) throw new Error('meta must be an object');
  if (!removeEvents.every((s) => Number.isInteger(s) && s > 0)) throw new Error('removeEvents takes seq numbers');
  if (!removeDays.every(isDay)) throw new Error('removeDays takes study days');
  if (!removeMeta.every((k) => typeof k === 'string')) throw new Error('removeMeta takes meta names');
  if (!clear.every((name) => CLEARABLE.includes(name))) throw new Error('clear takes progress, events or days');
  return { progress, remove, days, meta, removeEvents, removeDays, removeMeta, clear, event };
}

function checkDump(dump) {
  for (const name of ['progress', 'events', 'days']) {
    if (!Array.isArray(dump?.[name])) throw new Error(`The backup has no ${name} list`);
  }
  if (typeof dump.meta !== 'object' || dump.meta === null) throw new Error('The backup has no meta');
  const seqs = dump.events.map((e) => e.seq);
  if (!seqs.every((s, i) => Number.isInteger(s) && s > 0 && (i === 0 || s > seqs[i - 1]))) {
    throw new Error('Backup events must have increasing seq numbers');
  }
}

const bySeq = (a, b) => a.seq - b.seq;
const byDay = (a, b) => a.day.localeCompare(b.day);

export class MemoryStore {
  constructor() {
    this.progress = new Map();
    this.events = [];
    this.days = new Map();
    this.meta = new Map();
    this.nextSeq = 1;
  }

  async allProgress() { return [...this.progress.values()].map(copy); }

  async getProgress(id) { return copy(this.progress.get(id)); }

  async commit(input) {
    const c = checkCommit(input);
    const seq = this.nextSeq;
    if (c.clear.includes('progress')) this.progress.clear();
    if (c.clear.includes('events')) this.events = [];
    if (c.clear.includes('days')) this.days.clear();
    for (const id of c.remove) this.progress.delete(id);
    if (c.removeEvents.length) {
      const gone = new Set(c.removeEvents);
      this.events = this.events.filter((e) => !gone.has(e.seq));
    }
    for (const day of c.removeDays) this.days.delete(day);
    for (const key of c.removeMeta) this.meta.delete(key);
    for (const p of c.progress) this.progress.set(p.id, copy(p));
    for (const d of c.days) this.days.set(d.day, copy(d));
    for (const [key, value] of Object.entries(c.meta)) this.meta.set(key, copy(value));
    this.events.push(frozen({ ...copy(c.event), seq }));
    this.nextSeq = seq + 1;
    return seq;
  }

  async eventsSince(seq) { return this.events.filter((e) => e.seq > seq).map(copy); }

  async allEvents() { return this.events.slice(); }

  async eventsFrom(day) { return this.events.filter((e) => e.day >= day).map(copy); }

  async allDays() { return [...this.days.values()].sort(byDay).map(copy); }

  async getMeta(key) { return copy(this.meta.get(key)); }

  async dump() {
    return copy({
      progress: [...this.progress.values()],
      events: this.events,
      days: [...this.days.values()].sort(byDay),
      meta: Object.fromEntries(this.meta),
    });
  }

  async restore(dump) {
    checkDump(dump);
    this.progress = new Map(dump.progress.map((p) => [p.id, copy(p)]));
    this.events = dump.events.map((e) => frozen(copy(e)));
    this.days = new Map(dump.days.map((d) => [d.day, copy(d)]));
    this.meta = new Map(Object.entries(copy(dump.meta)));
    this.nextSeq = Math.max(this.nextSeq, ...this.events.map((e) => e.seq + 1));
  }
}

// ---- IndexedDB (the browser's built-in database). Not run by the Node tests. ----

function request(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function finished(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Transaction aborted'));
  });
}

export function openIdbStore(name = 'hsk-flashcards', factory = globalThis.indexedDB) {
  return new Promise((resolve, reject) => {
    const req = factory.open(name, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      db.createObjectStore('progress', { keyPath: 'id' });
      db.createObjectStore('events', { keyPath: 'seq', autoIncrement: true }).createIndex('day', 'day');
      db.createObjectStore('days', { keyPath: 'day' });
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(new IdbStore(req.result));
    req.onerror = () => reject(req.error);
  });
}

export class IdbStore {
  constructor(db) { this.db = db; }

  async getAll(storeName, query) {
    return request(this.db.transaction(storeName).objectStore(storeName).getAll(query));
  }

  async allProgress() { return this.getAll('progress'); }

  async getProgress(id) { return request(this.db.transaction('progress').objectStore('progress').get(id)); }

  // clear() empties a store but does not reset its key generator, so the event added after a
  // clear still gets the next seq (tests/browser/store-idb.js checks this in Chrome).
  async commit(input) {
    const c = checkCommit(input);
    const tx = this.db.transaction(STORE_NAMES, 'readwrite');
    const done = finished(tx);
    for (const name of c.clear) tx.objectStore(name).clear();
    for (const id of c.remove) tx.objectStore('progress').delete(id);
    for (const seq of c.removeEvents) tx.objectStore('events').delete(seq);
    for (const day of c.removeDays) tx.objectStore('days').delete(day);
    for (const key of c.removeMeta) tx.objectStore('meta').delete(key);
    for (const p of c.progress) tx.objectStore('progress').put(p);
    for (const d of c.days) tx.objectStore('days').put(d);
    for (const [key, value] of Object.entries(c.meta)) tx.objectStore('meta').put({ key, value });
    const [seq] = await Promise.all([request(tx.objectStore('events').add({ ...c.event })), done]);
    return seq;
  }

  async eventsSince(seq) { return this.getAll('events', IDBKeyRange.lowerBound(seq, true)); }

  async allEvents() { return this.getAll('events'); }

  async eventsFrom(day) {
    const tx = this.db.transaction('events');
    const events = await request(tx.objectStore('events').index('day').getAll(IDBKeyRange.lowerBound(day)));
    return events.sort(bySeq);
  }

  async allDays() { return this.getAll('days'); }

  async getMeta(key) {
    const row = await request(this.db.transaction('meta').objectStore('meta').get(key));
    return row?.value;
  }

  async dump() {
    const [progress, events, days, meta] = await Promise.all(STORE_NAMES.map((n) => this.getAll(n)));
    return { progress, events, days, meta: Object.fromEntries(meta.map((m) => [m.key, m.value])) };
  }

  async restore(dump) {
    checkDump(dump);
    const tx = this.db.transaction(STORE_NAMES, 'readwrite');
    const done = finished(tx);
    for (const name of STORE_NAMES) tx.objectStore(name).clear();
    for (const p of dump.progress) tx.objectStore('progress').put(p);
    for (const e of dump.events) tx.objectStore('events').put(e);
    for (const d of dump.days) tx.objectStore('days').put(d);
    for (const [key, value] of Object.entries(dump.meta)) tx.objectStore('meta').put({ key, value });
    await done;
  }
}

// Asks the browser not to clear saved data when the phone runs low on space.
// Returns true when the data is protected.
export async function askPersistentStorage(nav = globalThis.navigator) {
  const storage = nav?.storage;
  if (!storage?.persist) return false;
  if (storage.persisted && (await storage.persisted())) return true;
  return storage.persist();
}
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test tests/js/store.test.mjs`
Expected: `ℹ tests 14`, `ℹ pass 14`, `ℹ fail 0`.

- [ ] **Step 5: Add the same two checks to the IndexedDB page**

Node has no IndexedDB, so `tests/browser/store-idb.js` runs the store checks in Chrome (Task 15 runs it).

In `tests/browser/store-idb.js`, replace:

```js
  store.db = again.db; // so the check's clean-up closes the reopened connection
});

const failed
```

with:

```js
  store.db = again.db; // so the check's clean-up closes the reopened connection
});

await check('events, days and meta keys are deleted in the same commit as the new event', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', '2026-10-03')], days: [{ day: '2026-10-03' }], event: ev({ day: '2026-10-03' }) });
  await store.commit({ days: [{ day: '2026-10-04' }], meta: { session: { day: '2026-10-04' } }, event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-04', kind: 'checkin' }) });
  const seq = await store.commit({
    removeEvents: [2, 3], removeDays: ['2026-10-04'], removeMeta: ['session'], remove: ['w0001'],
    event: { day: '2026-10-05', kind: 'rewind', to: '2026-10-03' },
  });
  equal(seq, 4, 'seq of the rewind');
  equal((await store.allEvents()).map((e) => e.seq), [1, 4], 'events left');
  equal((await store.allDays()).map((d) => d.day), ['2026-10-03'], 'days left');
  equal(await store.getMeta('session'), undefined, 'session gone');
  equal(await store.allProgress(), [], 'word removed');
});

await check('clear empties progress, events and days, and seq keeps rising', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { settings: { newPerDay: 8 } }, event: ev() });
  await store.commit({ event: ev() });
  const seq = await store.commit({ clear: ['progress', 'events', 'days'], meta: { badges: {} }, event: { day: DAY, kind: 'reset' } });
  equal(seq, 3, 'seq after the clear');
  equal((await store.allEvents()).map((e) => [e.seq, e.kind]), [[3, 'reset']], 'only the reset event');
  equal([await store.allProgress(), await store.allDays()], [[], []], 'progress and days empty');
  equal(await store.getMeta('settings'), { newPerDay: 8 }, 'settings kept');
  equal(await store.commit({ event: ev() }), 4, 'next seq');
});

const failed
```

Run: `node --check tests/browser/store-idb.js && node --test "tests/js/*.test.mjs"`
Expected: no output from the syntax check, then `ℹ tests 255`, `ℹ pass 255`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/store.js tests/js/store.test.mjs tests/browser/store-idb.js && git commit -F - <<'EOF'
feat(store): delete events, days and meta values inside one commit, and read every event

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 2: Answers and minutes in one place (`docs/js/stats.js`)

The counters need the day's quiz answers without the ones Undo took back, and the minutes studied. The spec says `minutesOf` moves from `sheet.js` to `stats.js`, so the app and the Sheet use one function. It now takes exactly the events to count, so the caller decides. The app passes a day's answers, and Plan 7 can add speak events.

Worked example of the minutes rule (the spec's own). Answers at 19:00:00, 19:00:20 and 19:40:00 give a gap of 20 seconds and a gap of 39 minutes 40 seconds, which counts as 5 minutes. That is 320 seconds, or 5.3 minutes.

The Sheet's Daily tab now counts minutes from the day's answers only. Before, the times of check-ins and badge events counted too, so a check-in 3 minutes after the last answer added 3 minutes.

**Files:**
- Modify: `docs/js/stats.js`, `docs/js/sheet.js`
- Test: `tests/js/stats.test.mjs`, `tests/js/sheet.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tests/js/stats.test.mjs`, replace:

```js
import {
  LEVEL_GROUPS, accuracy, activity, forecast, groupsDone, levelProgress, liveEvents, mapSections, themesDone, totals,
} from '../../docs/js/stats.js';
```

with:

```js
import {
  ANSWER_KINDS, LEVEL_GROUPS, accuracy, activity, answerEvents, forecast, groupsDone, levelProgress, liveEvents, mapSections,
  minutesOf, themesDone, totals,
} from '../../docs/js/stats.js';
```

Append to the end of `tests/js/stats.test.mjs`:

```js
test('answers are the live review, re-ask, check and final events', () => {
  const events = [
    { seq: 1, day: TODAY, kind: 'review', grade: 'right' },
    { seq: 2, day: TODAY, kind: 'check', grade: 'wrong' },
    { seq: 3, day: TODAY, kind: 'undo', target: 2 },
    { seq: 4, day: TODAY, kind: 'checkin' },
    { seq: 5, day: TODAY, kind: 'final', grade: 'right', outcome: 'learned' },
    { seq: 6, day: TODAY, kind: 'reask', grade: 'know' },
    { seq: 7, day: TODAY, kind: 'badges', badges: ['perfect'] },
  ];
  assert.deepEqual(ANSWER_KINDS, ['review', 'reask', 'check', 'final']);
  assert.deepEqual(answerEvents(events).map((e) => e.seq), [1, 5, 6]);
});

test('minutes add the gaps between the given events, each at most 5 minutes', () => {
  const at = (t) => ({ ts: `2026-10-05T${t}Z` });
  // 20 seconds, then 39 minutes 40 seconds counted as 5 minutes, make 320 seconds or 5.3 minutes.
  assert.equal(minutesOf([at('19:00:00'), at('19:00:20'), at('19:40:00')]), 5.3);
  assert.equal(minutesOf([at('19:00:00')]), 0);
  assert.equal(minutesOf([]), 0);
  // The order does not matter, and an event without a readable time is skipped.
  assert.equal(minutesOf([at('19:40:00'), at('19:00:00'), { ts: 'not a time' }]), 5);
});
```

In `tests/js/sheet.test.mjs`, replace:

```js
  HEADERS, backUp, checkCode, checkWebAppUrl, dailyRow, isDue, loadState, logRow, makeCode, makeDeviceId, minutesOf, postJson,
```

with:

```js
  HEADERS, backUp, checkCode, checkWebAppUrl, dailyRow, isDue, loadState, logRow, makeCode, makeDeviceId, postJson,
```

In `tests/js/sheet.test.mjs`, replace:

```js
test('minutes add the gaps between answers, each at most 5 minutes', () => {
  const at = (t) => ({ ts: `2026-10-05T${t}Z` });
  assert.equal(minutesOf([at('19:00:00'), at('19:00:20'), at('19:40:00')]), 5.3);
  const events = [
    { seq: 1, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:00:00Z' },
    { seq: 2, day: '2026-10-06', kind: 'review', grade: 'wrong', ts: '2026-10-06T19:00:30Z' },
    { seq: 3, day: '2026-10-06', kind: 'undo', target: 2, ts: '2026-10-06T19:00:40Z' },
    { seq: 4, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:01:00Z' },
    { seq: 5, day: '2026-10-06', kind: 'review', grade: 'know', ts: '2026-10-06T19:01:30Z' },
    { seq: 6, day: '2026-10-06', kind: 'review', grade: 'unsure', ts: '2026-10-06T19:01:40Z' },
  ];
  // 4 live reviews (answer 2 was taken back), 3 of them right or Know it, 100 seconds in all.
  assert.deepEqual(dailyRow('2026-10-06', events, undefined), ['2026-10-06', 'no', 4, 0.75, 0, 1.7, '']);
});
```

with:

```js
test('a Daily row counts the live reviews, and minutes from the day\'s answers only', () => {
  const events = [
    { seq: 1, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:00:00Z' },
    { seq: 2, day: '2026-10-06', kind: 'review', grade: 'wrong', ts: '2026-10-06T19:00:30Z' },
    { seq: 3, day: '2026-10-06', kind: 'undo', target: 2, ts: '2026-10-06T19:00:40Z' },
    { seq: 4, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:01:00Z' },
    { seq: 5, day: '2026-10-06', kind: 'review', grade: 'know', ts: '2026-10-06T19:01:30Z' },
    { seq: 6, day: '2026-10-06', kind: 'review', grade: 'unsure', ts: '2026-10-06T19:01:40Z' },
    { seq: 7, day: '2026-10-06', kind: 'checkin', ts: '2026-10-06T19:04:40Z' },
  ];
  // 4 live reviews (answer 2 was taken back), 3 of them right or Know it. The live answers span
  // 100 seconds, 1.7 minutes. The check-in 3 minutes later is not an answer, so it adds nothing.
  assert.deepEqual(dailyRow('2026-10-06', events, undefined), ['2026-10-06', 'no', 4, 0.75, 0, 1.7, '']);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/stats.test.mjs tests/js/sheet.test.mjs`
Expected: `ℹ fail 2`. The stats file stops at once with `SyntaxError: The requested module '../../docs/js/stats.js' does not provide an export named 'ANSWER_KINDS'`, and the Daily row test gets `4.7` minutes where it expects `1.7`, because the check-in still counts.

- [ ] **Step 3: Add answers and minutes to `stats.js`**

In `docs/js/stats.js`, replace:

```js
export function liveEvents(events) {
  const undone = new Set(events.filter((e) => e.kind === 'undo').map((e) => e.target));
  return events.filter((e) => e.kind !== 'undo' && !undone.has(e.seq));
}
```

with:

```js
export function liveEvents(events) {
  const undone = new Set(events.filter((e) => e.kind === 'undo').map((e) => e.target));
  return events.filter((e) => e.kind !== 'undo' && !undone.has(e.seq));
}

// The event kinds that are quiz answers (session.js card types). A learning card has no answer.
export const ANSWER_KINDS = Object.freeze(['review', 'reask', 'check', 'final']);

// The quiz answers among events, without the ones Undo took back.
export function answerEvents(events) {
  return liveEvents(events).filter((e) => ANSWER_KINDS.includes(e.kind));
}

// The minutes studied add up the gaps between the times of `events`, each gap counted as at
// most 5 minutes, so a break does not count. The caller picks the events, for example one
// day's answers. Answers at 19:00:00, 19:00:20 and 19:40:00 give 20 s + 5 min = 5.3 minutes.
export function minutesOf(events) {
  const times = events.map((e) => Date.parse(e.ts)).filter(Number.isFinite).sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < times.length; i += 1) ms += Math.min(times[i] - times[i - 1], 5 * 60 * 1000);
  return Math.round(ms / 6000) / 10;
}
```

- [ ] **Step 4: Let `sheet.js` use them**

In `docs/js/sheet.js`, replace:

```js
import { liveEvents } from './stats.js';
```

with:

```js
import { answerEvents, minutesOf } from './stats.js';
```

In `docs/js/sheet.js`, replace:

```js
// Minutes studied on a day: the gaps between answers added up, each gap counted as at most
// 5 minutes, so a break does not count. Answers at 19:00:00, 19:00:20 and 19:40:00 give 5.3 min.
export function minutesOf(events) {
  const times = events.map((e) => Date.parse(e.ts)).filter(Number.isFinite).sort((a, b) => a - b);
  let ms = 0;
  for (let i = 1; i < times.length; i += 1) ms += Math.min(times[i] - times[i - 1], 5 * 60 * 1000);
  return Math.round(ms / 6000) / 10;
}

// One row per study day. dayRecord is the saved check-in record of that day, or undefined.
// ['2026-10-06', 'yes', 12, 0.917, 12, 21.5, '{"day":"2026-10-06",...}']
export function dailyRow(day, events, dayRecord) {
  const live = liveEvents(events.filter((e) => e.day === day));
  const reviews = live.filter((e) => e.kind === 'review');
  const right = reviews.filter((e) => e.grade === 'right' || e.grade === 'know').length;
  const learned = live.filter((e) => e.outcome === 'learned').length;
  return [day, dayRecord ? 'yes' : 'no', reviews.length, reviews.length ? Math.round((right / reviews.length) * 1000) / 1000 : '',
    learned, minutesOf(events.filter((e) => e.day === day)), dayRecord ? JSON.stringify(dayRecord) : ''];
}
```

with:

```js
// One row per study day. dayRecord is the saved check-in record of that day, or undefined.
// Minutes are those of the day's answers (minutesOf in stats.js, the same as the app's counters).
// ['2026-10-06', 'yes', 12, 0.917, 12, 21.5, '{"day":"2026-10-06",...}']
export function dailyRow(day, events, dayRecord) {
  const answers = answerEvents(events.filter((e) => e.day === day));
  const reviews = answers.filter((e) => e.kind === 'review');
  const right = reviews.filter((e) => e.grade === 'right' || e.grade === 'know').length;
  const learned = answers.filter((e) => e.outcome === 'learned').length;
  return [day, dayRecord ? 'yes' : 'no', reviews.length, reviews.length ? Math.round((right / reviews.length) * 1000) / 1000 : '',
    learned, minutesOf(answers), dayRecord ? JSON.stringify(dayRecord) : ''];
}
```

- [ ] **Step 5: Run the tests and see them pass**

Run: `node --test tests/js/stats.test.mjs tests/js/sheet.test.mjs`
Expected: `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0`.

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 257`, `ℹ pass 257`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/stats.js docs/js/sheet.js tests/js/stats.test.mjs tests/js/sheet.test.mjs && git commit -F - <<'EOF'
feat(stats): quiz answers without Undo, and one minutes rule for the app and the Sheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 3: Streaks that skip rewound days (`docs/js/checkin.js`)

The user decided on 2026-10-03 that after going back to a day, the streak is what it was at the end of that day. The days after it, up to yesterday, are stored as rewound (meta `rewound`, a list of day ranges), and a streak neither counts them nor breaks on them.

Worked example, the spec's own. Check-ins on 1 and 2 October, and on 5 October the learner goes back to 2 October, so 3 and 4 October are rewound (`[['2026-10-03', '2026-10-04']]`). On 5 October, before checking in, the streak looks back from 4 October. 4 and 3 October are rewound and skipped, 2 and 1 October are checked in, and 30 September is not, so the streak is 2. After the check-in on 5 October it is 3. Without the rewound days it would be 0, because 4 October would count as missed.

**Files:**
- Modify: `docs/js/checkin.js`
- Test: `tests/js/checkin.test.mjs`

- [ ] **Step 1: Write the failing test**

In `tests/js/checkin.test.mjs`, replace:

```js
import { bestStreak, currentStreak, monthCalendar, weekStrip } from '../../docs/js/checkin.js';
```

with:

```js
import { bestStreak, currentStreak, isRewound, monthCalendar, weekStrip } from '../../docs/js/checkin.js';
```

Append to the end of `tests/js/checkin.test.mjs`:

```js
test('rewound days neither count nor break a streak', () => {
  // The spec's example has check-ins on 1 and 2 October, and on 5 October the learner goes back
  // to 2 October, so 3 and 4 October are stored as rewound (meta 'rewound').
  const rewound = [['2026-10-03', '2026-10-04']];
  const checked = ['2026-10-01', '2026-10-02'];
  assert.equal(currentStreak(checked, '2026-10-05', rewound), 2);
  assert.equal(currentStreak([...checked, '2026-10-05'], '2026-10-05', rewound), 3);
  assert.equal(currentStreak(checked, '2026-10-05'), 0); // without the rewound days, 4 October was missed
  assert.equal(currentStreak(checked, '2026-10-06', rewound), 0); // 5 October was missed
  assert.equal(bestStreak([...checked, '2026-10-05'], rewound), 3);
  assert.equal(bestStreak([...checked, '2026-10-05']), 2);
  assert.equal(isRewound('2026-10-03', rewound), true);
  assert.equal(isRewound('2026-10-05', rewound), false);
  assert.equal(isRewound('2026-10-03'), false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/checkin.test.mjs`
Expected: `ℹ fail 1`, with `SyntaxError: The requested module '../../docs/js/checkin.js' does not provide an export named 'isRewound'`.

- [ ] **Step 3: Skip rewound days in the streaks**

In `docs/js/checkin.js`, replace:

```js
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
```

with:

```js
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
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `node --test tests/js/checkin.test.mjs`
Expected: `ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 258`, `ℹ pass 258`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/checkin.js tests/js/checkin.test.mjs && git commit -F - <<'EOF'
feat(checkin): streaks skip the days the learner went back over

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 4: The counters (`docs/js/counters.js`)

All the new numbers come from the answers and check-ins the app already saves (the spec's section 2). One pass over the events groups the live answers by day (`statsByDay`), and every counter is built from those days.

Worked example, Tuesday 6 October with these answers:

| Time | Card | Answer |
|---|---|---|
| 19:00:00 | review | right |
| 19:00:20 | review | wrong |
| 19:01:00 | re-ask | Know it |
| 19:02:00 | group check | right |
| 19:40:00 | final check | right, word learned |
| 19:40:10 | group check | wrong, then taken back by Undo |

The day has 5 live answers, 4 of them right, so its accuracy is 80%. It has 2 reviews and 1 new word. Its minutes are 20 s + 40 s + 60 s + 5 min (the 38-minute gap counts as 5) = 420 s = 7 minutes.

The other counters:
- **The ring** is the share of today's planned work that is done. With 2 reviews done and 6 reviews and new words left it is 2 / 8 = 0.25.
- **This week** runs Monday to Sunday, so on Wednesday 7 October it is 5 to 11 October. **This month** is the calendar month.
- **Bars** give each of the last 7 or 30 days its new words and reviews, with the busiest day at full height.
- **A perfect day** is a checked-in day with at least one answer, every one of them right. **A full week** has a check-in on all 7 days from Monday to Sunday.
- **All-time records** are the best streak (skipping rewound days), perfect days, reviews, words learned and mastered, study days and minutes.
- **Personal bests** compare today's new words and reviews with every earlier day, and today's accuracy and minutes with the earlier days of this week (choice 3).

**Files:**
- Create: `docs/js/counters.js`
- Modify: `docs/sw.js`
- Test: `tests/js/counters.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/counters.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allTime, bars, dayStats, fullWeeks, perfectDays, periodTotals, personalBests, thisMonth, thisWeek, todayCounters,
} from '../../docs/js/counters.js';
import { learnedProgress } from '../../docs/js/srs.js';

// Events as Study saves them, with times in UTC. ans('2026-10-06', '19:00:00', 'review', 'right')
// is a right review answer at 19:00 on 6 October.
let seq = 0;
const ans = (day, time, kind, grade, outcome = null) => ({ seq: ++seq, day, kind, grade, outcome, ts: `${day}T${time}Z` });
const other = (day, time, kind, extra = {}) => ({ seq: ++seq, day, kind, ts: `${day}T${time}Z`, ...extra });

// Tuesday 6 October has 5 live answers, 4 of them right.
function tuesday() {
  const events = [
    ans('2026-10-06', '19:00:00', 'review', 'right'),
    ans('2026-10-06', '19:00:20', 'review', 'wrong'),
    ans('2026-10-06', '19:01:00', 'reask', 'know'),
    ans('2026-10-06', '19:02:00', 'check', 'right'),
    ans('2026-10-06', '19:40:00', 'final', 'right', 'learned'),
  ];
  const taken = ans('2026-10-06', '19:40:10', 'check', 'wrong');
  return [...events, taken, other('2026-10-06', '19:40:15', 'undo', { target: taken.seq }),
    other('2026-10-06', '19:41:00', 'checkin')];
}

test('one day\'s numbers come from its live answers', () => {
  const s = dayStats(tuesday(), '2026-10-06');
  // The minutes are 20 s + 40 s + 60 s, plus 38 minutes counted as 5, which is 420 s or 7 minutes.
  // The answer taken back by Undo, the undo itself and the check-in are not answers.
  assert.deepEqual(s, { day: '2026-10-06', newWords: 1, reviews: 2, answers: 5, right: 4, accuracy: 80, minutes: 7 });
  assert.deepEqual(dayStats(tuesday(), '2026-10-07'),
    { day: '2026-10-07', newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, minutes: 0 });
});

test('today\'s ring is the share of the planned work that is done', () => {
  const plan = { reviews: ['a', 'b'], newWords: ['c', 'd', 'e', 'f'], reviewsDone: 2, newDone: 0 };
  const c = todayCounters({ events: tuesday(), plan, day: '2026-10-06' });
  assert.deepEqual([c.done, c.left, c.ring, c.accuracy, c.minutes], [2, 6, 0.25, 80, 7]);
  const empty = { reviews: [], newWords: [], reviewsDone: 0, newDone: 0 };
  assert.equal(todayCounters({ events: [], plan: empty, day: '2026-10-06' }).ring, 1);
});

test('the week runs Monday to Sunday and the month is the calendar month', () => {
  assert.deepEqual(thisWeek('2026-10-07'), { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(thisWeek('2026-10-11'), { from: '2026-10-05', to: '2026-10-11' });
  assert.deepEqual(thisMonth('2026-10-07'), { from: '2026-10-01', to: '2026-10-31' });
  assert.deepEqual(thisMonth('2028-02-10'), { from: '2028-02-01', to: '2028-02-29' });
});

test('week and month totals add words, reviews, study days and minutes', () => {
  const events = [
    ans('2026-09-30', '19:00:00', 'review', 'right'),
    ans('2026-10-04', '19:00:00', 'final', 'right', 'learned'),
    ans('2026-10-04', '19:01:00', 'final', 'right', 'learned'),
    ...tuesday(),
  ];
  // 5 October has a check-in but no answers (nothing was due), so it is a study day too.
  const checked = ['2026-10-04', '2026-10-05', '2026-10-06'];
  assert.deepEqual(periodTotals(events, checked, '2026-10-05', '2026-10-11'), { newWords: 1, reviews: 2, studyDays: 2, minutes: 7 });
  assert.deepEqual(periodTotals(events, checked, '2026-10-01', '2026-10-31'), { newWords: 3, reviews: 2, studyDays: 3, minutes: 8 });
});

test('bars give each of the last days its words and reviews, scaled to the busiest day', () => {
  const rows = bars(tuesday(), ['2026-10-06'], '2026-10-07', 7);
  assert.deepEqual(rows.map((r) => r.day), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07']);
  assert.deepEqual(rows[5], { day: '2026-10-06', newWords: 1, reviews: 2, minutes: 7, checkedIn: true, height: 1 });
  assert.equal(rows[6].height, 0);
  assert.equal(bars([], [], '2026-10-07', 30).length, 30);
});

test('a perfect day is a checked-in day on which every answer was right', () => {
  const events = [
    ans('2026-10-05', '19:00:00', 'check', 'right'), ans('2026-10-05', '19:00:10', 'final', 'right', 'learned'),
    ...tuesday(), // one wrong answer
    ans('2026-10-07', '19:00:00', 'review', 'know'), // not checked in
  ];
  // 4 October was checked in without any answer, so it is not counted.
  assert.deepEqual(perfectDays(events, ['2026-10-04', '2026-10-05', '2026-10-06']), ['2026-10-05']);
});

test('a full week is a check-in on every day from Monday to Sunday', () => {
  const week = (monday, n = 7) => Array.from({ length: n }, (_, i) => `2026-10-${String(Number(monday.slice(8)) + i).padStart(2, '0')}`);
  assert.equal(fullWeeks(week('2026-10-05')), 1);
  assert.equal(fullWeeks(week('2026-10-05', 6)), 0);
  assert.equal(fullWeeks(week('2026-10-06')), 0); // Tuesday to Monday is not a week of the calendar
  assert.equal(fullWeeks([...week('2026-10-05'), ...week('2026-10-12'), ...week('2026-10-19', 3)]), 2);
});

test('all-time records', () => {
  const events = [ans('2026-10-05', '19:00:00', 'final', 'right', 'learned'), ...tuesday()];
  const progress = [learnedProgress('w0001', '2026-10-05'), { ...learnedProgress('w0002', '2026-09-01'), step: 7 }];
  // The 3 and 4 October rewound days join the runs before and after them.
  const checked = ['2026-10-01', '2026-10-02', '2026-10-05', '2026-10-06'];
  const rewound = [['2026-10-03', '2026-10-04']];
  assert.deepEqual(allTime({ events, checkedDays: checked, progress, rewound }), {
    bestStreak: 4, perfectDays: 1, reviews: 2, learned: 2, mastered: 1, studyDays: 4, minutes: 7,
  });
  assert.equal(allTime({ events, checkedDays: checked, progress }).bestStreak, 2);
});

test('personal bests compare today with earlier days', () => {
  const events = [
    // Monday 5 October has 1 new word, 2 reviews, 2 of 4 answers right (50%) and 1 minute.
    ans('2026-10-05', '19:00:00', 'review', 'right'), ans('2026-10-05', '19:00:30', 'review', 'wrong'),
    ans('2026-10-05', '19:01:00', 'final', 'wrong'),
    ans('2026-10-05', '19:01:00', 'final', 'right', 'learned'),
    ...tuesday(), // 1 new word, 2 reviews, 80% right, 7 minutes
  ];
  assert.deepEqual(personalBests({ events, today: '2026-10-06' }), ['Best accuracy this week!', 'Most minutes this week!']);
  const more = [...events, ans('2026-10-06', '19:41:00', 'final', 'right', 'learned'), ans('2026-10-06', '19:41:10', 'review', 'right')];
  assert.deepEqual(personalBests({ events: more, today: '2026-10-06' }),
    ['Most words in a day!', 'Most reviews in a day!', 'Best accuracy this week!', 'Most minutes this week!']);
  // The first day ever has nothing to beat, and a day without answers has no bests.
  assert.deepEqual(personalBests({ events: tuesday(), today: '2026-10-06' }), []);
  assert.deepEqual(personalBests({ events, today: '2026-10-07' }), []);
  // A week starts on Monday, so on Monday 12 October last week's days do not count for accuracy.
  const nextMonday = [...events, ans('2026-10-12', '19:00:00', 'review', 'wrong'), ans('2026-10-12', '19:00:30', 'review', 'right')];
  assert.deepEqual(personalBests({ events: nextMonday, today: '2026-10-12' }), []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/counters.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\counters.js`.

- [ ] **Step 3: Write `docs/js/counters.js`**

Create `docs/js/counters.js`:

```js
// Counters for Today, the check-in screen and Stats (spec of 2026-10-03, section 2). All of them
// come from the answers and check-ins the app already saves. Pure functions, so Node tests them.
//   events       saved events (store.allEvents() or store.eventsFrom(day)), with Undo still in them
//   checkedDays  the checked-in study days, such as ['2026-10-05', '2026-10-06']
// Definitions:
//   accuracy   the share of a day's quiz answers that were right (right or Know it), a whole percent
//   minutes    the gaps between a day's answers, each at most 5 minutes (minutesOf in stats.js)
//   study day  a day with any answer or a check-in
//   perfect    a checked-in day with at least one answer, every one of them right
//   week       Monday to Sunday;  month  the calendar month
import { addDays, dayRange, mondayOf } from './dates.js';
import { PASS } from './srs.js';
import { answerEvents, minutesOf, totals } from './stats.js';
import { bestStreak } from './checkin.js';

const emptyDay = (day) => ({ day, newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, minutes: 0 });
const round1 = (n) => Math.round(n * 10) / 10;
const sum = (rows, key) => rows.reduce((total, r) => total + r[key], 0);

// Each day's numbers, worked out in one pass, as a Map from day to
// { day, newWords, reviews, answers, right, accuracy, minutes }. Days without answers are absent.
export function statsByDay(events) {
  const byDay = new Map();
  for (const e of answerEvents(events)) {
    if (!byDay.has(e.day)) byDay.set(e.day, []);
    byDay.get(e.day).push(e);
  }
  const out = new Map();
  for (const [day, answers] of byDay) {
    const right = answers.filter((e) => PASS.has(e.grade)).length;
    out.set(day, {
      day,
      newWords: answers.filter((e) => e.outcome === 'learned').length,
      reviews: answers.filter((e) => e.kind === 'review').length,
      answers: answers.length,
      right,
      accuracy: Math.round((100 * right) / answers.length),
      minutes: minutesOf(answers),
    });
  }
  return out;
}

// One day's numbers. A day of 5 answers, 4 of them right, has accuracy 80.
export function dayStats(events, day) {
  return statsByDay(events.filter((e) => e.day === day)).get(day) ?? emptyDay(day);
}

// Today's numbers and the ring of the Today screen. plan is planDay's result for today. The ring
// is the share of today's planned work that is done. For example, 2 reviews done and 6 reviews and
// new words left give 2 / 8 = 0.25. With nothing planned at all the ring is full.
export function todayCounters({ events, plan, day }) {
  const done = plan.reviewsDone + plan.newDone;
  const left = plan.reviews.length + plan.newWords.length;
  return { ...dayStats(events, day), done, left, ring: left === 0 ? 1 : done / (done + left) };
}

// This week, Monday to Sunday. thisWeek('2026-10-07') gives 5 to 11 October.
export function thisWeek(today) {
  const from = mondayOf(today);
  return { from, to: addDays(from, 6) };
}

// This calendar month. thisMonth('2026-10-07') gives 1 to 31 October.
export function thisMonth(today) {
  const from = `${today.slice(0, 7)}-01`;
  const [y, m] = today.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
  return { from, to: addDays(next, -1) };
}

function studyDays(byDay, checkedDays, inRange = () => true) {
  return new Set([...byDay.keys(), ...checkedDays].filter(inRange)).size;
}

// Totals from `from` to `to`, both included, as { newWords, reviews, studyDays, minutes }.
export function periodTotals(events, checkedDays, from, to) {
  const inRange = (day) => day >= from && day <= to;
  const byDay = statsByDay(events.filter((e) => inRange(e.day)));
  const days = [...byDay.values()];
  return {
    newWords: sum(days, 'newWords'),
    reviews: sum(days, 'reviews'),
    studyDays: studyDays(byDay, checkedDays, inRange),
    minutes: round1(sum(days, 'minutes')),
  };
}

// The last `n` days up to today, oldest first, for a bar chart of new words and reviews. height
// is the day's new words and reviews as a share of the busiest day's.
export function bars(events, checkedDays, today, n) {
  const first = addDays(today, -(n - 1));
  const byDay = statsByDay(events.filter((e) => e.day >= first && e.day <= today));
  const checked = new Set(checkedDays);
  const rows = dayRange(first, n).map((day) => {
    const s = byDay.get(day) ?? emptyDay(day);
    return { day, newWords: s.newWords, reviews: s.reviews, minutes: s.minutes, checkedIn: checked.has(day) };
  });
  const top = Math.max(1, ...rows.map((r) => r.newWords + r.reviews));
  return rows.map((r) => ({ ...r, height: (r.newWords + r.reviews) / top }));
}

function perfectOf(byDay, checkedDays) {
  return [...new Set(checkedDays)].sort().filter((day) => {
    const s = byDay.get(day);
    return Boolean(s) && s.right === s.answers;
  });
}

// The checked-in days on which every quiz answer was right, oldest first.
export function perfectDays(events, checkedDays) {
  return perfectOf(statsByDay(events), checkedDays);
}

// How many calendar weeks, Monday to Sunday, have a check-in on all 7 days.
export function fullWeeks(checkedDays) {
  const set = new Set(checkedDays);
  const mondays = new Set(checkedDays.map(mondayOf));
  return [...mondays].filter((monday) => dayRange(monday, 7).every((day) => set.has(day))).length;
}

// The all-time records of the Stats screen. progress is the list of saved word records, and
// rewound the meta 'rewound' day ranges (see checkin.js).
export function allTime({ events, checkedDays, progress, rewound = [] }) {
  const byDay = statsByDay(events);
  const days = [...byDay.values()];
  return {
    bestStreak: bestStreak(checkedDays, rewound),
    perfectDays: perfectOf(byDay, checkedDays).length,
    reviews: sum(days, 'reviews'),
    ...totals(progress),
    studyDays: studyDays(byDay, checkedDays),
    minutes: round1(sum(days, 'minutes')),
  };
}

// Notes for the check-in screen when one of today's four numbers is a personal best. New words
// and reviews are compared with every earlier day, accuracy and minutes with the earlier days of
// this week. Only a number higher than all of them counts, and there must be one to beat.
export function personalBests({ events, today }) {
  const byDay = statsByDay(events);
  const now = byDay.get(today);
  if (!now) return [];
  const earlier = [...byDay.values()].filter((d) => d.day < today);
  const week = earlier.filter((d) => d.day >= mondayOf(today));
  const beats = (list, key) => list.length > 0 && list.every((d) => now[key] > d[key]);
  const out = [];
  if (now.newWords > 0 && beats(earlier, 'newWords')) out.push('Most words in a day!');
  if (now.reviews > 0 && beats(earlier, 'reviews')) out.push('Most reviews in a day!');
  if (beats(week, 'accuracy')) out.push('Best accuracy this week!');
  if (now.minutes > 0 && beats(week, 'minutes')) out.push('Most minutes this week!');
  return out;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/counters.test.mjs`
Expected: `ℹ tests 9`, `ℹ pass 9`, `ℹ fail 0`.

- [ ] **Step 5: Save the new file for offline use**

The release test (`tests/js/release.test.mjs`) checks that every file of the site is in the service worker's `APP_FILES`. Run `node --test tests/js/release.test.mjs` and see it fail with `'js/counters.js'` in the list of files on disk.

In `docs/sw.js`, replace:

```js
  'js/config.js',
  'js/curriculum.js',
```

with:

```js
  'js/config.js',
  'js/counters.js',
  'js/curriculum.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 267`, `ℹ pass 267`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/counters.js docs/sw.js tests/js/counters.test.mjs && git commit -F - <<'EOF'
feat(counters): day, week, month and all-time numbers, bars, perfect days, full weeks and personal bests

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 5: More badges, in one table of groups (`docs/js/badges.js`, `docs/js/config.js`)

The spec's section 3 adds streaks of 3, 14, 60 and 200 days, words learned of 10, 25, 250 and 4000, perfect days (1, 7, 30), reviews answered (100, 1,000, 5,000, 10,000), minutes studied (60, 300, 1,000, 3,000), and "Full week", one badge with a count. The existing badges stay.

`BADGE_GROUPS` lists the groups in the order of the Badges screen. Each group names the fact that earns it and its steps, and three functions follow from the table:
- `earnedBadges(facts)` gives every badge ID the facts earn, for example `bestStreak: 7` gives `['streak-3', 'streak-7']`. A full week is `week-1`, `week-2` and so on, shown as one badge "Full week ×2".
- `badgeTitle(id)` gives the English title, for example `reviews-1000` gives `1,000 reviews answered`.
- `badgeLadder(facts, earned)` gives each group's earned badges with their days, and the next badge greyed out with its progress, for example `30-day streak`, `17 / 30 days`, share 0.57 (choice 8).

`badgeFacts` works the facts out of the saved words, check-in records and events, for example `{ bestStreak: 2, checkIns: 2, learned: 12, reviews: 2, minutes: 2.5, perfectDays: 1, fullWeeks: 0, ... }`. It replaces the facts `Study.finish` built by hand, and the duplicate step logic of `upcoming()` in `docs/js/view/progress.js` goes, because the Badges screen now uses `badgeLadder`.

A first study day of 12 words, every answer right, now also earns "10 words learned" and "1 perfect day". Three existing tests expect the old badge lists, and this task updates them.

**Files:**
- Modify: `docs/js/config.js`, `docs/js/badges.js`, `docs/js/study.js`, `docs/js/view/progress.js`, `docs/js/ui/screens.js`
- Test: `tests/js/badges.test.mjs`, `tests/js/view-progress.test.mjs`, `tests/js/study.test.mjs`, `tests/js/flow.test.mjs`

- [ ] **Step 1: Write the failing test**

Replace the whole of `tests/js/badges.test.mjs` with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BADGE_GROUPS, badgeFacts, badgeLadder, badgeTitle, earnedBadges, newBadges } from '../../docs/js/badges.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const NONE = {
  bestStreak: 0, checkIns: 0, learned: 0, mastered: 0, totalWords: 5000, reviews: 0, minutes: 0, perfectDays: 0, fullWeeks: 0,
  themesDone: [], groupsDone: [], perfectSession: false,
};

test('nothing earned at the start', () => {
  assert.deepEqual(earnedBadges(NONE), []);
});

test('streak badges at 3, 7, 14, 30, 60, 100, 200 and 365 days', () => {
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 2 }), []);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 7 }), ['streak-3', 'streak-7']);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 365 }),
    ['streak-3', 'streak-7', 'streak-14', 'streak-30', 'streak-60', 'streak-100', 'streak-200', 'streak-365']);
});

test('check-in badges at 10, 50 and 200', () => {
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 49 }), ['checkins-10']);
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 200 }), ['checkins-10', 'checkins-50', 'checkins-200']);
});

test('learned badges from 10 to every word', () => {
  assert.deepEqual(earnedBadges({ ...NONE, learned: 249 }), ['learned-10', 'learned-25', 'learned-50', 'learned-100']);
  assert.deepEqual(earnedBadges({ ...NONE, learned: 4000 }), ['learned-10', 'learned-25', 'learned-50', 'learned-100',
    'learned-250', 'learned-500', 'learned-1000', 'learned-2000', 'learned-3000', 'learned-4000']);
  assert.ok(earnedBadges({ ...NONE, learned: 5000 }).includes('learned-all'));
  assert.ok(!earnedBadges({ ...NONE, learned: 4999 }).includes('learned-all'));
});

test('mastered badges at 100, 500, 1000 and 2500', () => {
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 999 }), ['mastered-100', 'mastered-500']);
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 2500 }), ['mastered-100', 'mastered-500', 'mastered-1000', 'mastered-2500']);
});

test('reviews, minutes and perfect-day badges', () => {
  assert.deepEqual(earnedBadges({ ...NONE, reviews: 999, minutes: 300, perfectDays: 7 }),
    ['reviews-100', 'minutes-60', 'minutes-300', 'perfectday-1', 'perfectday-7']);
  assert.deepEqual(earnedBadges({ ...NONE, reviews: 10000, minutes: 2999.9, perfectDays: 30 }), [
    'reviews-100', 'reviews-1000', 'reviews-5000', 'reviews-10000', 'minutes-60', 'minutes-300', 'minutes-1000',
    'perfectday-1', 'perfectday-7', 'perfectday-30',
  ]);
});

test('full weeks give week-1, week-2 and so on', () => {
  assert.deepEqual(earnedBadges({ ...NONE, fullWeeks: 3 }), ['week-1', 'week-2', 'week-3']);
});

test('one badge per finished theme and level group, and one for a perfect session', () => {
  assert.deepEqual(earnedBadges({ ...NONE, themesDone: ['t01', 't02'], groupsDone: ['1-2', '3'], perfectSession: true }),
    ['theme-t01', 'theme-t02', 'hsk-1-2', 'hsk-3', 'perfect']);
});

test('badges already earned are not awarded again', () => {
  const facts = { ...NONE, bestStreak: 30, checkIns: 10 };
  assert.deepEqual(newBadges(facts, { 'streak-3': '2026-10-07', 'streak-7': '2026-10-11', 'streak-14': '2026-10-18', 'checkins-10': '2026-10-14' }),
    ['streak-30']);
});

test('titles for the badge screen', () => {
  const themes = [{ id: 't05', name: 'Food & Drink' }];
  assert.equal(badgeTitle('streak-3'), '3-day streak');
  assert.equal(badgeTitle('checkins-50'), '50 check-ins');
  assert.equal(badgeTitle('learned-all'), 'Every word learned');
  assert.equal(badgeTitle('learned-500'), '500 words learned');
  assert.equal(badgeTitle('learned-4000'), '4,000 words learned');
  assert.equal(badgeTitle('mastered-100'), '100 words mastered');
  assert.equal(badgeTitle('reviews-1000'), '1,000 reviews answered');
  assert.equal(badgeTitle('minutes-60'), '60 minutes studied');
  assert.equal(badgeTitle('perfectday-1'), '1 perfect day');
  assert.equal(badgeTitle('perfectday-7'), '7 perfect days');
  assert.equal(badgeTitle('week-1'), 'Full week');
  assert.equal(badgeTitle('week-3'), 'Full week ×3');
  assert.equal(badgeTitle('theme-t05', themes), 'Finished Food & Drink');
  assert.equal(badgeTitle('hsk-1-2'), 'Finished HSK 1-2');
  assert.equal(badgeTitle('hsk-6'), 'Finished HSK 6');
  assert.equal(badgeTitle('perfect'), 'Perfect session');
});

test('the Badges screen shows the groups in this order', () => {
  assert.deepEqual(BADGE_GROUPS.map((g) => g.id),
    ['streak', 'checkins', 'learned', 'mastered', 'reviews', 'minutes', 'perfectday', 'week', 'theme', 'hsk', 'perfect']);
});

test('the facts come from the saved words, check-ins and events', () => {
  // On 5 October 2 words are learned, every answer right. On 6 October there are 2 reviews, one wrong.
  const events = [
    { seq: 1, day: '2026-10-05', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-05T19:00:00Z' },
    { seq: 2, day: '2026-10-05', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-05T19:00:30Z' },
    { seq: 3, day: '2026-10-06', kind: 'review', grade: 'wrong', ts: '2026-10-06T19:00:00Z' },
    { seq: 4, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:02:00Z' },
  ];
  const progress = data.words.filter((w) => w.theme === 't01').map((w) => learnedProgress(w.id, '2026-10-05'));
  const days = [{ day: '2026-10-05' }, { day: '2026-10-06' }];
  assert.deepEqual(badgeFacts({ data, progress, days, events, perfectSession: true }), {
    bestStreak: 2, checkIns: 2, learned: 12, mastered: 0, totalWords: 61, reviews: 2, minutes: 2.5, perfectDays: 1, fullWeeks: 0,
    themesDone: ['t01'], groupsDone: [], perfectSession: true,
    // The unfinished theme with the fewest words left, and the first unfinished level group.
    nextTheme: { id: 't02', have: 0, need: 10 }, nextGroup: { id: '1-2', have: 12, need: 61 },
  });
  const rewound = [['2026-10-02', '2026-10-03']];
  const gap = [{ day: '2026-10-01' }, { day: '2026-10-04' }];
  assert.equal(badgeFacts({ data, progress: [], days: gap, events: [], rewound }).bestStreak, 2);
});

test('the ladder shows the earned badges of each group and the next one with its progress', () => {
  const facts = {
    ...NONE, bestStreak: 17, checkIns: 17, learned: 30, totalWords: 61, reviews: 150, minutes: 75.5, perfectDays: 2, fullWeeks: 1,
    themesDone: ['t01'], nextTheme: { id: 't02', have: 4, need: 10 }, nextGroup: { id: '1-2', have: 30, need: 61 },
  };
  const earned = {
    'streak-3': '2026-10-03', 'streak-7': '2026-10-07', 'streak-14': '2026-10-14', 'checkins-10': '2026-10-10',
    'learned-10': '2026-10-01', 'learned-25': '2026-10-03', 'reviews-100': '2026-10-09', 'minutes-60': '2026-10-15',
    'perfectday-1': '2026-10-01', 'week-1': '2026-10-11', 'theme-t01': '2026-10-01',
  };
  const byId = Object.fromEntries(badgeLadder(facts, earned, data.themes).map((g) => [g.id, g]));
  assert.deepEqual(byId.streak.earned.map((b) => [b.title, b.day]),
    [['3-day streak', '2026-10-03'], ['7-day streak', '2026-10-07'], ['14-day streak', '2026-10-14']]);
  assert.deepEqual(byId.streak.next, { id: 'streak-30', title: '30-day streak', text: '17 / 30 days', share: 17 / 30 });
  assert.deepEqual(byId.learned.next, { id: 'learned-50', title: '50 words learned', text: '30 / 50 words', share: 0.6 });
  assert.equal(byId.minutes.next.text, '75 / 300 minutes');
  assert.deepEqual([byId.mastered.earned, byId.mastered.next.text], [[], '0 / 100 words']);
  // Full weeks show as one badge with a count, and the next one has no progress bar.
  assert.deepEqual(byId.week.earned.map((b) => [b.title, b.day]), [['Full week', '2026-10-11']]);
  assert.deepEqual(byId.week.next, { id: 'week-2', title: 'Full week ×2', text: 'A check-in on every day from Monday to Sunday', share: null });
  assert.deepEqual(byId.theme.earned.map((b) => b.title), ['Finished Starter Kit']);
  assert.deepEqual(byId.theme.next, { id: 'theme-t02', title: 'Finished Greetings & Courtesy', text: '4 / 10 words', share: 0.4 });
  assert.deepEqual(byId.hsk.next, { id: 'hsk-1-2', title: 'Finished HSK 1-2', text: '30 / 61 words', share: 30 / 61 });
  assert.deepEqual(byId.perfect.next,
    { id: 'perfect', title: 'Perfect session', text: '30 reviews or more in one session, all right first time', share: null });
  const all = badgeLadder({ ...facts, checkIns: 200 }, { 'checkins-10': 'a', 'checkins-50': 'b', 'checkins-200': 'c', 'week-1': 'd', 'week-2': 'e', 'week-3': 'f' });
  assert.equal(all.find((g) => g.id === 'checkins').next, null);
  assert.deepEqual(all.find((g) => g.id === 'week').earned, [{ id: 'week-3', title: 'Full week ×3', day: 'f' }]);
});

test('with 55 of the fixture\'s 61 words learned, the next learned badge is the one for every word', () => {
  const ladder = badgeLadder({ ...NONE, learned: 55, totalWords: 61 }, { 'learned-10': 'a', 'learned-25': 'b', 'learned-50': 'c' });
  assert.deepEqual(ladder.find((g) => g.id === 'learned').next,
    { id: 'learned-all', title: 'Every word learned', text: '55 / 61 words', share: 55 / 61 });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/badges.test.mjs`
Expected: `ℹ fail 1`, with `SyntaxError: The requested module '../../docs/js/badges.js' does not provide an export named 'BADGE_GROUPS'`.

- [ ] **Step 3: Add the new steps to `config.js`**

In `docs/js/config.js`, replace:

```js
  badges: Object.freeze({
    streak: Object.freeze([7, 30, 100, 365]),
    checkIns: Object.freeze([10, 50, 200]),
    learned: Object.freeze([50, 100, 500, 1000, 2000, 3000]),
    mastered: Object.freeze([100, 500, 1000, 2500]),
  }),
```

with:

```js
  // Badge steps (badges.js BADGE_GROUPS). The spec of 2026-10-03 added streaks of 3, 14, 60 and
  // 200 days, 10, 25, 250 and 4000 words, and the perfect-day, review and minute badges.
  badges: Object.freeze({
    streak: Object.freeze([3, 7, 14, 30, 60, 100, 200, 365]),
    checkIns: Object.freeze([10, 50, 200]),
    learned: Object.freeze([10, 25, 50, 100, 250, 500, 1000, 2000, 3000, 4000]),
    mastered: Object.freeze([100, 500, 1000, 2500]),
    perfectDays: Object.freeze([1, 7, 30]),
    reviews: Object.freeze([100, 1000, 5000, 10000]),
    minutes: Object.freeze([60, 300, 1000, 3000]),
  }),
```

- [ ] **Step 4: Write `badges.js`**

Replace the whole of `docs/js/badges.js` with:

```js
// Milestone badges. A badge ID is a short text, for example 'streak-7', 'learned-all',
// 'reviews-1000', 'minutes-60', 'perfectday-7', 'week-2', 'theme-t05', 'hsk-1-2' or 'perfect'.
// Earned badges are kept in the meta store as { badgeId: dayEarned }, so each one is awarded once.
import { CONFIG } from './config.js';
import { allTime, fullWeeks } from './counters.js';
import { LEVEL_GROUPS, groupsDone, themesDone, wordsOfGroup } from './stats.js';
import { isLearned } from './srs.js';

// The badge groups, in the order of the Badges screen. `fact` names the number (or list) in the
// facts object that earns them. The kinds:
//   steps  one badge per step of `steps`, for example 'streak-14' at a best streak of 14. The
//          learned group also has 'learned-all' when every word of the course is learned.
//   count  'week-1', 'week-2', ... one per calendar week with a check-in on every day, shown as
//          one badge 'Full week ×N'
//   list   one per finished theme ('theme-t05') or level group ('hsk-1-2')
//   once   'perfect', a session with at least 30 reviews, all right first time
// Plan 7 adds a speaking group here as one more steps row.
export const BADGE_GROUPS = Object.freeze([
  { id: 'streak', title: 'Streaks', kind: 'steps', fact: 'bestStreak', steps: CONFIG.badges.streak, unit: 'days' },
  { id: 'checkins', title: 'Check-ins', kind: 'steps', fact: 'checkIns', steps: CONFIG.badges.checkIns, unit: 'check-ins' },
  { id: 'learned', title: 'Words learned', kind: 'steps', fact: 'learned', steps: CONFIG.badges.learned, unit: 'words' },
  { id: 'mastered', title: 'Words mastered', kind: 'steps', fact: 'mastered', steps: CONFIG.badges.mastered, unit: 'words' },
  { id: 'reviews', title: 'Reviews answered', kind: 'steps', fact: 'reviews', steps: CONFIG.badges.reviews, unit: 'reviews' },
  { id: 'minutes', title: 'Minutes studied', kind: 'steps', fact: 'minutes', steps: CONFIG.badges.minutes, unit: 'minutes' },
  { id: 'perfectday', title: 'Perfect days', kind: 'steps', fact: 'perfectDays', steps: CONFIG.badges.perfectDays, unit: 'days' },
  { id: 'week', title: 'Full weeks', kind: 'count', fact: 'fullWeeks', steps: null, unit: 'weeks' },
  { id: 'theme', title: 'Themes', kind: 'list', fact: 'themesDone', steps: null, unit: 'words' },
  { id: 'hsk', title: 'Level groups', kind: 'list', fact: 'groupsDone', steps: null, unit: 'words' },
  { id: 'perfect', title: 'Perfect session', kind: 'once', fact: 'perfectSession', steps: null, unit: '' },
].map((g) => Object.freeze(g)));

const WEEK_RULE = 'A check-in on every day from Monday to Sunday';
const PERFECT_RULE = `${CONFIG.perfectMinReviews} reviews or more in one session, all right first time`;
const grouped = (n) => Number(n).toLocaleString('en-US'); // 1000 gives '1,000'

// The badges the facts earn, in group order. The facts object looks like
// { bestStreak, checkIns, learned, mastered, totalWords, reviews, minutes, perfectDays, fullWeeks,
//   themesDone: ['t01'], groupsDone: ['1-2'], perfectSession: true or false } (see badgeFacts).
// groupsDone holds the finished level groups (stats.js LEVEL_GROUPS), which replaced the
// separate HSK 1 and HSK 2 badges (the user's decision of 2026-09-29).
export function earnedBadges(facts) {
  const ids = [];
  for (const g of BADGE_GROUPS) {
    const have = facts[g.fact];
    if (g.kind === 'steps') {
      for (const n of g.steps) if (have >= n) ids.push(`${g.id}-${n}`);
      if (g.id === 'learned' && facts.totalWords > 0 && have >= facts.totalWords) ids.push('learned-all');
    } else if (g.kind === 'count') {
      for (let n = 1; n <= (have ?? 0); n += 1) ids.push(`${g.id}-${n}`);
    } else if (g.kind === 'list') {
      for (const item of have ?? []) ids.push(`${g.id}-${item}`);
    } else if (have) {
      ids.push(g.id);
    }
  }
  return ids;
}

export function newBadges(facts, earned = {}) {
  return earnedBadges(facts).filter((id) => !(id in earned));
}

// A short English title for the badge screen. themes is the data file's theme list.
export function badgeTitle(id, themes = []) {
  const [kind, value] = id.split(/-(.+)/);
  switch (kind) {
    case 'streak': return `${value}-day streak`;
    case 'checkins': return `${value} check-ins`;
    case 'learned': return value === 'all' ? 'Every word learned' : `${grouped(value)} words learned`;
    case 'mastered': return `${grouped(value)} words mastered`;
    case 'reviews': return `${grouped(value)} reviews answered`;
    case 'minutes': return `${grouped(value)} minutes studied`;
    case 'perfectday': return value === '1' ? '1 perfect day' : `${value} perfect days`;
    case 'week': return value === '1' ? 'Full week' : `Full week ×${value}`;
    case 'theme': return `Finished ${themes.find((t) => t.id === value)?.name ?? value}`;
    case 'hsk': return `Finished HSK ${value}`;
    case 'perfect': return 'Perfect session';
    default: return id;
  }
}

// The unfinished theme with the fewest words left (all level groups), as { id, have, need }.
function nextTheme(data, byId) {
  const count = new Map(data.themes.map((t) => [t.id, { id: t.id, have: 0, need: 0 }]));
  for (const w of data.words) {
    const c = count.get(w.theme);
    if (!c) continue;
    c.need += 1;
    if (isLearned(byId.get(w.id))) c.have += 1;
  }
  let best = null;
  for (const t of data.themes.slice().sort((a, b) => a.order - b.order)) {
    const c = count.get(t.id);
    if (!c.need || c.have === c.need) continue;
    if (!best || c.need - c.have < best.need - best.have) best = c;
  }
  return best;
}

// The first level group that is not finished, as { id, have, need }.
function nextGroup(words, byId) {
  for (const g of LEVEL_GROUPS) {
    const list = wordsOfGroup(words, g);
    const have = list.filter((w) => isLearned(byId.get(w.id))).length;
    if (list.length && have < list.length) return { id: g.id, have, need: list.length };
  }
  return null;
}

// Everything the badges need, from what the app saves. days are the check-in records
// (store.allDays()), events the saved events (store.allEvents()), and rewound the meta 'rewound'
// day ranges. perfectSession is true when the session that just ended was perfect.
export function badgeFacts({ data, progress, days, events, rewound = [], perfectSession = false }) {
  const checked = days.map((d) => d.day);
  const byId = new Map(progress.map((p) => [p.id, p]));
  const all = allTime({ events, checkedDays: checked, progress, rewound });
  return {
    bestStreak: all.bestStreak,
    checkIns: checked.length,
    learned: all.learned,
    mastered: all.mastered,
    totalWords: data.words.length,
    reviews: all.reviews,
    minutes: all.minutes,
    perfectDays: all.perfectDays,
    fullWeeks: fullWeeks(checked),
    themesDone: themesDone(data.themes, data.words, byId),
    groupsDone: groupsDone(data.words, byId),
    nextTheme: nextTheme(data, byId),
    nextGroup: nextGroup(data.words, byId),
    perfectSession,
  };
}

function progressOf(id, have, need, unit, themes) {
  const h = Math.floor(have);
  return { id, title: badgeTitle(id, themes), text: `${grouped(h)} / ${grouped(need)} ${unit}`, share: Math.min(1, h / need) };
}

// The Badges screen, group by group. Each group has its earned badges with their days, and the
// next badge of the group greyed out with its progress, for example { title: '30-day streak', text: '17 / 30 days',
// share: 0.57 }. A group whose badges are all earned has next: null. share is null where there
// is nothing to count, as for the next full week and the perfect session.
export function badgeLadder(facts, earned = {}, themes = []) {
  const got = (id) => ({ id, title: badgeTitle(id, themes), day: earned[id] });
  return BADGE_GROUPS.map((g) => {
    let list = [];
    let next = null;
    if (g.kind === 'steps') {
      const have = facts[g.fact] ?? 0;
      let steps = g.steps;
      if (g.id === 'learned') steps = steps.filter((n) => n < facts.totalWords);
      list = steps.map((n) => `${g.id}-${n}`).filter((id) => id in earned).map(got);
      const step = steps.find((n) => !(`${g.id}-${n}` in earned));
      if (step) next = progressOf(`${g.id}-${step}`, have, step, g.unit, themes);
      if (g.id === 'learned') {
        if ('learned-all' in earned) list.push(got('learned-all'));
        else if (!step && facts.totalWords > 0) next = progressOf('learned-all', have, facts.totalWords, g.unit, themes);
      }
    } else if (g.kind === 'count') {
      const n = Object.keys(earned).filter((id) => id.startsWith(`${g.id}-`)).length;
      if (n) list = [got(`${g.id}-${n}`)];
      next = { id: `${g.id}-${n + 1}`, title: badgeTitle(`${g.id}-${n + 1}`), text: WEEK_RULE, share: null };
    } else if (g.kind === 'list') {
      list = Object.keys(earned).filter((id) => id.startsWith(`${g.id}-`))
        .sort((a, b) => earned[a].localeCompare(earned[b]) || a.localeCompare(b)).map(got);
      const upcoming = g.id === 'theme' ? facts.nextTheme : facts.nextGroup;
      if (upcoming) next = progressOf(`${g.id}-${upcoming.id}`, upcoming.have, upcoming.need, g.unit, themes);
    } else if (g.id in earned) {
      list = [got(g.id)];
    } else {
      next = { id: g.id, title: badgeTitle(g.id), text: PERFECT_RULE, share: null };
    }
    return { id: g.id, title: g.title, earned: list, next };
  });
}
```

Run: `node --test tests/js/badges.test.mjs`
Expected: `ℹ tests 14`, `ℹ pass 14`, `ℹ fail 0`.

- [ ] **Step 5: Let `Study.finish` use `badgeFacts`**

In `docs/js/study.js`, replace:

```js
import { bestStreak, currentStreak } from './checkin.js';
import { groupsDone, themesDone, totals } from './stats.js';
import { newBadges } from './badges.js';
```

with:

```js
import { currentStreak } from './checkin.js';
import { badgeFacts, newBadges } from './badges.js';
```

In `docs/js/study.js`, replace:

```js
    const progress = await store.allProgress();
    const byId = new Map(progress.map((p) => [p.id, p]));
    const after = planDay({ words: data.words, progress, today: day, settings: this.settings });
```

with:

```js
    const progress = await store.allProgress();
    const after = planDay({ words: data.words, progress, today: day, settings: this.settings });
```

In `docs/js/study.js`, replace:

```js
    const facts = {
      bestStreak: bestStreak(checked),
      checkIns: checked.length,
      ...totals(progress),
      totalWords: data.words.length,
      themesDone: themesDone(data.themes, data.words, byId),
      groupsDone: groupsDone(data.words, byId),
      perfectSession: summary.perfect,
    };
```

with:

```js
    const facts = badgeFacts({
      data, progress, days, events: await store.allEvents(), rewound: (await store.getMeta('rewound')) ?? [],
      perfectSession: summary.perfect,
    });
```

- [ ] **Step 6: Update the tests whose badge lists change**

In `tests/js/study.test.mjs`, replace:

```js
  const first = await playDay(store, '2026-10-05'); // words 1 to 12, all 12 of the Starter Kit
  assert.deepEqual(first.newBadges, ['theme-t01']);
  const second = await playDay(store, '2026-10-06'); // words 13 to 24, and Greetings ends at 22
  assert.deepEqual(second.newBadges, ['theme-t02']);
  assert.deepEqual(await store.getMeta('badges'), { 'theme-t01': '2026-10-05', 'theme-t02': '2026-10-06' });
});
```

with:

```js
  // Day 1 also earns the 10-words badge and, with every answer right, the first perfect day.
  const first = await playDay(store, '2026-10-05'); // words 1 to 12, all 12 of the Starter Kit
  assert.deepEqual(first.newBadges, ['learned-10', 'perfectday-1', 'theme-t01']);
  const second = await playDay(store, '2026-10-06'); // words 13 to 24, and Greetings ends at 22
  assert.deepEqual(second.newBadges, ['theme-t02']);
  assert.deepEqual(await store.getMeta('badges'), {
    'learned-10': '2026-10-05', 'perfectday-1': '2026-10-05', 'theme-t01': '2026-10-05', 'theme-t02': '2026-10-06',
  });
});
```

In `tests/js/study.test.mjs`, replace:

```js
  const before = Object.fromEntries(['learned-50', 'theme-t01', 'theme-t02', 'theme-t03', 'theme-t04'].map((id) => [id, '2026-10-04']));
  await store.commit({ progress: seeded, meta: { settings: { newPerDay: 15 }, badges: before }, event: { day: '2026-10-04', kind: 'settings' } });
  const result = await playDay(store, '2026-10-05');
  assert.equal(result.summary.learned, 15);
  assert.deepEqual(result.newBadges, ['learned-all', 'theme-t05', 'hsk-1-2']);
```

with:

```js
  const before = Object.fromEntries(['learned-10', 'learned-25', 'learned-50', 'theme-t01', 'theme-t02', 'theme-t03', 'theme-t04']
    .map((id) => [id, '2026-10-04']));
  await store.commit({ progress: seeded, meta: { settings: { newPerDay: 15 }, badges: before }, event: { day: '2026-10-04', kind: 'settings' } });
  const result = await playDay(store, '2026-10-05');
  assert.equal(result.summary.learned, 15);
  assert.deepEqual(result.newBadges, ['learned-all', 'perfectday-1', 'theme-t05', 'hsk-1-2']);
```

In `tests/js/flow.test.mjs`, replace:

```js
  assert.deepEqual(v.badges, ['Finished Starter Kit']);
```

with:

```js
  assert.deepEqual(v.badges, ['10 words learned', '1 perfect day', 'Finished Starter Kit']);
```

- [ ] **Step 7: Write the failing test of the Badges screen**

In `tests/js/view-progress.test.mjs`, replace:

```js
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';
```

with:

```js
import { learnedProgress } from '../../docs/js/srs.js';
import { badgeFacts } from '../../docs/js/badges.js';
import { loadFixture } from './helpers.mjs';
```

In `tests/js/view-progress.test.mjs`, replace:

```js
test('badges list the earned ones by date and the next milestone of each kind', () => {
  const v = badgesView({
    earned: { 'theme-t01': '2026-10-05', 'streak-7': '2026-10-11' },
    data,
    progressList: t01.map((w) => at(w.id, 1)),
    checkedDays: ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'],
  });
  assert.deepEqual(v.earned.map((b) => [b.title, b.day]), [['Finished Starter Kit', '2026-10-05'], ['7-day streak', '2026-10-11']]);
  assert.deepEqual(v.upcoming.map((u) => u.title), ['30-day streak', '10 check-ins', '50 words learned', '100 words mastered']);
  // With 55 of the fixture's 61 words learned, the next learned badge is the one for every word.
  const most = badgesView({ earned: {}, data, progressList: data.words.slice(0, 55).map((w) => at(w.id, 1)), checkedDays: [] });
  assert.deepEqual(most.upcoming.find((u) => u.title.includes('learned')), { title: 'Every word learned', have: '55 of 61' });
});
```

with:

```js
test('badges show group by group, each with its next badge and a progress bar', () => {
  // Checked in from Monday 5 to Sunday 11 October, with the 12 Starter Kit words learned.
  const days = ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((day) => ({ day }));
  const facts = badgeFacts({ data, progress: t01.map((w) => at(w.id, 1)), days, events: [] });
  const earned = { 'theme-t01': '2026-10-05', 'learned-10': '2026-10-05', 'streak-3': '2026-10-07', 'streak-7': '2026-10-11' };
  const v = badgesView({ earned, facts, themes: data.themes });
  assert.equal(v.count, 4);
  const g = Object.fromEntries(v.groups.map((x) => [x.id, x]));
  assert.deepEqual(g.streak.earned.map((b) => [b.title, b.day]), [['3-day streak', '2026-10-07'], ['7-day streak', '2026-10-11']]);
  assert.deepEqual([g.streak.next.title, g.streak.next.text, g.streak.next.pct], ['14-day streak', '7 / 14 days', '50%']);
  assert.deepEqual([g.learned.next.title, g.learned.next.text, g.learned.next.pct], ['25 words learned', '12 / 25 words', '48%']);
  assert.deepEqual([g.week.next.title, g.week.next.pct], ['Full week', null]);
  assert.deepEqual(g.theme.earned.map((b) => b.title), ['Finished Starter Kit']);
  assert.deepEqual([g.theme.next.title, g.theme.next.text], ['Finished Greetings & Courtesy', '0 / 10 words']);
});
```

Run: `node --test tests/js/view-progress.test.mjs`
Expected: `ℹ tests 9`, `ℹ fail 1`, the new badges test, with `TypeError: Cannot read properties of undefined (reading 'themes')`, because the old `badgesView` still expects `data`, `progressList` and `checkedDays`.

- [ ] **Step 8: Build the Badges view from the ladder**

In `docs/js/view/progress.js`, replace:

```js
import { CONFIG } from '../config.js';
import { bestStreak, monthCalendar } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { accuracy, activity, forecast, groupById, levelProgress, mapSections, totals, wordsOfGroup } from '../stats.js';
import { badgeTitle } from '../badges.js';
```

with:

```js
import { monthCalendar } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { accuracy, activity, forecast, groupById, levelProgress, mapSections, totals, wordsOfGroup } from '../stats.js';
import { badgeLadder, badgeTitle } from '../badges.js';
```

In `docs/js/view/progress.js`, replace:

```js
// The next milestone of each counted badge kind that is not earned yet.
function upcoming(facts) {
  const { badges } = CONFIG;
  const next = (list, have) => list.find((n) => n > have);
  const out = [];
  const s = next(badges.streak, facts.bestStreak);
  if (s) out.push({ title: badgeTitle(`streak-${s}`), have: `best streak so far: ${facts.bestStreak}` });
  const c = next(badges.checkIns, facts.checkIns);
  if (c) out.push({ title: badgeTitle(`checkins-${c}`), have: `${facts.checkIns} so far` });
  const l = next(badges.learned, facts.learned);
  if (l && l < facts.totalWords) out.push({ title: badgeTitle(`learned-${l}`), have: `${facts.learned} so far` });
  else if (facts.learned < facts.totalWords) out.push({ title: badgeTitle('learned-all'), have: `${facts.learned} of ${facts.totalWords}` });
  const m = next(badges.mastered, facts.mastered);
  if (m) out.push({ title: badgeTitle(`mastered-${m}`), have: `${facts.mastered} so far` });
  return out;
}

// The Badges screen. earned is the saved { badgeId: dayEarned } map (store meta 'badges').
export function badgesView({ earned, data, progressList, checkedDays }) {
  const list = Object.entries(earned ?? {})
    .sort(([a, da], [b, db]) => da.localeCompare(db) || a.localeCompare(b))
    .map(([id, day]) => ({ id, day, title: badgeTitle(id, data.themes) }));
  const facts = {
    bestStreak: bestStreak(checkedDays),
    checkIns: checkedDays.length,
    ...totals(progressList),
    totalWords: data.words.length,
  };
  return { earned: list, upcoming: upcoming(facts) };
}
```

with:

```js
// The Badges screen, group by group (badgeLadder in badges.js). earned is the saved
// { badgeId: dayEarned } map (store meta 'badges') and facts is badgeFacts()'s result. Each
// group's next badge gets pct, its progress as a bar width such as '57%', or null for no bar.
export function badgesView({ earned, facts, themes }) {
  const saved = earned ?? {};
  return {
    count: Object.keys(saved).length,
    groups: badgeLadder(facts, saved, themes).map((g) => ({
      ...g,
      next: g.next && { ...g.next, pct: g.next.share === null ? null : percent(g.next.share) },
    })),
  };
}
```

- [ ] **Step 9: Draw the Badges screen by group**

In `docs/js/ui/screens.js`, replace:

```js
import { shortDate } from '../view/format.js';
import { cardElement } from './card.js';
```

with:

```js
import { shortDate } from '../view/format.js';
import { badgeFacts } from '../badges.js';
import { cardElement } from './card.js';
```

In `docs/js/ui/screens.js`, replace:

```js
async function checkedDays(app) {
  return (await app.store.allDays()).map((d) => d.day);
}
```

with:

```js
async function checkedDays(app) {
  return (await app.store.allDays()).map((d) => d.day);
}

// Reads what the counters, goals and badges need, which is the saved words, check-in records,
// events and rewound days (meta 'rewound'), and badgeFacts() over them.
async function saved(app) {
  const [progress, days, events, rewound] = await Promise.all([
    app.store.allProgress(), app.store.allDays(), app.store.allEvents(), app.store.getMeta('rewound'),
  ]);
  const r = rewound ?? [];
  return { progress, days, events, rewound: r, facts: badgeFacts({ data: app.data, progress, days, events, rewound: r }) };
}
```

In `docs/js/ui/screens.js`, replace:

```js
export async function renderBadges(app) {
  const v = badgesView({
    earned: await app.store.getMeta('badges'),
    data: app.data,
    progressList: await app.store.allProgress(),
    checkedDays: await checkedDays(app),
  });
  show(app.main, h('h1', {}, 'Badges'),
    v.earned.length ? v.earned.map((b) => h('p', { class: 'badge' }, b.title, h('span', { class: 'muted' }, ` ${shortDate(b.day)}`)))
      : h('p', { class: 'muted' }, 'No badges yet. Your first check-ins will earn some.'),
    h('h2', {}, 'Next milestones'),
    v.upcoming.map((u) => h('p', { class: 'badge locked' }, u.title, h('span', { class: 'muted' }, ` (${u.have})`))));
}
```

with:

```js
// The Badges screen shows each group's earned badges with their days, then the next one greyed
// out with its progress.
export async function renderBadges(app) {
  const { facts } = await saved(app);
  const v = badgesView({ earned: await app.store.getMeta('badges'), facts, themes: app.data.themes });
  show(app.main, h('h1', {}, 'Badges'),
    v.count ? null : h('p', { class: 'muted' }, 'No badges yet. Your first check-ins will earn some.'),
    v.groups.map((g) => h('section', { class: 'badge-group' },
      h('h2', {}, g.title),
      g.earned.map((b) => h('p', { class: 'badge' }, b.title, h('span', { class: 'muted' }, ` ${shortDate(b.day)}`))),
      g.next ? h('div', { class: 'badge locked' },
        h('span', { class: 'badge-title' }, g.next.title),
        g.next.pct === null ? null : h('span', { class: 'bar' }, h('span', { class: 'bar-learned', style: `width:${g.next.pct}` })),
        h('span', { class: 'muted' }, g.next.text)) : null)));
}
```

- [ ] **Step 10: Run every test**

Run: `node --check docs/js/ui/screens.js && node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 273`, `ℹ pass 273`, `ℹ fail 0`. The 450-day simulation test takes about 20 seconds now, because every session end reads all events.

- [ ] **Step 11: Commit**

```bash
git add docs/js/config.js docs/js/badges.js docs/js/study.js docs/js/view/progress.js docs/js/ui/screens.js tests/js/badges.test.mjs tests/js/view-progress.test.mjs tests/js/study.test.mjs tests/js/flow.test.mjs && git commit -F - <<'EOF'
feat(badges): badge groups with streak, word, review, minute, perfect-day and full-week steps, and a Badges screen with the next badge of each group

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 6: Goal countdowns (`docs/js/goals.js`)

The spec's goal countdowns say how far each next milestone is, in the unit it names. There are six: the current tile of the progress map, the next streak badge, the next words-learned badge, the next level group, and the next reviews and minutes badges. Today shows the two with the smallest share left to go, and Stats shows all of them, nearest first.

Worked example with the test fixture. The 12 Starter Kit words and 2 of the 10 Greetings & Courtesy words are learned, the best and current streak are 27 days, 95 reviews and 52.5 minutes are done. The countdowns, nearest first:

| Goal | Text | Share left |
|---|---|---|
| reviews | 5 reviews to the 100-review badge | 5 / 100 = 0.05 |
| streak | 3 days to the 30-day badge | 3 / 30 = 0.10 |
| minutes | 8 minutes to the 60-minute badge | 8 / 60 = 0.13 |
| learned | 11 more words to the 25-word badge | 11 / 25 = 0.44 |
| group | 47 more words to finish HSK 1-2 | 47 / 61 = 0.77 |
| theme | 8 more words to finish Greetings & Courtesy | 8 / 10 = 0.80 |

Today shows the first two. The streak goal counts from today's streak, because the next streak badge needs that many days in a row, so with a broken streak it reads "30 days to the 30-day badge" (choice 9).

**Files:**
- Create: `docs/js/goals.js`
- Modify: `docs/sw.js`
- Test: `tests/js/goals.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/goals.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { goals, nearest } from '../../docs/js/goals.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const learned = (words) => new Map(words.map((w) => [w.id, learnedProgress(w.id, '2026-10-01')]));
// The 12 Starter Kit words and the first 2 of Greetings & Courtesy (10 words) are learned.
const t02 = data.words.filter((w) => w.theme === 't02');
const progressById = learned([...data.words.filter((w) => w.theme === 't01'), ...t02.slice(0, 2)]);
const facts = { bestStreak: 27, learned: 14, totalWords: 61, reviews: 95, minutes: 52.5 };

test('every countdown says how far the next milestone is, in its own unit, nearest first', () => {
  const list = goals({ data, progressById, facts, streak: 27 });
  assert.deepEqual(list.map((g) => [g.id, g.text, g.left]), [
    ['reviews', '5 reviews to the 100-review badge', 5],
    ['streak', '3 days to the 30-day badge', 3],
    ['minutes', '8 minutes to the 60-minute badge', 8],
    ['learned', '11 more words to the 25-word badge', 11],
    ['group', '47 more words to finish HSK 1-2', 47],
    ['theme', '8 more words to finish Greetings & Courtesy', 8],
  ]);
  // The share left to go is 5 of 100 reviews, 3 of 30 days, and so on up to 8 of the tile's 10 words.
  assert.deepEqual(list.map((g) => Math.round(g.share * 100)), [5, 10, 13, 44, 77, 80]);
});

test('Today shows the two nearest', () => {
  const list = goals({ data, progressById, facts, streak: 27 });
  assert.deepEqual(nearest(list, 2).map((g) => g.id), ['reviews', 'streak']);
  assert.deepEqual(nearest([{ id: 'a', share: 0.5 }, { id: 'b', share: 0.2 }], 1), [{ id: 'b', share: 0.2 }]);
});

test('a broken streak counts the whole run again, and the last words aim at every word', () => {
  const list = goals({ data, progressById: learned(data.words.slice(0, 55)), facts: { ...facts, learned: 55 }, streak: 0 });
  const byId = Object.fromEntries(list.map((g) => [g.id, g]));
  assert.equal(byId.streak.text, '30 days to the 30-day badge');
  assert.equal(byId.learned.text, '6 more words to learn every word');
  assert.equal(byId.group.text, '6 more words to finish HSK 1-2');
});

test('a goal with nothing left is not shown', () => {
  const done = goals({
    data, progressById: learned(data.words), facts: { bestStreak: 365, learned: 61, totalWords: 61, reviews: 10000, minutes: 3000 }, streak: 365,
  });
  assert.deepEqual(done, []);
  const reviews = (n) => goals({ data, progressById, facts: { ...facts, reviews: n }, streak: 27 }).find((g) => g.id === 'reviews').text;
  assert.equal(reviews(1), '99 reviews to the 100-review badge');
  assert.equal(reviews(99), '1 review to the 100-review badge');
  assert.equal(reviews(100), '900 reviews to the 1,000-review badge');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/goals.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\goals.js`.

- [ ] **Step 3: Write `docs/js/goals.js`**

Create `docs/js/goals.js`:

```js
// Goal countdowns (spec of 2026-10-03, section 2) say how far each next milestone is, in the unit
// it names. Today shows the two nearest, Stats shows them all. A goal's `share` is the part of its
// target still to go, so 3 days left of a 30-day streak is 0.1, and the smallest share is nearest.
import { CONFIG } from './config.js';
import { LEVEL_GROUPS, mapSections, wordsOfGroup } from './stats.js';
import { isLearned } from './srs.js';
import { plural } from './view/format.js';

const grouped = (n) => Number(n).toLocaleString('en-US'); // 1000 gives '1,000'
const nextStep = (steps, have) => steps.find((n) => n > have);
const goal = (id, text, left, target) => ({ id, text, left, share: left / target });

// facts is badgeFacts()'s result and streak today's streak (currentStreak in checkin.js).
// Returns [{ id, text, left, share }], nearest first. A milestone already reached is left out.
export function goals({ data, progressById, facts, streak }) {
  const out = [];
  // The current tile of the progress map ('current' in stats.js mapSections).
  for (const section of mapSections(data.themes, data.words, progressById)) {
    const tile = section.tiles.find((t) => t.status === 'current');
    if (tile) {
      const left = tile.total - tile.learned;
      out.push(goal('theme', `${plural(left, 'more word')} to finish ${tile.name}`, left, tile.total));
      break;
    }
  }
  // The next streak badge needs that many days in a row, counted from today's streak.
  const days = nextStep(CONFIG.badges.streak, facts.bestStreak);
  if (days) out.push(goal('streak', `${plural(days - streak, 'day')} to the ${days}-day badge`, days - streak, days));
  // The next words-learned badge, or every word once the steps are passed.
  const step = nextStep(CONFIG.badges.learned.filter((n) => n < facts.totalWords), facts.learned);
  const target = step ?? facts.totalWords;
  if (facts.learned < target) {
    const left = target - facts.learned;
    const text = step ? `${plural(left, 'more word')} to the ${grouped(step)}-word badge` : `${plural(left, 'more word')} to learn every word`;
    out.push(goal('learned', text, left, target));
  }
  // The first level group that is not finished.
  for (const g of LEVEL_GROUPS) {
    const words = wordsOfGroup(data.words, g);
    const have = words.filter((w) => isLearned(progressById.get(w.id))).length;
    if (words.length && have < words.length) {
      out.push(goal('group', `${plural(words.length - have, 'more word')} to finish ${g.label}`, words.length - have, words.length));
      break;
    }
  }
  const reviews = nextStep(CONFIG.badges.reviews, facts.reviews);
  if (reviews) out.push(goal('reviews', `${plural(reviews - facts.reviews, 'review')} to the ${grouped(reviews)}-review badge`, reviews - facts.reviews, reviews));
  const minutes = nextStep(CONFIG.badges.minutes, facts.minutes);
  if (minutes) {
    const left = Math.ceil(minutes - facts.minutes);
    out.push(goal('minutes', `${plural(left, 'minute')} to the ${grouped(minutes)}-minute badge`, left, minutes));
  }
  return nearest(out, out.length);
}

// The `n` goals with the smallest share left to go. A tie keeps the order of the list.
export function nearest(list, n = 2) {
  return list.slice().sort((a, b) => a.share - b.share).slice(0, n);
}
```

- [ ] **Step 4: Run it and see it pass, and save the file for offline use**

Run: `node --test tests/js/goals.test.mjs`
Expected: `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`.

In `docs/sw.js`, replace:

```js
  'js/distractors.js',
  'js/hooks.js',
```

with:

```js
  'js/distractors.js',
  'js/goals.js',
  'js/hooks.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 277`, `ℹ pass 277`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/goals.js docs/sw.js tests/js/goals.test.mjs && git commit -F - <<'EOF'
feat(goals): countdowns to the next tile, streak, words, level group, reviews and minutes badges

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 7: Closing a day in one shared place (`docs/js/closeday.js`)

`Study.finish` checks in the day when nothing is left and awards new badges. The speaking spec (Plan 7) moves this into one shared function, `closeDay`, which the study session and the speaking panel both call, so the check-in happens from whichever screen finishes last. This task makes that move now, with the same behaviour, plus the rewound days in the streak.

`closeDay({ store, data, day, settings, now, perfectSession })` returns `{ day, checkedIn, justCheckedIn, streak, newBadges, left }`, the same fields `Study.finish` returned before without `summary`. `Study.finish` becomes `closeDay` plus the session summary. One function, `dayStatus`, decides whether the day can be checked in. Plan 7 adds the speaking list there, so neither caller changes.

**Files:**
- Create: `docs/js/closeday.js`
- Modify: `docs/js/study.js`, `docs/sw.js`
- Test: `tests/js/closeday.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/closeday.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeDay } from '../../docs/js/closeday.js';
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
const DAY = '2026-10-05';
const now = localDate(DAY, 20);

// Every fixture word learned on 1 October and next due on 1 December, so nothing is planned in October.
async function allLearned(store) {
  const progress = data.words.map((w) => ({ ...learnedProgress(w.id, '2026-10-01'), due: '2026-12-01' }));
  await store.commit({ progress, event: { day: '2026-10-01', kind: 'settings' } });
}

test('a day with work left is not checked in', async () => {
  const store = new MemoryStore();
  const r = await closeDay({ store, data, day: DAY, now });
  assert.deepEqual([r.day, r.checkedIn, r.justCheckedIn, r.streak, r.left.newWords.length, r.newBadges], [DAY, false, false, 0, 12, []]);
  assert.deepEqual(await store.allDays(), []);
});

test('a day with nothing left is checked in once, with its new badges', async () => {
  const store = new MemoryStore();
  await allLearned(store);
  const r = await closeDay({ store, data, day: DAY, now });
  assert.deepEqual([r.checkedIn, r.justCheckedIn, r.streak], [true, true, 1]);
  // The 61 fixture words are every word, so every theme and HSK 1-2 are finished. With no answer
  // on the day, it is not a perfect day.
  assert.deepEqual(r.newBadges, ['learned-10', 'learned-25', 'learned-50', 'learned-all',
    'theme-t01', 'theme-t02', 'theme-t03', 'theme-t04', 'theme-t05', 'hsk-1-2']);
  assert.deepEqual((await store.allDays()).map((d) => [d.day, d.reviews, d.newWords]), [[DAY, 0, 0]]);
  assert.equal((await store.getMeta('badges'))['learned-all'], DAY);
  const again = await closeDay({ store, data, day: DAY, now: localDate(DAY, 21) });
  assert.deepEqual([again.checkedIn, again.justCheckedIn, again.newBadges], [true, false, []]);
  assert.deepEqual((await store.allEvents()).map((e) => e.kind), ['settings', 'checkin', 'badges']);
});

test('the streak runs across rewound days', async () => {
  // Checked in on 1 and 2 October, and 3 and 4 October were undone by going back to 2 October.
  const store = new MemoryStore();
  await allLearned(store);
  await store.commit({
    days: [{ day: '2026-10-01' }, { day: '2026-10-02' }], meta: { rewound: [['2026-10-03', '2026-10-04']] },
    event: { day: DAY, kind: 'rewind', to: '2026-10-02' },
  });
  const r = await closeDay({ store, data, day: DAY, now });
  assert.equal(r.streak, 3);
  assert.ok(r.newBadges.includes('streak-3'));
});

test('a perfect session earns its badge', async () => {
  const store = new MemoryStore();
  await allLearned(store);
  assert.ok((await closeDay({ store, data, day: DAY, now, perfectSession: true })).newBadges.includes('perfect'));
});

test('the learner\'s settings are read when the caller does not pass them', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 4 } }, event: { day: DAY, kind: 'settings' } });
  assert.equal((await closeDay({ store, data, day: DAY, now })).left.newWords.length, 4);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/closeday.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\closeday.js`.

- [ ] **Step 3: Write `docs/js/closeday.js`**

Create `docs/js/closeday.js`:

```js
// Closing a study day checks in the day when its work is done, then awards any new badges. The
// study session calls it when it ends (Study.finish in study.js). Plan 7's speaking panel will call it
// too, so the day is checked in from whichever screen finishes last.
//
//   const r = await closeDay({ store, data, day: '2026-10-05' });
//   // { day, checkedIn, justCheckedIn, streak, newBadges: ['learned-10'], left }
import { normalizeSettings } from './config.js';
import { badgeFacts, newBadges } from './badges.js';
import { currentStreak } from './checkin.js';
import { isDayDone, planDay } from './plan.js';

// What is left of `day` (planDay's plan) and whether the day can be checked in. This is the one
// place that decides it. Plan 7 adds the speaking list here (read from `store`, which is unused
// until then), so the callers never change.
export async function dayStatus({ store, data, day, settings, progress }) {
  const left = planDay({ words: data.words, progress, today: day, settings });
  return { left, done: isDayDone(left) };
}

// Checks in `day` when it is done and not checked in yet, and awards the badges that the saved
// progress, check-ins and events now earn, dated `day`. perfectSession is true when the session
// that just ended was perfect (session.js sessionSummary). settings default to the saved ones.
export async function closeDay({ store, data, day, settings, now = new Date(), perfectSession = false }) {
  const amounts = settings ?? normalizeSettings(await store.getMeta('settings'));
  const progress = await store.allProgress();
  const { left, done } = await dayStatus({ store, data, day, settings: amounts, progress });
  const days = await store.allDays();
  let checkedIn = days.some((d) => d.day === day);
  let justCheckedIn = false;
  if (!checkedIn && done) {
    const record = { day, at: now.toISOString(), reviews: left.reviewsDone, newWords: left.newDone };
    await store.commit({ days: [record], event: { day, kind: 'checkin', ts: now.toISOString() } });
    days.push(record);
    checkedIn = true;
    justCheckedIn = true;
  }
  const rewound = (await store.getMeta('rewound')) ?? [];
  const facts = badgeFacts({ data, progress, days, events: await store.allEvents(), rewound, perfectSession });
  const earned = (await store.getMeta('badges')) ?? {};
  const fresh = newBadges(facts, earned);
  if (fresh.length) {
    const updated = { ...earned };
    for (const id of fresh) updated[id] = day;
    await store.commit({ meta: { badges: updated }, event: { day, kind: 'badges', badges: fresh, ts: now.toISOString() } });
  }
  const streak = currentStreak(days.map((d) => d.day), day, rewound);
  return { day, checkedIn, justCheckedIn, streak, newBadges: fresh, left };
}
```

Run: `node --test tests/js/closeday.test.mjs`
Expected: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 4: Let `Study.finish` call it**

In `docs/js/study.js`, replace:

```js
// Study is the one place the screens (Plan 4) talk to. It plans the day, runs a session,
// saves every answer, handles Undo, and checks in and awards badges at the end.
```

with:

```js
// Study is the one place the screens (Plan 4) talk to. It plans the day, runs a session,
// saves every answer, handles Undo, and at the end closes the day (closeday.js), which checks in
// and awards badges.
```

In `docs/js/study.js`, replace:

```js
import { isDayDone, planDay } from './plan.js';
```

with:

```js
import { planDay } from './plan.js';
```

In `docs/js/study.js`, replace:

```js
import { currentStreak } from './checkin.js';
import { badgeFacts, newBadges } from './badges.js';
```

with:

```js
import { closeDay } from './closeday.js';
```

In `docs/js/study.js`, replace:

```js
  // End the session (finished or not). Checks in when nothing is left for today, and
  // awards any new badges.
  async finish(now = new Date()) {
    const { store, data, day } = this;
    const progress = await store.allProgress();
    const after = planDay({ words: data.words, progress, today: day, settings: this.settings });
    const days = await store.allDays();
    let checkedIn = days.some((d) => d.day === day);
    let justCheckedIn = false;
    if (!checkedIn && isDayDone(after)) {
      const record = { day, at: now.toISOString(), reviews: after.reviewsDone, newWords: after.newDone };
      await store.commit({ days: [record], event: { day, kind: 'checkin', ts: now.toISOString() } });
      days.push(record);
      checkedIn = true;
      justCheckedIn = true;
    }
    const checked = days.map((d) => d.day);
    const summary = sessionSummary(this.state);
    const facts = badgeFacts({
      data, progress, days, events: await store.allEvents(), rewound: (await store.getMeta('rewound')) ?? [],
      perfectSession: summary.perfect,
    });
    const earned = (await store.getMeta('badges')) ?? {};
    const fresh = newBadges(facts, earned);
    if (fresh.length) {
      const updated = { ...earned };
      for (const id of fresh) updated[id] = day;
      await store.commit({ meta: { badges: updated }, event: { day, kind: 'badges', badges: fresh, ts: now.toISOString() } });
    }
    return { day, checkedIn, justCheckedIn, streak: currentStreak(checked, day), summary, newBadges: fresh, left: after };
  }
}
```

with:

```js
  // End the session (finished or not). closeDay checks in when nothing is left for the day and
  // awards any new badges. The result adds the session's summary for the check-in screen.
  async finish(now = new Date()) {
    const summary = sessionSummary(this.state);
    const result = await closeDay({
      store: this.store, data: this.data, day: this.day, settings: this.settings, now, perfectSession: summary.perfect,
    });
    return { ...result, summary };
  }
}
```

- [ ] **Step 5: Save the new file for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/checkin.js',
  'js/config.js',
```

with:

```js
  'js/checkin.js',
  'js/closeday.js',
  'js/config.js',
```

Run: `node --check docs/js/study.js && node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 282`, `ℹ pass 282`, `ℹ fail 0`. Every test of `tests/js/study.test.mjs` passes unchanged since Task 5.

- [ ] **Step 6: Commit**

```bash
git add docs/js/closeday.js docs/js/study.js docs/sw.js tests/js/closeday.test.mjs && git commit -F - <<'EOF'
refactor(study): check-in and badges move to closeDay, which Plan 7's speaking panel will share

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 8: What going back to a day changes (`docs/js/rewind.js`, the pure part)

This task works out a rewind without changing anything, so Node can test every rule on hand-made events. Task 9 then performs it in the store.

The rules, from the spec's section 1 and the user's decision on the streak:
1. **Which days.** `rewindChoices` offers the days before today with a check-in or a live answer, and before the last such day (choice 10).
2. **Word records.** Every live answer after the chosen day is undone, newest first. Each answer saved the word's record from just before it (`before`). Undoing newest first ends with the `before` of each word's earliest undone answer that changed the record, so `rewindPlan` puts that one back, or removes the record when it is `null` (the word was new). Answers that Undo had already taken back are skipped.
3. **Events and days.** Every event after the chosen day is deleted, except settings changes and earlier rewinds and resets. That includes answers, undos, check-ins, badge events and, after Plan 7, speak events. The check-in records after the chosen day go too.
4. **Badges.** Badges earned on or before the chosen day stay with their days. Later ones are removed.
5. **Streak.** The days from the day after the chosen day up to yesterday become rewound, so the streak is what it was at the end of the chosen day.

Worked example (the test's events). Word `a` is learned on 1 October and reviewed on 2 and 4 October. Word `b` is learned on 3 October. Word `c`'s review on 3 October is answered wrong, taken back by Undo and answered right. Every day is checked in. On 5 October the learner goes back to 2 October:

| What | Result |
|---|---|
| Records put back | `c` as before 3 October, `a` as before 4 October (its step-2 record of 2 October) |
| Records removed | `b`, which was new on 3 October |
| Events deleted | every event of 3 and 4 October except the settings change |
| Check-ins deleted | 3 and 4 October |
| Badges kept | `learned-10` of 1 October; `streak-3` of 3 October goes |
| Rewound | `[['2026-10-03', '2026-10-04']]` |
| Confirmation | `Undo 2 days: 1 new word and 2 reviews. Your streak becomes 2 days.` |

**Files:**
- Create: `docs/js/rewind.js`
- Modify: `docs/sw.js`
- Test: `tests/js/rewind.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/rewind.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addRange, confirmText, rewindChoices, rewindPlan } from '../../docs/js/rewind.js';

// Word records as srs.js keeps them, cut down to the fields that matter here.
const rec = (id, step, due) => ({ id, step, due });
const A1 = rec('a', 1, '2026-10-02');
const A2 = rec('a', 2, '2026-10-04');
const A3 = rec('a', 3, '2026-10-08');
const B1 = rec('b', 1, '2026-10-04');
const C1 = rec('c', 1, '2026-10-03');
const C2 = rec('c', 2, '2026-10-05');

// Four study days. Word a is learned on 1 October and reviewed on 2 and 4 October, word b is
// learned on 3 October, and word c's review on 3 October is answered wrong, taken back by Undo
// and answered again.
const EVENTS = [
  { seq: 1, day: '2026-10-01', kind: 'final', id: 'a', grade: 'right', outcome: 'learned', before: null, after: A1 },
  { seq: 2, day: '2026-10-01', kind: 'checkin' },
  { seq: 3, day: '2026-10-01', kind: 'badges', badges: ['learned-10'] },
  { seq: 4, day: '2026-10-02', kind: 'review', id: 'a', grade: 'right', outcome: null, before: A1, after: A2 },
  { seq: 5, day: '2026-10-02', kind: 'checkin' },
  { seq: 6, day: '2026-10-03', kind: 'review', id: 'c', grade: 'wrong', outcome: null, before: C1, after: rec('c', 1, '2026-10-04') },
  { seq: 7, day: '2026-10-03', kind: 'undo', target: 6, id: 'c' },
  { seq: 8, day: '2026-10-03', kind: 'review', id: 'c', grade: 'right', outcome: null, before: C1, after: C2 },
  { seq: 9, day: '2026-10-03', kind: 'check', id: 'b', grade: 'right', outcome: null, before: null, after: null },
  { seq: 10, day: '2026-10-03', kind: 'final', id: 'b', grade: 'right', outcome: 'learned', before: null, after: B1 },
  { seq: 11, day: '2026-10-03', kind: 'settings', settings: { newPerDay: 8 } },
  { seq: 12, day: '2026-10-03', kind: 'checkin' },
  { seq: 13, day: '2026-10-03', kind: 'badges', badges: ['streak-3'] },
  { seq: 14, day: '2026-10-04', kind: 'review', id: 'a', grade: 'right', outcome: null, before: A2, after: A3 },
  { seq: 15, day: '2026-10-04', kind: 'checkin' },
];
const DAYS = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'].map((day) => ({ day }));
const BADGES = { 'learned-10': '2026-10-01', 'streak-3': '2026-10-03' };

test('the days to go back to are earlier study days before the last one', () => {
  // 4 October is the last study day, so going back to it would undo nothing.
  assert.deepEqual(rewindChoices({ events: EVENTS, days: DAYS, today: '2026-10-05' }), ['2026-10-01', '2026-10-02', '2026-10-03']);
  // With answers today, yesterday can be chosen too, but never today.
  const today = [...EVENTS, { seq: 16, day: '2026-10-05', kind: 'review', id: 'a', grade: 'right' }];
  assert.deepEqual(rewindChoices({ events: today, days: DAYS, today: '2026-10-05' }), ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']);
  assert.deepEqual(rewindChoices({ events: [], days: [], today: '2026-10-05' }), []);
});

test('going back to 2 October undoes every later answer, check-in and badge', () => {
  const plan = rewindPlan({ events: EVENTS, days: DAYS, badges: BADGES, rewound: [], toDay: '2026-10-02', today: '2026-10-05' });
  // a goes back to its record from before 4 October, c to its record from before 3 October (the
  // answer taken back by Undo is skipped), and b, new on 3 October, loses its record.
  assert.deepEqual(plan.put, [C1, A2]);
  assert.deepEqual(plan.remove, ['b']);
  // Every event after 2 October goes, except the settings change.
  assert.deepEqual(plan.eventSeqs, [6, 7, 8, 9, 10, 12, 13, 14, 15]);
  assert.deepEqual(plan.dayKeys, ['2026-10-03', '2026-10-04']);
  assert.deepEqual(plan.badges, { 'learned-10': '2026-10-01' });
  assert.deepEqual(plan.rewound, [['2026-10-03', '2026-10-04']]);
  assert.deepEqual(plan.counts, { days: 2, newWords: 1, reviews: 2 });
  // The streak is as at the end of 2 October, 1 and 2 October in a row, and the rewound days do not break it.
  assert.equal(plan.streakAfter, 2);
  assert.equal(confirmText(plan), 'Undo 2 days: 1 new word and 2 reviews. Your streak becomes 2 days.');
});

test('going back to the first study day leaves only that day', () => {
  const plan = rewindPlan({ events: EVENTS, days: DAYS, badges: BADGES, rewound: [], toDay: '2026-10-01', today: '2026-10-05' });
  assert.deepEqual([plan.put, plan.remove], [[A1, C1], ['b']]);
  assert.deepEqual(plan.counts, { days: 3, newWords: 1, reviews: 3 });
  assert.equal(confirmText(plan), 'Undo 3 days: 1 new word and 3 reviews. Your streak becomes 1 day.');
});

test('going back is refused for today, and for an answer without its saved records', () => {
  assert.throws(() => rewindPlan({ events: EVENTS, days: DAYS, toDay: '2026-10-05', today: '2026-10-05' }), /a day before today/);
  const old = EVENTS.map((e) => (e.seq === 14 ? { seq: 14, day: e.day, kind: 'review', id: 'a', grade: 'right' } : e));
  assert.throws(() => rewindPlan({ events: old, days: DAYS, toDay: '2026-10-02', today: '2026-10-05' }), /Answer 14 cannot be undone/);
});

test('rewound ranges join when they touch or overlap', () => {
  assert.deepEqual(addRange([], '2026-10-03', '2026-10-04'), [['2026-10-03', '2026-10-04']]);
  assert.deepEqual(addRange([['2026-10-03', '2026-10-04']], '2026-10-05', '2026-10-06'), [['2026-10-03', '2026-10-06']]);
  assert.deepEqual(addRange([['2026-10-08', '2026-10-09']], '2026-10-06', '2026-10-11'), [['2026-10-06', '2026-10-11']]);
  assert.deepEqual(addRange([['2026-10-01', '2026-10-01']], '2026-10-03', '2026-10-04'), [['2026-10-01', '2026-10-01'], ['2026-10-03', '2026-10-04']]);
  // Going back to yesterday adds no range.
  assert.deepEqual(addRange([['2026-10-01', '2026-10-01']], '2026-10-05', '2026-10-04'), [['2026-10-01', '2026-10-01']]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/rewind.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\rewind.js`.

- [ ] **Step 3: Write `docs/js/rewind.js`**

Create `docs/js/rewind.js`:

```js
// Going back to a day, and resetting (spec of 2026-10-03, section 1).
//
// Going back to `toDay` undoes every answer of a later study day, newest first. Each saved answer
// holds the word's record from just before it (`before`) and just after it (`after`), see
// Study.answer in study.js. Undoing newest first ends with each word's `before` of its earliest
// undone answer that changed the record, so that record is put back, or the word's record is
// removed when that `before` is empty (the word was new). Answers that Undo had already taken
// back are skipped. The check-ins and badges after toDay are removed too, the days from toDay + 1
// to yesterday are stored as rewound (meta 'rewound', see checkin.js), and the streak becomes
// what it was at the end of toDay.
//
// For example, the learner studied on 1, 2, 3 and 4 October and, on 5 October, went back to
// 2 October. The answers and check-ins of 3 and 4 October are undone, 3 and 4 October are rewound, the streak is 2
// (3 after checking in on 5 October), and a 3-day streak badge of 3 October is removed.
import { addDays } from './dates.js';
import { currentStreak } from './checkin.js';
import { ANSWER_KINDS, liveEvents } from './stats.js';
import { plural } from './view/format.js';

// The events a rewind keeps whatever their day, which are settings changes and earlier rewinds
// and resets.
export const KEPT_KINDS = Object.freeze(['settings', 'rewind', 'reset']);

// The days the learner may go back to, oldest first. They are the days before today with a
// check-in or a live answer, and before the last such day, as going back to the last one would
// undo nothing.
export function rewindChoices({ events, days, today }) {
  const active = new Set(days.map((d) => d.day));
  for (const e of liveEvents(events)) if (ANSWER_KINDS.includes(e.kind)) active.add(e.day);
  const sorted = [...active].sort();
  const last = sorted.at(-1);
  return sorted.filter((day) => day < today && day < last);
}

// The rewound day ranges with from..to added, joined where they touch or overlap, oldest first.
// Nothing is added when `from` is after `to` (going back to yesterday).
export function addRange(rewound, from, to) {
  const ranges = rewound.map(([a, b]) => [a, b]);
  if (from <= to) ranges.push([from, to]);
  ranges.sort((x, y) => x[0].localeCompare(y[0]));
  const out = [];
  for (const [a, b] of ranges) {
    const prev = out.at(-1);
    if (prev && a <= addDays(prev[1], 1)) prev[1] = b > prev[1] ? b : prev[1];
    else out.push([a, b]);
  }
  return out;
}

// What going back to `toDay` on `today` changes, without changing anything:
//   put, remove   word records to put back, and word IDs whose record goes
//   eventSeqs     seq numbers of the events to delete (every event after toDay but KEPT_KINDS)
//   dayKeys       check-in days to delete
//   badges        the badges map that stays (badges earned on or before toDay)
//   rewound       the new rewound day ranges
//   counts        { days, newWords, reviews } undone, for the confirmation
//   streakAfter   the streak after going back
// events are all saved events (store.allEvents()), days the check-in records, badges the saved
// { badgeId: day } map and rewound the saved ranges. Throws when toDay is not before today, or
// when an undone answer was saved without its word records.
export function rewindPlan({ events, days, badges = {}, rewound = [], toDay, today }) {
  if (!(toDay < today)) throw new Error('Pick a day before today.');
  const undone = liveEvents(events).filter((e) => ANSWER_KINDS.includes(e.kind) && e.day > toDay)
    .sort((a, b) => a.seq - b.seq);
  const bad = undone.find((e) => !('before' in e) || !('after' in e));
  if (bad) throw new Error(`Answer ${bad.seq} cannot be undone, because it was saved without the word's records.`);
  const first = new Map();
  for (const e of undone) if (e.after !== null && !first.has(e.id)) first.set(e.id, e.before);
  const put = [];
  const remove = [];
  for (const [id, before] of first) {
    if (before) put.push(before);
    else remove.push(id);
  }
  const dayKeys = days.map((d) => d.day).filter((day) => day > toDay).sort();
  const ranges = addRange(rewound, addDays(toDay, 1), addDays(today, -1));
  const left = days.map((d) => d.day).filter((day) => day <= toDay);
  return {
    put,
    remove,
    eventSeqs: events.filter((e) => e.day > toDay && !KEPT_KINDS.includes(e.kind)).map((e) => e.seq),
    dayKeys,
    badges: Object.fromEntries(Object.entries(badges).filter(([, day]) => day <= toDay)),
    rewound: ranges,
    counts: {
      days: new Set([...undone.map((e) => e.day), ...dayKeys]).size,
      newWords: undone.filter((e) => e.outcome === 'learned').length,
      reviews: undone.filter((e) => e.kind === 'review').length,
    },
    streakAfter: currentStreak(left, today, ranges),
  };
}

// The confirmation, for example 'Undo 3 days: 36 new words and 120 reviews. Your streak becomes 5 days.'
export function confirmText(plan) {
  const { days, newWords, reviews } = plan.counts;
  return `Undo ${plural(days, 'day')}: ${plural(newWords, 'new word')} and ${plural(reviews, 'review')}. `
    + `Your streak becomes ${plural(plan.streakAfter, 'day')}.`;
}
```

- [ ] **Step 4: Run it and see it pass, and save the file for offline use**

Run: `node --test tests/js/rewind.test.mjs`
Expected: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

In `docs/sw.js`, replace:

```js
  'js/release.js',
  'js/rng.js',
```

with:

```js
  'js/release.js',
  'js/rewind.js',
  'js/rng.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 287`, `ℹ pass 287`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/rewind.js docs/sw.js tests/js/rewind.test.mjs && git commit -F - <<'EOF'
feat(rewind): which days can be chosen, what going back undoes, and the confirmation text

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 9: Going back and resetting in the store (`rewindTo` and `resetAll`)

`rewindTo({ store, toDay })` reads everything a rewind needs, refuses a day that `rewindChoices` does not offer, and writes the whole plan in one commit: the records put back and removed, the events, check-in days and saved session deleted, the badges and rewound days saved, and one event `{ kind: 'rewind', to: toDay, counts }`, so the Sheet's log shows that it happened.

`resetAll({ store })` empties the word records, events and check-in days in one commit, saves `badges: {}` and `rewound: []`, deletes the saved session, keeps the settings, and leaves one event of kind `reset`. Its seq is the next number, because clearing never resets the seq (Task 1).

The tests play real study days through `Study`. The first is the spec's example. Studied on 1, 2, 3 and 4 October with 12 new words a day, then on 5 October gone back to 2 October. The confirmation reads `Undo 2 days: 24 new words and 36 reviews. Your streak becomes 2 days.` (3 October had 12 new words and 12 reviews, 4 October 12 new words and 24 reviews.) Afterwards the word records, check-in days and events are exactly those at the end of 2 October plus the rewind event, the 3-day streak badge of 3 October is gone, and on 5 October the 12 new words are the words first learned on 3 October. After studying 5 October the streak is 3 and the 3-day streak badge comes back, dated 5 October.

**Files:**
- Modify: `docs/js/rewind.js`
- Test: `tests/js/rewind.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tests/js/rewind.test.mjs`, replace:

```js
import { addRange, confirmText, rewindChoices, rewindPlan } from '../../docs/js/rewind.js';
```

with:

```js
import {
  addRange, confirmText, resetAll, rewindChoices, rewindPlan, rewindTo,
} from '../../docs/js/rewind.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { loadFixture, localDate } from './helpers.mjs';
```

Append to the end of `tests/js/rewind.test.mjs`:

```js
// ---- Going back and resetting in the store, with study days played through Study ----

const data = loadFixture();
const right = (card) => (card.quiz === 'recall' ? 'know' : 'right');
const byIdOrder = (list) => list.slice().sort((a, b) => a.id.localeCompare(b.id));

// Plays a whole study day at 09:00, every answer right.
async function playDay(store, day) {
  const now = localDate(day, 9);
  const study = await Study.start({ store, data, now });
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(right(study.card), now);
  }
  return study.finish(now);
}

test('the spec\'s example: studied 1 to 4 October, gone back to 2 October on 5 October', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-01');
  await playDay(store, '2026-10-02');
  const end2 = await store.dump();
  await playDay(store, '2026-10-03');
  await playDay(store, '2026-10-04');
  const learnedOn3 = (await store.allProgress()).filter((p) => p.learned === '2026-10-03').map((p) => p.id);
  assert.equal((await store.getMeta('badges'))['streak-3'], '2026-10-03');
  const plan = await rewindTo({ store, toDay: '2026-10-02', now: localDate('2026-10-05', 9) });
  // 3 October had 12 new words and 12 reviews, and 4 October 12 new words and 24 reviews.
  assert.equal(confirmText(plan), 'Undo 2 days: 24 new words and 36 reviews. Your streak becomes 2 days.');
  assert.deepEqual(byIdOrder(await store.allProgress()), byIdOrder(end2.progress));
  assert.deepEqual(await store.allDays(), end2.days);
  const events = await store.allEvents();
  assert.deepEqual(events.slice(0, -1), end2.events);
  assert.deepEqual([events.at(-1).kind, events.at(-1).day, events.at(-1).to], ['rewind', '2026-10-05', '2026-10-02']);
  assert.deepEqual(await store.getMeta('badges'), end2.meta.badges); // the 3-day streak badge is gone
  assert.deepEqual(await store.getMeta('rewound'), [['2026-10-03', '2026-10-04']]);
  assert.equal(await store.getMeta('session'), undefined);
  // On 5 October the words first learned on 3 October come back as new words, and the streak
  // is 2, then 3 after the check-in, which earns the 3-day streak badge again.
  const study = await Study.start({ store, data, now: localDate('2026-10-05', 9) });
  assert.deepEqual(study.plan.newWords, learnedOn3);
  const day5 = await playDay(store, '2026-10-05');
  assert.equal(day5.streak, 3);
  assert.equal((await store.getMeta('badges'))['streak-3'], '2026-10-05');
});

test('an answer taken back by Undo is skipped, and going back to the first study day leaves only it', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-01');
  const end1 = await store.dump();
  // On 2 October the first review is answered wrong, taken back by Undo, then answered right.
  const now = localDate('2026-10-02', 9);
  const study = await Study.start({ store, data, now });
  await study.answer('wrong', now);
  await study.undo(now);
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(right(study.card), now);
  }
  await study.finish(now);
  await assert.rejects(rewindTo({ store, toDay: '2026-10-02', now: localDate('2026-10-03', 9) }), /cannot be chosen/);
  const plan = await rewindTo({ store, toDay: '2026-10-01', now: localDate('2026-10-03', 9) });
  assert.deepEqual(plan.counts, { days: 1, newWords: 12, reviews: 12 });
  assert.deepEqual(byIdOrder(await store.allProgress()), byIdOrder(end1.progress));
  assert.deepEqual(await store.getMeta('rewound'), [['2026-10-02', '2026-10-02']]);
});

test('reset everything deletes the progress and keeps the settings', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 8 } }, event: { day: '2026-10-01', kind: 'settings' } });
  await playDay(store, '2026-10-01');
  const lastSeq = (await store.allEvents()).at(-1).seq;
  await resetAll({ store, now: localDate('2026-10-02', 9) });
  assert.deepEqual([await store.allProgress(), await store.allDays()], [[], []]);
  // The reset event gets the next seq, so the Sheet backup never sees an old seq again.
  assert.deepEqual((await store.allEvents()).map((e) => [e.seq, e.kind, e.day]), [[lastSeq + 1, 'reset', '2026-10-02']]);
  assert.deepEqual(await store.getMeta('settings'), { newPerDay: 8 });
  assert.deepEqual([await store.getMeta('badges'), await store.getMeta('rewound'), await store.getMeta('session')], [{}, [], undefined]);
  const study = await Study.start({ store, data, now: localDate('2026-10-02', 9) });
  assert.deepEqual(study.plan.newWords, data.words.slice(0, 8).map((w) => w.id));
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/rewind.test.mjs`
Expected: `ℹ fail 1`, with `SyntaxError: The requested module '../../docs/js/rewind.js' does not provide an export named 'resetAll'`.

- [ ] **Step 3: Add `rewindTo` and `resetAll`**

In `docs/js/rewind.js`, replace:

```js
import { addDays } from './dates.js';
```

with:

```js
import { addDays, studyDay } from './dates.js';
```

Append to the end of `docs/js/rewind.js`:

```js
// Goes back to `toDay` in one store commit, so it happens completely or not at all. One event of
// kind 'rewind' names the chosen day and the counts, so the Sheet's log shows that it happened,
// and the saved study session (meta 'session') is deleted. Returns the plan (see rewindPlan).
// A day that rewindChoices does not offer is refused.
export async function rewindTo({ store, toDay, now = new Date() }) {
  const today = studyDay(now);
  const [events, days, badges, rewound] = await Promise.all([
    store.allEvents(), store.allDays(), store.getMeta('badges'), store.getMeta('rewound'),
  ]);
  if (!rewindChoices({ events, days, today }).includes(toDay)) throw new Error('That day cannot be chosen.');
  const plan = rewindPlan({ events, days, badges: badges ?? {}, rewound: rewound ?? [], toDay, today });
  await store.commit({
    progress: plan.put,
    remove: plan.remove,
    removeEvents: plan.eventSeqs,
    removeDays: plan.dayKeys,
    removeMeta: ['session'],
    meta: { badges: plan.badges, rewound: plan.rewound },
    event: { day: today, kind: 'rewind', to: toDay, counts: plan.counts, ts: now.toISOString() },
  });
  return plan;
}

// "Reset everything" deletes every word record, answer, check-in, badge, rewound day and the
// saved session in one commit, and keeps the settings (daily amounts and auto-play; the Sheet
// address and code are kept in the browser, not in the store). One event of kind 'reset' is left.
export async function resetAll({ store, now = new Date() }) {
  await store.commit({
    clear: ['progress', 'events', 'days'],
    removeMeta: ['session'],
    meta: { badges: {}, rewound: [] },
    event: { day: studyDay(now), kind: 'reset', ts: now.toISOString() },
  });
}
```

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/js/rewind.test.mjs`
Expected: `ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 290`, `ℹ pass 290`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/rewind.js tests/js/rewind.test.mjs && git commit -F - <<'EOF'
feat(rewind): go back to a day or reset everything in one store commit each

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 10: The Google Sheet after going back or resetting (`docs/js/hooks.js`, `docs/js/sheet.js`, `docs/js/sync.js`)

The ordinary backup sends the events after its cursor, the seq of the last event the Sheet confirmed. After going back, that event may be deleted, and the backup then stops with "mismatch" (`backUp` in `docs/js/sheet.js`), because sending more would mix two histories. So after going back or resetting, the Sheet's copy must be replaced by the phone's, with the existing "Replace the Sheet with this phone's progress" step (`reset: true`).

How it works, with the flag that survives being offline:
1. The screen that went back or reset emits a new hook, `rewound` (Task 13 draws those screens).
2. `sync.js` listens to it. When the backup is set up, it saves `resetPending: true` in the Sheet state (localStorage) and starts a backup.
3. `backUp` treats `reset || state.resetPending` as a replacement, and clears the flag only when the Sheet has confirmed the first page. Offline, the flag waits, and the next backup at any later time replaces the Sheet.
4. A restore from the Sheet clears the flag, because the phone then holds the Sheet's history again.

The Sheet also learns the new parts. Meta `rewound` is backed up and restored (`META_KEYS`), the Log names the new events ("went back to a day", with the result "back to 2026-10-05", and "reset everything"), and the Dashboard's streaks skip rewound days.

**Files:**
- Modify: `docs/js/hooks.js`, `docs/js/sheet.js`, `docs/js/sync.js`
- Test: `tests/js/hooks.test.mjs`, `tests/js/sheet.test.mjs`, `tests/js/sync.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tests/js/hooks.test.mjs`, replace:

```js
  assert.deepEqual(HOOK_NAMES, ['open', 'hidden', 'sessionEnd', 'settings']);
```

with:

```js
  assert.deepEqual(HOOK_NAMES, ['open', 'hidden', 'sessionEnd', 'settings', 'rewound']);
```

In `tests/js/sheet.test.mjs`, replace:

```js
import { Study } from '../../docs/js/study.js';
```

with:

```js
import { Study } from '../../docs/js/study.js';
import { resetAll, rewindTo } from '../../docs/js/rewind.js';
```

Append to the end of `tests/js/sheet.test.mjs`:

```js
test('the log names a rewind and a reset', () => {
  const rewind = { seq: 40, day: '2026-10-07', kind: 'rewind', to: '2026-10-05', counts: { days: 1, newWords: 12, reviews: 12 }, ts: 'T' };
  assert.deepEqual(logRow(rewind).slice(0, 9), [40, '2026-10-07', 'T', 'went back to a day', '', '', '', '', 'back to 2026-10-05']);
  assert.deepEqual(logRow({ seq: 41, day: '2026-10-07', kind: 'reset', ts: 'T' }).slice(0, 9),
    [41, '2026-10-07', 'T', 'reset everything', '', '', '', '', '']);
});

test('after going back to a day, the next backup replaces the Sheet, also when the phone was offline', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  await playDay(store, '2026-10-06');
  let { state } = await run(store, phone(), sheet.post);
  await rewindTo({ store, toDay: '2026-10-05', now: new Date('2026-10-07T08:00:00Z') });
  // An ordinary backup stops, because the events the Sheet has were deleted on the phone.
  assert.equal((await run(store, state, sheet.post)).state.problem, 'mismatch');
  // sync.js sets resetPending when the 'rewound' hook runs. Offline, the flag waits.
  const offline = async () => { throw Object.assign(new Error('Could not reach the Sheet (Failed to fetch).'), { problem: 'offline' }); };
  ({ state } = await run(store, { ...state, resetPending: true }, offline));
  assert.deepEqual([state.problem, state.resetPending], ['offline', true]);
  ({ state } = await run(store, state, sheet.post, { now: new Date('2026-10-07T08:05:00Z') }));
  assert.deepEqual([state.problem, state.resetPending], [null, false]);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), (await store.eventsSince(0)).map((e) => e.seq));
  assert.equal(sheet.ss.rowsOf('Daily').some((r) => r[0] === '2026-10-06'), false);
  assert.deepEqual(sheet.ss.rowsOf('Meta').find((r) => r[0] === 'rewound')[1], '[["2026-10-06","2026-10-06"]]');
  // The Dashboard's streak skips the rewound day. On 7 October it counts 5 October, after the rewound 6 October.
  assert.equal(sheet.ss.getSheetByName('Dashboard').getRange(5, 2).getValues()[0][0], 1);
  // A restore brings the rewound days back, and the next backup is an ordinary one.
  const fresh = new MemoryStore();
  const { state: restored } = await restoreFromSheet({ store: fresh, state: { ...phone('0011223344556677'), resetPending: true }, post: sheet.post });
  assert.deepEqual(await fresh.getMeta('rewound'), [['2026-10-06', '2026-10-06']]);
  assert.equal(restored.resetPending, false);
});

test('after "Reset everything" the Sheet is replaced by the empty progress', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  let { state } = await run(store, phone(), sheet.post);
  await resetAll({ store, now: new Date('2026-10-06T08:00:00Z') });
  ({ state } = await run(store, { ...state, resetPending: true }, sheet.post));
  assert.equal(state.problem, null);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[3]), ['reset everything']);
  assert.deepEqual([sheet.ss.rowsOf('Progress').length, sheet.ss.rowsOf('Daily').map((r) => r.slice(0, 2))], [0, [['2026-10-06', 'no']]]);
});
```

In `tests/js/sync.test.mjs`, replace:

```js
import { MemoryStore } from '../../docs/js/store.js';
```

with:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { rewindTo } from '../../docs/js/rewind.js';
```

Append to the end of `tests/js/sync.test.mjs`:

```js
test('after going back to a day, the backup replaces the Sheet, once', async () => {
  const { sync, hooks, sheet, store, net } = await setUp();
  // A second study day, so there is a day to go back to.
  const p = learnedProgress('w0039', '2026-10-06');
  await store.commit({ progress: [p], event: { day: '2026-10-06', kind: 'final', id: 'w0039', grade: 'right', outcome: 'learned', before: null, after: p, ts: '2026-10-06T19:00:00Z' } });
  await hooks.emit('rewound', { store }); // not set up yet, so nothing is marked or sent
  assert.equal(sync.state().resetPending, undefined);
  sync.saveSettings({ url: URL_OK, code: CODE });
  await sync.run();
  assert.equal(sheet.ss.rowsOf('Log').length, 2);
  await rewindTo({ store, toDay: '2026-10-05', now: new Date('2026-10-07T08:00:00Z') });
  await hooks.emit('rewound', { store });
  assert.equal(sync.state().resetPending, true);
  await sync.run(); // waits for the backup the hook started
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => [r[0], r[3]]), [[1, 'final check'], [3, 'went back to a day']]);
  assert.deepEqual([sync.state().resetPending, sync.state().problem], [false, null]);
  assert.equal(net.bodies.filter((b) => b.reset).length, 1);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/hooks.test.mjs tests/js/sheet.test.mjs tests/js/sync.test.mjs`
Expected: `ℹ tests 35`, `ℹ fail 5`. They are the hook list, the three new Sheet tests (the first gets `'rewind'` where it expects `'went back to a day'`), and the new sync test, where `resetPending` stays unset because nothing listens to the hook yet.

- [ ] **Step 3: Add the hook**

In `docs/js/hooks.js`, replace:

```js
//   'settings'    ({ container, store })     when Settings is drawn, to add a section to container
// A failing handler is logged and skipped, so a backup problem never stops a study session.
export const HOOK_NAMES = Object.freeze(['open', 'hidden', 'sessionEnd', 'settings']);
```

with:

```js
//   'settings'    ({ container, store })     when Settings is drawn, to add a section to container
//   'rewound'     ({ store })                after "Go back to a day" (ui/rewind.js) or "Reset everything"
//                                            (ui/settings.js) changed the saved history
// A failing handler is logged and skipped, so a backup problem never stops a study session.
export const HOOK_NAMES = Object.freeze(['open', 'hidden', 'sessionEnd', 'settings', 'rewound']);
```

- [ ] **Step 4: Teach `sheet.js` the new events, the rewound days and the flag**

In `docs/js/sheet.js`, replace:

```js
export const META_KEYS = Object.freeze(['settings', 'badges']);
```

with:

```js
export const META_KEYS = Object.freeze(['settings', 'badges', 'rewound']); // not 'session', which stays on the phone
```

In `docs/js/sheet.js`, replace:

```js
  final: 'final check', undo: 'undo', checkin: 'check-in', badges: 'badges', settings: 'settings',
};
```

with:

```js
  final: 'final check', undo: 'undo', checkin: 'check-in', badges: 'badges', settings: 'settings',
  rewind: 'went back to a day', reset: 'reset everything',
};
```

In `docs/js/sheet.js`, replace:

```js
  if (e.kind === 'badges') result = (e.badges ?? []).join(', ');
```

with:

```js
  if (e.kind === 'badges') result = (e.badges ?? []).join(', ');
  if (e.kind === 'rewind') result = `back to ${e.to}`;
```

In `docs/js/sheet.js`, replace:

```js
// The numbers the Dashboard shows at the top.
export function summaryOf({ progress, days, words, now = new Date() }) {
  const checked = days.map((d) => d.day);
  const today = studyDay(now);
  return {
    updated: now.toISOString(),
    today,
    streak: currentStreak(checked, today),
    bestStreak: bestStreak(checked),
```

with:

```js
// The numbers the Dashboard shows at the top. rewound is the meta 'rewound' list of day ranges,
// which the streaks skip (see checkin.js).
export function summaryOf({ progress, days, words, now = new Date(), rewound = [] }) {
  const checked = days.map((d) => d.day);
  const today = studyDay(now);
  return {
    updated: now.toISOString(),
    today,
    streak: currentStreak(checked, today, rewound),
    bestStreak: bestStreak(checked, rewound),
```

In `docs/js/sheet.js`, replace:

```js
//   reset        true replaces everything in the Sheet with this phone's progress
// Returns { state, sent }, where sent counts the events the Sheet confirmed.
export async function backUp({
  store, words, themes = [], state, post, save = () => {}, now = new Date(), pageSize = PAGE_SIZE, reset = false,
}) {
  if (!isReady(state)) return { state, sent: 0 };
  let current = { ...state };
  let sent = 0;
  try {
    let cursor = reset ? 0 : current.cursor;
```

with:

```js
//   reset        true replaces everything in the Sheet with this phone's progress
// state.resetPending (set by sync.js after going back to a day or "Reset everything") also
// replaces the Sheet, and is cleared only when the Sheet has confirmed the replacement. So a
// rewind on a phone that is offline still replaces the Sheet later, instead of stopping with
// "mismatch" because the deleted events are gone.
// Returns { state, sent }, where sent counts the events the Sheet confirmed.
export async function backUp({
  store, words, themes = [], state, post, save = () => {}, now = new Date(), pageSize = PAGE_SIZE, reset = false,
}) {
  if (!isReady(state)) return { state, sent: 0 };
  const replace = reset || Boolean(state.resetPending);
  let current = { ...state };
  let sent = 0;
  try {
    let cursor = replace ? 0 : current.cursor;
```

In `docs/js/sheet.js`, replace:

```js
    if (reset && pending.length === 0) {
```

with:

```js
    if (replace && pending.length === 0) {
```

In `docs/js/sheet.js`, replace:

```js
    const meta = [];
    for (const key of META_KEYS) {
      const value = await store.getMeta(key);
      if (value !== undefined) meta.push([key, JSON.stringify(value)]);
    }
    const summary = summaryOf({ progress: [...progressById.values()], days, words, now });
```

with:

```js
    const meta = [];
    let rewound = [];
    for (const key of META_KEYS) {
      const value = await store.getMeta(key);
      if (value !== undefined) meta.push([key, JSON.stringify(value)]);
      if (key === 'rewound' && value) rewound = value;
    }
    const summary = summaryOf({ progress: [...progressById.values()], days, words, now, rewound });
```

In `docs/js/sheet.js`, replace:

```js
        reset: reset && i === 0,
```

with:

```js
        reset: replace && i === 0,
```

In `docs/js/sheet.js`, replace:

```js
      current = { ...current, cursor, lastOk: now.toISOString(), problem: null, detail: '' };
      save(current);
    }
    return { state: current, sent };
```

with:

```js
      current = { ...current, cursor, lastOk: now.toISOString(), problem: null, detail: '' };
      if (replace) current.resetPending = false;
      save(current);
    }
    return { state: current, sent };
```

In `docs/js/sheet.js`, replace:

```js
  const next = { ...state, cursor: first.lastSeq, lastOk: now.toISOString(), problem: null, detail: '' };
```

with:

```js
  const next = { ...state, cursor: first.lastSeq, lastOk: now.toISOString(), problem: null, detail: '', resetPending: false };
```

- [ ] **Step 5: Let `sync.js` set the flag when the hook runs**

In `docs/js/sync.js`, replace:

```js
//   when the phone comes back online, and when "Back up now" is tapped in Settings.
// A backup never makes a screen wait, and a failed one only changes the status line in Settings.
import {
  KEEPALIVE_PAGE_SIZE, PAGE_SIZE, PROBLEM_TEXT, backUp, checkCode, checkWebAppUrl, isDue, loadState, makeCode, makeDeviceId,
  postJson, restoreFromSheet, saveState, statusText, withSettings,
} from './sheet.js';
```

with:

```js
//   when the phone comes back online, and when "Back up now" is tapped in Settings.
// After "Go back to a day" or "Reset everything" ('rewound'), the next backup replaces the
// Sheet's copy (state.resetPending, see backUp in sheet.js), also when it waits until the phone
// is online again.
// A backup never makes a screen wait, and a failed one only changes the status line in Settings.
import {
  KEEPALIVE_PAGE_SIZE, PAGE_SIZE, PROBLEM_TEXT, backUp, checkCode, checkWebAppUrl, isDue, isReady, loadState, makeCode,
  makeDeviceId, postJson, restoreFromSheet, saveState, statusText, withSettings,
} from './sheet.js';
```

In `docs/js/sync.js`, replace:

```js
    saveSettings({ url, code }) {
      save(withSettings(state(), { url, code }));
    },
```

with:

```js
    saveSettings({ url, code }) {
      save(withSettings(state(), { url, code }));
    },
    // Marks that the Sheet must be replaced by the phone's progress. Returns false, and marks
    // nothing, when the backup is not set up.
    markReset() {
      const s = state();
      if (!isReady(s)) return false;
      save({ ...s, resetPending: true });
      return true;
    },
```

In `docs/js/sync.js`, replace:

```js
  on('open', () => { if (isDue(sync.state())) quietly(); });
```

with:

```js
  on('open', () => { if (isDue(sync.state())) quietly(); });
  on('rewound', () => { if (sync.markReset()) quietly(); });
```

- [ ] **Step 6: Run the tests and see them pass**

Run: `node --test tests/js/hooks.test.mjs tests/js/sheet.test.mjs tests/js/sync.test.mjs tests/js/apps-script.test.mjs`
Expected: `ℹ fail 0`.

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 294`, `ℹ pass 294`, `ℹ fail 0`.

- [ ] **Step 7: Commit**

```bash
git add docs/js/hooks.js docs/js/sheet.js docs/js/sync.js tests/js/hooks.test.mjs tests/js/sheet.test.mjs tests/js/sync.test.mjs && git commit -F - <<'EOF'
feat(sheet): after going back or resetting, the next backup replaces the Sheet, also after being offline

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 11: Today and the check-in screen show the counters, with confetti (`docs/js/view/today.js`, `docs/js/ui/confetti.js`)

The spec's Today screen gets a large streak count, a ring that fills as the day's planned work gets done, four tiles (new words, reviews, accuracy and minutes studied today) and the two nearest goal countdowns. The check-in screen gets today's four numbers with a note when one is a personal best, and confetti bursts when the day is checked in. All motion is switched off when the phone asks for reduced motion.

What Today shows, worked through with real values. Halfway through a day with 18 reviews and 12 new words planned, 6 reviews and 4 new words done, 17 of 20 answers right and 7.6 minutes studied:

| Part | Shows |
|---|---|
| Ring | 25% (10 done, 30 left) |
| Counts (what is still due, as before) | 18 reviews, 12 new words |
| Done today | 4 new words, 6 reviews, 85% accuracy, 8 minutes |
| Next goals | 5 reviews to the 100-review badge; 3 days to the 30-day badge |

The ring is an SVG circle whose drawn length grows (a CSS transition on `stroke-dashoffset`, styled in Task 14). The confetti is a small module, `docs/js/ui/confetti.js`, with no package. It uses the browser's `element.animate` and the six theme colours, and makes nothing when the phone asks for reduced motion.

**Files:**
- Create: `docs/js/ui/confetti.js`
- Modify: `docs/js/view/today.js`, `docs/js/view/progress.js`, `docs/js/view/format.js`, `docs/js/ui/screens.js`, `docs/sw.js`
- Test: `tests/js/view-today.test.mjs`, `tests/js/view-progress.test.mjs`, `tests/js/confetti.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tests/js/view-today.test.mjs`, replace:

```js
import { todayView } from '../../docs/js/view/today.js';
```

with:

```js
import { tilesOf, todayView } from '../../docs/js/view/today.js';
```

Append to the end of `tests/js/view-today.test.mjs`:

```js
test('the ring, the four tiles of today and the two nearest goals', () => {
  // With 6 reviews and 4 new words done and 30 cards of work left, the ring is a quarter full.
  const counters = { newWords: 4, reviews: 6, answers: 20, right: 17, accuracy: 85, minutes: 7.6, done: 10, left: 30, ring: 0.25 };
  const goals = [{ id: 'reviews', text: '5 reviews to the 100-review badge' }, { id: 'streak', text: '3 days to the 30-day badge' }];
  const v = todayView({
    plan: plan({ reviews: ids(18), newWords: ids(12), reviewsDone: 6, newDone: 4 }), checkedDays: [], today: TODAY, settings: SETTINGS, counters, goals,
  });
  assert.deepEqual([v.ring, v.ringPct], [0.25, '25%']);
  assert.deepEqual(v.tiles, [
    { label: 'new words', value: '4' }, { label: 'reviews', value: '6' }, { label: 'accuracy', value: '85%' }, { label: 'minutes', value: '8' },
  ]);
  assert.deepEqual(v.goals, ['5 reviews to the 100-review badge', '3 days to the 30-day badge']);
  // Before the first answer of the day the accuracy tile has nothing to show.
  assert.deepEqual(tilesOf({ newWords: 0, reviews: 0, accuracy: null, minutes: 0 }).map((t) => t.value), ['0', '0', '-', '0']);
});

test('the streak runs across rewound days', () => {
  const v = todayView({ plan: plan({}), checkedDays: ['2026-10-04'], today: TODAY, settings: SETTINGS, rewound: [['2026-10-05', '2026-10-06']] });
  assert.equal(v.streak, 1);
});
```

In `tests/js/view-progress.test.mjs`, replace:

```js
  assert.deepEqual([plain.title, plain.streak, plain.lines], ['Check-in', null, []]);
```

with:

```js
  assert.deepEqual([plain.title, plain.streak, plain.lines, plain.confetti], ['Check-in', null, [], false]);
```

Append to the end of `tests/js/view-progress.test.mjs`:

```js
test("the check-in screen shows the day's four numbers, the personal bests and confetti", () => {
  const result = {
    day: TODAY, checkedIn: true, justCheckedIn: true, streak: 3, newBadges: [],
    summary: { reviews: 12, firstRight: 12, learned: 12, failed: 0, perfect: false }, left: { reviews: [], newWords: [] },
  };
  const counters = { newWords: 12, reviews: 12, answers: 48, right: 46, accuracy: 96, minutes: 21.4 };
  const v = checkinView({ result, checkedDays: [TODAY], today: TODAY, themes: data.themes, counters, bests: ['Best accuracy this week!'] });
  assert.deepEqual(v.numbers.map((t) => `${t.value} ${t.label}`), ['12 new words', '12 reviews', '96% accuracy', '21 minutes']);
  assert.deepEqual(v.bests, ['Best accuracy this week!']);
  assert.equal(v.confetti, true);
  assert.equal(checkinView({ result: { ...result, justCheckedIn: false }, checkedDays: [TODAY], today: TODAY, themes: data.themes }).confetti, false);
});
```

Create `tests/js/confetti.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { burst, confettiPieces, reducedMotion } from '../../docs/js/ui/confetti.js';
import { THEME_COLORS } from '../../docs/js/view/format.js';

test('each piece gets a colour of the themes and a flight from the random numbers', () => {
  const pieces = confettiPieces(7, () => 0.5);
  assert.equal(pieces.length, 7);
  assert.deepEqual(pieces.map((p) => p.color), [...THEME_COLORS, THEME_COLORS[0]]);
  // With every random number 0.5, a piece flies straight up 200 px, without turning, after 75 ms.
  assert.deepEqual(pieces[0], { color: THEME_COLORS[0], x: 0, y: -200, turn: 0, delay: 75 });
  const low = confettiPieces(1, () => 0)[0];
  assert.deepEqual([low.x, low.y, low.turn, low.delay], [-150, -120, -360, 0]);
});

test('no confetti when the phone asks for reduced motion', () => {
  assert.equal(reducedMotion({ matchMedia: (q) => ({ matches: q === '(prefers-reduced-motion: reduce)' }) }), true);
  assert.equal(reducedMotion({ matchMedia: () => ({ matches: false }) }), false);
  assert.equal(reducedMotion({}), false);
  assert.equal(burst({}, { reduced: true }), 0);
  assert.equal(burst(null, { reduced: false }), 0);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/view-today.test.mjs tests/js/view-progress.test.mjs tests/js/confetti.test.mjs`
Expected: `ℹ fail 4`. The Today test file stops with `does not provide an export named 'tilesOf'`, the confetti test file with `ERR_MODULE_NOT_FOUND`, and both check-in tests fail on `confetti` and `numbers`.

- [ ] **Step 3: The Today view**

Replace the whole of `docs/js/view/today.js` with:

```js
// The Today screen: streak, this week's check-ins, the day's ring, what is due, the four
// counters of today, the two nearest goals and the Start button.
import { currentStreak, weekStrip } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { WEEKDAY_LETTERS, percent, plural } from './format.js';

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
// counters.js todayCounters' result and goals the nearest goals (goals.js nearest).
// With 150 reviews waiting and the default settings, the note says that new words are halved.
export function todayView({
  plan, checkedDays, today, settings, resumable = false, rewound = [], counters = null, goals = [],
}) {
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
    canStart: !(nothingLeft && checkedInToday),
    startLabel: resumable || plan.reviewsDone + plan.newDone > 0 ? 'Continue' : 'Start',
  };
}
```

- [ ] **Step 4: The check-in view**

In `docs/js/view/progress.js`, replace:

```js
import { WEEKDAY_SHORT, monthTitle, percent, plural } from './format.js';
```

with:

```js
import { WEEKDAY_SHORT, monthTitle, percent, plural } from './format.js';
import { tilesOf } from './today.js';
```

In `docs/js/view/progress.js`, replace:

```js
// The check-in screen. result is Study.finish()'s result, or null when the screen is
// opened from the streak on the Today screen.
export function checkinView({ result, checkedDays, today, themes }) {
  const month = today.slice(0, 7);
  const view = {
    title: 'Check-in',
    lines: [],
    badges: [],
    streak: result ? result.streak : null,
```

with:

```js
// The check-in screen. result is Study.finish()'s result, or null when the screen is
// opened from the streak on the Today screen. counters is the day's numbers (counters.js
// dayStats) and bests the personal-best notes (counters.js personalBests). confetti is true
// right after the day was checked in.
export function checkinView({ result, checkedDays, today, themes, counters = null, bests = [] }) {
  const month = today.slice(0, 7);
  const view = {
    title: 'Check-in',
    lines: [],
    numbers: counters ? tilesOf(counters) : [],
    bests,
    badges: [],
    confetti: Boolean(result?.justCheckedIn),
    streak: result ? result.streak : null,
```

- [ ] **Step 5: The theme colours and the confetti**

In `docs/js/view/format.js`, replace:

```js
export const WEEKDAY_SHORT = Object.freeze(WEEKDAYS);
```

with:

```js
export const WEEKDAY_SHORT = Object.freeze(WEEKDAYS);

// Six bright colours of the bright look (spec of 2026-10-03, section 4): orange, yellow, green,
// blue, violet and pink. The themes take them in turn, and the confetti uses them too.
export const THEME_COLORS = Object.freeze(['#ff6b35', '#ffb703', '#38b000', '#3a86ff', '#8338ec', '#ff006e']);
```

Create `docs/js/ui/confetti.js`:

```js
// Confetti for a check-in, made of small coloured pieces that fly up and fall, drawn with the
// browser's own animation function (element.animate) and no package. Nothing happens when the phone asks
// for reduced motion (prefers-reduced-motion), as the spec of 2026-10-03 asks for all motion.
import { THEME_COLORS } from '../view/format.js';

// Each piece's colour and flight, from random numbers between 0 and 1. With every number 0.5 a
// piece flies 200 px straight up without turning and starts after 75 ms.
export function confettiPieces(count, random = Math.random) {
  return Array.from({ length: count }, (_, i) => ({
    color: THEME_COLORS[i % THEME_COLORS.length],
    x: Math.round((random() - 0.5) * 300), // px sideways at the end of the flight
    y: Math.round(-120 - random() * 160), // px up at the top of the flight
    turn: Math.round((random() - 0.5) * 720), // degrees
    delay: Math.round(random() * 150), // ms
  }));
}

// True when the phone asks for less motion.
export function reducedMotion(win = globalThis) {
  return Boolean(win.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
}

// Bursts `count` pieces from the middle of `el` and removes them after 2 seconds. Returns how
// many pieces it made, which is 0 with reduced motion.
export function burst(el, { reduced = reducedMotion(), count = 40, random = Math.random } = {}) {
  if (reduced || !el) return 0;
  const layer = document.createElement('div');
  layer.className = 'confetti';
  for (const p of confettiPieces(count, random)) {
    const piece = document.createElement('i');
    piece.className = 'confetti-piece';
    piece.style.background = p.color;
    layer.append(piece);
    piece.animate([
      { transform: 'translate(0, 0) rotate(0deg)', opacity: 1 },
      { transform: `translate(${p.x}px, ${p.y}px) rotate(${p.turn / 2}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${Math.round(p.x * 1.3)}px, 220px) rotate(${p.turn}deg)`, opacity: 0 },
    ], { duration: 1400, delay: p.delay, easing: 'ease-out', fill: 'forwards' });
  }
  el.append(layer);
  setTimeout(() => layer.remove(), 2000);
  return count;
}
```

Run: `node --test tests/js/view-today.test.mjs tests/js/view-progress.test.mjs tests/js/confetti.test.mjs`
Expected: `ℹ fail 0`.

- [ ] **Step 6: Draw Today and the check-in screen**

In `docs/js/ui/screens.js`, replace:

```js
import { badgeFacts } from '../badges.js';
import { cardElement } from './card.js';
```

with:

```js
import { badgeFacts } from '../badges.js';
import { currentStreak } from '../checkin.js';
import { dayStats, personalBests, todayCounters } from '../counters.js';
import { goals, nearest } from '../goals.js';
import { burst } from './confetti.js';
import { cardElement } from './card.js';
```

In `docs/js/ui/screens.js`, replace:

```js
export async function renderToday(app) {
  const today = studyDay();
  const plan = await previewDay({ store: app.store, data: app.data });
  const settings = { ...(await app.settings()) };
  const resumable = await canContinue({ store: app.store, data: app.data });
  const v = todayView({ plan, checkedDays: await checkedDays(app), today, settings, resumable });
  show(app.main,
    h('a', { class: 'streak', href: '#/checkin' }, h('span', { class: 'streak-n' }, v.streak), ' day streak'),
    h('div', { class: 'week' }, v.week.map((d) => h('span', {
      class: `day${d.checkedIn ? ' done' : ''}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`,
    }, d.letter))),
    h('div', { class: 'counts' },
      h('div', {}, h('b', {}, v.reviews), h('span', {}, 'reviews')),
      h('div', {}, h('b', {}, v.newWords), h('span', {}, 'new words'))),
    v.note ? h('p', { class: 'note' }, v.note) : null,
    h('p', { class: 'status' }, v.status),
    v.canStart ? h('button', {
      class: 'big start',
      onclick: async (e) => { e.target.disabled = true; await startSession(app); },
    }, v.startLabel) : null);
}

export async function renderCheckin(app) {
  const today = app.lastResult?.day ?? studyDay();
  const v = checkinView({ result: app.lastResult, checkedDays: await checkedDays(app), today, themes: app.data.themes });
  app.lastResult = null;
  show(app.main,
    h('h1', {}, v.title),
    v.streak !== null ? h('p', { class: 'streak' }, h('span', { class: 'streak-n' }, v.streak), ' day streak') : null,
    v.lines.map((line) => h('p', {}, line)),
    v.badges.length ? h('div', { class: 'new-badges' }, h('h2', {}, 'New badges'), v.badges.map((t) => h('p', { class: 'badge' }, t))) : null,
    h('h2', {}, v.monthTitle),
    h('table', { class: 'calendar' },
      h('tr', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('th', {}, d))),
      v.weeks.map((week) => h('tr', {}, week.map((c) => h('td', {
        class: c ? `${c.checkedIn ? 'done' : ''}${c.isToday ? ' today' : ''}` : '',
      }, c ? c.date : ''))))),
    h('a', { class: 'button big', href: '#/today' }, 'Back to Today'));
```

with:

```js
// The day's ring, a circle that fills as the day's planned work gets done. It starts empty and
// fills smoothly (the CSS transition of .ring-fill), unless the phone asks for reduced motion.
function ringElement(share, label) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = 2 * Math.PI * 52; // the length of the circle
  const circle = (cls) => {
    const c = document.createElementNS(NS, 'circle');
    for (const [k, v] of Object.entries({ cx: 60, cy: 60, r: 52, class: cls })) c.setAttribute(k, v);
    return c;
  };
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 120 120');
  svg.setAttribute('class', 'ring');
  svg.setAttribute('aria-hidden', 'true');
  const fill = circle('ring-fill');
  fill.style.strokeDasharray = `${C}`;
  fill.style.strokeDashoffset = `${C}`;
  svg.append(circle('ring-track'), fill);
  requestAnimationFrame(() => requestAnimationFrame(() => { fill.style.strokeDashoffset = `${C * (1 - share)}`; }));
  return h('div', { class: 'ring-box', role: 'img', 'aria-label': `${label} of today's work done` },
    svg, h('span', { class: 'ring-label' }, label));
}

// The four numbers of a day as tiles (tilesOf in view/today.js).
function tilesElement(tiles) {
  return h('div', { class: 'tiles4' }, tiles.map((t) => h('div', { class: 'tile4' }, h('b', {}, t.value), h('span', {}, t.label))));
}

export async function renderToday(app) {
  const today = studyDay();
  const plan = await previewDay({ store: app.store, data: app.data });
  const settings = { ...(await app.settings()) };
  const resumable = await canContinue({ store: app.store, data: app.data });
  const s = await saved(app);
  const checked = s.days.map((d) => d.day);
  const byId = new Map(s.progress.map((p) => [p.id, p]));
  const streak = currentStreak(checked, today, s.rewound);
  const v = todayView({
    plan, checkedDays: checked, today, settings, resumable, rewound: s.rewound,
    counters: todayCounters({ events: s.events, plan, day: today }),
    goals: nearest(goals({ data: app.data, progressById: byId, facts: s.facts, streak }), 2),
  });
  show(app.main,
    h('a', { class: 'streak', href: '#/checkin' }, h('span', { class: 'streak-n' }, v.streak), ' day streak'),
    h('div', { class: 'week' }, v.week.map((d) => h('span', {
      class: `day${d.checkedIn ? ' done' : ''}${d.isToday ? ' today' : ''}${d.future ? ' future' : ''}`,
    }, d.letter))),
    h('div', { class: 'today-top' },
      ringElement(v.ring, v.ringPct),
      h('div', { class: 'counts' },
        h('div', {}, h('b', {}, v.reviews), h('span', {}, 'reviews')),
        h('div', {}, h('b', {}, v.newWords), h('span', {}, 'new words')))),
    v.note ? h('p', { class: 'note' }, v.note) : null,
    h('p', { class: 'status' }, v.status),
    v.canStart ? h('button', {
      class: 'big start',
      onclick: async (e) => { e.target.disabled = true; await startSession(app); },
    }, v.startLabel) : null,
    h('h2', {}, 'Done today'),
    tilesElement(v.tiles),
    v.goals.length ? h('div', { class: 'goals' }, h('h2', {}, 'Next goals'), v.goals.map((g) => h('p', { class: 'goal' }, g))) : null);
}

export async function renderCheckin(app) {
  const today = app.lastResult?.day ?? studyDay();
  const events = await app.store.allEvents();
  const v = checkinView({
    result: app.lastResult, checkedDays: await checkedDays(app), today, themes: app.data.themes,
    counters: dayStats(events, today), bests: personalBests({ events, today }),
  });
  app.lastResult = null;
  show(app.main,
    h('h1', {}, v.title),
    v.streak !== null ? h('p', { class: 'streak' }, h('span', { class: 'streak-n' }, v.streak), ' day streak') : null,
    v.lines.map((line) => h('p', {}, line)),
    tilesElement(v.numbers),
    v.bests.map((b) => h('p', { class: 'best' }, b)),
    v.badges.length ? h('div', { class: 'new-badges' }, h('h2', {}, 'New badges'), v.badges.map((t) => h('p', { class: 'badge' }, t))) : null,
    h('h2', {}, v.monthTitle),
    h('table', { class: 'calendar' },
      h('tr', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('th', {}, d))),
      v.weeks.map((week) => h('tr', {}, week.map((c) => h('td', {
        class: c ? `${c.checkedIn ? 'done' : ''}${c.isToday ? ' today' : ''}` : '',
      }, c ? c.date : ''))))),
    h('a', { class: 'button big', href: '#/today' }, 'Back to Today'));
  if (v.confetti) burst(app.main);
```

In `docs/sw.js`, replace:

```js
  'js/ui/card.js',
  'js/ui/dom.js',
```

with:

```js
  'js/ui/card.js',
  'js/ui/confetti.js',
  'js/ui/dom.js',
```

- [ ] **Step 7: Run every test**

Run: `node --check docs/js/ui/screens.js && node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 299`, `ℹ pass 299`, `ℹ fail 0`.

- [ ] **Step 8: Commit**

```bash
git add docs/js/view/today.js docs/js/view/progress.js docs/js/view/format.js docs/js/ui/confetti.js docs/js/ui/screens.js docs/sw.js tests/js/view-today.test.mjs tests/js/view-progress.test.mjs tests/js/confetti.test.mjs && git commit -F - <<'EOF'
feat(today): the day's ring, four tiles and the nearest goals; check-in numbers, personal bests and confetti

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 12: The Stats screen in the spec's four sections (`statsView` in `docs/js/view/progress.js`)

The spec orders Stats in four sections:
1. This week and this month, with words learned, reviews, study days and minutes, a bar chart of the last 7 days and one of the last 30 days. The reviews due in the next 7 days and the 7-day accuracy, which the screen showed before, stay at the end of this section (choice 7).
2. All-time records, with the best streak, perfect days, reviews answered, words learned (of all words), words mastered, study days and minutes studied.
3. Progress per HSK level, as now.
4. Every goal countdown, nearest first.

Worked example (the test's data). Today is Tuesday 20 October. A word was learned on Monday 12 and Monday 19 October, both days checked in with every answer right, and today 2 reviews were answered 2 minutes apart, one of them wrong:

| Section | Shows |
|---|---|
| This week (19 to 25 October) | 1 words learned, 2 reviews, 2 study days, 2 minutes |
| October 2026 | 2 words learned, 2 reviews, 3 study days, 2 minutes |
| Last 7 days | bars for 14 to 20 October, labelled W T F S S M T; 19 October half height, 20 October full |
| All-time records | Best streak 1 day, Perfect days 2, Reviews answered 2, Words learned 2 of 61, Words mastered 1, Study days 3, Minutes studied 2 |

The old 30-day function `activity` in `stats.js` is replaced by `bars` and removed, with its test and its setting `statsDays.activity`.

**Files:**
- Modify: `docs/js/view/progress.js`, `docs/js/ui/screens.js`, `docs/js/stats.js`, `docs/js/config.js`
- Test: `tests/js/view-progress.test.mjs`, `tests/js/stats.test.mjs`

- [ ] **Step 1: Write the failing test, and drop the test of `activity`**

In `tests/js/view-progress.test.mjs`, replace:

```js
test('stats show totals, levels, 30 days, the forecast and accuracy', () => {
  const progressList = [at(t01[0].id, 1, TODAY), at(t01[1].id, 7, '2026-10-22')];
  const events = [
    { seq: 1, day: TODAY, kind: 'review', grade: 'right' },
    { seq: 2, day: TODAY, kind: 'review', grade: 'wrong' },
    { seq: 3, day: '2026-10-19', kind: 'final', grade: 'right', outcome: 'learned' },
  ];
  const v = statsView({ data, progressList, events, checkedDays: ['2026-10-19'], today: TODAY });
  assert.deepEqual([v.learned, v.mastered, v.total], [2, 1, 61]);
  assert.deepEqual(v.levels.map((l) => l.label), ['HSK 1', 'HSK 2']);
  assert.equal(v.levels[0].text, '2 of 47 learned, 1 mastered');
  assert.equal(v.activity.length, 30);
  assert.deepEqual(v.activity.slice(-2).map((r) => [r.day, r.reviews, r.learned, r.checkedIn, r.height]),
    [['2026-10-19', 0, 1, true, 0.5], ['2026-10-20', 2, 0, false, 1]]);
  assert.deepEqual(v.forecast.map((r) => [r.label, r.due]),
    [['Today', 1], ['Wed', 0], ['Thu', 1], ['Fri', 0], ['Sat', 0], ['Sun', 0], ['Mon', 0]]);
  assert.equal(v.accuracy, '50% right (1 of 2 reviews).');
  assert.equal(statsView({ data, progressList: [], events: [], checkedDays: [], today: TODAY }).accuracy, 'No reviews in the last 7 days.');
});
```

with:

```js
test('stats show this week and month, the all-time records, the levels and the goals', () => {
  // Today is Tuesday 20 October. A word was learned on Monday 12 and Monday 19 October, and two
  // reviews were answered today, 2 minutes apart, one of them wrong.
  const progressList = [at(t01[0].id, 1, TODAY), at(t01[1].id, 7, '2026-10-22')];
  const events = [
    { seq: 1, day: '2026-10-12', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-12T19:00:00Z' },
    { seq: 2, day: '2026-10-19', kind: 'final', grade: 'right', outcome: 'learned', ts: '2026-10-19T19:00:00Z' },
    { seq: 3, day: TODAY, kind: 'review', grade: 'right', ts: `${TODAY}T19:00:00Z` },
    { seq: 4, day: TODAY, kind: 'review', grade: 'wrong', ts: `${TODAY}T19:02:00Z` },
  ];
  const goals = [{ id: 'streak', text: '2 days to the 3-day badge', left: 2, share: 0.67 }];
  const v = statsView({ data, progressList, events, checkedDays: ['2026-10-12', '2026-10-19'], today: TODAY, goals });
  const tiles = (p) => [p.title, p.numbers.map((n) => `${n.value} ${n.label}`)];
  assert.deepEqual(v.periods.map(tiles), [
    ['This week', ['1 words learned', '2 reviews', '2 study days', '2 minutes']],
    ['October 2026', ['2 words learned', '2 reviews', '3 study days', '2 minutes']],
  ]);
  assert.deepEqual(v.bars7.map((r) => r.label), ['W', 'T', 'F', 'S', 'S', 'M', 'T']);
  assert.deepEqual(v.bars7.slice(-2).map((r) => [r.day, r.newWords, r.reviews, r.checkedIn, r.height]),
    [['2026-10-19', 1, 0, true, 0.5], ['2026-10-20', 0, 2, false, 1]]);
  assert.equal(v.bars30.length, 30);
  assert.deepEqual(v.forecast.map((r) => [r.label, r.due]),
    [['Today', 1], ['Wed', 0], ['Thu', 1], ['Fri', 0], ['Sat', 0], ['Sun', 0], ['Mon', 0]]);
  assert.equal(v.accuracy, '50% right (1 of 2 reviews).');
  assert.deepEqual(v.records.map((r) => `${r.label}: ${r.value}`), [
    'Best streak: 1 day', 'Perfect days: 2', 'Reviews answered: 2', 'Words learned: 2 of 61', 'Words mastered: 1',
    'Study days: 3', 'Minutes studied: 2',
  ]);
  assert.deepEqual(v.levels.map((l) => [l.label, l.text]), [['HSK 1', '2 of 47 learned, 1 mastered'], ['HSK 2', '0 of 14 learned, 0 mastered']]);
  assert.deepEqual(v.goals, ['2 days to the 3-day badge']);
  assert.equal(statsView({ data, progressList: [], events: [], checkedDays: [], today: TODAY }).accuracy, 'No reviews in the last 7 days.');
});
```

In `tests/js/stats.test.mjs`, replace:

```js
  ANSWER_KINDS, LEVEL_GROUPS, accuracy, activity, answerEvents, forecast, groupsDone, levelProgress, liveEvents, mapSections,
```

with:

```js
  ANSWER_KINDS, LEVEL_GROUPS, accuracy, answerEvents, forecast, groupsDone, levelProgress, liveEvents, mapSections,
```

In `tests/js/stats.test.mjs`, replace:

```js
test('30-day activity counts reviews and learned words per day', () => {
  const events = [
    { seq: 1, day: '2026-09-20', kind: 'review', grade: 'right' }, // 31 days ago, so left out
    { seq: 2, day: '2026-09-21', kind: 'review', grade: 'right' },
    { seq: 3, day: TODAY, kind: 'review', grade: 'right' },
    { seq: 4, day: TODAY, kind: 'reask', grade: 'know' },
    { seq: 5, day: TODAY, kind: 'final', grade: 'right', outcome: 'learned' },
  ];
  const rows = activity(events, [TODAY], TODAY);
  assert.equal(rows.length, 30);
  assert.deepEqual(rows[0], { day: '2026-09-21', reviews: 1, learned: 0, checkedIn: false });
  assert.deepEqual(rows[29], { day: TODAY, reviews: 1, learned: 1, checkedIn: true });
});

test('7-day forecast puts overdue words on today', () => {
```

with:

```js
test('7-day forecast puts overdue words on today', () => {
```

- [ ] **Step 2: Run them and see the Stats test fail**

Run: `node --test tests/js/view-progress.test.mjs tests/js/stats.test.mjs`
Expected: `ℹ fail 1`, the new Stats test, with `TypeError: Cannot read properties of undefined (reading 'map')` because `statsView` has no `periods` yet.

- [ ] **Step 3: Build the four sections**

In `docs/js/view/progress.js`, replace:

```js
import { monthCalendar } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { accuracy, activity, forecast, groupById, levelProgress, mapSections, totals, wordsOfGroup } from '../stats.js';
```

with:

```js
import { monthCalendar } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { accuracy, forecast, groupById, levelProgress, mapSections, wordsOfGroup } from '../stats.js';
import { allTime, bars, periodTotals, thisMonth, thisWeek } from '../counters.js';
```

In `docs/js/view/progress.js`, replace:

```js
import { WEEKDAY_SHORT, monthTitle, percent, plural } from './format.js';
```

with:

```js
import { WEEKDAY_LETTERS, WEEKDAY_SHORT, monthTitle, percent, plural } from './format.js';
```

In `docs/js/view/progress.js`, replace:

```js
// The Stats screen. events are the answers of the last 30 study days (store.eventsFrom).
export function statsView({ data, progressList, events, checkedDays, today }) {
  const byId = new Map(progressList.map((p) => [p.id, p]));
  const { learned, mastered } = totals(progressList);
  const rows = activity(events, checkedDays, today);
  const top = Math.max(1, ...rows.map((r) => r.reviews + r.learned));
  const acc = accuracy(events, today);
  return {
    learned,
    mastered,
    total: data.words.length,
    levels: levelProgress(data.words, byId).map((l) => ({
      label: `HSK ${l.lv}`,
      text: `${l.learned} of ${l.total} learned, ${l.mastered} mastered`,
      learnedPct: percent(l.learned / l.total),
      masteredPct: percent(l.mastered / l.total),
    })),
    activity: rows.map((r) => ({ ...r, height: (r.reviews + r.learned) / top })),
    forecast: forecast(progressList, today).map((r, i) => ({
      ...r, label: i === 0 ? 'Today' : WEEKDAY_SHORT[weekdayIndex(r.day)],
    })),
    accuracy: acc.rate === null
      ? 'No reviews in the last 7 days.'
      : `${percent(acc.rate)} right (${acc.right} of ${acc.answered} reviews).`,
  };
}
```

with:

```js
const grouped = (n) => Number(n).toLocaleString('en-US'); // 1234 gives '1,234'

// The four numbers of a week or month as tiles.
function periodTiles(t) {
  return [
    { label: 'words learned', value: grouped(t.newWords) },
    { label: 'reviews', value: grouped(t.reviews) },
    { label: 'study days', value: grouped(t.studyDays) },
    { label: 'minutes', value: grouped(Math.round(t.minutes)) },
  ];
}

// The Stats screen, in the four sections of the spec of 2026-10-03:
//   1. periods (this week, Monday to Sunday, and this calendar month), bars7 and bars30 (new words
//      and reviews per day), and the reviews due in the next 7 days and the 7-day accuracy that
//      the screen showed before
//   2. records, the all-time records
//   3. levels, the progress per HSK level
//   4. goals, every goal countdown nearest first (goals.js goals)
// events are all saved events, rewound the meta 'rewound' day ranges.
export function statsView({ data, progressList, events, checkedDays, today, rewound = [], goals = [] }) {
  const byId = new Map(progressList.map((p) => [p.id, p]));
  const week = thisWeek(today);
  const month = thisMonth(today);
  const all = allTime({ events, checkedDays, progress: progressList, rewound });
  const acc = accuracy(events, today);
  return {
    periods: [
      { title: 'This week', numbers: periodTiles(periodTotals(events, checkedDays, week.from, week.to)) },
      { title: monthTitle(today.slice(0, 7)), numbers: periodTiles(periodTotals(events, checkedDays, month.from, month.to)) },
    ],
    bars7: bars(events, checkedDays, today, 7).map((r) => ({ ...r, label: WEEKDAY_LETTERS[weekdayIndex(r.day)] })),
    bars30: bars(events, checkedDays, today, 30),
    forecast: forecast(progressList, today).map((r, i) => ({
      ...r, label: i === 0 ? 'Today' : WEEKDAY_SHORT[weekdayIndex(r.day)],
    })),
    accuracy: acc.rate === null
      ? 'No reviews in the last 7 days.'
      : `${percent(acc.rate)} right (${acc.right} of ${acc.answered} reviews).`,
    records: [
      { label: 'Best streak', value: plural(all.bestStreak, 'day') },
      { label: 'Perfect days', value: grouped(all.perfectDays) },
      { label: 'Reviews answered', value: grouped(all.reviews) },
      { label: 'Words learned', value: `${grouped(all.learned)} of ${grouped(data.words.length)}` },
      { label: 'Words mastered', value: grouped(all.mastered) },
      { label: 'Study days', value: grouped(all.studyDays) },
      { label: 'Minutes studied', value: grouped(Math.round(all.minutes)) },
    ],
    levels: levelProgress(data.words, byId).map((l) => ({
      label: `HSK ${l.lv}`,
      text: `${l.learned} of ${l.total} learned, ${l.mastered} mastered`,
      learnedPct: percent(l.learned / l.total),
      masteredPct: percent(l.mastered / l.total),
    })),
    goals: goals.map((g) => g.text),
  };
}
```

- [ ] **Step 4: Remove `activity`**

In `docs/js/stats.js`, replace:

```js
// Reviews answered and words learned on each of the last `days` study days, oldest first.
export function activity(events, checkedDays, today, days = CONFIG.statsDays.activity) {
  const checked = new Set(checkedDays);
  const rows = new Map(dayRange(addDays(today, -(days - 1)), days)
    .map((day) => [day, { day, reviews: 0, learned: 0, checkedIn: checked.has(day) }]));
  for (const e of liveEvents(events)) {
    const row = rows.get(e.day);
    if (!row) continue;
    if (e.kind === 'review') row.reviews += 1;
    if (e.outcome === 'learned') row.learned += 1;
  }
  return [...rows.values()];
}

// Reviews due on each of the next `days` days. Overdue words count on today.
```

with:

```js
// Reviews due on each of the next `days` days. Overdue words count on today.
```

In `docs/js/config.js`, replace:

```js
  statsDays: Object.freeze({ activity: 30, forecast: 7, accuracy: 7 }),
```

with:

```js
  statsDays: Object.freeze({ forecast: 7, accuracy: 7 }),
```

Run: `node --test tests/js/view-progress.test.mjs tests/js/stats.test.mjs`
Expected: `ℹ fail 0`.

- [ ] **Step 5: Draw the Stats screen**

In `docs/js/ui/screens.js`, replace:

```js
import { studyDay, addDays } from '../dates.js';
```

with:

```js
import { studyDay } from '../dates.js';
```

In `docs/js/ui/screens.js`, replace:

```js
export async function renderStats(app) {
  const today = studyDay();
  const v = statsView({
    data: app.data,
    progressList: await app.store.allProgress(),
    events: await app.store.eventsFrom(addDays(today, -29)),
    checkedDays: await checkedDays(app),
    today,
  });
  show(app.main, h('h1', {}, 'Stats'),
    h('div', { class: 'counts' },
      h('div', {}, h('b', {}, v.learned), h('span', {}, 'learned')),
      h('div', {}, h('b', {}, v.mastered), h('span', {}, 'mastered')),
      h('div', {}, h('b', {}, v.total), h('span', {}, 'words in all'))),
    h('h2', {}, 'HSK levels'),
    v.levels.map((l) => h('div', { class: 'level' }, h('span', {}, l.label),
      h('span', { class: 'bar' }, h('span', { class: 'bar-learned', style: `width:${l.learnedPct}` }),
        h('span', { class: 'bar-mastered', style: `width:${l.masteredPct}` })),
      h('span', { class: 'muted' }, l.text))),
    h('h2', {}, 'Last 30 days'),
    h('div', { class: 'chart' }, v.activity.map((r) => h('span', {
      class: `col${r.checkedIn ? ' done' : ''}`,
      title: `${shortDate(r.day)}: ${r.reviews} reviews, ${r.learned} learned`,
      style: `height:${Math.round(r.height * 100)}%`,
    }))),
    h('h2', {}, 'Reviews due in the next 7 days'),
    h('table', { class: 'forecast' },
      h('tr', {}, v.forecast.map((r) => h('th', {}, r.label))),
      h('tr', {}, v.forecast.map((r) => h('td', {}, r.due)))),
    h('h2', {}, 'Accuracy, last 7 days'),
    h('p', {}, v.accuracy));
```

with:

```js
// A bar chart of new words and reviews per day. A checked-in day's bar has the main colour.
function chartElement(rows, withLabels) {
  return [
    h('div', { class: 'chart' }, rows.map((r) => h('span', {
      class: `col${r.checkedIn ? ' done' : ''}`,
      title: `${shortDate(r.day)}: ${r.newWords} new words, ${r.reviews} reviews`,
      style: `height:${Math.round(r.height * 100)}%`,
    }))),
    withLabels ? h('div', { class: 'chart-labels' }, rows.map((r) => h('span', {}, r.label))) : null,
  ];
}

// Stats in the four sections of the spec of 2026-10-03 (statsView in view/progress.js).
export async function renderStats(app) {
  const today = studyDay();
  const s = await saved(app);
  const checked = s.days.map((d) => d.day);
  const streak = currentStreak(checked, today, s.rewound);
  const byId = new Map(s.progress.map((p) => [p.id, p]));
  const v = statsView({
    data: app.data, progressList: s.progress, events: s.events, checkedDays: checked, today, rewound: s.rewound,
    goals: goals({ data: app.data, progressById: byId, facts: s.facts, streak }),
  });
  show(app.main, h('h1', {}, 'Stats'),
    h('h2', {}, 'This week and this month'),
    v.periods.map((p) => [h('h3', {}, p.title), tilesElement(p.numbers)]),
    h('h3', {}, 'New words and reviews, last 7 days'),
    chartElement(v.bars7, true),
    h('h3', {}, 'Last 30 days'),
    chartElement(v.bars30, false),
    h('h3', {}, 'Reviews due in the next 7 days'),
    h('table', { class: 'forecast' },
      h('tr', {}, v.forecast.map((r) => h('th', {}, r.label))),
      h('tr', {}, v.forecast.map((r) => h('td', {}, r.due)))),
    h('h3', {}, 'Accuracy, last 7 days'),
    h('p', {}, v.accuracy),
    h('h2', {}, 'All-time records'),
    h('dl', { class: 'records' }, v.records.map((r) => h('div', {}, h('dt', {}, r.label), h('dd', {}, r.value)))),
    h('h2', {}, 'HSK levels'),
    v.levels.map((l) => h('div', { class: 'level' }, h('span', {}, l.label),
      h('span', { class: 'bar' }, h('span', { class: 'bar-learned', style: `width:${l.learnedPct}` }),
        h('span', { class: 'bar-mastered', style: `width:${l.masteredPct}` })),
      h('span', { class: 'muted' }, l.text))),
    h('h2', {}, 'Goals'),
    v.goals.length ? v.goals.map((g) => h('p', { class: 'goal' }, g)) : h('p', { class: 'muted' }, 'Every goal is reached.'));
```

- [ ] **Step 6: Run every test**

Run: `node --check docs/js/ui/screens.js && node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 298`, `ℹ pass 298`, `ℹ fail 0` (one test fewer, the removed `activity` test).

- [ ] **Step 7: Commit**

```bash
git add docs/js/view/progress.js docs/js/ui/screens.js docs/js/stats.js docs/js/config.js tests/js/view-progress.test.mjs tests/js/stats.test.mjs && git commit -F - <<'EOF'
feat(stats): this week and month, all-time records, HSK levels and goals, in the spec's four sections

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 13: "Go back to a day" and "Reset everything" in Settings (`docs/js/ui/rewind.js`, `docs/js/ui/settings.js`)

Settings gets a section "Go back or start again" with two buttons, as the spec asks.

**Go back to a day** opens a calendar screen at `#/rewind` (choice 11). It shows the month of the newest day that can be chosen, with Earlier and Later buttons that skip to the months that have such days. Only those days are buttons. Tapping one shows the confirmation in the page (choice 12), for example `Undo 3 days: 36 new words and 120 reviews. Your streak becomes 5 days.`, with three buttons: "Save a backup file first" (the existing backup file download), "Go back to Fri 2 Oct", and "Cancel". After going back, the screen emits the `rewound` hook (Task 10), shows "Gone back to Fri 2 Oct." for 4 seconds and opens Today.

**Reset everything** shows its confirmation in the page, which says what is deleted and what stays, with "Save a backup file first", "Yes, reset everything" and "Cancel". After the reset it emits `rewound` too and opens Today.

The calendar's logic is a pure view, `rewindCalendar`, which Node tests. For example, with the days 29 and 30 September and 1 and 2 October to choose from on 5 October, it opens on October 2026, where 1 and 2 October are buttons, with an Earlier button to September and no Later button.

**Files:**
- Create: `docs/js/view/rewind.js`, `docs/js/ui/rewind.js`
- Modify: `docs/js/view/route.js`, `docs/js/ui/settings.js`, `docs/js/app.js`, `docs/sw.js`
- Test: `tests/js/view-rewind.test.mjs`, `tests/js/view-misc.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/js/view-rewind.test.mjs`:

```js
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
```

In `tests/js/view-misc.test.mjs`, replace:

```js
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today' });
```

with:

```js
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today' });
  assert.deepEqual(parseRoute('#/rewind'), { name: 'rewind' }); // "Go back to a day", opened from Settings
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/view-rewind.test.mjs tests/js/view-misc.test.mjs`
Expected: `ℹ fail 2`. The calendar test file stops with `ERR_MODULE_NOT_FOUND`, and the route test gets `{ name: 'today' }` for `#/rewind`.

- [ ] **Step 3: The calendar view and the route**

Create `docs/js/view/rewind.js`:

```js
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
```

In `docs/js/view/route.js`, replace:

```js
const SIMPLE = new Set(['today', 'session', 'checkin', 'map', 'stats', 'badges', 'settings']);
```

with:

```js
const SIMPLE = new Set(['today', 'session', 'checkin', 'map', 'stats', 'badges', 'settings', 'rewind']);
```

Run: `node --test tests/js/view-rewind.test.mjs tests/js/view-misc.test.mjs`
Expected: `ℹ fail 0`.

- [ ] **Step 4: The "Go back to a day" screen**

Create `docs/js/ui/rewind.js`:

```js
// The "Go back to a day" screen ('#/rewind'), opened from Settings. The learner taps a day in the
// calendar, reads what will be undone, and confirms. The backup file can be saved first. After
// going back, the 'rewound' hook lets the Google Sheet backup replace the Sheet's copy.
import { studyDay } from '../dates.js';
import { confirmText, rewindChoices, rewindPlan, rewindTo } from '../rewind.js';
import { rewindCalendar, startMonth } from '../view/rewind.js';
import { shortDate } from '../view/format.js';
import { saveBackupFile } from './settings.js';
import { h, show } from './dom.js';

export async function renderRewind(app) {
  const today = studyDay();
  const [events, days, badges, rewound] = await Promise.all([
    app.store.allEvents(), app.store.allDays(), app.store.getMeta('badges'), app.store.getMeta('rewound'),
  ]);
  const choices = rewindChoices({ events, days, today });
  const back = h('a', { class: 'button big', href: '#/settings' }, 'Back to Settings');
  if (!choices.length) {
    show(app.main, h('h1', {}, 'Go back to a day'), h('p', {}, 'There is no earlier study day to go back to yet.'), back);
    return;
  }
  let month = startMonth(choices, today);
  const area = h('div', {});

  // The confirmation for one day, with what going back undoes.
  function ask(day) {
    const plan = rewindPlan({ events, days, badges: badges ?? {}, rewound: rewound ?? [], toDay: day, today });
    area.replaceChildren(
      h('h2', {}, `Go back to ${shortDate(day)}?`),
      h('p', { class: 'confirm-text' }, confirmText(plan)),
      h('button', { class: 'small', onclick: () => saveBackupFile(app) }, 'Save a backup file first'),
      h('button', {
        class: 'big danger',
        onclick: async (e) => {
          e.target.disabled = true;
          await rewindTo({ store: app.store, toDay: day });
          await app.hooks.emit('rewound', { store: app.store });
          app.note(`Gone back to ${shortDate(day)}.`);
          window.location.hash = '#/today';
        },
      }, `Go back to ${shortDate(day)}`),
      h('button', { class: 'small', onclick: draw }, 'Cancel'));
  }

  // The calendar of one month, where only the days that can be chosen are buttons.
  function draw() {
    const v = rewindCalendar({ choices, month, today });
    area.replaceChildren(
      h('div', { class: 'month-nav' },
        h('button', { class: 'small', disabled: !v.prev, onclick: () => { month = v.prev; draw(); } }, 'Earlier'),
        h('h2', {}, v.title),
        h('button', { class: 'small', disabled: !v.next, onclick: () => { month = v.next; draw(); } }, 'Later')),
      h('table', { class: 'calendar rewind' },
        h('tr', {}, ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => h('th', {}, d))),
        v.weeks.map((week) => h('tr', {}, week.map((c) => h('td', { class: c?.isToday ? 'today' : '' },
          c?.choosable ? h('button', { class: 'day-pick', onclick: () => ask(c.day) }, c.date) : (c ? c.date : '')))))));
  }

  show(app.main, h('h1', {}, 'Go back to a day'),
    h('p', {}, 'Tap a day. Everything after it is undone: answers, check-ins and badges. The settings stay.'),
    area, back);
  draw();
}
```

- [ ] **Step 5: The two Settings buttons**

In `docs/js/ui/settings.js`, replace:

```js
// The Settings screen: daily amounts, auto-play, backup file and restore, saved storage,
// "Download all audio", the Google Sheet section that Plan 5 adds through hooks, and credits.
import { RELEASE, WORDS_FILE } from '../release.js';
import { studyDay } from '../dates.js';
import { askPersistentStorage } from '../store.js';
```

with:

```js
// The Settings screen: daily amounts, auto-play, backup file and restore, saved storage,
// "Download all audio", going back to a day and resetting, the Google Sheet section that Plan 5
// adds through hooks, and credits.
import { RELEASE, WORDS_FILE } from '../release.js';
import { studyDay } from '../dates.js';
import { askPersistentStorage } from '../store.js';
import { resetAll } from '../rewind.js';
```

In `docs/js/ui/settings.js`, replace:

```js
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
```

with:

```js
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// "Download backup file", also offered before going back to a day and before a reset.
export async function saveBackupFile(app) {
  download(backupFileName(studyDay()), backupText(await app.store.dump(), { release: RELEASE }));
}

// The confirmation of "Reset everything", drawn in the page, which offers the backup file first.
function resetPanel(app, area) {
  area.replaceChildren(
    h('p', { class: 'confirm-text' }, 'This deletes all progress on this phone: every learned word, answer, check-in, '
      + 'badge and the streak. The daily amounts, auto-play and the Google Sheet address stay. If the Google Sheet '
      + 'backup is set up, the Sheet is replaced by the empty progress too.'),
    h('button', { class: 'small', onclick: () => saveBackupFile(app) }, 'Save a backup file first'),
    h('button', {
      class: 'big danger',
      onclick: async (e) => {
        e.target.disabled = true;
        await resetAll({ store: app.store });
        await app.hooks.emit('rewound', { store: app.store });
        app.note('Everything was reset.');
        window.location.hash = '#/today';
      },
    }, 'Yes, reset everything'),
    h('button', { class: 'small', onclick: () => area.replaceChildren() }, 'Cancel'));
}
```

In `docs/js/ui/settings.js`, replace:

```js
    h('button', {
      class: 'small',
      onclick: async () => download(backupFileName(studyDay()), backupText(await app.store.dump(), { release: RELEASE })),
    }, 'Download backup file'),
    h('label', { class: 'field' }, 'Restore from a backup file', fileInput),
    pluginArea,
```

with:

```js
    h('button', { class: 'small', onclick: () => saveBackupFile(app) }, 'Download backup file'),
    h('label', { class: 'field' }, 'Restore from a backup file', fileInput),
    h('h2', {}, 'Go back or start again'),
    h('p', { class: 'muted' }, 'Going back to a day undoes everything after it. Resetting deletes all progress.'),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => { window.location.hash = '#/rewind'; } }, 'Go back to a day'),
      h('button', { class: 'small', onclick: () => resetPanel(app, resetArea) }, 'Reset everything')),
    resetArea,
    pluginArea,
```

In `docs/js/ui/settings.js`, replace:

```js
  const pluginArea = h('div', {});
```

with:

```js
  const pluginArea = h('div', {});
  const resetArea = h('div', { class: 'confirm' });
```

- [ ] **Step 6: Open the screen from its address**

In `docs/js/app.js`, replace:

```js
import { renderSettings } from './ui/settings.js';
```

with:

```js
import { renderSettings } from './ui/settings.js';
import { renderRewind } from './ui/rewind.js';
```

In `docs/js/app.js`, replace:

```js
      case 'settings': await renderSettings(app); break;
```

with:

```js
      case 'settings': await renderSettings(app); break;
      case 'rewind': await renderRewind(app); break;
```

- [ ] **Step 7: Save the new files for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/ui/dom.js',
  'js/ui/screens.js',
```

with:

```js
  'js/ui/dom.js',
  'js/ui/rewind.js',
  'js/ui/screens.js',
```

In `docs/sw.js`, replace:

```js
  'js/view/quiz.js',
  'js/view/route.js',
```

with:

```js
  'js/view/quiz.js',
  'js/view/rewind.js',
  'js/view/route.js',
```

Run: `node --check docs/js/ui/rewind.js && node --check docs/js/ui/settings.js && node --check docs/js/app.js && node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 300`, `ℹ pass 300`, `ℹ fail 0`.

- [ ] **Step 8: Commit**

```bash
git add docs/js/view/rewind.js docs/js/ui/rewind.js docs/js/view/route.js docs/js/ui/settings.js docs/js/app.js docs/sw.js tests/js/view-rewind.test.mjs tests/js/view-misc.test.mjs && git commit -F - <<'EOF'
feat(settings): "Go back to a day" with its calendar and "Reset everything", each offering the backup file first

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 14: The bright look (`docs/css/app.css`, theme colours)

The spec's section 4, in practice:
- **Always light.** The `prefers-color-scheme: dark` block and `color-scheme: light dark` go. The page is white (`--bg: #ffffff`) with dark text (`#1d1b1a`), also when the phone is in dark mode.
- **One cheerful main colour,** the warm orange-red `#d63c1f`, for buttons, the streak, the ring and checked-in days. It is also the `theme-color` of the page and of the installed app.
- **A colour per theme.** The 30 themes take the six colours in turn by their order (theme 1 orange, theme 2 yellow, ..., theme 6 pink, theme 7 orange again). The colour is the band at the top of each map tile and each word card, set as the CSS variable `--theme`.
- **Shapes.** Rounded cards with soft shadows, large rounded buttons, and every button and bottom-bar tab at least 48 pixels high (`min-height: 3rem`, with the root font size of 16 pixels).
- **Feedback.** The right-answer banner bounces and the wrong-answer banner shakes, new badges and personal bests pop up, and the ring fills in 0.8 seconds.
- **Reduced motion.** When the phone asks for it, one rule switches off every animation and transition, and the confetti module makes no pieces (Task 11).
- **Unchanged.** The order of the screens, the bottom bar, the quizzes and the cards stay as they are.

**Files:**
- Modify: `docs/css/app.css`, `docs/index.html`, `docs/manifest.webmanifest`, `docs/js/view/format.js`, `docs/js/view/card.js`, `docs/js/ui/card.js`, `docs/js/view/progress.js`, `docs/js/ui/screens.js`
- Test: `tests/js/look.test.mjs`, `tests/js/view-card.test.mjs`, `tests/js/view-progress.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/js/look.test.mjs`:

```js
// The bright look (spec of 2026-10-03, section 4), checked in the files the browser reads. The
// browser check `node tests/browser/check.mjs look` checks the same in Chrome.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../../docs/${path}`, import.meta.url), 'utf8');
const css = read('css/app.css');

test('the app is always light, also when the phone is in dark mode', () => {
  assert.doesNotMatch(css, /prefers-color-scheme/);
  assert.match(css, /color-scheme: light;/);
  assert.match(css, /--bg: #ffffff;/);
  assert.match(css, /body \{[^}]*background: var\(--bg\);/);
});

test('all motion stops when the phone asks for reduced motion', () => {
  const at = css.indexOf('@media (prefers-reduced-motion: reduce)');
  assert.ok(at >= 0, 'no reduced-motion block');
  const block = css.slice(at);
  assert.match(block, /animation: none !important;/);
  assert.match(block, /transition: none !important;/);
});

test('buttons and the bottom bar are at least 48 pixels high', () => {
  assert.match(css, /button, \.button \{[^}]*min-height: 3rem;/);
  assert.match(css, /button\.small \{[^}]*min-height: 3rem;/);
  assert.match(css, /nav a \{[^}]*min-height: 3rem;/);
});

test('the page and the installed app use the warm orange-red main colour', () => {
  const accent = css.match(/--accent: (#[0-9a-f]{6});/)[1];
  assert.equal(accent, '#d63c1f');
  assert.match(read('index.html'), new RegExp(`<meta name="theme-color" content="${accent}">`));
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.deepEqual([manifest.theme_color, manifest.background_color], [accent, '#ffffff']);
});
```

In `tests/js/view-card.test.mjs`, replace:

```js
import { monthTitle, percent, plural, posText, shortDate } from '../../docs/js/view/format.js';
```

with:

```js
import { THEME_COLORS, monthTitle, percent, plural, posText, shortDate, themeColor } from '../../docs/js/view/format.js';
```

In `tests/js/view-card.test.mjs`, replace:

```js
test('a new word\'s card plays the word twice, the card after an answer plays it once', () => {
```

with:

```js
test('a card has the colour of its theme, for the band at its top', () => {
  // 苹果 is in Food & Drink, the fixture's 5th theme, so it gets the 5th colour.
  assert.equal(learningCard(word(data, '苹果'), { themes: data.themes }).color, THEME_COLORS[4]);
  assert.equal(learningCard(word(data, '苹果')).color, THEME_COLORS[0]); // without the theme list
});

test('the themes take the six colours in turn', () => {
  const themes = Array.from({ length: 30 }, (_, i) => ({ id: `t${String(i + 1).padStart(2, '0')}`, order: i + 1 }));
  assert.equal(THEME_COLORS.length, 6);
  assert.equal(themeColor('t01', themes), THEME_COLORS[0]);
  assert.equal(themeColor('t06', themes), THEME_COLORS[5]);
  assert.equal(themeColor('t07', themes), THEME_COLORS[0]);
  assert.equal(themeColor('t30', themes), THEME_COLORS[5]);
  assert.equal(themeColor('t99', themes), THEME_COLORS[0]);
});

test('a new word\'s card plays the word twice, the card after an answer plays it once', () => {
```

In `tests/js/view-progress.test.mjs`, replace:

```js
import { badgeFacts } from '../../docs/js/badges.js';
```

with:

```js
import { badgeFacts } from '../../docs/js/badges.js';
import { THEME_COLORS } from '../../docs/js/view/format.js';
```

In `tests/js/view-progress.test.mjs`, replace:

```js
  assert.deepEqual(tiles.map((t) => t.href).slice(0, 2), ['#/theme/t01/1-2', '#/theme/t02/1-2']);
```

with:

```js
  assert.deepEqual(tiles.map((t) => t.href).slice(0, 2), ['#/theme/t01/1-2', '#/theme/t02/1-2']);
  assert.deepEqual(tiles.map((t) => t.color), THEME_COLORS.slice(0, 5)); // each theme in its colour
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/look.test.mjs tests/js/view-card.test.mjs tests/js/view-progress.test.mjs`
Expected: `ℹ fail 6`. The four look tests fail on the old stylesheet (it still has `prefers-color-scheme`) and the old `theme-color`, the card test file stops with `does not provide an export named 'themeColor'`, and the map test gets no tile colours.

- [ ] **Step 3: The theme colour of a theme, a card and a tile**

In `docs/js/view/format.js`, replace:

```js
export const THEME_COLORS = Object.freeze(['#ff6b35', '#ffb703', '#38b000', '#3a86ff', '#8338ec', '#ff006e']);
```

with:

```js
export const THEME_COLORS = Object.freeze(['#ff6b35', '#ffb703', '#38b000', '#3a86ff', '#8338ec', '#ff006e']);

// A theme's colour, for its map tiles and the band at the top of its cards. The themes take the
// six colours in turn by their order, so themes 1, 7, 13, 19 and 25 are orange and theme 6 is
// pink. themes is the words file's theme list. An unknown theme gets the first colour.
export function themeColor(themeId, themes = []) {
  const order = themes.find((t) => t.id === themeId)?.order ?? 1;
  return THEME_COLORS[(order - 1) % THEME_COLORS.length];
}
```

In `docs/js/view/card.js`, replace:

```js
import { posText } from './format.js';
```

with:

```js
import { posText, themeColor } from './format.js';
```

In `docs/js/view/card.js`, replace:

```js
// Everything the learning card shows for one word of the words file.
// learningCard(apple).plays is 2, learningCard(apple, { afterAnswer: true }).plays is 1.
export function learningCard(word, { afterAnswer = false } = {}) {
  return {
    id: word.id,
```

with:

```js
// Everything the learning card shows for one word of the words file.
// learningCard(apple).plays is 2, learningCard(apple, { afterAnswer: true }).plays is 1.
// color is the colour of the word's theme (themeColor), for the band at the top of the card.
export function learningCard(word, { afterAnswer = false, themes = [] } = {}) {
  return {
    id: word.id,
    color: themeColor(word.theme, themes),
```

In `docs/js/ui/card.js`, replace:

```js
  const c = learningCard(word, { afterAnswer });
```

with:

```js
  const c = learningCard(word, { afterAnswer, themes: app.data.themes });
```

In `docs/js/ui/card.js`, replace:

```js
  const el = h('section', { class: 'card' },
```

with:

```js
  const el = h('section', { class: 'card', style: `--theme:${c.color}` },
```

In `docs/js/view/progress.js`, replace:

```js
import { WEEKDAY_LETTERS, WEEKDAY_SHORT, monthTitle, percent, plural } from './format.js';
```

with:

```js
import { WEEKDAY_LETTERS, WEEKDAY_SHORT, monthTitle, percent, plural, themeColor } from './format.js';
```

In `docs/js/view/progress.js`, replace:

```js
// learned share, for example '40%', where the other tiles show Done, Now or Locked.
export function mapView(data, progressById) {
```

with:

```js
// learned share, for example '40%', where the other tiles show Done, Now or Locked. A tile has
// the colour of its theme (themeColor in format.js).
export function mapView(data, progressById) {
```

In `docs/js/view/progress.js`, replace:

```js
      name: t.name,
      href: hrefOf({ name: 'theme', id: t.id, group: s.id }),
```

with:

```js
      name: t.name,
      color: themeColor(t.id, data.themes),
      href: hrefOf({ name: 'theme', id: t.id, group: s.id }),
```

In `docs/js/ui/screens.js`, replace:

```js
      h('div', { class: 'tiles' }, s.tiles.map((t) => h('a', { class: `tile ${t.status}`, href: t.href },
```

with:

```js
      h('div', { class: 'tiles' }, s.tiles.map((t) => h('a', { class: `tile ${t.status}`, href: t.href, style: `--theme:${t.color}` },
```

- [ ] **Step 4: The stylesheet, the page and the manifest**

Replace the whole of `docs/css/app.css` with:

```css
/* HSK Flashcards. Phone first, with one column, large tap targets, and a bright, playful look that
   is always light, also when the phone is in dark mode (spec of 2026-10-03, section 4). */
:root {
  --bg: #ffffff; --fg: #1d1b1a; --muted: #6b6560; --card: #ffffff; --line: #ece6e0; --soft: #fff3ee;
  --accent: #d63c1f; --right: #1e7b34; --wrong: #c62828; --learned: #ffb703; --mastered: #1e7b34;
  --shadow: 0 2px 10px rgba(29, 27, 26, 0.08);
  --theme: var(--accent);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
  color-scheme: light;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-size: 18px; line-height: 1.4; }
main { max-width: 34rem; margin: 0 auto; padding: 1rem 1rem 6rem; }
h1 { font-size: 1.6rem; margin: 0.5rem 0 1rem; }
h2 { font-size: 1.15rem; margin: 1.5rem 0 0.5rem; }
h3 { font-size: 1rem; margin: 1rem 0 0.4rem; color: var(--muted); }
a { color: var(--accent); }
main > a:not(.button) { display: inline-block; padding: 0.75rem 0; }
.muted { color: var(--muted); }
button, .button {
  font: inherit; border: 2px solid var(--line); background: var(--card); color: var(--fg);
  border-radius: 1rem; padding: 0.6rem 1rem; min-height: 3rem; cursor: pointer; text-decoration: none;
  display: inline-block; text-align: center; box-shadow: var(--shadow);
  transition: transform 0.12s ease-out;
}
button:active:not(:disabled) { transform: scale(0.97); }
button:disabled { opacity: 0.4; }
button.big, .button.big {
  display: block; width: 100%; margin: 1rem 0; font-size: 1.2rem; font-weight: 700;
  background: var(--accent); color: #fff; border: none; border-radius: 1.5rem; min-height: 3.5rem;
}
button.small { min-height: 3rem; margin: 0.25rem 0.25rem 0.25rem 0; }
button.danger { background: var(--wrong); }
.row { display: flex; flex-wrap: wrap; gap: 0.25rem; }

/* Today */
.streak { display: block; font-size: 1.2rem; text-decoration: none; color: var(--fg); margin: 0.5rem 0; }
.streak-n { font-size: 3rem; font-weight: 800; color: var(--accent); margin-right: 0.25rem; }
.week { display: flex; gap: 0.4rem; margin: 0.5rem 0 1rem; }
.week .day { flex: 1; text-align: center; padding: 0.5rem 0; border-radius: 0.75rem; background: var(--soft); font-weight: 600; }
.week .day.done { background: var(--accent); color: #fff; }
.week .day.today { outline: 3px solid var(--accent); outline-offset: -3px; }
.week .day.future { opacity: 0.5; }
.today-top { display: flex; align-items: center; gap: 1rem; }
.today-top .counts { flex: 1; flex-direction: column; margin: 0; gap: 0.5rem; }
.ring-box { position: relative; width: 7.5rem; height: 7.5rem; flex: none; }
.ring { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring-track { fill: none; stroke: var(--soft); stroke-width: 12; }
.ring-fill { fill: none; stroke: var(--accent); stroke-width: 12; stroke-linecap: round; transition: stroke-dashoffset 0.8s ease-out; }
.ring-label { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; font-weight: 800; }
.counts { display: flex; gap: 1rem; margin: 1rem 0; }
.counts div { flex: 1; background: var(--card); border-radius: 1rem; padding: 0.6rem; text-align: center; box-shadow: var(--shadow); }
.counts b { display: block; font-size: 1.8rem; }
.tiles4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.5rem; margin: 0.5rem 0; }
.tile4 { background: var(--soft); border-radius: 1rem; padding: 0.6rem 0.25rem; text-align: center; }
.tile4 b { display: block; font-size: 1.4rem; color: var(--accent); }
.tile4 span { font-size: 0.8rem; color: var(--muted); }
.goal { background: var(--card); border-left: 6px solid var(--learned); border-radius: 0.75rem; padding: 0.6rem 0.8rem; margin: 0.4rem 0; box-shadow: var(--shadow); }
.note { background: var(--soft); border-left: 6px solid var(--learned); border-radius: 0.75rem; padding: 0.6rem 0.8rem; }
.best { font-weight: 700; color: var(--accent); animation: pop 0.5s ease-out both; }

/* Session and learning card */
.session-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.heading { color: var(--muted); margin: 0.25rem 0; }
.card { background: var(--card); border-radius: 1.25rem; padding: 1rem; margin: 0.5rem 0; box-shadow: var(--shadow); border-top: 8px solid var(--theme); }
.hz { font-size: 3.5rem; line-height: 1.2; text-align: center; }
.big-hz { font-size: 4rem; margin: 1rem 0 0.5rem; }
.py { font-size: 1.6rem; text-align: center; color: var(--accent); }
.pos { text-align: center; color: var(--muted); font-style: italic; }
.en { font-size: 1.2rem; text-align: center; margin: 0.5rem 0; }
.example { border-top: 1px solid var(--line); margin-top: 1rem; padding-top: 0.75rem; }
.ex-hz { font-size: 1.4rem; }
.ex-hz mark { background: none; color: var(--accent); font-weight: 700; }
.ex-py { color: var(--muted); }
.strokes { display: flex; flex-wrap: wrap; gap: 0.5rem; justify-content: center; margin: 0.5rem 0; }
.stroke-box { border: 1px dashed var(--line); border-radius: 0.5rem; }
.prompt { text-align: center; font-weight: 600; margin: 1rem 0 0.5rem; }
.choices { display: grid; gap: 0.6rem; }
.choice { width: 100%; font-size: 1.15rem; text-align: left; }
.grades { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; }
.grades button.big { margin: 0.5rem 0; font-size: 1rem; padding: 0.5rem; }
.grade-know { background: var(--right) !important; }
.grade-unsure { background: #b7791f !important; }
.banner { padding: 0.75rem 1rem; border-radius: 1rem; color: #fff; font-weight: 700; }
.banner.right { background: var(--right); animation: bounce 0.4s ease-out; }
.banner.wrong { background: var(--wrong); animation: shake 0.4s ease-out; }

/* Check-in, calendar and badges */
.calendar { width: 100%; border-collapse: separate; border-spacing: 0.2rem; text-align: center; }
.calendar td, .calendar th { padding: 0.4rem 0; border-radius: 0.6rem; }
.calendar td.done { background: var(--accent); color: #fff; font-weight: 700; }
.calendar td.today { outline: 3px solid var(--accent); outline-offset: -3px; }
.calendar.rewind td { padding: 0; }
.day-pick { width: 100%; min-height: 3rem; padding: 0; margin: 0; background: var(--soft); border-color: var(--accent); font-weight: 700; }
.month-nav { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }
.month-nav h2 { margin: 0; }
.confirm-text { background: var(--soft); border-radius: 1rem; padding: 0.75rem 1rem; font-weight: 600; }
.badge { background: var(--card); border-radius: 1rem; padding: 0.6rem 0.8rem; margin: 0.4rem 0; box-shadow: var(--shadow); border-left: 6px solid var(--accent); }
.badge.locked { display: flex; flex-direction: column; gap: 0.3rem; opacity: 0.7; border-left-color: var(--line); filter: grayscale(1); }
.badge-title { font-weight: 600; }
.new-badges .badge { animation: pop 0.5s ease-out both; }
.new-badges .badge:nth-of-type(2) { animation-delay: 0.15s; }
.new-badges .badge:nth-of-type(3) { animation-delay: 0.3s; }
.confetti { position: fixed; left: 50%; top: 40%; width: 0; height: 0; pointer-events: none; z-index: 30; }
.confetti-piece { position: absolute; width: 0.6rem; height: 0.9rem; border-radius: 0.15rem; }

/* Progress map, word lists and stats */
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.group-section { margin-bottom: 1.2rem; }
.group-status, .group-counts { font-size: 0.8rem; color: var(--muted); }
.group-section.done h2 { color: var(--mastered); }
.tile { display: flex; flex-direction: column; gap: 0.25rem; background: var(--card); border-radius: 1rem; padding: 0.6rem; color: var(--fg); text-decoration: none; box-shadow: var(--shadow); border-top: 8px solid var(--theme); }
.tile.current { outline: 3px solid var(--accent); }
.tile.locked { opacity: 0.55; }
.tile-status, .tile-counts { font-size: 0.8rem; color: var(--muted); }
.tile-name { font-weight: 700; }
.bar { position: relative; display: block; height: 0.6rem; background: var(--soft); border-radius: 0.3rem; overflow: hidden; }
.bar-learned, .bar-mastered { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 0.3rem; }
.bar-learned { background: var(--learned); }
.bar-mastered { background: var(--mastered); }
.words { list-style: none; padding: 0; }
.words a { display: grid; grid-template-columns: 4.5rem 1fr; gap: 0 0.5rem; padding: 0.5rem 0; min-height: 3rem; border-bottom: 1px solid var(--line); color: var(--fg); text-decoration: none; }
.w-hz { font-size: 1.5rem; grid-row: span 2; }
.w-status { font-size: 0.8rem; color: var(--muted); }
.level { margin: 0.5rem 0; }
.chart { display: flex; align-items: flex-end; gap: 3px; height: 6rem; border-bottom: 2px solid var(--line); }
.chart .col { flex: 1; background: var(--learned); min-height: 2px; border-radius: 0.3rem 0.3rem 0 0; }
.chart .col.done { background: var(--accent); }
.chart-labels { display: flex; gap: 3px; }
.chart-labels span { flex: 1; text-align: center; font-size: 0.8rem; color: var(--muted); }
.records { display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin: 0.5rem 0; }
.records div { background: var(--soft); border-radius: 1rem; padding: 0.6rem 0.8rem; }
.records dt { font-size: 0.8rem; color: var(--muted); }
.records dd { margin: 0; font-size: 1.2rem; font-weight: 700; }
.forecast { width: 100%; text-align: center; }
.field { display: block; margin: 0.75rem 0; }
.field input[type=number] { display: block; font: inherit; padding: 0.5rem; width: 8rem; min-height: 3rem; margin-top: 0.25rem; border: 2px solid var(--line); border-radius: 0.75rem; }
.field.check input { width: 1.6rem; height: 1.6rem; vertical-align: middle; }

/* Bottom navigation, update banner, "Tap to continue" and short messages */
nav { position: fixed; left: 0; right: 0; bottom: 0; display: flex; background: var(--card); box-shadow: 0 -2px 10px rgba(29, 27, 26, 0.08); padding-bottom: env(safe-area-inset-bottom); }
nav a { flex: 1; display: flex; align-items: center; justify-content: center; min-height: 3rem; padding: 0.5rem 0; text-decoration: none; color: var(--muted); font-size: 0.9rem; }
nav a.active { color: var(--accent); font-weight: 800; }
.update { position: sticky; top: 0; z-index: 5; background: var(--accent); color: #fff; text-align: center; padding: 0.75rem; min-height: 3rem; cursor: pointer; }
.overlay { position: fixed; inset: 0; z-index: 10; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: 2rem; }
.overlay[hidden] { display: none; }
.overlay button.big { max-width: 20rem; }
.toast { position: fixed; left: 1rem; right: 1rem; bottom: 4.5rem; background: var(--fg); color: #fff; padding: 0.75rem; border-radius: 1rem; text-align: center; z-index: 20; }

/* Google Sheet backup section of Settings (Plan 5) */
.field input.wide { display: block; width: 100%; font: inherit; padding: 0.5rem; min-height: 3rem; margin-top: 0.25rem; border: 2px solid var(--line); border-radius: 0.75rem; }
.field input.code { font-family: ui-monospace, Consolas, monospace; letter-spacing: 0.05em; }
.sheet-message { min-height: 1.4em; }

/* Feedback motion. A right answer bounces, a wrong one shakes, and new badges pop up. */
@keyframes bounce { 0% { transform: scale(0.9); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
@keyframes shake { 0%, 100% { transform: translateX(0); } 25% { transform: translateX(-8px); } 50% { transform: translateX(6px); } 75% { transform: translateX(-4px); } }
@keyframes pop { 0% { transform: scale(0.6); opacity: 0; } 70% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); } }

/* All motion is switched off when the phone asks for reduced motion. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
}
```

In `docs/index.html`, replace:

```html
  <meta name="theme-color" content="#b3261e">
```

with:

```html
  <meta name="theme-color" content="#d63c1f">
```

In `docs/manifest.webmanifest`, replace:

```json
  "background_color": "#fffaf5",
  "theme_color": "#b3261e",
```

with:

```json
  "background_color": "#ffffff",
  "theme_color": "#d63c1f",
```

- [ ] **Step 5: Run every test**

Run: `node --test tests/js/look.test.mjs tests/js/view-card.test.mjs tests/js/view-progress.test.mjs`
Expected: `ℹ fail 0`.

Run: `node --check docs/js/ui/screens.js && node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 306`, `ℹ pass 306`, `ℹ fail 0`.

Run: `python -m pytest tests -q`
Expected: `247 passed, 5 skipped`.

- [ ] **Step 6: Commit**

```bash
git add docs/css/app.css docs/index.html docs/manifest.webmanifest docs/js/view/format.js docs/js/view/card.js docs/js/ui/card.js docs/js/view/progress.js docs/js/ui/screens.js tests/js/look.test.mjs tests/js/view-card.test.mjs tests/js/view-progress.test.mjs && git commit -F - <<'EOF'
feat(look): bright and always light, a colour per theme, rounded shapes, 48-pixel tap targets and feedback motion that respects reduced motion

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 15: Release r008 and the browser checks (`docs/js/release.js`, `docs/sw.js`, `tests/browser/check.mjs`)

Everything in `docs/` changed, so the release goes up by one, and phones show "Update available, tap to reload". The browser checks gain two modes:
- **`rewind`** moves the page's clock one day ahead before the app loads (the same replacement of `window.Date` as the r007 `day` check, installed with the DevTools command `Page.addScriptToEvaluateOnNewDocument`), studies day 2, then goes back to day 1 through Settings. It checks that only day 1 can be chosen, the confirmation text, that afterwards the streak is as at the end of day 1 and Today's 12 new words are exactly the words learned on day 2, and that the stand-in Sheet was replaced (the `rewound` hook of Task 10).
- **`look`** turns Chrome's emulated dark mode on (`Emulation.setEmulatedMedia`) and checks the page stays white with dark text, that every button and bottom-bar tab is at least 48 pixels high, the theme colours of the map tiles, the full ring, and that with emulated reduced motion there is no confetti and no bounce.

Run `rewind` after `day` and `sheet`, in the same Chrome profile, because it needs the first day and the Sheet set up. The order below does that.

**Files:**
- Modify: `docs/js/release.js`, `docs/sw.js`, `tests/browser/check.mjs`

- [ ] **Step 1: Raise the release**

In `docs/js/release.js`, replace:

```js
export const RELEASE = 'r007';
```

with:

```js
export const RELEASE = 'r008';
```

In `docs/sw.js`, replace:

```js
const RELEASE = 'r007';
```

with:

```js
const RELEASE = 'r008';
```

Run: `node --test tests/js/release.test.mjs tests/js/sw.test.mjs`
Expected: `ℹ tests 11`, `ℹ pass 11`, `ℹ fail 0`.

- [ ] **Step 2: Add the `rewind` and `look` modes**

In `tests/browser/check.mjs`, replace:

```js
//   node tests/browser/check.mjs sheet     the Google Sheet backup, against fake-sheet-server.mjs (after day)
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
```

with:

```js
//   node tests/browser/check.mjs sheet     the Google Sheet backup, against fake-sheet-server.mjs (after day)
//   node tests/browser/check.mjs rewind    a second day with the clock one day ahead, then going back
//                                          to the first day in Settings (after day and sheet)
//   node tests/browser/check.mjs look      always light in dark mode, 48-pixel tap targets, theme
//                                          colours, and no confetti or bounce with reduced motion
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
```

In `tests/browser/check.mjs`, replace:

```js
const mode = process.argv[2];
const modes = { store, day, offline, update, sheet };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update|sheet');
```

with:

```js
// ---- Going back to a day (Plan 6) ----

// The page's clock, one day ahead of the real one, installed before the app's own scripts run.
const CLOCK_AHEAD = `(() => { const Real = Date; const shift = 86400000;
  window.Date = class extends Real {
    constructor(...a) { if (a.length) super(...a); else super(Real.now() + shift); }
    static now() { return Real.now() + shift; }
  }; })();`;

// What the session shows now, as in day() above.
const KIND = `(() => { const m = document.getElementById('main');
  if (!m.querySelector('.session-top')) return 'wait';
  if (m.querySelector('.banner')) return 'feedback';
  if (m.querySelector('.choice')) return m.querySelector('.en') ? 'pinyin' : 'listen';
  if ([...m.querySelectorAll('button')].some((b) => b.textContent === 'Reveal')) return 'recall';
  if (m.querySelector('.grades')) return 'grades';
  return m.querySelector('.card') ? 'learn' : 'other'; })()`;

// Taps the right choice of a listening or pinyin question, found as in day() above.
const TAP_RIGHT = `(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
  const data = await (await fetch(WORDS_FILE)).json();
  const shown = document.querySelector('.big-hz');
  const heard = __plays[__plays.length - 1];
  const w = shown ? data.words.find((x) => x.hz === shown.textContent) : data.words.find((x) => '/audio/' + x.au === heard);
  const want = document.querySelector('.en') ? w.py : w.enShort;
  const b = [...document.querySelectorAll('.choice')].find((c) => c.textContent === want) ?? document.querySelector('.choice');
  b.click(); })()`;

// Answers every card of the running session right, until the session ends.
async function answerAll(page) {
  for (let i = 0; i < 400 && (await page.eval('location.hash')) === '#/session'; i += 1) {
    const kind = await page.eval(KIND);
    if (kind === 'listen' || kind === 'pinyin') await page.eval(TAP_RIGHT);
    else if (kind === 'recall') await page.eval(CLICK('Reveal'));
    else if (kind === 'grades') await page.eval("document.querySelector('.grades button').click()");
    else if (kind === 'learn' || kind === 'feedback') await page.eval(CLICK('Next'));
    await page.sleep(100);
  }
}

// These read the saved store in the page, for the words learned on the page's study day and the
// plan of today.
const LEARNED_TODAY = `(async () => { const { openIdbStore } = await import(location.origin + '/js/store.js');
  const { studyDay } = await import(location.origin + '/js/dates.js');
  const s = await openIdbStore(); const p = await s.allProgress(); s.db.close();
  return p.filter((x) => x.learned === studyDay()).map((x) => x.id).sort(); })()`;
const PLANNED_NEW = `(async () => { const { openIdbStore } = await import(location.origin + '/js/store.js');
  const { previewDay } = await import(location.origin + '/js/study.js');
  const { WORDS_FILE } = await import(location.origin + '/js/release.js');
  const data = await (await fetch(WORDS_FILE)).json();
  const s = await openIdbStore(); const plan = await previewDay({ store: s, data }); s.db.close();
  return plan.newWords.slice().sort(); })()`;
const EVENT_COUNT = `(async () => { const { openIdbStore } = await import(location.origin + '/js/store.js');
  const s = await openIdbStore(); const n = (await s.allEvents()).length; s.db.close(); return n; })()`;

// Run after 'day' and 'sheet' in the same Chrome profile. The page's clock is moved one day
// ahead, so the app sees day 2. Its 12 reviews and 12 new words are studied, then Settings,
// "Go back to a day" takes it back to day 1.
async function rewind() {
  const page = await openPage('about:blank');
  await page.send('Page.enable');
  await page.send('Page.addScriptToEvaluateOnNewDocument', { source: CLOCK_AHEAD });
  await page.send('Page.navigate', { url: `${SITE}#/today` });
  await page.until("!!document.querySelector('.start')", 20000);
  const day2 = await page.text();
  check('on day 2 Today shows 12 reviews and 12 new words', /12 \| reviews/.test(day2) && /12 \| new words/.test(day2), day2.slice(0, 120));
  await page.eval(COUNT_PLAYS);
  await page.eval("document.querySelector('.start').click()");
  await page.until("location.hash === '#/session' && !!document.querySelector('.session-top')");
  await answerAll(page);
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  const pieces = await page.eval("document.querySelectorAll('.confetti-piece').length");
  const checkin = await page.text();
  check('day 2 checks in with a 2-day streak and confetti', /Checked in! \| 2 day streak/.test(checkin) && pieces > 0, `${checkin.slice(0, 60)}, ${pieces} pieces`);
  const learned2 = await page.eval(LEARNED_TODAY);
  await page.eval("location.hash = '#/settings'; true");
  await page.until("[...document.querySelectorAll('button')].some((b) => b.textContent === 'Go back to a day')");
  await page.eval(CLICK('Go back to a day'));
  await page.until("location.hash === '#/rewind' && !!document.querySelector('.day-pick')");
  const picks = await page.eval("[...document.querySelectorAll('.day-pick')].map((b) => b.textContent)");
  check('only day 1 can be chosen', picks.length === 1, JSON.stringify(picks));
  await page.eval("document.querySelector('.day-pick').click()");
  await page.until("!!document.querySelector('.confirm-text')");
  const said = await page.eval("document.querySelector('.confirm-text').textContent");
  check('the confirmation names what is undone', said === 'Undo 1 day: 12 new words and 12 reviews. Your streak becomes 1 day.', said);
  check('the confirmation offers the backup file first', await page.eval("[...document.querySelectorAll('button')].some((b) => b.textContent === 'Save a backup file first')"));
  await page.eval("document.querySelector('button.danger').click()");
  await page.until("location.hash === '#/today' && !!document.querySelector('.start')");
  await page.sleep(500);
  const today = await page.text();
  check('after going back, the streak is as at the end of day 1', /^1 day streak/.test(today), today.slice(0, 60));
  check('after going back, Today has the 12 reviews and 12 new words again', /12 \| reviews/.test(today) && /12 \| new words/.test(today), today.slice(0, 120));
  const planned = await page.eval(PLANNED_NEW);
  check('the new words of Today are the words learned on day 2', planned.length === 12 && JSON.stringify(planned) === JSON.stringify(learned2),
    `${planned.length} planned, ${learned2.length} learned on day 2`);
  // The 'rewound' hook replaces the Sheet's copy (the stand-in of the 'sheet' check) with the phone's.
  await page.sleep(1500);
  const rows = await fetch(`${FAKE_SHEET}/admin/rows`).then((r) => r.json()).catch(() => null);
  const events = await page.eval(EVENT_COUNT);
  check('the Sheet is replaced by the rewound progress', rows !== null && rows.log === events && rows.progress === 12, `${JSON.stringify(rows)}, ${events} events on the phone`);
  for (const hash of ['#/stats', '#/badges', '#/checkin']) {
    await page.eval(`location.hash = '${hash}'; true`);
    await page.sleep(700);
    check(`${hash} draws after going back`, (await page.text()).length > 20);
  }
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

// ---- The bright look (Plan 6) ----

const BODY_COLOURS = "[getComputedStyle(document.body).backgroundColor, getComputedStyle(document.body).color]";
// The smallest height of the buttons and bottom-bar links that are shown.
const SMALLEST_TAP = `Math.min(...[...document.querySelectorAll('button, .button, nav a')]
  .filter((el) => el.offsetParent !== null).map((el) => el.getBoundingClientRect().height))`;
const BOUNCE = `(() => { const b = Object.assign(document.createElement('div'), { className: 'banner right' });
  document.body.append(b); const name = getComputedStyle(b).animationName; b.remove(); return name; })()`;
const BURST = "import(location.origin + '/js/ui/confetti.js').then((m) => [m.burst(document.body), document.querySelectorAll('.confetti-piece').length])";

async function look() {
  const page = await openPage(`${SITE}#/today`);
  await page.until("!!document.querySelector('.streak')", 20000);
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'dark' }] });
  await page.sleep(300);
  const dark = await page.eval(`[matchMedia('(prefers-color-scheme: dark)').matches, ...${BODY_COLOURS}]`);
  check('in dark mode the page stays white with dark text', dark[0] === true && dark[1] === 'rgb(255, 255, 255)' && dark[2] === 'rgb(29, 27, 26)', JSON.stringify(dark));
  let smallest = Infinity;
  for (const hash of ['#/today', '#/map', '#/stats', '#/badges', '#/settings']) {
    await page.eval(`location.hash = '${hash}'; true`);
    await page.sleep(700);
    smallest = Math.min(smallest, await page.eval(SMALLEST_TAP));
  }
  check('every button and bottom-bar tab is at least 48 pixels high', smallest >= 47.5, `${smallest} px`);
  await page.eval("location.hash = '#/map'; true");
  await page.sleep(700);
  const colours = await page.eval("[...document.querySelectorAll('.tile')].slice(0, 2).map((t) => getComputedStyle(t).borderTopColor)");
  check('map tiles carry their theme colours', colours[0] === 'rgb(255, 107, 53)' && colours[1] === 'rgb(255, 183, 3)', JSON.stringify(colours));
  await page.eval("location.hash = '#/today'; true");
  await page.sleep(1500);
  const ring = await page.eval("parseFloat(document.querySelector('.ring-fill').style.strokeDashoffset)");
  check('the day\'s ring is drawn and full once the day is done', ring < 1, `stroke-dashoffset ${ring}`);
  const moving = await page.eval(BURST);
  check('with normal motion, confetti bursts and a right answer bounces', moving[0] === 40 && moving[1] >= 40 && (await page.eval(BOUNCE)) === 'bounce', JSON.stringify(moving));
  await page.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await page.sleep(2500); // the pieces of the first burst are removed after 2 seconds
  const still = await page.eval(BURST);
  check('with reduced motion there is no confetti and no bounce', still[0] === 0 && still[1] === 0 && (await page.eval(BOUNCE)) === 'none', JSON.stringify(still));
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

const mode = process.argv[2];
const modes = { store, day, offline, update, sheet, rewind, look };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update|sheet|rewind|look');
```

Run: `node --check tests/browser/check.mjs && node --test "tests/js/*.test.mjs"`
Expected: no output from the syntax check, then `ℹ tests 306`, `ℹ pass 306`, `ℹ fail 0`.

- [ ] **Step 3: Build the smoke site and start the servers and Chrome**

As in Plan 4 Task 17 and Plan 5 Task 5. First remove an old check profile, so `day` starts on a phone that never studied:
```bash
rm -rf "$TEMP/hskchk"
PYTHONIOENCODING=utf-8 python tools/14_smoke_site.py
```
It prints `Smoke site: .claude\scratch\smoke_v001` (or a higher number) and `Stroke files new 0, already there 82, missing none`. Then start each of these in its own background shell, with the `smoke_vNNN` folder it printed:
```bash
cd .claude/scratch/smoke_vNNN && python -m http.server 8123
```
```bash
python -m http.server 8124
```
```bash
node tests/browser/fake-sheet-server.mjs
```
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir="$TEMP\\hskchk" --no-first-run --autoplay-policy=no-user-gesture-required about:blank
```
Check that Chrome listens. `curl -s http://127.0.0.1:9333/json/version` prints a `"Browser": "Chrome/...` line. If Chrome's output says `bind() returned an error`, another Chrome holds port 9333. Do not end it unless its command line contains `hskchk`, because the user may have their own Chrome open.

- [ ] **Step 4: Run the checks in this order**

Run: `node tests/browser/check.mjs store`
Expected: 9 `PASS` lines, the last two being
```
PASS events, days and meta keys are deleted in the same commit as the new event
PASS clear empties progress, events and days, and seq keeps rising
```

Run: `node tests/browser/check.mjs day`
Expected: 23 `PASS` lines, the same checks as release r007, among them `PASS the check-in screen says Checked in! with a 1-day streak (Checked in! | 1 day streak | 12 new words learned. | 12 | new words | ...)`.

Run: `node tests/browser/check.mjs sheet`
Expected: the 10 `PASS` lines of Plan 5 Task 5, with `Backed up. 26 changes sent.`.

Run: `node tests/browser/check.mjs rewind`
Expected: 13 `PASS` lines and exit code 0 (the date in the third line is the real day of the run, as day 1):
```
PASS on day 2 Today shows 12 reviews and 12 new words (1 day streak | M | T | W | T | F | S | S | 0% | 12 | reviews | 12 | new words | ...)
PASS day 2 checks in with a 2-day streak and confetti (Checked in! | 2 day streak | 12 reviews, 12 right first time, 40 pieces)
PASS only day 1 can be chosen (["3"])
PASS the confirmation names what is undone (Undo 1 day: 12 new words and 12 reviews. Your streak becomes 1 day.)
PASS the confirmation offers the backup file first
PASS after going back, the streak is as at the end of day 1 (1 day streak | ...)
PASS after going back, Today has the 12 reviews and 12 new words again (...)
PASS the new words of Today are the words learned on day 2 (12 planned, 12 learned on day 2)
PASS the Sheet is replaced by the rewound progress ({"log":28,"progress":12,"daily":2}, 28 events on the phone)
PASS #/stats draws after going back
PASS #/badges draws after going back
PASS #/checkin draws after going back
PASS no uncaught errors on the page
```

Run: `node tests/browser/check.mjs look`
Expected: 7 `PASS` lines and exit code 0:
```
PASS in dark mode the page stays white with dark text ([true,"rgb(255, 255, 255)","rgb(29, 27, 26)"])
PASS every button and bottom-bar tab is at least 48 pixels high (48 px)
PASS map tiles carry their theme colours (["rgb(255, 107, 53)","rgb(255, 183, 3)"])
PASS the day's ring is drawn and full once the day is done (stroke-dashoffset 0)
PASS with normal motion, confetti bursts and a right answer bounces ([40,40])
PASS with reduced motion there is no confetti and no bounce ([0,0])
PASS no uncaught errors on the page
```

End the background shell of the server on port 8123, then run: `node tests/browser/check.mjs offline`
Expected: the 4 `PASS` lines of Plan 4 (`the app opens with the server stopped`, `a word card opens offline`, `its saved sound plays offline (ended)`, `its stroke order draws offline`).

In the smoke copy only, never in `docs/`, raise the release and serve it again in a background shell:
```bash
cd .claude/scratch/smoke_vNNN && sed -i "s/RELEASE = 'r008'/RELEASE = 'r009'/" sw.js js/release.js && python -m http.server 8123
```
Run: `node tests/browser/check.mjs update`
Expected:
```
PASS the update message appears (Update available, tap to reload)
PASS after the tap only the new app cache is left (["media-v1","app-r009"])
PASS progress is kept after the update (1 day streak | ...)
```

- [ ] **Step 5: Clean up**

End the background shells of the three servers and of Chrome. If one keeps running, stop only the check's own processes. In PowerShell, Chrome first, choosing only the processes whose command line contains `hskchk`:
```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*hskchk*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Confirm:$false }
Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='node.exe'" | Where-Object { $_.CommandLine -like '*http.server 812*' -or $_.CommandLine -like '*fake-sheet-server*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Confirm:$false }
```
Never stop every `chrome.exe`. Then delete the check profile and the smoke site, which have served their purpose:
```bash
rm -rf "$TEMP/hskchk" .claude/scratch/smoke_vNNN
```

- [ ] **Step 6: Run the publish check**

Run from the worktree: `PYTHONIOENCODING=utf-8 python tools/15_publish_check.py`
Expected: a line such as `13189 tracked files, docs/ 177.6 MB`, then `OK, nothing private or oversized found`.

- [ ] **Step 7: Name the new browser checks in the project notes**

The project folder's `.claude/CLAUDE.md` (`<project folder>\.claude\CLAUDE.md`) is not in the repository. In its "Browser checks" line, replace the end

```text
then `node tests/browser/check.mjs store|day|offline|update`.
```

by

```text
then `node tests/browser/check.mjs store|day|sheet|rewind|look|offline|update`, in that order (rewind needs day and sheet first).
```

- [ ] **Step 8: Commit**

```bash
git add docs/js/release.js docs/sw.js tests/browser/check.mjs && git commit -F - <<'EOF'
chore(release): r008 with going back to a day, counters, badges and the bright look, and the rewind and look browser checks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

## After the tasks: merge and publish (waits for the user)

The push publishes the site to the learner's phone, so it waits for the user's yes.

1. Show the user what r008 changes, in plain words: going back to a day and resetting in Settings, the new Today, check-in, Stats and Badges screens, the new badges, and the bright look. Ask whether to publish.
2. After the user says yes, from the project folder (`git -c safe.directory='<project folder>'` for every git command there, because Box reports the files as owned by Everyone): merge the branch into `main` with `git merge --ff-only plan6-rewind-counters-look`. If `main` moved on meanwhile, rebase the branch in the worktree first and run the tests again.
3. Follow the release checklist of `.claude/plans/2026-09-28-plan5-sync-publish.md`. `node --test "tests/js/*.test.mjs"` and `python -m pytest tests -q` pass, `python tools/15_publish_check.py` prints `OK, nothing private or oversized found`, then `git push`.
4. After 1 to 5 minutes, `node tools/16_check_live.mjs https://xiao-wen-tan.github.io/hsk-flashcards/` prints its `PASS` lines with release r008.
5. On the phone, the app shows "Update available, tap to reload". After the tap, Settings, About shows release r008. The user then checks on the phone that the app looks bright also in the phone's dark mode, that a check-in shows confetti, and that "Go back to a day" offers the days studied before.
6. Remove the worktree when the branch is merged: `git --git-dir=~/git/hsk-flashcards.git worktree remove ~/git/hsk-wt-plan6`.

---

## Self-review

### The spec, requirement by requirement

| Requirement (spec of 2026-10-03, with its Amendments) | Task |
|---|---|
| Settings has "Go back to a day" and "Reset everything" | 13 |
| The calendar offers past days with a check-in or an answer, never today or after the last study day | 8 (`rewindChoices`), 13 |
| The confirmation names what is undone ("Undo 3 days: 36 new words and 120 reviews. Your streak becomes 5 days.") and offers the backup file first | 8 (`confirmText`), 13 |
| Every answer after the chosen day is undone newest first, from `before`, skipping answers Undo took back | 8 (`rewindPlan`), 9 |
| Check-ins after the chosen day are removed; the streak becomes what it was at the end of that day; the days after it up to yesterday are stored as rewound (meta `rewound`, backed up) and the streaks skip them | 3, 8, 9, 10 |
| Badges earned after the chosen day are removed, earlier ones keep their days | 8 |
| The undone answers and check-ins are deleted; one "rewind" event with the day and the counts; the saved session is deleted | 1, 9 |
| The Sheet's copy is replaced, also after being offline (`resetPending`) | 10 |
| The spec's example (1 to 4 October, back to 2 October on 5 October) | 3, 9 (tests), 15 (browser) |
| Reset everything keeps the settings, deletes all else, replaces the Sheet | 9, 10, 13 |
| A rewind or reset happens completely or not at all (one commit) | 1, 9 |
| Today: large streak, ring, four tiles, two nearest goals | 11, 14 |
| Check-in screen: today's four numbers with personal-best notes, then the calendar | 11 |
| Stats in four sections: week and month with 7- and 30-day bars, all-time records, HSK levels, goals | 12 |
| Minutes (gaps of at most 5 minutes, one `minutesOf` in `stats.js`), accuracy, perfect day, week Monday to Sunday, calendar month | 2, 4 |
| Goal countdowns for the current tile, streak, words learned, level group, reviews and minutes; Today shows the two smallest shares | 6, 11 |
| New badges: streaks 3, 14, 60, 200; words 10, 25, 250, 4000; perfect days 1, 7, 30; reviews 100 to 10,000; minutes 60 to 3,000; "Full week" with a count | 5 |
| Badges screen: greyed next badges with a progress bar ("17 / 30 days"); new badges pop up on the check-in screen | 5, 14 |
| Always light, white background, one warm orange-red main colour | 14 |
| A colour per theme, six colours in turn, on map tiles and as a band on cards | 11, 14 |
| Rounded cards with soft shadows, large rounded buttons, tap targets of at least 48 pixels | 14, 15 (browser) |
| Right answer flashes green with a bounce, wrong one red with a shake, the ring fills smoothly, confetti on check-in, all off with reduced motion | 11, 14, 15 (browser) |
| The order of the screens, the bottom bar, the quizzes and the cards are unchanged | 11 to 14 (no route or quiz changes beyond `#/rewind`) |
| Tests first for `rewind.js` (what is undone, counts, badges, an Undo inside, the first study day), `counters.js`, `goals.js` and the badges | 4 to 9 |
| A rewind browser check (study two days, go back to the first, new words return, streak drops) | 15 |
| One new release with the release test and the publish check | 15 |
| Amendment: speak events of Plan 7 are removed by a rewind like other events | 8 (every event after the day except settings, rewind and reset) |
| Amendment: speaking badges are kept or removed by date | 8 (badges by date) |

### Kept compatible with Plan 7, without building it

- `closeDay` (Task 7) is the one place that checks in a day, and `dayStatus` is the one function that decides whether the day is done. Plan 7 adds the speaking list there.
- `BADGE_GROUPS` (Task 5) takes the "Speaking" group (10, 50, 100, 500, 1000 words spoken well) as one more `steps` row, and `badgeLadder` and `badgeTitle` then need one more title line.
- `minutesOf` (Task 2) counts whatever events it is given, so Plan 7 passes the day's answers and speak events. `ANSWER_KINDS` stays the quiz answers, so accuracy leaves speaking out, as the speaking spec asks.

### Left out on purpose

- Points, levels, a streak freeze and leaderboards (the spec's "Not in this spec").
- The tone recordings of single characters, which wait for the Tone Perfect team.
- Keeping each finished day's totals so the screens need not read every event. The measured cost (0.4 to 0.8 seconds for 15 months of events on this PC) is in "Facts verified". A later plan can add it if the phone feels slow.
