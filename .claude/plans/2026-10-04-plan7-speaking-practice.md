# HSK Flashcards Plan 7: The Speaking Practice Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a speaking practice panel that takes the learner through every word studied today (listen, repeat three times, then say it alone with a check of the sounds and the tones), saves one result per word, and makes the day's check-in wait for it, as release r009.

**Architecture:** The logic goes into small pure modules in `docs/js/`, which Node tests directly. `pitch.js` finds the pitch of a recording 100 times a second, `tones.js` cuts it into syllables and compares each one with the tone the card's pinyin expects, `speakcheck.js` compares what Chrome's speech recognizer heard with the word, `speaklist.js` works out the day's speaking list, `speakflow.js` is the routine for one word as a small state machine, and `speaking.js` is the controller that saves one speak event per finished word and closes the day. `closeDay`'s `dayStatus` (Plan 6) gets the speaking condition, so the study session and the panel both check in the day. The browser parts sit in `docs/js/ui/`. `mic.js` records through an audio worklet, `recognize.js` drives Chrome's recognizer and finds out whether it can share the microphone, and `speak.js` draws the panel at `#/speak`. The tone check is measured on the app's own word recordings in Chrome, and the panel is checked end to end in headless Chrome with a fake microphone that plays a model recording.

**Tech Stack:** Node v24.16.0 (`node:test`), plain JavaScript ES modules with no npm packages (the project rule), the Web Audio API (AudioContext, AudioWorklet, OfflineAudioContext, MediaRecorder), Chrome's Web Speech API (`webkitSpeechRecognition`), IndexedDB, plain CSS, Python 3.10 with pytest, and headless Google Chrome 154 driven through the Chrome DevTools Protocol for the browser checks.

**Spec:** `.claude/specs/2026-10-03-speaking-practice-design.md`, all of it, with the user's decisions table of 2026-10-03, which is binding. The approved overall plan is `~/.claude/plans/continue-to-work-on-staged-riddle.md`, Step 3, "Plan 7".

**Where this plan sits:**
- Plans 1 to 5 built the word list, the app, the screens, offline use and the Google Sheet backup.
- Release r007 made a stopped study session continue. Plan 6 (release r008) added going back to a day, the counters, the goals, the badge groups, the bright look, and `closeDay` in `docs/js/closeday.js`, whose `dayStatus` decides whether a day can be checked in.
- Plan 7 (this plan) is release r009. It builds on Plan 6's interfaces exactly as they are: `dayStatus` and `closeDay`, `BADGE_GROUPS`, `minutesOf` and `answerEvents` in `stats.js`, `statsByDay`, `todayCounters` and `periodTotals` in `counters.js`, the rewind that deletes every later event, and the stylesheet of the bright look.

**Before you start.**
1. `main` must hold Plan 6 (release r008). Run `git --git-dir=~/git/hsk-flashcards.git log --oneline -1 main`. It must print `ed97797 fix: hidden elements stay hidden, and the rewind check can catch real failures`, or a later commit.
2. Make the worktree outside Box, because Box is slow with the 13,000 files of the repository:
```bash
git --git-dir=~/git/hsk-flashcards.git worktree add ~/git/hsk-wt-plan7 -b plan7-speaking-practice main
cd ~/git/hsk-wt-plan7
```
Every command of this plan runs from `~/git/hsk-wt-plan7`.
3. Check the starting point. `node --test "tests/js/*.test.mjs"` must give `ℹ tests 314`, `ℹ pass 314`, `ℹ fail 0`, and `python -m pytest tests -q` must give `247 passed, 5 skipped`.

**A tool pitfall.** File-writing tools turn a typed unicode escape (a backslash, `u` and four hex digits) into the character itself. This plan writes characters such as `是`, `ǐ` and `×` directly and needs no escapes. After writing a file, `grep -n '\\u' FILE` should find nothing new. A second pitfall is that a Python script that edits a file with `Path.write_text()` on Windows turns every line ending into CRLF. Edit files with the editing tool, or with `write_bytes()`.

---

## Facts verified before writing this plan (2026-10-04)

Each fact was checked by running the command or reading the file named. All code of this plan ran in a scratch worktree outside Box, `~/git/hsk-wt-plan7-draft`. Nothing was written into the project folder except this plan file.

- **Starting point.** At `ed97797` (Plan 6 finished, release r008), `node --test "tests/js/*.test.mjs"` gave `ℹ tests 314`, `ℹ pass 314`, and `python -m pytest tests -q` gave `247 passed, 5 skipped`.
- **Each task, applied from this plan's own text.** A script took the code blocks of this file task by task, applied them to a fresh worktree at `ed97797`, and ran every `Run:` command of the plan. Each test failed first with the failure the plan names and passed after the code. After Task 15 the JavaScript tests gave `ℹ tests 369`, `ℹ pass 369`, `ℹ fail 0`, and pytest still gave `247 passed, 5 skipped`. All 57 files the plan changes were byte for byte the same as in the scratch worktree where the code was first written.
- **The tone check on the app's own recordings.** `node tests/browser/check.mjs tones` (Task 14) decodes 1,979 word recordings of `docs/audio/w/` in Chrome at 48,000 samples a second and judges them. These are the words whose recordings were not used to make the tone shapes (see "Words used"). At the normal strictness:

  | Words | Words that pass | Tone heard right, tones 1, 2, 3, 4 |
  |---|---|---|
  | one syllable (359 words) | 96.1% | 91.1%, 95.4%, 98.6%, 99.1% |
  | two syllables (1,352 words) | 94.3% | 94.5%, 93.3%, 85.2%, 95.2% |
  | three or more (268 words) | 75.0% | 91.0%, 77.9%, 85.1%, 89.9% |
  | every syllable (3,879) | | 91.8% in all |

  The other strictness settings, gentle and strict, pass 96.7% and 96.1% of the one-syllable words, 96.2% and 87.2% of the two-syllable words, and 98.1% and 62.3% of the longer ones. The tones heard wrong were mostly a 3rd tone heard as a 2nd (59 syllables), a 1st tone heard as a 4th (49, many of them exclamations such as 哈 and 哇, which the voice says with a fall) and a 4th tone heard as a 1st (46). A few one-syllable words were read by the voice with their other tone (种, 转 and 吐 have a 4th tone in other words), so they count as wrong although the check heard what was said. The 16 tone samples the user made on 2 October (`.claude/scratch/tone_samples/*.wav`, third tones of 你, 好, 很, 我 and 马, in full, v2 and v3 forms) all pass. The pass bars of the browser check are a little below these numbers: at least 90% of the syllables, 94% of the one-syllable words and 92% of the two-syllable words.
- **Made-up sounds in Node.** A buzz with 6 harmonics (a stand-in for a sung vowel) at a steady 90, 220 and 440 Hz was tracked within 0.1%, a glide from 300 Hz down to 150 Hz in 0.4 seconds within 1.4% (also from 48,000 and 44,100 samples a second), and the same glide with noise within 0.4%. Made-up words built from the tone shapes, with every point moved at random by up to a tenth of the voice range, were heard right in 168 of 170 syllables.
- **Chrome's speech recognizer in Chrome 154.** `new webkitSpeechRecognition().start(null)` throws `TypeError: Failed to execute 'start' on 'SpeechRecognition': parameter 1 is not of type 'MediaStreamTrack'.`, so this Chrome can give the recognizer the panel's own microphone track (`sharesMic` in `ui/recognize.js` looks for exactly this). In headless Chrome the recognizer exists. Started without a track it ends with the error `not-allowed`, and started with a track of the fake microphone it ended every try without any result and without an error. The panel then counts the try as missed by the recognizer, and after two such tries in a row it uses the tone check alone (`recognizerOutcome` in `speakcheck.js`). The browser checks use a stand-in recognizer or none at all, so they never depend on Google.
- **Chrome's fake microphone.** With `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=<file.wav>`, every `getUserMedia` call starts the WAV file from its beginning. Three tries in a row found the voice of 是 at the same place, 0.71 seconds in, and each try stopped by itself after 1.6 seconds. The audio context ran at 44,100 samples a second, and the audio worklet path of `mic.js` recorded. `Browser.setPermission` with `{ name: 'microphone' }` and `denied` makes `navigator.permissions.query` say `denied` in that browser context.
- **The bottom bar on the panel.** `app.js` hides the bottom bar with the `hidden` attribute, and Plan 6's last fix (`ed97797`, `[hidden] { display: none !important; }`) makes that work, after `nav { display: flex }` had kept the bar on the screen since Plan 4. A screenshot of the panel at phone size before that fix still showed the bar. The panel uses the same attribute, and the `speak` browser check finds the bar's `display` to be `none` on the panel.
- **The words file and the sound check.** Every one of the 5,043 words of `docs/data/words_v002.json` has as many characters as syllables in its pinyin, the 儿 ending counted, and every word passes the sound check with its own characters. The map from each character to its syllables has 2,637 characters and takes about 30 ms to build.
- **Time.** Tracking the pitch of a 2-second recording takes about 44 ms in Node. The `tones` check takes about 1.5 minutes. In the `speak` checks each word takes about 12 seconds with the sounds played 4 times faster. The 450-day simulation test now takes about 35 seconds instead of 22, because each simulated day also saves about 110 speak events.
- **Existing tests whose expected values change.** From r009 a day is checked in only when the learning and the speaking are both done. Five test files play whole days and expect a check-in (`study`, `flow`, `rewind`, `sheet` and `simulation`). Each gets one line that finishes the day's speaking list first (`speakAll` in `tests/js/helpers.mjs`), with the result 'listened', which earns no speaking badge and adds no minutes, so every expected value of those tests stays. Other tests change because the shapes they check grow by the speaking parts: `config.test.mjs` and `view-misc.test.mjs` (the new setting), `counters.test.mjs` (`spoken` in a day's numbers and the ring), `badges.test.mjs` (the new group), `goals.test.mjs` (the speaking countdown), `view-progress.test.mjs` (the fifth tile of Stats) and the Daily test of `sheet.test.mjs` (its name).
- **The browser checks.** On the tree built from this plan's text, with the smoke site of `tools/14_smoke_site.py` (which serves the real words file and sounds) and a fresh Chrome profile: `store` gave 9 `PASS` lines, `tones` 4 (and one `INFO` line with the other strictness settings), `day` 25, `sheet` 10, `rewind` 13, `look` 7 and `wav` 1 in the first Chrome. In the Chrome started again with the fake microphone, `speak` gave 10, `speakboth` 7, `speaktwice` 4 and `nomic` 5, and then `offline` gave 5 and `update` 3. Every run ended with exit code 0 and no `FAIL` line. Another check run used the usual ports at the same time, so these ran on ports 8223 (smoke site), 8224 (project folder), 8225 (stand-in Sheet) and 9433 (Chrome) with the profile `%TEMP%\hskchk7`. The plan gives the usual ports.

## Choices this plan makes where the spec is silent

Each choice is made in one place, named in brackets. These are for the user to see, and each can be changed later.

1. **The order of the speaking list.** The words studied today come first, in the order they were first answered in the session, then the words carried over from earlier skips, oldest skip first. (`speakList` in `speaklist.js`)
2. **"Words spoken" in Stats** counts the words finished in speaking practice that were not skipped, so 'pass' and 'listened'. (`statsByDay` in `counters.js`)
3. **The speaking badges count each word once.** "50 words spoken well" means 50 different words with the result 'pass'. The group sits after "Minutes studied" on the Badges screen, and its badges are called "10 words spoken well" and so on. The goal countdowns of Today and Stats include the next one, as the overall plan's "ring and goals" asks, for example "8 more words to say well for the 10-word speaking badge". (`BADGE_GROUPS` and `badgeFacts` in `badges.js`, `goals` in `goals.js`)
4. **A day with speaking only.** It counts as a study day. It has no accuracy, it is never a perfect day, and it is left out when today's accuracy is compared with the week. (`statsByDay`, `perfectDays` and `personalBests` in `counters.js`)
5. **The ring of Today.** The day's work is every planned word to study, every word left on the speaking list, and every planned word that is not on the list yet, because it will be spoken after it is studied. With 12 reviews and 12 new words planned and nothing carried over, the ring is half full when the studying is done and full when the speaking is done. (`todayCounters` in `counters.js`)
6. **The Sheet counts speaking minutes too.** The Daily tab's minutes come from the day's answers and speak events, the same as the app's. (`dailyRow` in `sheet.js`)
7. **How a tone is judged.** Each syllable is compared with the shape of every tone in its place of the word (alone, first before a given tone, or later after a given tone), made from the app's own recordings. The nearest shape is the tone heard. A third tone at the end of a word also passes when it dips and rises fully, as the user's tone samples do. A 4th tone may also match on the first 60% or 80% of its shape, because its end often fades into a creak that has no pitch. A syllable in the middle of a longer word is compared like a later syllable. (`SHAPES` and `judgeTones` in `tones.js`)
8. **What the three strictness settings mean.** The expected tone passes when its distance is at most the nearest tone's distance plus a margin. Gentle allows a margin of 0.04 and lets a word of 3 or 4 syllables pass with one wrong syllable. Normal allows 0.02 and needs every judged syllable right. Strict allows no margin. On the app's own voice this passes the numbers of the facts above. (`CONFIG.speak.strictness` in `config.js`)
9. **The learner's voice range.** It is learned from the learner's own recordings, a count of pitch values per half semitone that is kept in this browser (localStorage `hsk-voice`), never a recording. Until 5 recordings are in it, a try is judged by the shapes of its syllables alone, without their height. (`voiceRange` in `tones.js`, `ui/speak.js`)
10. **How the panel finds out which checks work.** It finds out at every start of the panel. Without a recognizer, or offline, it uses the tones alone. A recognizer that refuses `start(null)` with a TypeError takes the microphone track, so one recording feeds both checks. Otherwise the word is said twice. When the browser says the microphone is denied, or the learner refuses it at the first try, the words are listened to and repeated only. The last mode found is kept in localStorage `hsk-speak-check` for the line in Settings. (`findMode` and `sharesMic` in `ui/recognize.js`, `startSpeaking` in `ui/speak.js`)
11. **When the recognizer says nothing.** An error other than 'no-speech' switches the session to the tone check alone. No guess at all although the recording heard a voice counts as the recognizer missing it, so the tones decide that try, and after two such tries in a row the session uses the tones alone. No guess and no voice is a miss, "The sound check heard nothing." In say-it-twice mode the panel cannot tell, so no guess is a miss there. (`recognizerOutcome` in `speakcheck.js`)
12. **A recording ends by itself.** It stops 0.7 seconds after the voice stops, after 4 seconds when no voice came, and after 6 seconds in all. Each try opens the microphone and closes it again. The microphone has echo cancellation and noise suppression off, which would change the pitch, and automatic gain on. (`stopper` and `openMic` in `ui/mic.js`)
13. **The sound check's rules.** The word's own characters pass, and so does a homophone whose syllables match the card's pinyin with its tones. A neutral-tone syllable matches its letters in any tone. A word with the 儿 ending also passes without its 儿. Digits become Chinese numbers (10 is 十), and 2 may also be 两. (`matchWord` and `cleanHeard` in `speakcheck.js`)
14. **The one-time note about Google** shows above the microphone button before the first try that uses the recognizer, with an OK button, and the button works once it is tapped. The note is also in Settings and on the credits page. (`draw` in `ui/speak.js`, localStorage `hsk-speak-note`)
15. **Words spoken well before.** Such a word starts at "Your turn" without playing first, and the "Play the word" button is always there. (`startWord` in `speakflow.js`)
16. **After a word.** "Well said!" or "Skipped. It comes back next time." shows for 0.9 seconds before the next word. A word that ends as 'listened' goes straight on. (`advance` in `ui/speak.js`)
17. **The pause after each round** is 1.5 times the time the word took to play on the phone, plus 1 second. (`pauseMs` in `speakflow.js`)
18. **Where the panel ends.** Finished, stopped or left, the panel closes the day and shows the check-in screen, as the study session does, and the Google Sheet backup runs. The check-in screen offers "Next: speaking practice" whenever the speaking list has words left. (`endSpeaking` in `ui/speak.js`, `checkinView` in `view/progress.js`)
19. **The button on Today** is always there, under Start or Continue. It says "18 words to speak", "All 18 words spoken." or "No words to speak yet. Study first.", and it is greyed out when nothing is left. When the learning is done and only speaking is left, Start is hidden. (`speakButton` in `view/speak.js`, `todayView` in `view/today.js`)
20. **Resetting and going back.** Plan 7 adds no meta key, so Plan 6's rewind and reset need no change. Going back deletes the later speak events with every other event, and the speaking badges by their dates. "Reset everything" keeps the voice range, the note and the mode in this browser, because they describe the learner's voice and the phone, not the progress. (No code change. `tests/js/rewind.test.mjs` checks the rewind.)
21. **The existing tests finish a day's speaking with 'listened'** (`speakAll` in `tests/js/helpers.mjs`), as a phone without a microphone would, so their expected badges and minutes stay the same.

---

## Words used in this plan

- **Speaking list.** The words to speak on a study day, which are every word studied that day (new words, lessons that ended without passing, and reviews) and every word skipped on its latest earlier day. It is done when every word in it has a speak event that day.
- **Speak event.** The one event saved per finished word, `{ day, kind: 'speak', id, result, tries, check: { tones, heard }, ts }`. `result` is 'pass', 'skip' or 'listened'. `check` holds the numbers of the last try, the share of syllables with the right tone and what the recognizer heard, never audio.
- **Carried word.** A word on today's list because it was skipped on its latest earlier day.
- **Phase.** Where a word is in its routine: listen, repeat (rounds 1 to 3), turn ("Your turn"), sounds, record, missed, done (`speakflow.js`).
- **Mode.** Which checks run on this phone: 'one' (both checks from one recording), 'twice' (both checks, the word said twice), 'tones' (the tone check alone) or 'none' (no microphone).
- **Try.** One recording of the learner saying the word, with its verdict, pass or miss.
- **Sound check.** Chrome's speech recognizer, set to Chinese, must hear the word's characters or a homophone.
- **Tone check.** The pitch of each syllable is compared with the tone the card's pinyin expects.
- **Pitch track.** The pitch of a recording every 10 ms, in Hz, 0 where there is none, with the loudness of each 10 ms (`trackPitch` in `pitch.js`).
- **Voice range.** The middle (`ref`, in Hz) and the spread (`span`, in semitones from the 10th to the 90th percentile) of the learner's pitch. A semitone is the step between two neighbouring piano keys, and 12 semitones double the pitch.
- **Tone shape.** Five pitch points of a tone, at 10%, 30%, 50%, 70% and 90% of a syllable, in voice ranges from the middle of the voice. 0.25 is a quarter of the voice range above the middle.
- **Fit words and held-out words.** The tone shapes were averaged from the recordings of 1,712 fit words, the one-syllable words at even places (0, 2, 4, ...) of the words file and the two-syllable words at places 0, 3, 6 and so on. The other words are held out, and the check is measured on 1,979 of them: the one-syllable words at odd places, the two-syllable words at places 1, 4, 7 and so on, and every word of 3 or more syllables.
- **Strictness.** The learner setting "Speaking check", gentle, normal or strict.
- **Fake microphone.** Chrome started with flags that make every microphone play a WAV file, here the app's recording of 是.
- **Stand-in recognizer.** A small script that the browser checks put in place of Chrome's recognizer before the app loads. It "hears" the word on the screen, or a text the check sets.
- **Browser context.** An empty browser profile of its own inside the running Chrome, so a check starts as a phone that never used the app.
- **Smoke site.** A local copy of `docs/` that `tools/14_smoke_site.py` builds in `.claude/scratch/smoke_vNNN/` for the browser checks.

## File map

| File | What changes |
|---|---|
| `docs/js/config.js`, `docs/js/view/settings.js` | `CONFIG.speak`, the strictness setting (Task 1), the speaking badge steps (Task 10) |
| `docs/js/pitch.js` | New. Pitch tracking (Task 2) |
| `docs/js/tones.js` | New. Expected tones, syllables, the voice range, tone shapes and the tone check (Task 3) |
| `docs/js/speakcheck.js` | New. The sound check, the recognizer's answer and the verdict of a try (Task 4) |
| `docs/js/speaklist.js` | New. The day's speaking list (Task 5) |
| `docs/js/speakflow.js` | New. The routine for one word (Task 6) |
| `docs/js/speaking.js` | New. The panel's controller, which saves the speak events (Task 7) |
| `docs/js/closeday.js` | `dayStatus` needs the speaking list done too (Task 8) |
| `docs/js/stats.js`, `docs/js/counters.js`, `docs/js/sheet.js` | Minutes with speaking, words spoken, the ring, the Sheet's log and Daily minutes (Task 9) |
| `docs/js/badges.js`, `docs/js/goals.js` | The speaking badge group and its countdown (Task 10) |
| `docs/js/view/speak.js` | New. What the panel, Today's button and Settings show (Task 11) |
| `docs/js/view/today.js`, `docs/js/view/progress.js`, `docs/js/view/route.js` | The button and status of Today, "Words spoken" in Stats, the check-in screen, the `#/speak` route (Tasks 9, 11) |
| `docs/js/ui/mic-worklet.js`, `docs/js/ui/mic.js`, `docs/js/ui/recognize.js` | New. The microphone and the recognizer (Task 12) |
| `docs/js/ui/speak.js` | New. The panel screen (Task 13) |
| `docs/js/app.js`, `docs/js/ui/screens.js`, `docs/js/ui/settings.js`, `docs/js/hooks.js` | The route, the buttons of Today and the check-in screen, the Settings items (Task 13) |
| `docs/css/app.css`, `docs/credits.html` | The panel's styles and the strictness choice, the credits line (Task 13) |
| `docs/js/release.js`, `docs/sw.js` | Every new file in `APP_FILES` (Tasks 2 to 7, 11 to 13), release r009 (Task 15) |
| `tests/js/*.test.mjs`, `tests/js/voice.mjs`, `tests/js/helpers.mjs` | New tests for every new module, made-up voices, `speakAll`, and the changed tests listed above |
| `tests/browser/tones.html`, `tests/browser/tones-check.js` | New. The tone check on the app's own recordings (Task 14) |
| `tests/browser/check.mjs` | The `tones`, `wav`, `speak`, `speakboth`, `speaktwice` and `nomic` modes, and `day` and `rewind` with speaking (Tasks 14, 15) |

`docs/` is public. This plan adds only app code, styles and one line of credits to it. Recordings are never saved anywhere.

---

### Task 1: The speaking settings and thresholds (`docs/js/config.js`, `docs/js/view/settings.js`)

The spec asks for a learner setting "Speaking check: gentle, normal, strict", with normal as the default, and for the thresholds of the tone check in one place. `normalizeSettings` gains `speakStrictness`, and `CONFIG.speak` holds the numbers that `tones.js` (Task 3) uses.

What the three settings do, in plain words. Each syllable's pitch is compared with the shape of every tone, and each tone gets a distance. The tone with the smallest distance is the tone heard. The expected tone passes when its distance is at most the smallest distance plus a margin.

| Setting | Margin | Judged syllables that must be right |
|---|---|---|
| gentle | 0.04 | 60%, so a word of 3 or 4 syllables may have one wrong |
| normal | 0.02 | all |
| strict | 0 | all |

A margin of 0.02 is small. A distance is the spread of the 5 differences between the syllable's points and a tone's shape, plus half the square of their mean, because a voice may sit a little higher or lower. A syllable whose 5 points all sit 0.2 of the voice range above a shape has the distance 0.5 × 0.2 × 0.2 = 0.02. With a voice range of 8 semitones, 0.2 of it is 1.6 semitones.

**Files:**
- Modify: `docs/js/config.js`, `docs/js/view/settings.js`
- Test: `tests/js/config.test.mjs`, `tests/js/view-misc.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tests/js/config.test.mjs`, replace:

```js
test('missing settings get the defaults', () => {
  assert.deepEqual(normalizeSettings(undefined), { reviewCap: 100, newPerDay: 12 });
  assert.deepEqual(normalizeSettings(null), { reviewCap: 100, newPerDay: 12 });
});

test('settings are kept inside their ranges and other keys survive', () => {
  assert.deepEqual(normalizeSettings({ newPerDay: 50, reviewCap: 5, autoplay: false }),
    { newPerDay: 30, reviewCap: 20, autoplay: false });
  assert.deepEqual(normalizeSettings({ newPerDay: '8', reviewCap: 'abc' }), { newPerDay: 8, reviewCap: 100 });
});
```

with:

```js
test('missing settings get the defaults', () => {
  assert.deepEqual(normalizeSettings(undefined), { reviewCap: 100, newPerDay: 12, speakStrictness: 'normal' });
  assert.deepEqual(normalizeSettings(null), { reviewCap: 100, newPerDay: 12, speakStrictness: 'normal' });
});

test('settings are kept inside their ranges and other keys survive', () => {
  assert.deepEqual(normalizeSettings({ newPerDay: 50, reviewCap: 5, autoplay: false }),
    { newPerDay: 30, reviewCap: 20, autoplay: false, speakStrictness: 'normal' });
  assert.deepEqual(normalizeSettings({ newPerDay: '8', reviewCap: 'abc' }), { newPerDay: 8, reviewCap: 100, speakStrictness: 'normal' });
});

test('the speaking check is gentle, normal or strict, and normal by default', () => {
  assert.equal(normalizeSettings({ speakStrictness: 'gentle' }).speakStrictness, 'gentle');
  assert.equal(normalizeSettings({ speakStrictness: 'strict' }).speakStrictness, 'strict');
  assert.equal(normalizeSettings({ speakStrictness: 'very' }).speakStrictness, 'normal');
  assert.deepEqual(Object.keys(CONFIG.speak.strictness), ['gentle', 'normal', 'strict']);
});
```

In `tests/js/view-misc.test.mjs`, replace:

```js
test('settings have defaults, ranges and auto-play on', () => {
  assert.deepEqual(settingsView(undefined), { newPerDay: 12, reviewCap: 100, autoplay: true, newRange: [4, 30], capRange: [20, 300] });
  assert.equal(settingsView({ autoplay: false }).autoplay, false);
  assert.deepEqual(settingsFromForm({ newPerDay: '50', reviewCap: '80', autoplay: false }, { other: 1 }),
    { other: 1, newPerDay: 30, reviewCap: 80, autoplay: false });
});
```

with:

```js
test('settings have defaults, ranges and auto-play on', () => {
  assert.deepEqual(settingsView(undefined), {
    newPerDay: 12, reviewCap: 100, autoplay: true, newRange: [4, 30], capRange: [20, 300], speakStrictness: 'normal',
    strictness: [{ value: 'gentle', label: 'Gentle' }, { value: 'normal', label: 'Normal' }, { value: 'strict', label: 'Strict' }],
  });
  assert.equal(settingsView({ autoplay: false }).autoplay, false);
  assert.deepEqual(settingsFromForm({ newPerDay: '50', reviewCap: '80', autoplay: false }, { other: 1 }),
    { other: 1, newPerDay: 30, reviewCap: 80, autoplay: false, speakStrictness: 'normal' });
  assert.equal(settingsFromForm({ newPerDay: '12', reviewCap: '100', autoplay: true, speakStrictness: 'gentle' }).speakStrictness, 'gentle');
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/config.test.mjs tests/js/view-misc.test.mjs`
Expected: `ℹ tests 12`, `ℹ pass 8`, `ℹ fail 4`, the failing tests being "missing settings get the defaults"; "settings are kept inside their ranges and other keys survive"; "the speaking check is gentle, normal or strict, and normal by default"; "settings have defaults, ranges and auto-play on".

- [ ] **Step 3: Add the setting and the thresholds**

In `docs/js/config.js`, replace:

```js
  statsDays: Object.freeze({ forecast: 7, accuracy: 7 }),

  // Rough seconds per card, used only to print an estimated daily time in the simulation test.
  secondsPerCard: Object.freeze({ review: 8, reask: 6, learn: 20, check: 8, final: 8 }),
```

with:

```js
  statsDays: Object.freeze({ forecast: 7, accuracy: 7 }),

  // The tone check of the speaking panel (tones.js, speaking practice spec of 2026-10-03).
  speak: Object.freeze({
    levelWeight: 0.5, // how much a syllable's height counts next to its shape
    voiceKeep: 0.98, // older recordings count this much less with each new one
    voiceRecordings: 5, // recordings needed before the height of the learner's voice is trusted
    // The learner setting "Speaking check". margin is how much farther the expected tone may be
    // than the nearest tone (toneScores), and share is the part of the judged syllables of a
    // word that must be right.
    strictness: Object.freeze({
      gentle: Object.freeze({ margin: 0.04, share: 0.6 }),
      normal: Object.freeze({ margin: 0.02, share: 1 }),
      strict: Object.freeze({ margin: 0, share: 1 }),
    }),
  }),

  // Rough seconds per card, used only to print an estimated daily time in the simulation test.
  secondsPerCard: Object.freeze({ review: 8, reask: 6, learn: 20, check: 8, final: 8 }),
```

In `docs/js/config.js`, replace:

```js
}

// Fill in missing learner settings and keep them inside their allowed range.
// For example, normalizeSettings({ newPerDay: 50 }) gives { reviewCap: 100, newPerDay: 30 }.
export function normalizeSettings(raw = {}) {
  const s = raw ?? {};
```

with:

```js
}

// How strictly the speaking panel checks the tones (learner setting, CONFIG.speak.strictness).
export const STRICTNESS = Object.freeze(['gentle', 'normal', 'strict']);

// Fill in missing learner settings and keep them inside their allowed range.
// For example, normalizeSettings({ newPerDay: 50 }) gives
// { reviewCap: 100, newPerDay: 30, speakStrictness: 'normal' }.
export function normalizeSettings(raw = {}) {
  const s = raw ?? {};
```

In `docs/js/config.js`, replace:

```js
    reviewCap: clampInt(s.reviewCap, CONFIG.reviewCapMin, CONFIG.reviewCapMax, CONFIG.reviewCap),
    newPerDay: clampInt(s.newPerDay, CONFIG.newPerDayMin, CONFIG.newPerDayMax, CONFIG.newPerDay),
  };
}
```

with:

```js
    reviewCap: clampInt(s.reviewCap, CONFIG.reviewCapMin, CONFIG.reviewCapMax, CONFIG.reviewCap),
    newPerDay: clampInt(s.newPerDay, CONFIG.newPerDayMin, CONFIG.newPerDayMax, CONFIG.newPerDay),
    speakStrictness: STRICTNESS.includes(s.speakStrictness) ? s.speakStrictness : 'normal',
  };
}
```

In `docs/js/view/settings.js`, replace:

```js
// The Settings form and the backup file. No page access, so Node can test it.
import { CONFIG, normalizeSettings } from '../config.js';

// Values for the form. Auto-play is on unless the learner turned it off.
export function settingsView(saved) {
  const s = normalizeSettings(saved);
```

with:

```js
// The Settings form and the backup file. No page access, so Node can test it.
import { CONFIG, STRICTNESS, normalizeSettings } from '../config.js';

// Values for the form. Auto-play is on unless the learner turned it off. strictness lists the
// choices of "Speaking check" (the speaking panel's tone check, CONFIG.speak.strictness).
export function settingsView(saved) {
  const s = normalizeSettings(saved);
```

In `docs/js/view/settings.js`, replace:

```js
    newRange: [CONFIG.newPerDayMin, CONFIG.newPerDayMax],
    capRange: [CONFIG.reviewCapMin, CONFIG.reviewCapMax],
  };
}
```

with:

```js
    newRange: [CONFIG.newPerDayMin, CONFIG.newPerDayMax],
    capRange: [CONFIG.reviewCapMin, CONFIG.reviewCapMax],
    speakStrictness: s.speakStrictness,
    strictness: STRICTNESS.map((value) => ({ value, label: value[0].toUpperCase() + value.slice(1) })),
  };
}
```

In `docs/js/view/settings.js`, replace:

```js
  return normalizeSettings({
    ...saved, newPerDay: form.newPerDay, reviewCap: form.reviewCap, autoplay: Boolean(form.autoplay),
  });
}
```

with:

```js
  return normalizeSettings({
    ...saved, newPerDay: form.newPerDay, reviewCap: form.reviewCap, autoplay: Boolean(form.autoplay),
    speakStrictness: form.speakStrictness ?? saved.speakStrictness,
  });
}
```

- [ ] **Step 4: Run every test**

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 315`, `ℹ pass 315`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/config.js docs/js/view/settings.js tests/js/config.test.mjs tests/js/view-misc.test.mjs && git commit -F - <<'EOF'
feat(settings): the speaking check's strictness, gentle, normal or strict, and its thresholds

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 2: Pitch tracking (`docs/js/pitch.js`)

The tone check needs the pitch of the learner's voice every 10 ms. `pitch.js` finds it with the YIN method (de Cheveigné and Kawahara, 2002), which asks how far a short piece of sound must be shifted to repeat itself.

Worked example. A voice at 250 Hz repeats every 1/250 of a second. At 16,000 samples a second that is a shift of 64 samples, so YIN's difference between the sound and itself shifted by 64 samples is near 0, and 16000 / 64 = 250 Hz. A window of hiss never repeats, so its difference stays high and it gets pitch 0.

The steps for a recording:
1. `downsample` turns 48,000 (or 44,100) samples a second into 16,000, each new sample the mean of the old ones around it.
2. `trackPitch` looks at a 40 ms window every 10 ms and gives each window a pitch (`yinPitch`) and a loudness in decibels. Windows 40 dB below the loudest are silence.
3. `cleanPitch` fixes octave jumps (a pitch twice or half that of its neighbours), smooths with a 5-window median, and drops voiced stretches shorter than 40 ms.

`tests/js/voice.mjs` makes the test sounds, a buzz of 6 harmonics whose pitch glides through given values, the same kind of sound a sung vowel is. The spec asks for an error under 2% on such made-up tones.

**Files:**
- Create: `docs/js/pitch.js`, `tests/js/voice.mjs`
- Modify: `docs/sw.js`
- Test: `tests/js/pitch.test.mjs`

- [ ] **Step 1: Write the failing test and the made-up voices**

Create `tests/js/voice.mjs`:

```js
// Made-up voices for the pitch and tone tests. A voice is a buzz of 6 harmonics, like a sung
// vowel, whose pitch glides through the listed values.
//   madeUpVoice([{ ms: 100 }, { ms: 300, hz: [220, 180] }, { ms: 100 }])
// gives 100 ms of silence, 300 ms of voice falling from 220 Hz to 180 Hz, and 100 ms of silence,
// at 16,000 samples a second. A piece without `hz` is silence. `dip` lowers the loudness in the
// middle of a voiced piece, as a consonant such as m or n does between two vowels.
export function madeUpVoice(pieces, { rate = 16000, noise = 0, random = Math.random } = {}) {
  const total = pieces.reduce((s, p) => s + Math.round((p.ms / 1000) * rate), 0);
  const out = new Float32Array(total);
  let at = 0;
  let phase = 0;
  for (const piece of pieces) {
    const n = Math.round((piece.ms / 1000) * rate);
    for (let i = 0; i < n; i += 1) {
      let v = 0;
      if (piece.hz) {
        const f = (i / Math.max(1, n - 1)) * (piece.hz.length - 1);
        const k = Math.min(piece.hz.length - 2, Math.floor(f));
        const hz = piece.hz.length === 1 ? piece.hz[0] : piece.hz[k] + (piece.hz[k + 1] - piece.hz[k]) * (f - k);
        phase += (2 * Math.PI * hz) / rate;
        for (let h = 1; h <= 6; h += 1) v += Math.sin(h * phase) / h;
        const edge = Math.min(1, i / (0.01 * rate), (n - 1 - i) / (0.01 * rate));
        const dip = piece.dip ? 1 - piece.dip * Math.exp(-(((i / n - 0.5) / 0.06) ** 2)) : 1;
        v *= 0.3 * edge * dip;
      }
      out[at + i] = v + (noise ? noise * (random() * 2 - 1) : 0);
    }
    at += n;
  }
  return out;
}

// The true pitch of a made-up voice at time t (seconds), or 0 in silence, for checking a track.
export function pitchAt(pieces, t) {
  let start = 0;
  for (const piece of pieces) {
    const end = start + piece.ms / 1000;
    if (t >= start && t < end) {
      if (!piece.hz) return 0;
      if (piece.hz.length === 1) return piece.hz[0];
      const f = ((t - start) / (end - start)) * (piece.hz.length - 1);
      const k = Math.min(piece.hz.length - 2, Math.floor(f));
      return piece.hz[k] + (piece.hz[k + 1] - piece.hz[k]) * (f - k);
    }
    start = end;
  }
  return 0;
}
```

Create `tests/js/pitch.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PITCH, cleanPitch, downsample, semitones, trackPitch, voicedRuns } from '../../docs/js/pitch.js';
import { madeUpVoice, pitchAt } from './voice.mjs';
import { mulberry32 } from '../../docs/js/rng.js';

// The largest error of the tracked pitch, as a share of the true pitch, over the windows that
// lie wholly inside the voiced pieces (a window at i covers i * 10 ms to i * 10 ms + 40 ms).
function worstError(pieces, track) {
  let worst = 0;
  let voiced = 0;
  track.f0.forEach((hz, i) => {
    const from = i * track.hop;
    const to = from + PITCH.winMs / 1000;
    const a = pitchAt(pieces, from + 0.001);
    const b = pitchAt(pieces, to - 0.001);
    if (!a || !b) return;
    voiced += 1;
    const truth = pitchAt(pieces, (from + to) / 2);
    worst = Math.max(worst, hz ? Math.abs(hz - truth) / truth : 1);
  });
  return { worst, voiced };
}

test('steady pitches of a low, a middle and a high voice are tracked within 2%', () => {
  for (const hz of [90, 220, 440]) {
    const pieces = [{ ms: 100 }, { ms: 400, hz: [hz] }, { ms: 100 }];
    const { worst, voiced } = worstError(pieces, trackPitch(madeUpVoice(pieces), 16000));
    assert.ok(voiced >= 30, `${hz} Hz: ${voiced} windows`);
    assert.ok(worst < 0.02, `${hz} Hz: worst error ${(worst * 100).toFixed(2)}%`);
  }
});

test('a glide from 300 Hz down to 150 Hz is tracked within 2%, also from 48,000 samples a second', () => {
  const pieces = [{ ms: 100 }, { ms: 400, hz: [300, 150] }, { ms: 100 }];
  for (const rate of [16000, 48000, 44100]) {
    const { worst } = worstError(pieces, trackPitch(madeUpVoice(pieces, { rate }), rate));
    assert.ok(worst < 0.02, `${rate}: worst error ${(worst * 100).toFixed(2)}%`);
  }
});

test('noise is tracked too, a little less closely', () => {
  const pieces = [{ ms: 100 }, { ms: 400, hz: [200, 260] }, { ms: 100 }];
  const sound = madeUpVoice(pieces, { noise: 0.02, random: mulberry32(7) });
  assert.ok(worstError(pieces, trackPitch(sound, 16000)).worst < 0.03);
});

test('silence and hiss have no pitch', () => {
  assert.deepEqual(voicedRuns(trackPitch(new Float32Array(16000), 16000).f0), []);
  const hiss = madeUpVoice([{ ms: 500 }], { noise: 0.3, random: mulberry32(1) });
  assert.deepEqual(voicedRuns(trackPitch(hiss, 16000).f0), []);
});

test('downsampling keeps a third of the samples from 48,000 a second', () => {
  assert.equal(downsample(new Float32Array(48000), 48000).length, 16000);
  assert.equal(downsample(new Float32Array(16000), 16000).length, 16000);
  assert.equal(downsample(new Float32Array(44100), 44100).length, 16000);
});

test('the clean-up halves an octave jump, smooths, and drops stretches under 40 ms', () => {
  assert.deepEqual(cleanPitch([0, 200, 200, 400, 200, 200, 0]), [0, 200, 200, 200, 200, 200, 0]);
  assert.deepEqual(cleanPitch([0, 200, 100, 200, 200, 200, 0]), [0, 200, 200, 200, 200, 200, 0]);
  assert.deepEqual(cleanPitch([0, 210, 220, 0, 0, 0, 0]), [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(voicedRuns([0, 5, 5, 0, 5]), [[1, 2], [4, 4]]);
});

test('semitones count from a reference, 12 to twice the pitch', () => {
  assert.equal(semitones(440, 220), 12);
  assert.equal(semitones(220, 220), 0);
  assert.equal(Math.round(semitones(207.65, 220) * 100) / 100, -1);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/pitch.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\pitch.js`.

- [ ] **Step 3: Write `docs/js/pitch.js`**

Create `docs/js/pitch.js`:

```js
// Pitch tracking of a recorded voice, for the tone check of the speaking panel (tones.js).
// Pure functions on plain number arrays, so Node tests them with made-up sounds.
//
// How it works, for a 1-second recording at 48,000 samples a second:
//   1. downsample() keeps every third sample after smoothing, so 16,000 samples a second are left.
//   2. trackPitch() looks at a 40 ms window every 10 ms, 100 windows in all. In each window the
//      YIN method (de Cheveigné and Kawahara, 2002) finds how far the wave must be shifted to
//      repeat itself. A shift of 64 samples at 16,000 a second is a pitch of 16000 / 64 = 250 Hz.
//      A window that does not repeat clearly (a breath, an "s", silence) gets pitch 0.
//   3. cleanPitch() removes single wrong values. A pitch twice or half that of its neighbours (an
//      octave jump) is halved or doubled, a 5-window median smooths the rest, and voiced
//      stretches shorter than 40 ms are dropped.
// semitones() turns a pitch into semitones from a reference, so 12 semitones is twice the pitch.
export const PITCH = Object.freeze({
  rate: 16000, // samples a second after downsampling
  hopMs: 10, // one pitch value every 10 ms
  winMs: 40, // each value looks at 40 ms of sound
  fmin: 70, // Hz, below a deep man's voice
  fmax: 500, // Hz, above a child's voice
  threshold: 0.15, // YIN's limit of how clearly a window must repeat
  loose: 0.4, // a window that repeats less clearly than this has no pitch
  silenceDb: 40, // a window this many decibels below the loudest one is silence
});

// Fewer samples a second. Each new sample is the mean of the old samples around it, which
// removes the high sounds that would otherwise fold back as noise. downsample(x, 48000) gives
// a third as many samples.
export function downsample(samples, fromRate, toRate = PITCH.rate) {
  if (fromRate === toRate) return Float32Array.from(samples);
  const ratio = fromRate / toRate;
  const n = Math.floor(samples.length / ratio);
  const out = new Float32Array(n);
  const half = Math.max(0, Math.floor(ratio / 2));
  for (let i = 0; i < n; i += 1) {
    const centre = Math.round(i * ratio);
    let sum = 0;
    let count = 0;
    for (let k = centre - half; k <= centre + half; k += 1) {
      if (k >= 0 && k < samples.length) { sum += samples[k]; count += 1; }
    }
    out[i] = count ? sum / count : 0;
  }
  return out;
}

// The pitch of one window by the YIN method, in Hz, or 0 when the window does not repeat
// clearly enough. `start` is the first sample of the window in `x`.
export function yinPitch(x, start, rate = PITCH.rate, {
  fmin = PITCH.fmin, fmax = PITCH.fmax, threshold = PITCH.threshold, loose = PITCH.loose,
} = {}) {
  const maxLag = Math.min(Math.floor(rate / fmin), Math.floor((x.length - start) / 2));
  const minLag = Math.max(2, Math.floor(rate / fmax));
  const size = Math.floor((PITCH.winMs / 1000) * rate) - maxLag;
  if (size < minLag || maxLag <= minLag) return 0;
  const d = new Float64Array(maxLag + 2);
  for (let lag = 1; lag <= maxLag + 1; lag += 1) {
    let sum = 0;
    for (let j = 0; j < size; j += 1) {
      const diff = x[start + j] - x[start + j + lag];
      sum += diff * diff;
    }
    d[lag] = sum;
  }
  // The cumulative mean normalised difference, d'(lag) = d(lag) * lag / (d(1) + ... + d(lag)).
  let running = 0;
  const dn = new Float64Array(maxLag + 2);
  dn[0] = 1;
  for (let lag = 1; lag <= maxLag + 1; lag += 1) {
    running += d[lag];
    dn[lag] = running > 0 ? (d[lag] * lag) / running : 1;
  }
  // The first dip under the threshold, or else the deepest dip when it is under `loose`.
  let lag = minLag;
  while (lag <= maxLag && dn[lag] >= threshold) lag += 1;
  if (lag > maxLag) {
    lag = minLag;
    for (let k = minLag + 1; k <= maxLag; k += 1) if (dn[k] < dn[lag]) lag = k;
    if (dn[lag] >= loose) return 0;
  }
  while (lag + 1 <= maxLag && dn[lag + 1] < dn[lag]) lag += 1;
  // A parabola through the three values around the dip finds the shift between two samples.
  const a = dn[lag - 1];
  const b = dn[lag];
  const c = dn[lag + 1];
  const bend = a - 2 * b + c;
  const shift = bend > 0 ? (0.5 * (a - c)) / bend : 0;
  return rate / (lag + Math.max(-1, Math.min(1, shift)));
}

// Loudness of one window in decibels (0 dB is a full-scale wave).
function decibels(x, start, size) {
  let sum = 0;
  const end = Math.min(x.length, start + size);
  for (let i = start; i < end; i += 1) sum += x[i] * x[i];
  return 10 * Math.log10(sum / Math.max(1, end - start) + 1e-12);
}

// The pitch track of a recording, with one value every 10 ms. Returns { hop, f0, db }, where
// f0[i] is the pitch in Hz of the window that starts at i * 10 ms (0 for no pitch) and db[i] its
// loudness. `samples` are numbers between -1 and 1 at `rate` samples a second.
export function trackPitch(samples, rate) {
  const x = downsample(samples, rate);
  const hop = Math.round((PITCH.hopMs / 1000) * PITCH.rate);
  const win = Math.round((PITCH.winMs / 1000) * PITCH.rate);
  const f0 = [];
  const db = [];
  for (let start = 0; start + win < x.length; start += hop) {
    db.push(decibels(x, start, win));
    f0.push(yinPitch(x, start));
  }
  const loudest = Math.max(-120, ...db);
  for (let i = 0; i < f0.length; i += 1) if (db[i] < loudest - PITCH.silenceDb) f0[i] = 0;
  return { hop: PITCH.hopMs / 1000, f0: cleanPitch(f0), db };
}

const median = (list) => {
  const s = list.slice().sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// The voiced stretches of a track, as [first, last] window numbers.
export function voicedRuns(f0) {
  const runs = [];
  let from = -1;
  for (let i = 0; i <= f0.length; i += 1) {
    const on = i < f0.length && f0[i] > 0;
    if (on && from < 0) from = i;
    if (!on && from >= 0) { runs.push([from, i - 1]); from = -1; }
  }
  return runs;
}

// Removes single wrong pitch values (see the top of this file). Returns a new list.
export function cleanPitch(f0, { minRun = 4 } = {}) {
  const out = f0.slice();
  if (!out.some((v) => v > 0)) return out;
  // An octave jump is found by comparing with the median of the voiced values within 15 windows.
  for (let i = 0; i < out.length; i += 1) {
    if (!out[i]) continue;
    const near = [];
    for (let k = Math.max(0, i - 15); k <= Math.min(out.length - 1, i + 15); k += 1) if (f0[k] > 0) near.push(f0[k]);
    const m = median(near);
    if (out[i] > 1.7 * m) out[i] /= 2;
    else if (out[i] < 0.6 * m) out[i] *= 2;
  }
  // A 5-window median inside each voiced stretch.
  const smooth = out.slice();
  for (const [a, b] of voicedRuns(out)) {
    for (let i = a; i <= b; i += 1) {
      smooth[i] = median(out.slice(Math.max(a, i - 2), Math.min(b, i + 2) + 1));
    }
  }
  for (const [a, b] of voicedRuns(smooth)) if (b - a + 1 < minRun) for (let i = a; i <= b; i += 1) smooth[i] = 0;
  return smooth;
}

// Semitones of `hz` above `ref` (negative below it). semitones(440, 220) === 12.
export function semitones(hz, ref) {
  return 12 * Math.log2(hz / ref);
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/pitch.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 5: Save the new file for offline use**

The release test (`tests/js/release.test.mjs`) checks that every file of the site is in the service worker's `APP_FILES`.

In `docs/sw.js`, replace:

```js
  'js/offline.js',
  'js/pinyin.js',
  'js/plan.js',
  'js/plugins.js',
```

with:

```js
  'js/offline.js',
  'js/pinyin.js',
  'js/pitch.js',
  'js/plan.js',
  'js/plugins.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 322`, `ℹ pass 322`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/pitch.js docs/sw.js tests/js/pitch.test.mjs tests/js/voice.mjs && git commit -F - <<'EOF'
feat(pitch): YIN pitch tracking every 10 ms, with octave fixes and smoothing, for the tone check

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 3: The tone check (`docs/js/tones.js`)

The spec's tone check measures the pitch of each spoken syllable and compares its shape (level, rising, dipping, falling) with the tone the card expects, relative to the learner's own voice range. Neutral tones are not judged.

**The tones to expect** come from the card pinyin `py`, which shows the changes of 一 and 不, while `pyNum` keeps the dictionary tones. On top comes the third-tone change, where a third tone before another third tone is said as a second tone.

| Word | `py` | `pyNum` | Tones to listen for |
|---|---|---|---|
| 一点儿 | yìdiǎnr | yi1 dian3 r5 | 4, 3 (the 儿 ending joins diǎn) |
| 不客气 | bú kèqi | bu4 ke4 qi5 | 2, 4, neutral |
| 你好 | nǐhǎo | ni3 hao3 | 2, 3 |
| 展览馆 | zhǎnlǎnguǎn | zhan3 lan3 guan3 | 2, 2, 3 |
| 我们 | wǒmen | wo3 men5 | 3, neutral (the neutral tone breaks a run of third tones) |

**The syllables.** `syllableSegments` cuts the pitch track into as many syllables as the word has. Short or quiet voiced stretches are dropped, two stretches less than 120 ms apart are joined (a third tone often breaks off in a creak), and a stretch that holds two syllables is split at its quietest point, where a consonant such as m, n or l sits between two vowels.

**The voice range.** A high and a low voice must give the same numbers, so pitch is measured in semitones from the middle of the learner's voice and divided by the learner's voice range. The range is learned from the learner's own recordings, as a count of pitch values per half semitone (`addToVoice`), and is trusted after 5 recordings (`voiceRange`). Before that, a try is judged by the shapes of its syllables without their height.

**The shapes.** `SHAPES` holds 5 points of each tone in each place of a word, averaged from the app's own recordings of the 1,712 fit words. A tone sounds different next to another tone. A 4th tone after another 4th starts lower, for example, so a later syllable is compared with the shape of its tone after the tone before it. A third tone at the end of a word also passes when it dips and rises fully, as textbooks teach it and as the user's tone samples of 2 October say it.

Worked example with the app's own recordings, in a voice whose middle is 257 Hz and whose range is 7.8 semitones. The recording of 我 wǒ has the pitch 229, 232, 233, 230 and 223 Hz at 10%, 30%, 50%, 70% and 90% of its syllable. In voice ranges from the middle these are −0.26, −0.23, −0.22, −0.25 and −0.31. The distances to the shapes of a word alone are 0.167 for tone 1, 0.065 for tone 2, 0.013 for tone 3 and 0.144 for tone 4, so a 3rd tone is heard and the try passes. The recording of 是 shì falls from 304 Hz to 204 Hz (0.37 down to −0.50), and its nearest shape is tone 4 (0.011). Said for 我, it fails with "Tone: heard a falling tone, it should go low."

The spec asks for a classifier at least 90% right on made-up shapes with noise. The test below makes 170 syllables from the shapes, each point moved at random by up to a tenth of the voice range, and they are heard right 168 times. Task 14 measures the check on the app's real recordings.

**Files:**
- Create: `docs/js/tones.js`
- Modify: `docs/sw.js`
- Test: `tests/js/tones.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/tones.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SHAPES, addToVoice, emptyVoice, expectedTones, judgeTones, syllableSegments, voiceRange,
} from '../../docs/js/tones.js';
import { trackPitch } from '../../docs/js/pitch.js';
import { mulberry32 } from '../../docs/js/rng.js';
import { madeUpVoice } from './voice.mjs';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const says = (w) => expectedTones(w).map((e) => e.say);

test('the tones to expect come from the card pinyin, with the changes of 一 and 不', () => {
  // pyNum keeps the dictionary tones (yi1 dian3 r5, bu4 ke4 qi5), the card pinyin shows how they are said.
  assert.deepEqual(expectedTones(word(data, '一点儿')), [{ text: 'yì', tone: 4, say: 4 }, { text: 'diǎnr', tone: 3, say: 3 }]);
  assert.deepEqual(says(word(data, '不客气')), [2, 4, 5]);
  assert.deepEqual(says(word(data, '对不起')), [4, 5, 3]);
  assert.deepEqual(says(word(data, '谢谢')), [4, 5]);
  assert.deepEqual(says(word(data, '我')), [3]);
});

test('a third tone before another third tone is said as a second tone', () => {
  assert.deepEqual(expectedTones({ py: 'nǐhǎo', pyNum: 'ni3 hao3' }),
    [{ text: 'nǐ', tone: 3, say: 2 }, { text: 'hǎo', tone: 3, say: 3 }]);
  assert.deepEqual(says({ py: 'zhǎnlǎnguǎn', pyNum: 'zhan3 lan3 guan3' }), [2, 2, 3]);
  assert.deepEqual(says({ py: 'wǒmen', pyNum: 'wo3 men5' }), [3, 5]); // a neutral tone breaks the run
});

// A voice whose middle is 200 Hz and whose range is 8 semitones, as the voice histogram of
// a learner who has made a few recordings.
const RANGE = { ref: 200, span: 8 };
const hzOf = (points) => points.map((p) => RANGE.ref * 2 ** ((p * RANGE.span) / 12));
let KNOWN = emptyVoice();
for (let i = 0; i < 6; i += 1) KNOWN = addToVoice(KNOWN, hzOf([-0.5, -0.25, 0, 0.25, 0.5]).flatMap((hz) => Array(40).fill(hz)));

test('the middle and the range of a learner\'s voice', () => {
  // Pitch values from 141 Hz to 283 Hz, evenly spread over 12 semitones around 200 Hz.
  const hz = Array.from({ length: 121 }, (_, i) => 200 * 2 ** ((i / 10 - 6) / 12));
  let voice = emptyVoice();
  for (let i = 0; i < 5; i += 1) voice = addToVoice(voice, hz);
  const r = voiceRange(voice);
  // The 10th and 90th percentiles are 4.8 semitones below and above the middle.
  assert.ok(Math.abs(r.ref - 200) < 2, `ref ${r.ref}`);
  assert.ok(Math.abs(r.span - 9.6) <= 0.2, `span ${r.span}`);
  assert.equal(r.known, true);
  // Before 5 recordings, the recording itself is used and the height of the voice is not trusted.
  assert.equal(voiceRange(addToVoice(emptyVoice(), hz), hz).known, false);
  assert.deepEqual(voiceRange(null, []), { ref: 200, span: 8, known: false });
});

test('a recording is cut into its syllables', () => {
  const track = (pieces) => trackPitch(madeUpVoice(pieces), 16000);
  // Two syllables with a silent consonant between them.
  const two = syllableSegments(track([{ ms: 100 }, { ms: 250, hz: [220] }, { ms: 80 }, { ms: 250, hz: [180] }, { ms: 100 }]), 2);
  assert.equal(two.length, 2);
  assert.ok(two[0][1] < 36 && two[1][0] > 38, JSON.stringify(two));
  // Two syllables joined by a voiced consonant, found at the dip in loudness.
  const joined = syllableSegments(track([{ ms: 100 }, { ms: 500, hz: [220, 200], dip: 0.9 }, { ms: 100 }]), 2);
  assert.ok(Math.abs(joined[0][1] - 33) <= 4, JSON.stringify(joined));
  // One syllable broken by a 60 ms creak is joined again.
  const one = syllableSegments(track([{ ms: 100 }, { ms: 150, hz: [200] }, { ms: 60 }, { ms: 150, hz: [180] }, { ms: 100 }]), 1);
  assert.equal(one.length, 1);
  assert.equal(syllableSegments(track([{ ms: 300 }]), 1), null);
});

// In made-up words each syllable follows the tone shape of its place in the word (SHAPES), with
// every point moved at random by up to a tenth of the voice range.
function sayShapes(shapes, random) {
  const pieces = [{ ms: 120 }];
  shapes.forEach((points, k) => {
    const wobbly = points.map((p) => p + (random() - 0.5) * 0.2);
    pieces.push({ ms: 220 + Math.round(random() * 120), hz: hzOf(wobbly) });
    pieces.push({ ms: k === shapes.length - 1 ? 150 : 60 + Math.round(random() * 40) });
  });
  return madeUpVoice(pieces, { noise: 0.005, random });
}
const shapeOfTone = (k, list) => {
  if (list.length === 1) return SHAPES.alone[list[0]];
  if (k === 0) return SHAPES.before[list[0]][list[1]] ?? SHAPES.alone[list[0]];
  return SHAPES.after[list[k - 1]][list[k]] ?? SHAPES.later[list[k]];
};
const PY = { 1: 'mā', 2: 'má', 3: 'mǎ', 4: 'mà' };

test('the tones of made-up words with noise are heard right at least 90% of the time', () => {
  const random = mulberry32(2026);
  let right = 0;
  let total = 0;
  const lists = [[1], [2], [3], [4]];
  for (const a of [1, 2, 3, 4]) for (const b of [1, 2, 3, 4]) if (!(a === 3 && b === 3)) lists.push([a, b]);
  for (let round = 0; round < 5; round += 1) {
    for (const list of lists) {
      const w = { py: list.map((t) => PY[t]).join(''), pyNum: list.map((t) => `ma${t}`).join(' ') };
      const sound = sayShapes(list.map((_, k) => shapeOfTone(k, list)), random);
      const j = judgeTones({ track: trackPitch(sound, 16000), word: w, voice: KNOWN });
      j.syllables.forEach((s) => { total += 1; if (s.heard === s.say) right += 1; });
    }
  }
  assert.equal(total, 5 * (4 + 2 * 15));
  console.log(`made-up words: ${right} of ${total} syllables right`);
  assert.ok(right / total >= 0.9, `${right} of ${total} right`);
});

test('a wrong tone is named, and the strictness decides how close is close enough', () => {
  // 再见 zàijiàn said with a rising 2nd syllable.
  const w = word(data, '再见');
  const sound = sayShapes([SHAPES.before[4][4], SHAPES.after[4][2]], mulberry32(3));
  const j = judgeTones({ track: trackPitch(sound, 16000), word: w, voice: KNOWN });
  assert.deepEqual(j.syllables.map((s) => [s.text, s.say, s.heard, s.ok]), [['zài', 4, 4, true], ['jiàn', 4, 2, false]]);
  assert.deepEqual([j.right, j.judged, j.share, j.pass], [1, 2, 0.5, false]);
  assert.equal(j.problem, '2nd syllable: heard a rising tone, it should fall.');
  // A one-syllable word names its tone.
  const one = judgeTones({ track: trackPitch(sayShapes([SHAPES.alone[4]], mulberry32(4)), 16000), word: word(data, '我'), voice: KNOWN });
  assert.equal(one.problem, 'Tone: heard a falling tone, it should go low.');
});

test('neutral tones are not judged, and silence does not pass', () => {
  const w = word(data, '谢谢');
  const j = judgeTones({ track: trackPitch(sayShapes([SHAPES.before[4][5], SHAPES.alone[1]], mulberry32(5)), 16000), word: w, voice: KNOWN });
  assert.deepEqual(j.syllables.map((s) => [s.say, s.heard, s.ok]), [[4, 4, true], [5, null, true]]);
  assert.equal(j.pass, true);
  const quiet = judgeTones({ track: trackPitch(new Float32Array(16000), 16000), word: w, voice: KNOWN });
  assert.deepEqual([quiet.pass, quiet.problem], [false, 'Could not hear 2 syllables.']);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/tones.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\tones.js`.

- [ ] **Step 3: Write `docs/js/tones.js`**

Create `docs/js/tones.js`:

```js
// The tone check of the speaking panel. It compares the pitch of each spoken syllable with the
// tone the word's pinyin expects. Pure functions, so Node tests them.
//
// The steps, for 你好 said by a learner:
//   1. expectedTones() reads the card pinyin, so nǐ is to be said as a 2nd tone and hǎo as a 3rd.
//   2. syllableSegments() cuts the pitch track of pitch.js into 2 syllables.
//   3. shapeOf() reads 5 pitch points of each syllable, at 10%, 30%, 50%, 70% and 90% of it, in
//      semitones from the middle of the learner's voice, divided by the learner's voice range
//      (voiceRange), so a high and a low voice give the same numbers.
//   4. toneScores() compares the 5 points with the shape of each tone in that place of a word
//      (SHAPES) and gives each tone a distance. The nearest tone is what was heard.
//   5. judgeTones() marks each syllable right or wrong by the strictness the learner chose, and
//      says whether the word passes.
import { CONFIG } from './config.js';
import { syllableSpans, syllables, toneOf } from './pinyin.js';
import { semitones, voicedRuns } from './pitch.js';

// The tones to expect, one item per syllable, from the card pinyin `py`, which already shows
// the changes of 一 and 不 (一点儿 is yìdiǎnr, 不客气 is bú kèqi), while `pyNum` keeps the
// dictionary tones (yi1 dian3 r5). The 儿 ending joins the syllable before it. A third tone
// before another third tone is said as a second tone (你好 nǐhǎo is said níhǎo), and in a run
// of third tones every one but the last changes (展览馆 zhǎnlǎnguǎn is said zhánlánguǎn).
// `say` is the tone to listen for. Neutral tones (5) are not judged.
//   expectedTones({ py: 'nǐhǎo', pyNum: 'ni3 hao3' })
//   gives [{ text: 'nǐ', tone: 3, say: 2 }, { text: 'hǎo', tone: 3, say: 3 }]
export function expectedTones(word) {
  const items = syllables(word.pyNum);
  const spans = syllableSpans(word.py, word.pyNum);
  const py = word.py.normalize('NFC');
  const out = [];
  items.forEach((item, k) => {
    if (k > 0 && item.base === 'r' && item.tone === 5) {
      out.at(-1).text += 'r';
      return;
    }
    const text = spans ? py.slice(spans[k][0], spans[k][1]) : item.base;
    const tone = spans ? toneOf(text) : item.tone;
    out.push({ text, tone, say: tone });
  });
  for (let k = 0; k + 1 < out.length; k += 1) if (out[k].tone === 3 && out[k + 1].tone === 3) out[k].say = 2;
  return out;
}

const mean = (list) => list.reduce((s, v) => s + v, 0) / list.length;

// Cuts a pitch track (trackPitch in pitch.js) into `n` syllables. Returns n segments
// [first, last] of window numbers, or null when the recording has too little voice.
// Voiced stretches shorter than 50 ms or 20 dB quieter than the loudest are dropped first.
// Then, while there are more stretches than syllables, the two nearest are joined when the gap
// is at most 120 ms (a third tone often breaks off in a creak), or else the weakest is dropped.
// While there are fewer, the longest is split at its deepest dip in loudness, where a
// consonant such as m, n or l sits between two vowels (我们 wǒmen is one voiced stretch).
export function syllableSegments({ f0, db }, n, { minFrames = 5, joinGap = 12 } = {}) {
  const level = ([a, b]) => mean(db.slice(a, b + 1));
  let runs = voicedRuns(f0).filter(([a, b]) => b - a + 1 >= minFrames);
  if (!runs.length) return null;
  const loudest = Math.max(...runs.map(level));
  runs = runs.filter((r) => level(r) > loudest - 20);
  const strength = (r) => level(r) + 10 * Math.log10(r[1] - r[0] + 1);
  while (runs.length > n) {
    let at = 0;
    for (let k = 1; k + 1 < runs.length; k += 1) if (runs[k + 1][0] - runs[k][1] < runs[at + 1][0] - runs[at][1]) at = k;
    if (runs[at + 1][0] - runs[at][1] <= joinGap) {
      runs.splice(at, 2, [runs[at][0], runs[at + 1][1]]);
    } else {
      let weak = 0;
      for (let k = 1; k < runs.length; k += 1) if (strength(runs[k]) < strength(runs[weak])) weak = k;
      runs.splice(weak, 1);
    }
  }
  while (runs.length < n) {
    let k = 0;
    for (let j = 1; j < runs.length; j += 1) if (runs[j][1] - runs[j][0] > runs[k][1] - runs[k][0]) k = j;
    const [a, b] = runs[k];
    if (b - a + 1 < 2 * minFrames + 1) return null;
    let cut = a + minFrames;
    let depth = -Infinity;
    for (let i = a + minFrames; i <= b - minFrames; i += 1) {
      const d = Math.min(Math.max(...db.slice(a, i)), Math.max(...db.slice(i + 1, b + 1))) - db[i];
      if (d > depth) { depth = d; cut = i; }
    }
    runs.splice(k, 1, [a, cut - 1], [cut + 1, b]);
  }
  return runs;
}

// ---- The learner's voice ----

// A voice is a count of pitch values per half semitone, from 55 Hz (bin 0) up 6 octaves, kept
// over the learner's recordings with older ones counting less, so the middle and the range of
// the voice follow the learner. ui/speak.js keeps it in this browser. The recordings themselves
// are never kept.
export const VOICE_BINS = 144;
export const emptyVoice = () => ({ bins: new Array(VOICE_BINS).fill(0), recordings: 0 });

// The voice with the pitch values (Hz) of one more recording added.
export function addToVoice(voice, hzList) {
  const bins = voice.bins.map((v) => v * CONFIG.speak.voiceKeep);
  for (const hz of hzList) {
    if (!(hz > 0)) continue;
    const bin = Math.round(2 * semitones(hz, 55));
    if (bin >= 0 && bin < VOICE_BINS) bins[bin] += 1;
  }
  return { bins, recordings: voice.recordings + 1 };
}

// The middle of a voice (`ref`, Hz) and its range (`span`, semitones from the 10th to the 90th
// percentile of its pitch values, kept between 4 and 14). With no voice yet, the recording's
// own pitch values are used and `known` is false, so the tone check looks at shapes only.
// A voice whose pitch values run from 205 Hz to 322 Hz with the middle at 274 Hz gives
// { ref: 274, span: 7.8, known: true }.
export function voiceRange(voice, hzList = []) {
  const known = voice && voice.recordings >= CONFIG.speak.voiceRecordings;
  const bins = known ? voice.bins : addToVoice(emptyVoice(), hzList).bins;
  const total = bins.reduce((s, v) => s + v, 0);
  if (!total) return { ref: 200, span: 8, known: false };
  // The pitch (semitones above 55 Hz) below which `share` of the values lie, read between the
  // edges of the half-semitone bin where the count passes that share.
  const at = (share) => {
    let run = 0;
    for (let i = 0; i < bins.length; i += 1) {
      if (run + bins[i] >= share * total) return (i - 0.5 + (share * total - run) / bins[i]) / 2;
      run += bins[i];
    }
    return (bins.length - 1) / 2;
  };
  const span = Math.min(14, Math.max(4, at(0.9) - at(0.1)));
  return { ref: 55 * 2 ** (at(0.5) / 12), span: Math.round(span * 10) / 10, known: Boolean(known) };
}

// ---- Tone shapes ----

// The 5 pitch points of each tone, in voice ranges from the middle of the voice (0.25 is a
// quarter of the range above the middle). They are the averages of the app's own recordings
// (the Xiaoxiao voice) of 1,712 words, the one-syllable words at even places of the words file
// and the two-syllable words at places 0, 3, 6 and so on, so they include how a tone sounds next
// to another. tests/browser/tones-check.js measures the check on the other words.
//   alone[tone]                   a word of one syllable
//   before[tone][next]            the first syllable of a longer word, before the tone `next`
//   after[previous][tone]         a later syllable, after the tone `previous`
//   later[tone]                   a later syllable after a neutral tone
//   fullThird                     a third tone that dips and rises fully, as textbooks teach it
//                                 (the user's tone samples of 2 October), also accepted at the
//                                 end of a word
export const SHAPES = Object.freeze({
  alone: { 1: [0.32, 0.34, 0.34, 0.33, 0.29], 2: [-0.33, -0.39, -0.34, -0.08, 0.20], 3: [-0.27, -0.40, -0.43, -0.36, -0.28], 4: [0.40, 0.40, 0.27, -0.10, -0.31] },
  before: {
    1: { 1: [0.28, 0.28, 0.31, 0.34, 0.31], 2: [0.38, 0.39, 0.44, 0.48, 0.47], 3: [0.34, 0.36, 0.41, 0.47, 0.46], 4: [0.29, 0.30, 0.35, 0.39, 0.40], 5: [0.35, 0.37, 0.43, 0.48, 0.49] },
    2: { 1: [-0.33, -0.41, -0.40, -0.29, -0.25], 2: [-0.28, -0.32, -0.21, 0.03, 0.22], 3: [-0.25, -0.28, -0.12, 0.16, 0.31], 4: [-0.35, -0.45, -0.44, -0.31, -0.18], 5: [-0.34, -0.43, -0.45, -0.34, -0.26] },
    3: { 1: [-0.31, -0.43, -0.54, -0.58, -0.55], 2: [-0.27, -0.38, -0.48, -0.52, -0.52], 4: [-0.30, -0.43, -0.55, -0.57, -0.50], 5: [-0.27, -0.39, -0.52, -0.57, -0.52] },
    4: { 1: [0.39, 0.34, 0.18, 0.01, -0.15], 2: [0.46, 0.45, 0.36, 0.21, 0.00], 3: [0.48, 0.46, 0.39, 0.27, 0.06], 4: [0.43, 0.40, 0.29, 0.14, -0.03], 5: [0.46, 0.47, 0.41, 0.25, 0.01] },
  },
  after: {
    1: { 1: [0.36, 0.32, 0.30, 0.29, 0.28], 2: [-0.05, -0.35, -0.49, -0.44, -0.24], 3: [-0.13, -0.44, -0.67, -0.74, -0.54], 4: [0.47, 0.41, 0.19, -0.14, -0.30] },
    2: { 1: [0.37, 0.40, 0.42, 0.44, 0.47], 2: [-0.08, -0.29, -0.38, -0.29, -0.11], 3: [-0.03, -0.31, -0.59, -0.70, -0.53], 4: [0.43, 0.45, 0.38, 0.10, -0.17] },
    3: { 1: [0.24, 0.31, 0.37, 0.40, 0.44], 2: [-0.41, -0.41, -0.28, 0.01, 0.23], 4: [0.25, 0.35, 0.37, 0.22, -0.07] },
    4: { 1: [0.23, 0.24, 0.25, 0.30, 0.30], 2: [-0.33, -0.50, -0.55, -0.43, -0.18], 3: [-0.35, -0.58, -0.72, -0.75, -0.50], 4: [0.12, 0.04, -0.12, -0.37, -0.46] },
  },
  later: { 1: [0.30, 0.31, 0.32, 0.34, 0.36], 2: [-0.20, -0.39, -0.44, -0.31, -0.10], 3: [-0.17, -0.44, -0.66, -0.72, -0.52], 4: [0.30, 0.30, 0.18, -0.07, -0.27] },
  fullThird: [-0.36, -0.51, -0.56, -0.27, 0.08],
});

const POINTS = [0.1, 0.3, 0.5, 0.7, 0.9];

// The 5 points of one syllable (segment [a, b] of the track), in voice ranges from the middle
// of the voice. Each point is the middle value of 3 neighbouring pitch values, which ignores a
// single stray one. Unvoiced windows inside the segment are skipped.
export function shapeOf(f0, [a, b], { ref, span }) {
  const values = f0.slice(a, b + 1).filter((v) => v > 0).map((v) => semitones(v, ref) / span);
  if (values.length < 3) return null;
  return POINTS.map((p) => {
    const i = Math.min(values.length - 1, Math.floor(p * values.length));
    const near = values.slice(Math.max(0, i - 1), i + 2).sort((x, y) => x - y);
    return near[near.length >> 1];
  });
}

// The shape of `tone` in place `k` of a word whose tones to listen for are `says`.
function shapeFor(tone, k, says) {
  if (says.length === 1) return SHAPES.alone[tone];
  if (k === 0) return SHAPES.before[tone][says[1]] ?? SHAPES.alone[tone];
  return SHAPES.after[says[k - 1]]?.[tone] ?? SHAPES.later[tone];
}

// How far a syllable's 5 points are from a tone shape. The shape may sit a little higher or
// lower, but a difference in height counts `levelWeight` times. `upTo` below 1 compares only
// the first part of the shape, because the end of a falling 4th tone often fades into a creak
// that has no pitch.
function distance(points, shape, levelWeight, upTo = 1) {
  const at = (q) => {
    const f = q * upTo * (shape.length - 1);
    const i = Math.min(shape.length - 2, Math.floor(f));
    return shape[i] + (shape[i + 1] - shape[i]) * (f - i);
  };
  const diff = points.map((v, i) => v - at(i / (points.length - 1)));
  const m = mean(diff);
  return mean(diff.map((d) => (d - m) ** 2)) + levelWeight * m * m;
}

const levelWeightOf = (range) => (range.known ? CONFIG.speak.levelWeight : 0);

// Each tone's distance for syllable `k` of a word whose tones to listen for are `says`, as
// { 1: 0.004, 2: 0.31, 3: 0.52, 4: 0.12 }. The smallest is the tone heard. Without a known
// voice (range.known false) the height of the voice is unknown, so only the shapes count.
export function toneScores(points, k, says, range = { known: true }) {
  const levelWeight = levelWeightOf(range);
  const out = {};
  for (const tone of [1, 2, 3, 4]) {
    const shape = shapeFor(tone, k, says);
    const ends = tone === 4 ? [0.6, 0.8, 1] : [1];
    out[tone] = Math.min(...ends.map((e) => distance(points, shape, levelWeight, e)));
  }
  return out;
}

const TONE_WORDS = { 1: 'a high level tone', 2: 'a rising tone', 3: 'a low tone', 4: 'a falling tone' };
const SHOULD = { 1: 'it should stay high and level', 2: 'it should rise', 3: 'it should go low', 4: 'it should fall' };
const ORDINAL = ['1st', '2nd', '3rd', '4th', '5th', '6th'];

// Judges the tones of one recording. track is trackPitch()'s result, word the card, voice the
// learner's voice (addToVoice) or null, and strictness 'gentle', 'normal' or 'strict'.
// Returns { syllables, judged, right, share, pass, problem }:
//   syllables  [{ text, say, heard, ok }], where heard is null and ok true for a neutral tone
//   share      right / judged, the share of judged syllables with the right tone
//   pass       share reaches the strictness's share (a word of neutral tones passes once its
//              syllables are heard)
//   problem    a sentence for the learner, such as '2nd syllable: heard a falling tone, it should rise.'
// A word whose syllables cannot be found gives pass false and the problem 'Could not hear 2 syllables.'
export function judgeTones({ track, word, voice = null, strictness = 'normal' }) {
  const rule = CONFIG.speak.strictness[strictness] ?? CONFIG.speak.strictness.normal;
  const expected = expectedTones(word);
  const says = expected.map((e) => e.say);
  const segments = syllableSegments(track, expected.length);
  const judgedCount = says.filter((t) => t !== 5).length;
  if (!segments) {
    const n = expected.length;
    return { syllables: [], judged: judgedCount, right: 0, share: 0, pass: false, problem: `Could not hear ${n} syllable${n === 1 ? '' : 's'}.` };
  }
  const range = voiceRange(voice, track.f0);
  const out = expected.map((e, k) => {
    if (e.say === 5) return { text: e.text, say: 5, heard: null, ok: true };
    const points = shapeOf(track.f0, segments[k], range);
    if (!points) return { text: e.text, say: e.say, heard: null, ok: false };
    const scores = toneScores(points, k, says, range);
    const best = Math.min(...Object.values(scores));
    const heard = Number(Object.keys(scores).find((t) => scores[t] === best));
    // A third tone at the end of a word may also dip and rise fully, as textbooks teach it.
    let mine = scores[e.say];
    if (e.say === 3 && k === expected.length - 1) mine = Math.min(mine, distance(points, SHAPES.fullThird, levelWeightOf(range)));
    return { text: e.text, say: e.say, heard, ok: mine <= best + rule.margin };
  });
  const right = out.filter((s) => s.say !== 5 && s.ok).length;
  const share = judgedCount ? right / judgedCount : 1;
  const wrong = out.findIndex((s) => !s.ok);
  let problem = null;
  if (wrong >= 0) {
    const s = out[wrong];
    const where = expected.length === 1 ? 'Tone' : `${ORDINAL[wrong] ?? `${wrong + 1}th`} syllable`;
    problem = s.heard ? `${where}: heard ${TONE_WORDS[s.heard]}, ${SHOULD[s.say]}.` : `${where}: could not hear its pitch.`;
  }
  return { syllables: out, judged: judgedCount, right, share, pass: share >= rule.share, problem };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/tones.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 5: Save the new file for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/study.js',
  'js/sync.js',
  'js/ui/card.js',
  'js/ui/confetti.js',
```

with:

```js
  'js/study.js',
  'js/sync.js',
  'js/tones.js',
  'js/ui/card.js',
  'js/ui/confetti.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 329`, `ℹ pass 329`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/tones.js docs/sw.js tests/js/tones.test.mjs && git commit -F - <<'EOF'
feat(tones): expected tones from the card pinyin, syllables, the learner's voice range and the tone check

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 4: The sound check and the verdict of a try (`docs/js/speakcheck.js`)

Chrome's speech recognizer, set to Chinese, writes down what it heard, with up to 5 guesses, best first. The spec's sound check passes when it heard the word's characters, or a homophone with the same pinyin and tones.

Worked examples, with the target 他 tā:

| The recognizer wrote | Cleaned | Verdict |
|---|---|---|
| 他 | 他 | passes, the same characters |
| 她。 | 她 | passes, 她 is read tā too |
| 塔 | 塔 | fails, 塔 is tǎ, a 3rd tone |
| 是 | 是 | fails, and the screen says "Heard: 是" |

Which characters sound alike comes from `readingsOf`, a map from each character of the words file to the syllables it is read as, both as the card shows them (一 in 一点儿 is yì) and with the dictionary tones (yī). The words file gives 2,637 characters. A neutral-tone syllable such as qi in 客气 kèqi matches its letters in any tone. The 儿 ending may be left out (一点 passes for 一点儿). Digits become Chinese numbers (`numberText`), so "10" is 十 and "101" is 一百零一, and 2 may also be 两.

`recognizerOutcome` says what the recognizer's answer means for a try (choice 11), and `verdict` joins the checks that ran. A try passes when every check that ran passed, and the numbers saved with the word are those of the last try, for example `{ tones: 0.5, heard: '是' }`.

**Files:**
- Create: `docs/js/speakcheck.js`
- Modify: `docs/sw.js`
- Test: `tests/js/speakcheck.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/speakcheck.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanHeard, matchWord, numberText, readingsOf, recognizerOutcome, syllablesOf, verdict,
} from '../../docs/js/speakcheck.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
// The fixture's words plus two that are not in it: 塔 tǎ (a tower) and 细 xì (thin).
const readings = readingsOf([...data.words, { hz: '塔', py: 'tǎ', pyNum: 'ta3' }, { hz: '细', py: 'xì', pyNum: 'xi4' }]);

test('each character gets the syllables it is read as, from the card pinyin and the dictionary tones', () => {
  assert.deepEqual([...readings.get('他')], ['tā']);
  assert.deepEqual([...readings.get('她')], ['tā']);
  // 一点儿 is yìdiǎnr on its card and yi1 dian3 r5 in the dictionary.
  assert.ok(readings.get('一').has('yì') && readings.get('一').has('yī'));
  assert.deepEqual(syllablesOf(word(data, '一点儿')), [{ ch: '一', py: 'yì' }, { ch: '点', py: 'diǎn' }, { ch: '儿', py: 'r' }]);
});

test('punctuation, spaces and full-width forms are cleaned away, and digits become characters', () => {
  assert.equal(cleanHeard('她。'), '她');
  assert.equal(cleanHeard(' 不客气！ '), '不客气');
  assert.equal(cleanHeard('ＯＫ，好的'), '好的');
  assert.equal(cleanHeard('我有 2 个'), '我有二个');
  assert.deepEqual([0, 1, 10, 12, 20, 101, 110, 1000, 1010, 20000, 10086].map(numberText),
    ['零', '一', '十', '十二', '二十', '一百零一', '一百一十', '一千', '一千零一十', '二万', '一万零八十六']);
});

test('the word passes as its own characters or a homophone with the same tones', () => {
  const ta = word(data, '他');
  assert.deepEqual(matchWord(ta, ['他'], readings), { ok: true, heard: '他', how: 'same' });
  assert.deepEqual(matchWord(ta, ['她。'], readings), { ok: true, heard: '她', how: 'sounds alike' });
  assert.deepEqual(matchWord(ta, ['塔'], readings), { ok: false, heard: '塔', how: null });
  // Any of the recognizer's guesses may match, and the first is reported when none does.
  assert.equal(matchWord(ta, ['塔', '它'], readings).heard, '它');
  assert.deepEqual(matchWord(ta, ['是'], readings), { ok: false, heard: '是', how: null });
  assert.deepEqual(matchWord(ta, [], readings), { ok: false, heard: '', how: null });
});

test('longer words, the 儿 ending, neutral tones and numbers', () => {
  assert.equal(matchWord(word(data, '不客气'), ['不客气。'], readings).ok, true);
  assert.equal(matchWord(word(data, '一点儿'), ['一点'], readings).ok, true); // without its 儿
  assert.equal(matchWord(word(data, '一点儿'), ['一点儿'], readings).ok, true);
  assert.equal(matchWord(word(data, '一点儿'), ['一'], readings).ok, false);
  // 系 in 没关系 méi guānxi has the neutral tone, so 细 xì sounds alike there.
  assert.deepEqual(matchWord(word(data, '没关系'), ['没关细'], readings), { ok: true, heard: '没关细', how: 'sounds alike' });
  // A recognizer that writes 2 for 两.
  assert.equal(matchWord(word(data, '两'), ['2'], readings).ok, true);
});

test('a try passes when every check that ran passed', () => {
  const tonesOk = { pass: true, share: 1, problem: null };
  const tonesBad = { pass: false, share: 0.5, problem: '2nd syllable: heard a falling tone, it should rise.' };
  assert.deepEqual(verdict({ tones: tonesOk, sounds: { ok: false, heard: '是' } }),
    { pass: false, problems: ['Heard: 是'], check: { tones: 1, heard: '是' } });
  assert.deepEqual(verdict({ tones: tonesBad, sounds: { ok: true, heard: '他' } }),
    { pass: false, problems: ['2nd syllable: heard a falling tone, it should rise.'], check: { tones: 0.5, heard: '他' } });
  // Offline, or when the recognizer failed, the tone check decides alone.
  assert.deepEqual(verdict({ tones: tonesOk }), { pass: true, problems: [], check: { tones: 1, heard: null } });
  assert.equal(verdict({ sounds: { ok: false, heard: '' } }).problems[0], 'The sound check heard nothing.');
  assert.equal(verdict({}).pass, false);
});

test('what the recognizer\'s answer means for a try', () => {
  assert.equal(recognizerOutcome(null, true), 'none');
  assert.equal(recognizerOutcome({ texts: [], error: 'network' }, true), 'failed');
  assert.equal(recognizerOutcome({ texts: [], error: 'not-allowed' }, false), 'failed');
  // No guess although the recording heard a voice means the recognizer missed it.
  assert.equal(recognizerOutcome({ texts: [], error: null }, true), 'empty');
  assert.equal(recognizerOutcome({ texts: [], error: 'no-speech' }, true), 'empty');
  // No guess and no voice means nothing was said, which the sound check reports.
  assert.equal(recognizerOutcome({ texts: [], error: 'no-speech' }, false), 'heard');
  assert.equal(recognizerOutcome({ texts: ['是'], error: null }, true), 'heard');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/speakcheck.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\speakcheck.js`.

- [ ] **Step 3: Write `docs/js/speakcheck.js`**

Create `docs/js/speakcheck.js`:

```js
// The sound check of the speaking panel, and the verdict of a try. Pure functions, so Node
// tests them.
//
// Chrome's speech recognizer, set to Chinese, writes down what it heard, for example '她。'.
// cleanHeard() keeps only the characters ('她'), and matchWord() accepts the word's own
// characters or a homophone with the same pinyin and tones. With the target 他 tā, 她 (tā)
// passes and 塔 (tǎ) fails. Which characters sound alike comes from readingsOf(), a map from
// each character of the words file to its pinyin syllables.
import { markTone, stripTones, syllableSpans, syllables } from './pinyin.js';

const HAN = /\p{Script=Han}/u;
const DIGITS = '零一二三四五六七八九';

// A whole number as Chinese characters, as a Chinese speaker reads it.
// numberText(2) === '二', numberText(10) === '十', numberText(15) === '十五',
// numberText(101) === '一百零一', numberText(20000) === '二万'.
export function numberText(n) {
  if (n === 0) return '零';
  if (n >= 100000000) return String(n);
  const below10000 = (m, leading) => {
    const parts = [[1000, '千'], [100, '百'], [10, '十'], [1, '']];
    let out = '';
    let zero = false;
    for (const [unit, name] of parts) {
      const d = Math.floor(m / unit) % 10;
      if (d === 0) {
        if (out) zero = true;
        continue;
      }
      if (zero) out += '零';
      zero = false;
      out += (d === 1 && unit === 10 && !out && leading ? '' : DIGITS[d]) + name;
    }
    return out;
  };
  const high = Math.floor(n / 10000);
  const low = n % 10000;
  if (!high) return below10000(low, true);
  return `${below10000(high, true)}万${low && low < 1000 ? '零' : ''}${below10000(low, false)}`;
}

// Cleans up what the recognizer heard. Full-width forms become plain ones, punctuation, spaces
// and Latin letters go, and numbers written in digits become characters.
// cleanHeard('我有 2 个。') gives '我有二个'.
export function cleanHeard(text) {
  const plain = String(text ?? '').normalize('NFKC').replace(/\d+/g, (d) => numberText(Number(d)));
  return [...plain].filter((ch) => HAN.test(ch)).join('');
}

// 2 may also mean 两, as in 两个 and 两百. withLiang('二个') gives '两个'.
const withLiang = (text) => text.replaceAll('二', '两');

// The syllables of a word, one per character of its characters when they line up, as
// [{ ch: '他', py: 'tā' }], from the card pinyin `py` (so 一 in 一点儿 is yì). The 儿 ending is
// { ch: '儿', py: 'r' }. Returns null when the characters and the syllables do not line up.
export function syllablesOf(word) {
  const chars = [...word.hz].filter((ch) => HAN.test(ch));
  const items = syllables(word.pyNum);
  const spans = syllableSpans(word.py, word.pyNum);
  if (!spans || chars.length !== items.length) return null;
  const py = word.py.normalize('NFC').toLowerCase();
  return chars.map((ch, i) => ({ ch, py: py.slice(spans[i][0], spans[i][1]) }));
}

// Each character of the words file with the toned syllables it is read as, from the card
// pinyin and from the dictionary tones (pyNum). For example 他 gives Set { 'tā' } and 一 gives
// Set { 'yī', 'yì', 'yí' }.
export function readingsOf(words) {
  const map = new Map();
  const add = (ch, syllable) => {
    if (!map.has(ch)) map.set(ch, new Set());
    map.get(ch).add(syllable);
  };
  for (const w of words) {
    const list = syllablesOf(w);
    if (!list) continue;
    const items = syllables(w.pyNum);
    list.forEach(({ ch, py }, i) => {
      add(ch, py);
      const { base, tone } = items[i];
      add(ch, markTone(base, tone));
    });
  }
  return map;
}

// True when the character `ch` can be read as the syllable `py`. A neutral-tone syllable (no
// mark, as qi in 客气 kèqi) matches any reading with the same letters.
function soundsLike(ch, py, readings) {
  const set = readings.get(ch);
  if (!set) return false;
  if (set.has(py)) return true;
  const neutral = stripTones(py) === py;
  return neutral && [...set].some((r) => stripTones(r) === py);
}

// Whether what the recognizer heard is the word. heardList holds its guesses, best first.
// Returns { ok, heard, how }, where heard is the cleaned guess that matched, or the first
// guess when none did, and how is 'same' (the word's characters), 'sounds alike' (a homophone)
// or null. A word ending in the 儿 ending also passes without its 儿 (一点 for 一点儿).
//   matchWord(他, ['她。'], readings) gives { ok: true, heard: '她', how: 'sounds alike' }
export function matchWord(word, heardList, readings) {
  const target = [...word.hz].filter((ch) => HAN.test(ch)).join('');
  const parts = syllablesOf(word);
  const cleaned = heardList.map(cleanHeard).filter(Boolean);
  const guesses = cleaned.flatMap((h) => (withLiang(h) === h ? [h] : [h, withLiang(h)]));
  const short = parts && parts.at(-1).py === 'r' ? target.slice(0, -1) : null;
  for (const h of guesses) {
    if (h === target || h === short) return { ok: true, heard: h, how: 'same' };
  }
  if (parts) {
    for (const h of guesses) {
      const chars = [...h];
      const list = chars.length === parts.length ? parts : short && chars.length === parts.length - 1 ? parts.slice(0, -1) : null;
      if (list && list.every((p, i) => chars[i] === p.ch || soundsLike(chars[i], p.py, readings))) {
        return { ok: true, heard: h, how: 'sounds alike' };
      }
    }
  }
  return { ok: false, heard: cleaned[0] ?? '', how: null };
}

// What the recognizer's answer means for one try. heard is its { texts, error } (ui/recognize.js
// listen) or null when it did not listen, and voice is true when the recording heard a voice.
//   'failed'  an error other than 'no-speech' (for example 'network' or 'not-allowed'), so the
//             recognizer does not work here and the tone check decides alone from now on
//   'empty'   no guess at all, although the recording heard a voice, so the recognizer missed it
//             and the tone check decides this try alone
//   'heard'   its guesses go to matchWord(), and no guess with no voice means nothing was said
//   'none'    it did not listen
export function recognizerOutcome(heard, voice) {
  if (!heard) return 'none';
  if (heard.error && heard.error !== 'no-speech') return 'failed';
  if (heard.texts.length === 0 && voice) return 'empty';
  return 'heard';
}

// The verdict of one try from the checks that ran. tones is judgeTones()'s result (tones.js)
// or null, and sounds is matchWord()'s result or null. A try passes when every check that ran
// passed. Returns { pass, problems, check }, where check is what is saved with the word:
// { tones: the share of syllables with the right tone, heard: what the recognizer heard }.
//   verdict({ tones: { pass: true, share: 1 }, sounds: { ok: false, heard: '是' } })
//   gives { pass: false, problems: ['Heard: 是'], check: { tones: 1, heard: '是' } }
export function verdict({ tones = null, sounds = null }) {
  const problems = [];
  if (sounds && !sounds.ok) problems.push(sounds.heard ? `Heard: ${sounds.heard}` : 'The sound check heard nothing.');
  if (tones && !tones.pass && tones.problem) problems.push(tones.problem);
  const ran = Boolean(tones || sounds);
  return {
    pass: ran && (!tones || tones.pass) && (!sounds || sounds.ok),
    problems,
    check: { tones: tones ? Math.round(tones.share * 100) / 100 : null, heard: sounds ? sounds.heard : null },
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/speakcheck.test.mjs`
Expected: `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`.

- [ ] **Step 5: Save the new file for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/session.js',
  'js/sheet.js',
  'js/srs.js',
  'js/stats.js',
```

with:

```js
  'js/session.js',
  'js/sheet.js',
  'js/speakcheck.js',
  'js/srs.js',
  'js/stats.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 335`, `ℹ pass 335`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/speakcheck.js docs/sw.js tests/js/speakcheck.test.mjs && git commit -F - <<'EOF'
feat(speakcheck): the sound check with homophones, punctuation and numbers, and the verdict of a try

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 5: The speaking list (`docs/js/speaklist.js`)

The spec's section 2 defines the speaking list of a study day. It holds every word with a word record whose `lessonDay` or `lastReview` is that day (new words, lessons that ended without passing, and reviewed words), and every word whose latest speak event is a skip, with no pass since. The list is done when every word in it has a speak event on that day.

Worked example (the test's data), on 6 October:

| Word | What happened | On the list? |
|---|---|---|
| c, a | reviewed today, in that order | yes, first, in the order they were answered |
| b | a new word learned today | yes |
| d | a new word whose lesson ended without passing today | yes |
| e | learned on 5 October, not studied today | no |
| x | skipped on 4 October | yes, carried over |
| z | skipped on 3 October, said well on 4 October | no, its latest speak event is a pass |

So the list is c, a, b, d, x. Before any learning on a day the list holds only the carried words. A word skipped again today comes back tomorrow.

`spokenWellBefore` tells the routine (Task 6) that a word was said well on an earlier day, so it starts at "Your turn".

**Files:**
- Create: `docs/js/speaklist.js`
- Modify: `docs/sw.js`
- Test: `tests/js/speaklist.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/speaklist.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { speakList, speakStatus, spokenWellBefore } from '../../docs/js/speaklist.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';

const DAY = '2026-10-06';
let seq = 0;
const ans = (day, id, kind = 'final') => ({ seq: ++seq, day, kind, id, grade: 'right' });
const spoke = (day, id, result) => ({ seq: ++seq, day, kind: 'speak', id, result, tries: 1, check: { tones: 1, heard: null } });
const reviewed = (id, day) => ({ ...learnedProgress(id, '2026-10-01'), step: 2, lastReview: day });

// On 6 October c and a are reviewed (in that order), b is a new word learned, and d is a new word
// whose lesson ended without passing. e was learned on 5 October and is not studied today.
function day6() {
  const progress = [
    reviewed('a', DAY), learnedProgress('b', DAY), reviewed('c', DAY), failedLessonProgress('d', DAY), learnedProgress('e', '2026-10-05'),
  ];
  const events = [
    ans('2026-10-05', 'e'), spoke('2026-10-05', 'e', 'pass'),
    ans(DAY, 'c', 'review'), ans(DAY, 'a', 'review'), ans(DAY, 'b', 'check'), ans(DAY, 'd', 'check'), ans(DAY, 'b'), ans(DAY, 'd'),
  ];
  return { progress, events };
}

test('the list holds the words studied that day, new and reviewed, in the order they were studied', () => {
  const { progress, events } = day6();
  assert.deepEqual(speakList({ progress, events, day: DAY }), ['c', 'a', 'b', 'd']);
  assert.deepEqual(speakList({ progress, events, day: '2026-10-05' }), ['e']);
});

test('a word skipped on its latest earlier day comes back until it is spoken', () => {
  const { progress, events } = day6();
  // x was skipped on 4 October and y on 5 October, z was skipped on 3 and passed on 4 October.
  const more = [
    spoke('2026-10-03', 'z', 'skip'), spoke('2026-10-04', 'x', 'skip'), spoke('2026-10-04', 'z', 'pass'), spoke('2026-10-05', 'y', 'skip'),
  ];
  const all = [...events, ...more];
  assert.deepEqual(speakList({ progress, events: all, day: DAY }), ['c', 'a', 'b', 'd', 'x', 'y']);
  // Skipped again today, x comes back tomorrow. Spoken today, y does not.
  const today = [...all, spoke(DAY, 'x', 'skip'), spoke(DAY, 'y', 'listened')];
  assert.deepEqual(speakList({ progress, events: today, day: '2026-10-07' }), ['x']);
  // Before any learning on 7 October, the list holds only the carried word.
  assert.deepEqual(speakStatus({ progress, events: today, day: '2026-10-07' }), { list: ['x'], done: [], left: ['x'] });
});

test('the list is done when every word has a speak event that day', () => {
  const { progress, events } = day6();
  const half = [...events, spoke(DAY, 'c', 'pass'), spoke(DAY, 'a', 'skip')];
  assert.deepEqual(speakStatus({ progress, events: half, day: DAY }), { list: ['c', 'a', 'b', 'd'], done: ['c', 'a'], left: ['b', 'd'] });
  const all = [...half, spoke(DAY, 'b', 'listened'), spoke(DAY, 'd', 'pass')];
  assert.deepEqual(speakStatus({ progress, events: all, day: DAY }).left, []);
});

test('a word spoken well on an earlier day is known', () => {
  const { events } = day6();
  assert.equal(spokenWellBefore(events, 'e', DAY), true);
  assert.equal(spokenWellBefore(events, 'e', '2026-10-05'), false);
  assert.equal(spokenWellBefore([spoke('2026-10-05', 'f', 'skip')], 'f', DAY), false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/speaklist.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\speaklist.js`.

- [ ] **Step 3: Write `docs/js/speaklist.js`**

Create `docs/js/speaklist.js`:

```js
// The speaking list of a study day (speaking practice spec of 2026-10-03, section 2). Pure
// functions over the saved word records and events, so Node tests them.
//
// The list of a day holds every word studied that day, which is every word record whose
// lessonDay or lastReview is the day (new words, lessons that ended without passing, and reviewed
// words), and every word whose latest speak event before that day is a skip. It is done when
// every word in it has a speak event on that day. A speak event is saved once per finished word:
//   { day, kind: 'speak', id, result: 'pass' | 'skip' | 'listened', tries, check: { tones, heard }, ts }
import { liveEvents } from './stats.js';

export const SPEAK_RESULTS = Object.freeze(['pass', 'skip', 'listened']);

const speakEvents = (events) => events.filter((e) => e.kind === 'speak');

// The words whose latest speak event before `day` is a skip, oldest skip first.
function carried(speaks, day) {
  const last = new Map();
  for (const e of speaks) if (e.day < day) last.set(e.id, e);
  return [...last.values()].filter((e) => e.result === 'skip').sort((a, b) => a.seq - b.seq).map((e) => e.id);
}

// The IDs of the day's speaking list. The words studied that day come first, in the order they
// were first answered, then the words carried over from earlier skips.
//   speakList({ progress, events, day: '2026-10-06' }) gives ['w0013', 'w0014', ..., 'w0002']
export function speakList({ progress, events, day }) {
  const studied = new Set(progress.filter((p) => p.lessonDay === day || p.lastReview === day).map((p) => p.id));
  const order = [];
  for (const e of liveEvents(events.filter((x) => x.day === day))) {
    if (studied.has(e.id) && !order.includes(e.id)) order.push(e.id);
  }
  for (const id of [...studied].sort()) if (!order.includes(id)) order.push(id);
  for (const id of carried(speakEvents(events), day)) if (!order.includes(id)) order.push(id);
  return order;
}

// The day's list with what is done and what is left, as { list, done, left }. A word is done
// when it has a speak event on the day.
export function speakStatus({ progress, events, day }) {
  const list = speakList({ progress, events, day });
  const spoken = new Set(speakEvents(events).filter((e) => e.day === day).map((e) => e.id));
  return { list, done: list.filter((id) => spoken.has(id)), left: list.filter((id) => !spoken.has(id)) };
}

// True when the word was spoken well (result 'pass') on a day before `day`. Such a word starts
// at "Your turn" (speakflow.js).
export function spokenWellBefore(events, id, day) {
  return events.some((e) => e.kind === 'speak' && e.id === id && e.result === 'pass' && e.day < day);
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/speaklist.test.mjs`
Expected: `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 5: Save the new file for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/sheet.js',
  'js/speakcheck.js',
  'js/srs.js',
  'js/stats.js',
```

with:

```js
  'js/sheet.js',
  'js/speakcheck.js',
  'js/speaklist.js',
  'js/srs.js',
  'js/stats.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 339`, `ℹ pass 339`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/speaklist.js docs/sw.js tests/js/speaklist.test.mjs && git commit -F - <<'EOF'
feat(speaklist): the day's speaking list, with words skipped earlier carried over until spoken

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 6: The routine for one word (`docs/js/speakflow.js`)

The spec's section 3 is the routine for one word. It is written as a small state machine with no page in it, so Node tests every path. The screen (Task 13) carries out the effects of each phase and sends an input back.

| Phase | The screen does | Then |
|---|---|---|
| listen | plays the word, then its example sentence once | repeat, round 1 |
| repeat | plays the word, then pauses for the learner to say it ("1 of 3") | the next round, or turn after round 3 |
| turn | shows the microphone button ("Your turn") | record, or sounds when the word is said twice |
| sounds | lets the recognizer listen alone (mode 'twice') | record |
| record | records, with the recognizer listening too in mode 'one' | done ('pass'), or missed |
| missed | shows what was wrong and plays the word again | turn, or listen for a word spoken well before, after its first miss |
| done | saves the word ('pass', 'skip' or 'listened') | the next word |

Skip ends any phase as 'skip'. There is no limit on tries. Without a microphone (mode 'none') a word runs listen and the three repeats and ends as 'listened'.

Worked example of the pause. The word 我 plays for 0.8 seconds on the phone, so the pause after it in each repeat round is 1.5 × 0.8 + 1 = 2.2 seconds (`pauseMs`). A new word takes listen (about 4 seconds), three rounds (9 seconds) and a try (3 to 5 seconds), close to the spec's "about 30 seconds" with its tries.

**Files:**
- Create: `docs/js/speakflow.js`
- Modify: `docs/sw.js`
- Test: `tests/js/speakflow.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/speakflow.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ROUNDS, effectsOf, next, pauseMs, startWord } from '../../docs/js/speakflow.js';

const TONES_OK = { pass: true, share: 1, problem: null };
const TONES_BAD = { pass: false, share: 0, problem: 'Tone: heard a falling tone, it should go low.' };
const HEARD_OK = { ok: true, heard: '我', how: 'same' };
const HEARD_BAD = { ok: false, heard: '是', how: null };

// Sends inputs one by one and lists the phases passed through, as 'repeat 2' for round 2.
function run(state, inputs) {
  const seen = [];
  let s = state;
  for (const input of inputs) {
    s = next(s, input);
    seen.push(s.phase === 'repeat' ? `repeat ${s.round}` : s.phase);
  }
  return { s, seen };
}
const DONE = { type: 'done' };

test('the pause after a word is 1.5 times its sound plus 1 second', () => {
  assert.equal(pauseMs(0.8), 2200);
  assert.equal(pauseMs(0), 1000);
});

test('a new word is listened to, repeated three times, then tried, and the try passes', () => {
  const start = startWord({ id: 'w0003', mode: 'tones' });
  assert.equal(start.phase, 'listen');
  assert.deepEqual(effectsOf(start), [{ type: 'play', what: 'word' }, { type: 'play', what: 'sentence' }]);
  const { s, seen } = run(start, [DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', tones: TONES_OK }]);
  assert.equal(ROUNDS, 3);
  assert.deepEqual(seen, ['repeat 1', 'repeat 2', 'repeat 3', 'turn', 'record', 'done']);
  assert.deepEqual(effectsOf(next(start, DONE)), [{ type: 'play', what: 'word' }, { type: 'pause' }]);
  assert.deepEqual(effectsOf(s), [{ type: 'finish', result: 'pass', tries: 1, check: { tones: 1, heard: null } }]);
});

test('a miss shows what was wrong, plays the word again and asks again, with no limit on tries', () => {
  let s = run(startWord({ id: 'w0003', mode: 'one' }), [DONE, DONE, DONE, DONE, { type: 'tap' }]).s;
  assert.deepEqual(effectsOf(s), [{ type: 'record', sounds: true }]);
  for (let i = 1; i <= 5; i += 1) {
    s = next(s, { type: 'heard', tones: TONES_OK, sounds: HEARD_BAD });
    assert.deepEqual([s.phase, s.tries, s.problems], ['missed', i, ['Heard: 是']]);
    assert.deepEqual(effectsOf(s), [{ type: 'play', what: 'word' }]);
    s = next(next(s, DONE), { type: 'tap' });
  }
  s = next(s, { type: 'heard', tones: TONES_OK, sounds: HEARD_OK });
  assert.deepEqual([s.phase, s.result, s.tries, s.check], ['done', 'pass', 6, { tones: 1, heard: '我' }]);
});

test('Skip ends the word in any phase', () => {
  for (const phase of ['listen', 'repeat', 'turn', 'record', 'missed']) {
    let s = startWord({ id: 'w0003', mode: 'tones' });
    const path = [DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', tones: TONES_BAD }];
    for (const input of path) {
      if (s.phase === phase) break;
      s = next(s, input);
    }
    assert.equal(s.phase, phase);
    const skipped = next(s, { type: 'skip' });
    assert.deepEqual([skipped.phase, skipped.result], ['done', 'skip']);
  }
});

test('a word spoken well before starts at your turn, and its first miss runs listen and repeat', () => {
  const start = startWord({ id: 'w0003', spokenWell: true, mode: 'tones' });
  assert.deepEqual([start.phase, effectsOf(start)], ['turn', []]);
  const { s, seen } = run(start, [
    { type: 'tap' }, { type: 'heard', tones: TONES_BAD }, DONE, DONE, DONE, DONE, DONE,
    { type: 'tap' }, { type: 'heard', tones: TONES_BAD }, DONE,
  ]);
  // After the first miss the word is taught again. After the second it is only played again.
  assert.deepEqual(seen, ['record', 'missed', 'listen', 'repeat 1', 'repeat 2', 'repeat 3', 'turn', 'record', 'missed', 'turn']);
  assert.equal(s.tries, 2);
});

test('when the phone cannot share the microphone, the word is said twice, sounds first', () => {
  const { s, seen } = run(startWord({ id: 'w0003', mode: 'twice' }), [
    DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', sounds: HEARD_OK }, { type: 'heard', tones: TONES_OK },
  ]);
  assert.deepEqual(seen.slice(-3), ['sounds', 'record', 'done']);
  assert.deepEqual(effectsOf(run(startWord({ id: 'w0003', mode: 'twice' }), [DONE, DONE, DONE, DONE, { type: 'tap' }]).s), [{ type: 'listen' }]);
  assert.deepEqual([s.result, s.check], ['pass', { tones: 1, heard: '我' }]);
  // A wrong sound fails the try even with the right tones.
  const bad = run(startWord({ id: 'w0003', mode: 'twice' }), [
    DONE, DONE, DONE, DONE, { type: 'tap' }, { type: 'heard', sounds: HEARD_BAD }, { type: 'heard', tones: TONES_OK },
  ]).s;
  assert.deepEqual([bad.phase, bad.problems], ['missed', ['Heard: 是']]);
});

test('when the recognizer fails, the tone check decides alone', () => {
  // When the word is said twice and the recognizer fails the first time, the recording follows at once.
  let s = run(startWord({ id: 'w0003', mode: 'twice' }), [DONE, DONE, DONE, DONE, { type: 'tap' }]).s;
  s = next(s, { type: 'mode', mode: 'tones' });
  assert.deepEqual([s.phase, s.mode], ['record', 'tones']);
  s = next(s, { type: 'heard', tones: TONES_OK });
  assert.deepEqual([s.result, s.check], ['pass', { tones: 1, heard: null }]);
});

test('without a microphone the word is listened to and repeated, and ends as listened', () => {
  const { s, seen } = run(startWord({ id: 'w0003', mode: 'none' }), [DONE, DONE, DONE, DONE]);
  assert.deepEqual(seen, ['repeat 1', 'repeat 2', 'repeat 3', 'done']);
  assert.deepEqual(effectsOf(s), [{ type: 'finish', result: 'listened', tries: 0, check: { tones: null, heard: null } }]);
  // A word spoken well before is taught too when there is no microphone.
  assert.equal(startWord({ id: 'w0003', spokenWell: true, mode: 'none' }).phase, 'listen');
  // When the microphone is refused at the first tap, a new word has been repeated already and ends.
  const turn = run(startWord({ id: 'w0003', mode: 'one' }), [DONE, DONE, DONE, DONE]).s;
  assert.deepEqual([next(turn, { type: 'mode', mode: 'none' }).phase, next(turn, { type: 'mode', mode: 'none' }).result], ['done', 'listened']);
  // A word that started at your turn is first taught.
  const review = next(startWord({ id: 'w0003', spokenWell: true, mode: 'one' }), { type: 'mode', mode: 'none' });
  assert.equal(review.phase, 'listen');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/speakflow.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\speakflow.js`.

- [ ] **Step 3: Write `docs/js/speakflow.js`**

Create `docs/js/speakflow.js`:

```js
// The routine for one word of the speaking panel (speaking practice spec of 2026-10-03,
// section 3), as a small state machine. It never touches the page, so Node tests every path.
// The screen (ui/speak.js) carries out the `effects` of each phase, then sends an input back.
//
// The phases:
//   listen   the word plays, then its example sentence once        effects: play word, play sentence
//   repeat   round 1 to 3, the word plays and a pause follows,       effects: play word, pause
//            for the learner to say it
//   turn     "Your turn", which waits for the microphone button     effects: none
//   sounds   the first time in say-it-twice mode, for the recognizer effects: listen
//   record   the recording for the tone check (and the recognizer,  effects: record
//            when it shares the microphone)
//   missed   what was wrong is shown, and the word plays again      effects: play word
//   done     the word is finished                                   effects: finish
//
// The modes say which checks run on this phone (ui/recognize.js finds out):
//   one    both checks from one recording
//   twice  both checks, with the word said twice, first for the recognizer
//   tones  the tone check alone (offline, or the recognizer failed)
//   none   without a microphone the word is listened to and repeated, and ends as 'listened'
//
// A new word goes listen, repeat 1, 2, 3, turn. A word spoken well on an earlier day starts at
// turn, and its first miss runs listen and repeat before the next try. Skip ends any phase.
//   let s = startWord({ id: 'w0003', spokenWell: false, mode: 'tones' });   // phase 'listen'
//   s = next(s, { type: 'done' });                                            // phase 'repeat', round 1
import { verdict } from './speakcheck.js';

export const ROUNDS = 3;
export const MODES = Object.freeze(['one', 'twice', 'tones', 'none']);

// The pause after a word in the repeat rounds, 1.5 times the length of its sound plus 1 second.
// A word that plays for 0.8 seconds gives 2,200 ms.
export function pauseMs(seconds) {
  return Math.round(1500 * seconds + 1000);
}

export function startWord({ id, spokenWell = false, mode = 'tones' }) {
  const atTurn = spokenWell && mode !== 'none';
  return {
    id, mode, phase: atTurn ? 'turn' : 'listen', round: 0, tries: 0, repeated: !atTurn, startedAtTurn: atTurn,
    sounds: null, problems: [], check: { tones: null, heard: null }, result: null,
  };
}

const finish = (s, result) => ({ ...s, phase: 'done', result });
const listenAgain = (s) => ({ ...s, phase: 'listen', round: 0, repeated: true });

// The state after one input. The inputs are
//   { type: 'done' }                  the effects of the phase have finished
//   { type: 'tap' }                   the microphone button, in 'turn'
//   { type: 'heard', sounds, tones }  the checks of a recording, as matchWord() and judgeTones()
//                                     give them (only sounds in the 'sounds' phase), either may be null
//   { type: 'mode', mode }            the checks changed, for example to 'tones' when the recognizer
//                                     failed, or to 'none' when the microphone was refused
//   { type: 'skip' }                  the Skip button
export function next(s, input) {
  if (s.phase === 'done') return s;
  if (input.type === 'skip') return finish(s, 'skip');
  if (input.type === 'mode') {
    const changed = { ...s, mode: input.mode };
    if (input.mode !== 'none') return s.phase === 'sounds' && input.mode !== 'twice' ? { ...changed, phase: 'record' } : changed;
    if (s.phase === 'listen' || s.phase === 'repeat') return changed;
    return s.repeated && s.round >= ROUNDS ? finish(changed, 'listened') : listenAgain(changed);
  }
  switch (s.phase) {
    case 'listen':
      return input.type === 'done' ? { ...s, phase: 'repeat', round: 1 } : s;
    case 'repeat':
      if (input.type !== 'done') return s;
      if (s.round < ROUNDS) return { ...s, round: s.round + 1 };
      return s.mode === 'none' ? finish(s, 'listened') : { ...s, phase: 'turn' };
    case 'turn':
      if (input.type !== 'tap') return s;
      return { ...s, phase: s.mode === 'twice' ? 'sounds' : 'record', sounds: null };
    case 'sounds':
      return input.type === 'heard' ? { ...s, phase: 'record', sounds: input.sounds ?? null } : s;
    case 'record': {
      if (input.type !== 'heard') return s;
      const sounds = s.mode === 'twice' ? s.sounds : input.sounds ?? null;
      const v = verdict({ tones: input.tones ?? null, sounds: s.mode === 'tones' ? null : sounds });
      const tried = { ...s, tries: s.tries + 1, check: v.check, problems: v.problems, sounds: null };
      return v.pass ? finish(tried, 'pass') : { ...tried, phase: 'missed' };
    }
    case 'missed':
      if (input.type !== 'done') return s;
      return s.startedAtTurn && !s.repeated ? listenAgain(s) : { ...s, phase: 'turn' };
    default:
      return s;
  }
}

// What the screen does in a phase, in order.
export function effectsOf(s) {
  switch (s.phase) {
    case 'listen': return [{ type: 'play', what: 'word' }, { type: 'play', what: 'sentence' }];
    case 'repeat': return [{ type: 'play', what: 'word' }, { type: 'pause' }];
    case 'sounds': return [{ type: 'listen' }];
    case 'record': return [{ type: 'record', sounds: s.mode === 'one' }];
    case 'missed': return [{ type: 'play', what: 'word' }];
    case 'done': return [{ type: 'finish', result: s.result, tries: s.tries, check: s.check }];
    default: return [];
  }
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/speakflow.test.mjs`
Expected: `ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 5: Save the new file for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/sheet.js',
  'js/speakcheck.js',
  'js/speaklist.js',
  'js/srs.js',
```

with:

```js
  'js/sheet.js',
  'js/speakcheck.js',
  'js/speakflow.js',
  'js/speaklist.js',
  'js/srs.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 347`, `ℹ pass 347`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/speakflow.js docs/sw.js tests/js/speakflow.test.mjs && git commit -F - <<'EOF'
feat(speakflow): the routine for one word, listen, repeat three times, then tries until it passes or is skipped

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 7: The panel's controller (`docs/js/speaking.js`)

`Speaking` is the one place the panel's screen talks to, as `Study` is for the study session. `Speaking.start` reads the day's speaking list, and the words already spoken today are left out. Each word runs through its routine (Task 6). When a word ends, `saveSpoken` saves one event in the spec's form, and the next word starts.

Worked example. After a first study day of 12 new words, `Speaking.start` gives 12 words, the first is 我 in the phase 'listen'. When it passes on its first try, the store gets

```js
{ day: '2026-10-05', kind: 'speak', id: 'w0039', result: 'pass', tries: 1, check: { tones: 1, heard: null }, ts: '2026-10-05T...' }
```

(w0039 is the test fixture's ID of 我, and `heard` is null because the tone check ran alone), and the next word, 你, starts at 'listen'. On the next day 我 is a review, so it is on the list again. Said well yesterday, it starts at 'turn'.

`close()` closes the day through Plan 6's `closeDay`, and adds the counts of the session's words for the check-in screen, for example `{ pass: 11, skip: 1, listened: 0 }`.

**Files:**
- Create: `docs/js/speaking.js`
- Modify: `docs/sw.js`
- Test: `tests/js/speaking.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/speaking.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Speaking, saveSpoken } from '../../docs/js/speaking.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
const DAY = '2026-10-05';
const DONE = { type: 'done' };
const TONES_OK = { pass: true, share: 1, problem: null };
const TONES_BAD = { pass: false, share: 0, problem: 'Tone: heard a falling tone, it should go low.' };

async function learnDay(store, day) {
  const at = localDate(day, 9);
  const study = await Study.start({ store, data, now: at });
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(study.card.quiz === 'recall' ? 'know' : 'right', at);
  }
  return study.finish(at);
}

// Takes the current word through listen, three repeats and one try with the given tone result.
async function sayOnce(speaking, tones, at) {
  for (let i = 0; i < 4; i += 1) await speaking.send(DONE, at);
  await speaking.send({ type: 'tap' }, at);
  return speaking.send({ type: 'heard', tones }, at);
}

test('each finished word is saved as one speak event, and the next word starts', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const speaking = await Speaking.start({ store, data, now: at, mode: 'tones' });
  assert.deepEqual([speaking.position, speaking.word.hz, speaking.state.phase], [{ done: 0, total: 12 }, '我', 'listen']);
  const wo = speaking.state.id;
  assert.deepEqual(await sayOnce(speaking, TONES_OK, at), { id: wo, result: 'pass', tries: 1, check: { tones: 1, heard: null } });
  const saved = (await store.allEvents()).at(-1);
  assert.deepEqual({ ...saved, seq: 0 }, {
    seq: 0, day: DAY, kind: 'speak', id: wo, result: 'pass', tries: 1, check: { tones: 1, heard: null }, ts: at.toISOString(),
  });
  assert.deepEqual([speaking.position, speaking.word.hz, speaking.state.phase], [{ done: 1, total: 12 }, '你', 'listen']);
});

test('a miss keeps the word, a skip saves it as skipped, and the day checks in when the list is done', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const speaking = await Speaking.start({ store, data, now: at, mode: 'tones' });
  assert.equal(await sayOnce(speaking, TONES_BAD, at), null);
  assert.deepEqual([speaking.state.phase, speaking.state.tries, speaking.state.problems], ['missed', 1, [TONES_BAD.problem]]);
  const wo = speaking.state.id; // 我
  assert.deepEqual(await speaking.send({ type: 'skip' }, at), { id: wo, result: 'skip', tries: 1, check: { tones: 0, heard: null } });
  while (!speaking.finished) await sayOnce(speaking, TONES_OK, at);
  const r = await speaking.close(at);
  assert.deepEqual([r.checkedIn, r.spoken], [true, { pass: 11, skip: 1, listened: 0 }]);
  assert.equal(speaking.word, null);
});

test('the next day the skipped word comes back, and a word spoken well starts at your turn', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const day1 = await Speaking.start({ store, data, now: at, mode: 'tones' });
  const wo = day1.state.id;
  await day1.send({ type: 'skip' }, at); // 我 is skipped
  while (!day1.finished) await sayOnce(day1, TONES_OK, at);
  await day1.close(at);
  await learnDay(store, '2026-10-06');
  const day2 = await Speaking.start({ store, data, now: localDate('2026-10-06', 10), mode: 'tones' });
  // The list has 24 words, yesterday's 12 as reviews in the order they were reviewed, and 12 new words.
  assert.equal(day2.position.total, 24);
  // The first review was spoken well yesterday, so it starts at your turn.
  assert.deepEqual([day2.word.hz, day2.state.phase], ['不', 'turn']);
  // 我 was skipped, so it is on the list and is taught again from the start.
  assert.deepEqual([day2.queue.includes(wo), day2.spokenWell.has(wo), day2.spokenWell.size], [true, false, 11]);
});

test('without a microphone the words are listened to, repeated and saved as listened', async () => {
  const store = new MemoryStore();
  await learnDay(store, DAY);
  const at = localDate(DAY, 10);
  const speaking = await Speaking.start({ store, data, now: at, mode: 'one' });
  for (let i = 0; i < 4; i += 1) await speaking.send(DONE, at); // the first word reaches your turn
  // The microphone is refused at the first tap.
  const first = speaking.state.id;
  assert.deepEqual(await speaking.setMode('none', at), { id: first, result: 'listened', tries: 0, check: { tones: null, heard: null } });
  while (!speaking.finished) {
    assert.equal(speaking.state.mode, 'none');
    await speaking.send(DONE, at);
  }
  const r = await speaking.close(at);
  assert.deepEqual([r.checkedIn, r.spoken], [true, { pass: 0, skip: 0, listened: 12 }]);
});

test('an unknown result is refused', async () => {
  await assert.rejects(saveSpoken({ store: new MemoryStore(), day: DAY, id: 'w0001', result: 'great' }), /Unknown speaking result great/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/speaking.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\speaking.js`.

- [ ] **Step 3: Write `docs/js/speaking.js`**

Create `docs/js/speaking.js`:

```js
// The speaking panel's controller, the one place its screen (ui/speak.js) talks to. It holds the
// day's speaking list (speaklist.js), runs each word through its routine (speakflow.js), saves
// one speak event per finished word, and closes the day (closeday.js), so the day is checked in
// from whichever screen finishes last.
//
//   const speaking = await Speaking.start({ store, data, mode: 'tones' });
//   speaking.word            // the current word of the words file
//   speaking.state.phase     // 'listen', 'repeat', 'turn', ... (speakflow.js)
//   await speaking.send({ type: 'done' });   // after the screen played the word and the sentence
//   ...
//   const result = await speaking.close();   // closeDay's result, as { checkedIn, streak, ... }
import { studyDay } from './dates.js';
import { closeDay } from './closeday.js';
import { SPEAK_RESULTS, speakStatus, spokenWellBefore } from './speaklist.js';
import { next, startWord } from './speakflow.js';

// Saves one finished word as one event (speaking practice spec of 2026-10-03, section 5).
// check holds the numbers of the last try, never audio. Returns the event's seq.
export async function saveSpoken({ store, day, id, result, tries = 0, check = { tones: null, heard: null }, now = new Date() }) {
  if (!SPEAK_RESULTS.includes(result)) throw new Error(`Unknown speaking result ${result}`);
  return store.commit({ event: { day, kind: 'speak', id, result, tries, check, ts: now.toISOString() } });
}

export class Speaking {
  // mode says which checks run on this phone, 'one', 'twice', 'tones' or 'none' (speakflow.js).
  static async start({ store, data, now = new Date(), mode = 'tones' }) {
    const day = studyDay(now);
    const [progress, events] = await Promise.all([store.allProgress(), store.allEvents()]);
    const status = speakStatus({ progress, events, day });
    return new Speaking({ store, data, day, status, events, mode });
  }

  constructor({ store, data, day, status, events, mode }) {
    Object.assign(this, { store, data, day, mode });
    this.byId = new Map(data.words.map((w) => [w.id, w]));
    this.total = status.list.length;
    this.queue = status.left.slice();
    this.spokenWell = new Set(this.queue.filter((id) => spokenWellBefore(events, id, day)));
    this.counts = { pass: 0, skip: 0, listened: 0 };
    this.state = this.queue.length ? this.begin(this.queue[0]) : null;
  }

  begin(id) {
    return startWord({ id, spokenWell: this.spokenWell.has(id), mode: this.mode });
  }

  get word() { return this.state ? this.byId.get(this.state.id) : null; }

  get finished() { return this.queue.length === 0; }

  // How many words of the day's list are done, and how many it has.
  get position() { return { done: this.total - this.queue.length, total: this.total }; }

  // Changes the checks for the rest of the session, for example to 'tones' when the recognizer
  // failed, or to 'none' when the microphone was refused.
  async setMode(mode, now = new Date()) {
    this.mode = mode;
    return this.send({ type: 'mode', mode }, now);
  }

  // Sends one input to the current word's routine. When the word ends, it is saved and the next
  // word starts. Returns the finished word as { id, result, tries, check }, or null.
  async send(input, now = new Date()) {
    if (!this.state) return null;
    this.state = next(this.state, input);
    if (this.state.phase !== 'done') return null;
    const { id, result, tries, check } = this.state;
    await saveSpoken({ store: this.store, day: this.day, id, result, tries, check, now });
    this.counts[result] += 1;
    this.queue.shift();
    this.state = this.queue.length ? this.begin(this.queue[0]) : null;
    return { id, result, tries, check };
  }

  // Closes the day, which is checked in when the learning and the speaking are both done, and
  // awards new badges. Returns closeDay's result with the counts of this session's words.
  async close(now = new Date()) {
    const result = await closeDay({ store: this.store, data: this.data, day: this.day, now });
    return { ...result, spoken: { ...this.counts } };
  }
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/speaking.test.mjs`
Expected: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

The day checks in here already, because `closeDay` does not look at speaking yet. Task 8 changes that, and this test still passes then, because every word of its list is spoken.

- [ ] **Step 5: Save the new file for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/speakcheck.js',
  'js/speakflow.js',
  'js/speaklist.js',
  'js/srs.js',
```

with:

```js
  'js/speakcheck.js',
  'js/speakflow.js',
  'js/speaking.js',
  'js/speaklist.js',
  'js/srs.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 352`, `ℹ pass 352`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/speaking.js docs/sw.js tests/js/speaking.test.mjs && git commit -F - <<'EOF'
feat(speaking): the speaking panel's controller, one speak event per finished word, and closing the day

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 8: The check-in needs the speaking too (`dayStatus` in `docs/js/closeday.js`)

From r009 the day is checked in when the learning is done and the speaking list is done, from whichever screen finishes last (the spec's section 6, which changes the original design's rule). Plan 6 made `dayStatus` the one function that decides it, so the speaking condition goes there, and neither caller changes. `closeDay`'s result gains `speak`, the day's speaking list as `{ list, done, left }`, for the screens.

Worked example (the first new test). On 5 October all 12 new words are learned. `Study.finish` now gives `checkedIn: false` with 12 words left to speak, and the day's learning badges ("10 words learned", "Finished Starter Kit") as before. The learner skips one word and says ten well, and the next close still gives no check-in, with 1 word left. The 12th word, ended as 'listened', checks in the day, with the badge "1 perfect day", which needs the check-in.

The tests that play whole days and expect a check-in get one line before `Study.finish`, `await speakAll(store, day, now)`. `speakAll` (in `tests/js/helpers.mjs`) finishes the day's list with the result 'listened', at the same time as the answers, so it earns no speaking badge and adds no minutes, and every expected value of those tests stays.

**Files:**
- Modify: `docs/js/closeday.js`
- Test: `tests/js/closeday.test.mjs`, `tests/js/helpers.mjs`, `tests/js/study.test.mjs`, `tests/js/flow.test.mjs`, `tests/js/rewind.test.mjs`, `tests/js/sheet.test.mjs`, `tests/js/simulation.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tests/js/closeday.test.mjs`, replace:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeDay } from '../../docs/js/closeday.js';
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, localDate } from './helpers.mjs';
```

with:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { closeDay, dayStatus } from '../../docs/js/closeday.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { saveSpoken } from '../../docs/js/speaking.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, localDate } from './helpers.mjs';
```

In `tests/js/closeday.test.mjs`, replace:

```js
  assert.equal((await closeDay({ store, data, day: DAY, now })).left.newWords.length, 4);
});
```

with:

```js
  assert.equal((await closeDay({ store, data, day: DAY, now })).left.newWords.length, 4);
});

// ---- Since release r009 the day also needs its speaking (speaking practice spec, section 6) ----

// Plays the day's whole learning session at 09:00, every answer right.
async function learnDay(store, day) {
  const at = localDate(day, 9);
  const study = await Study.start({ store, data, now: at });
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(study.card.quiz === 'recall' ? 'know' : 'right', at);
  }
  return study.finish(at);
}

test('the learning done, the day waits for its speaking list, and the last word spoken checks it in', async () => {
  const store = new MemoryStore();
  const learned = await learnDay(store, DAY);
  assert.deepEqual([learned.checkedIn, learned.left.newWords.length, learned.speak.list.length, learned.speak.left.length], [false, 0, 12, 12]);
  // Badges come at every close, the perfect day only with the check-in.
  assert.deepEqual(learned.newBadges, ['learned-10', 'theme-t01']);
  const [first, ...rest] = learned.speak.left;
  await saveSpoken({ store, day: DAY, id: first, result: 'skip', now });
  for (const id of rest.slice(0, -1)) await saveSpoken({ store, day: DAY, id, result: 'pass', tries: 1, check: { tones: 1, heard: null }, now });
  const almost = await closeDay({ store, data, day: DAY, now });
  assert.deepEqual([almost.checkedIn, almost.speak.left.length], [false, 1]);
  await saveSpoken({ store, day: DAY, id: rest.at(-1), result: 'listened', now });
  const r = await closeDay({ store, data, day: DAY, now });
  assert.deepEqual([r.checkedIn, r.justCheckedIn, r.streak, r.speak.left], [true, true, 1, []]);
  assert.ok(r.newBadges.includes('perfectday-1'));
});

test('a word skipped yesterday keeps today open even with nothing to study', async () => {
  const store = new MemoryStore();
  await allLearned(store);
  await saveSpoken({ store, day: '2026-10-04', id: data.words[0].id, result: 'skip', now: localDate('2026-10-04', 20) });
  const progress = await store.allProgress();
  const status = await dayStatus({ store, data, day: DAY, settings: { reviewCap: 100, newPerDay: 12 }, progress });
  assert.deepEqual([status.left.reviews.length, status.left.newWords.length, status.speak.left, status.done], [0, 0, [data.words[0].id], false]);
  assert.equal((await closeDay({ store, data, day: DAY, now })).checkedIn, false);
  await saveSpoken({ store, day: DAY, id: data.words[0].id, result: 'pass', tries: 3, check: { tones: 1, heard: '我' }, now });
  assert.equal((await closeDay({ store, data, day: DAY, now })).checkedIn, true);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/closeday.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 5`, `ℹ fail 2`, the failing tests being "the learning done, the day waits for its speaking list, and the last word spoken checks it in"; "a word skipped yesterday keeps today open even with nothing to study".

- [ ] **Step 3: Let `dayStatus` wait for the speaking list**

In `docs/js/closeday.js`, replace:

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
```

with:

```js
// Closing a study day checks in the day when its work is done, then awards any new badges. The
// study session calls it when it ends (Study.finish in study.js), and so does the speaking panel
// (speaking.js), so the day is checked in from whichever screen finishes last.
//
//   const r = await closeDay({ store, data, day: '2026-10-05' });
//   // { day, checkedIn, justCheckedIn, streak, newBadges: ['learned-10'], left, speak }
import { normalizeSettings } from './config.js';
import { badgeFacts, newBadges } from './badges.js';
import { currentStreak } from './checkin.js';
import { isDayDone, planDay } from './plan.js';
import { speakStatus } from './speaklist.js';

// What is left of `day` and whether the day can be checked in. This is the one place that
// decides it. The learning (planDay's plan) and the speaking list (speakStatus in speaklist.js)
// must both be done (speaking practice spec of 2026-10-03, section 6). events are all saved
// events, read from `store` when not given.
export async function dayStatus({ store, data, day, settings, progress, events }) {
  const left = planDay({ words: data.words, progress, today: day, settings });
  const speak = speakStatus({ progress, events: events ?? (await store.allEvents()), day });
  return { left, speak, done: isDayDone(left) && speak.left.length === 0 };
}
```

In `docs/js/closeday.js`, replace:

```js
  const amounts = settings ?? normalizeSettings(await store.getMeta('settings'));
  const progress = await store.allProgress();
  const { left, done } = await dayStatus({ store, data, day, settings: amounts, progress });
  const days = await store.allDays();
  let checkedIn = days.some((d) => d.day === day);
```

with:

```js
  const amounts = settings ?? normalizeSettings(await store.getMeta('settings'));
  const progress = await store.allProgress();
  const { left, speak, done } = await dayStatus({ store, data, day, settings: amounts, progress });
  const days = await store.allDays();
  let checkedIn = days.some((d) => d.day === day);
```

In `docs/js/closeday.js`, replace:

```js
  }
  const streak = currentStreak(days.map((d) => d.day), day, rewound);
  return { day, checkedIn, justCheckedIn, streak, newBadges: fresh, left };
}
```

with:

```js
  }
  const streak = currentStreak(days.map((d) => d.day), day, rewound);
  return { day, checkedIn, justCheckedIn, streak, newBadges: fresh, left, speak };
}
```

Run: `node --test tests/js/closeday.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 4: See which existing tests now miss their check-in**

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 354`, `ℹ pass 341`, `ℹ fail 13`, the failing tests being "day 1 teaches 12 words through the screens and checks in"; "day 2 starts with 12 listening reviews, and a wrong tap brings a recall card 4 cards later"; "the spec's example: studied 1 to 4 October, gone back to 2 October on 5 October"; "a first day goes to the Sheet, and a second backup sends nothing new"; "the next day sends only its own events, in pages"; "after going back to a day, the next backup replaces the Sheet, also when the phone was offline"; "450 simulated days never go over the review cap"; "on day 1, 12 new words in 3 groups are all learned and the day is checked in"; "leaving early does not check in, and the streak still shows yesterday"; "a finished theme earns its badge once"; "learning the last HSK 1 and 2 words earns the theme badge and the HSK 1-2 badge"; "a missed day resets the streak"; "stopping during the new words and starting again continues after the last answer".

- [ ] **Step 5: Finish the speaking list in the tests that play whole days**

In `tests/js/helpers.mjs`, replace:

```js
// Shared test helpers. Paths are resolved from this file, so tests run from any folder.
import { readFileSync } from 'node:fs';

export function loadFixture() {
```

with:

```js
// Shared test helpers. Paths are resolved from this file, so tests run from any folder.
import { readFileSync } from 'node:fs';
import { speakStatus } from '../../docs/js/speaklist.js';
import { saveSpoken } from '../../docs/js/speaking.js';

export function loadFixture() {
```

In `tests/js/helpers.mjs`, replace:

```js
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}
```

with:

```js
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}

// Finishes the day's speaking list as a phone without a microphone does, saving every word left
// as 'listened'. Since release r009 a day is checked in only when the learning and the speaking
// are both done, so tests that play whole days call this before Study.finish. A 'listened' word
// earns no speaking badge, and at the time `now` of the answers it adds no minutes.
export async function speakAll(store, day, now = localDate(day)) {
  const [progress, events] = await Promise.all([store.allProgress(), store.allEvents()]);
  for (const id of speakStatus({ progress, events, day }).left) await saveSpoken({ store, day, id, result: 'listened', now });
}
```

In `tests/js/study.test.mjs`, replace:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress, quizForReview } from '../../docs/js/srs.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
```

with:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress, quizForReview } from '../../docs/js/srs.js';
import { loadFixture, localDate, speakAll } from './helpers.mjs';

const data = loadFixture();
```

In `tests/js/study.test.mjs`, replace:

```js
    else await study.answer(grade(study.card), localDate(day, hour));
  }
  return study.finish(localDate(day, hour));
}
```

with:

```js
    else await study.answer(grade(study.card), localDate(day, hour));
  }
  await speakAll(store, day, localDate(day, hour));
  return study.finish(localDate(day, hour));
}
```

In `tests/js/study.test.mjs`, replace:

```js
  assert.equal(again.canUndo, false);
  await playUntil(again, now, () => false);
  const result = await again.finish(now);
  assert.equal(result.checkedIn, true);
```

with:

```js
  assert.equal(again.canUndo, false);
  await playUntil(again, now, () => false);
  await speakAll(store, '2026-10-05', now);
  const result = await again.finish(now);
  assert.equal(result.checkedIn, true);
```

In `tests/js/flow.test.mjs`, replace:

```js
import { gradeFor, questionView } from '../../docs/js/view/quiz.js';
import { checkinView } from '../../docs/js/view/progress.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
```

with:

```js
import { gradeFor, questionView } from '../../docs/js/view/quiz.js';
import { checkinView } from '../../docs/js/view/progress.js';
import { loadFixture, localDate, speakAll } from './helpers.mjs';

const data = loadFixture();
```

In `tests/js/flow.test.mjs`, replace:

```js
    await study.answer(gradeFor(view, tap(view, card)), now);
  }
  return { result: await study.finish(now), kinds };
}
```

with:

```js
    await study.answer(gradeFor(view, tap(view, card)), now);
  }
  await speakAll(store, day, now);
  return { result: await study.finish(now), kinds };
}
```

In `tests/js/rewind.test.mjs`, replace:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { loadFixture, localDate } from './helpers.mjs';

// Word records as srs.js keeps them, cut down to the fields that matter here.
```

with:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { loadFixture, localDate, speakAll } from './helpers.mjs';

// Word records as srs.js keeps them, cut down to the fields that matter here.
```

In `tests/js/rewind.test.mjs`, replace:

```js
    else await study.answer(right(study.card), now);
  }
  return study.finish(now);
}
```

with:

```js
    else await study.answer(right(study.card), now);
  }
  await speakAll(store, day, now);
  return study.finish(now);
}
```

In `tests/js/sheet.test.mjs`, replace:

```js
import { learnedProgress } from '../../docs/js/srs.js';
import { loadAppsScript } from './fake-apps-script.mjs';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
```

with:

```js
import { learnedProgress } from '../../docs/js/srs.js';
import { loadAppsScript } from './fake-apps-script.mjs';
import { loadFixture, speakAll, word } from './helpers.mjs';

const data = loadFixture();
```

In `tests/js/sheet.test.mjs`, replace:

```js
    await study.answer(grade, new Date(t));
  }
  return study.finish(new Date(t));
}
```

with:

```js
    await study.answer(grade, new Date(t));
  }
  await speakAll(store, day, new Date(t));
  return study.finish(new Date(t));
}
```

In `tests/js/simulation.test.mjs`, replace:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { localDate, syntheticWords } from './helpers.mjs';

const DAYS = 450;
```

with:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { localDate, speakAll, syntheticWords } from './helpers.mjs';

const DAYS = 450;
```

In `tests/js/simulation.test.mjs`, replace:

```js
      await study.answer(grade, now);
    }
    const result = await study.finish(now);
    const cards = study.state.cards;
```

with:

```js
      await study.answer(grade, now);
    }
    await speakAll(store, day, now);
    const result = await study.finish(now);
    const cards = study.state.cards;
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 354`, `ℹ pass 354`, `ℹ fail 0`. The 450-day simulation test now takes about 35 seconds, because each day also saves its speak events.

- [ ] **Step 6: Commit**

```bash
git add docs/js/closeday.js tests/js/closeday.test.mjs tests/js/flow.test.mjs tests/js/helpers.mjs tests/js/rewind.test.mjs tests/js/sheet.test.mjs tests/js/simulation.test.mjs tests/js/study.test.mjs && git commit -F - <<'EOF'
feat(closeday): the day is checked in when the learning and the speaking list are both done

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 9: Speaking in the minutes, the ring, Stats and the Sheet (`stats.js`, `counters.js`, `sheet.js`)

The spec's section 6, with Plan 6's counters:
- **Minutes studied include speaking**, because they follow the times of all events. `timedEvents` (in `stats.js`) gives the day's answers and speak events, and both the app (`statsByDay` in `counters.js`) and the Sheet's Daily tab (`dailyRow` in `sheet.js`) count minutes from them, so the two agree.
- **Accuracy leaves speaking out**. It still counts the quiz answers only.
- **Today's ring counts the speaking words as part of the day's work** (choice 5).
- **Stats adds "words spoken"** to the week and month, a fifth tile.
- **The Sheet's log** names a speak event "spoke", with its result in the Result column. The Sheet script needs no change, because it stores every event as it comes.

Worked example of the minutes (the new test). On Tuesday the answers run from 19:00:00 to 19:40:00 and count 7 minutes (420 seconds, Plan 6's example). Three words are then spoken at 19:41:00, 19:41:30 and 19:42:00, which adds the 2 minutes from 19:40:00 to 19:42:00, so the day has 9 minutes. Two of the three were not skipped, so it has 2 words spoken.

Worked example of the ring. 6 reviews are studied and spoken, and 2 reviews and 4 new words are left. The work left is 6 words to study, then the same 6 to speak, so 4 of 16 are done and the ring is a quarter full. With the studying done and 6 words still to speak, it is half full.

**Files:**
- Modify: `docs/js/stats.js`, `docs/js/counters.js`, `docs/js/sheet.js`, `docs/js/view/progress.js`
- Test: `tests/js/counters.test.mjs`, `tests/js/sheet.test.mjs`, `tests/js/view-progress.test.mjs`

- [ ] **Step 1: Write the failing tests, and update the counters that gain speaking**

In `tests/js/counters.test.mjs`, replace:

```js
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
```

with:

```js
  // The minutes are 20 s + 40 s + 60 s, plus 38 minutes counted as 5, which is 420 s or 7 minutes.
  // The answer taken back by Undo, the undo itself and the check-in are not answers.
  assert.deepEqual(s, { day: '2026-10-06', newWords: 1, reviews: 2, answers: 5, right: 4, accuracy: 80, spoken: 0, minutes: 7 });
  assert.deepEqual(dayStats(tuesday(), '2026-10-07'),
    { day: '2026-10-07', newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, spoken: 0, minutes: 0 });
});

test('today\'s ring is the share of the day\'s studying and speaking that is done', () => {
  // 2 reviews studied and spoken, and 2 reviews and 4 new words left to study and then to speak.
  const plan = { reviews: ['a', 'b'], newWords: ['c', 'd', 'e', 'f'], reviewsDone: 2, newDone: 0 };
  const speak = { list: ['x', 'y'], done: ['x', 'y'], left: [] };
  const c = todayCounters({ events: tuesday(), plan, day: '2026-10-06', speak });
  assert.deepEqual([c.done, c.left, c.ring, c.accuracy, c.minutes], [4, 12, 0.25, 80, 7]);
  // With the studying done and 6 words still to speak, the ring is half full.
  const studied = { reviews: [], newWords: [], reviewsDone: 6, newDone: 0 };
  const six = ['a', 'b', 'c', 'd', 'e', 'f'];
  assert.equal(todayCounters({ events: [], plan: studied, day: '2026-10-06', speak: { list: six, done: [], left: six } }).ring, 0.5);
  // A review skipped yesterday is on the speaking list already, so it counts once to study and once to speak.
  const carried = todayCounters({ events: [], plan: { ...plan, reviewsDone: 0 }, day: '2026-10-06', speak: { list: ['a'], done: [], left: ['a'] } });
  assert.equal(carried.left, 6 + 1 + 5);
  const empty = { reviews: [], newWords: [], reviewsDone: 0, newDone: 0 };
  assert.equal(todayCounters({ events: [], plan: empty, day: '2026-10-06' }).ring, 1);
```

In `tests/js/counters.test.mjs`, replace:

```js
  // 5 October has a check-in but no answers (nothing was due), so it is a study day too.
  const checked = ['2026-10-04', '2026-10-05', '2026-10-06'];
  assert.deepEqual(periodTotals(events, checked, '2026-10-05', '2026-10-11'), { newWords: 1, reviews: 2, studyDays: 2, minutes: 7 });
  assert.deepEqual(periodTotals(events, checked, '2026-10-01', '2026-10-31'), { newWords: 3, reviews: 2, studyDays: 3, minutes: 8 });
});
```

with:

```js
  // 5 October has a check-in but no answers (nothing was due), so it is a study day too.
  const checked = ['2026-10-04', '2026-10-05', '2026-10-06'];
  assert.deepEqual(periodTotals(events, checked, '2026-10-05', '2026-10-11'), { newWords: 1, reviews: 2, spoken: 0, studyDays: 2, minutes: 7 });
  assert.deepEqual(periodTotals(events, checked, '2026-10-01', '2026-10-31'), { newWords: 3, reviews: 2, spoken: 0, studyDays: 3, minutes: 8 });
});
```

In `tests/js/counters.test.mjs`, replace:

```js
  assert.deepEqual(personalBests({ events: nextMonday, today: '2026-10-12' }), []);
});
```

with:

```js
  assert.deepEqual(personalBests({ events: nextMonday, today: '2026-10-12' }), []);
});

test('speaking counts in the minutes and as words spoken, but not in the accuracy', () => {
  // On Tuesday the learner also spoke three words after the answers, two of them well and one skipped.
  const spoke = (time, result) => other('2026-10-06', time, 'speak', { id: 'w0001', result, tries: 1, check: { tones: 1, heard: null } });
  const events = [...tuesday(), spoke('19:41:00', 'pass'), spoke('19:41:30', 'skip'), spoke('19:42:00', 'listened')];
  // The 420 seconds of the answers plus the 2 minutes from 19:40:00 to 19:42:00 make 9 minutes.
  assert.deepEqual(dayStats(events, '2026-10-06'),
    { day: '2026-10-06', newWords: 1, reviews: 2, answers: 5, right: 4, accuracy: 80, spoken: 2, minutes: 9 });
  // A day with speaking only is a study day, with no accuracy, and it is not a perfect day.
  const only = [spoke('19:00:00', 'pass')].map((e) => ({ ...e, day: '2026-10-07', ts: '2026-10-07T19:00:00Z' }));
  assert.deepEqual(dayStats(only, '2026-10-07'),
    { day: '2026-10-07', newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, spoken: 1, minutes: 0 });
  assert.deepEqual(perfectDays(only, ['2026-10-07']), []);
  assert.equal(periodTotals([...events, ...only], [], '2026-10-05', '2026-10-11').studyDays, 2);
  assert.deepEqual(personalBests({ events: [...events, ...only], today: '2026-10-07' }), []);
});
```

In `tests/js/sheet.test.mjs`, replace:

```js
});

test('a Daily row counts the live reviews, and minutes from the day\'s answers only', () => {
  const events = [
    { seq: 1, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:00:00Z' },
```

with:

```js
});

test('a Daily row counts the live reviews, and minutes from the day\'s answers, not its check-in', () => {
  const events = [
    { seq: 1, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:00:00Z' },
```

In `tests/js/sheet.test.mjs`, replace:

```js
  assert.deepEqual([sheet.ss.rowsOf('Progress').length, sheet.ss.rowsOf('Daily').map((r) => r.slice(0, 2))], [0, [['2026-10-06', 'no']]]);
});
```

with:

```js
  assert.deepEqual([sheet.ss.rowsOf('Progress').length, sheet.ss.rowsOf('Daily').map((r) => r.slice(0, 2))], [0, [['2026-10-06', 'no']]]);
});

test('the log names a spoken word with its result, and the Daily minutes include speaking', () => {
  const apple = word(data, '苹果');
  const spoke = { seq: 12, day: '2026-10-06', kind: 'speak', id: apple.id, result: 'pass', tries: 2, check: { tones: 1, heard: '苹果' }, ts: 'T' };
  assert.deepEqual(logRow(spoke, apple).slice(0, 9), [12, '2026-10-06', 'T', 'spoke', apple.id, '苹果', '', '', 'pass']);
  const events = [
    { seq: 1, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:00:00Z' },
    { seq: 2, day: '2026-10-06', kind: 'review', grade: 'right', ts: '2026-10-06T19:01:00Z' },
    { seq: 3, day: '2026-10-06', kind: 'speak', id: apple.id, result: 'pass', ts: '2026-10-06T19:03:00Z' },
  ];
  // The answers span 1 minute and the speaking 2 more, as the app's own minutes count them.
  assert.deepEqual(dailyRow('2026-10-06', events, undefined), ['2026-10-06', 'no', 2, 1, 0, 3, '']);
});
```

In `tests/js/view-progress.test.mjs`, replace:

```js
  const tiles = (p) => [p.title, p.numbers.map((n) => `${n.value} ${n.label}`)];
  assert.deepEqual(v.periods.map(tiles), [
    ['This week', ['1 words learned', '2 reviews', '2 study days', '2 minutes']],
    ['October 2026', ['2 words learned', '2 reviews', '3 study days', '2 minutes']],
  ]);
  assert.deepEqual(v.bars7.map((r) => r.label), ['W', 'T', 'F', 'S', 'S', 'M', 'T']);
```

with:

```js
  const tiles = (p) => [p.title, p.numbers.map((n) => `${n.value} ${n.label}`)];
  assert.deepEqual(v.periods.map(tiles), [
    ['This week', ['1 words learned', '2 reviews', '0 words spoken', '2 study days', '2 minutes']],
    ['October 2026', ['2 words learned', '2 reviews', '0 words spoken', '3 study days', '2 minutes']],
  ]);
  assert.deepEqual(v.bars7.map((r) => r.label), ['W', 'T', 'F', 'S', 'S', 'M', 'T']);
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/counters.test.mjs tests/js/sheet.test.mjs tests/js/view-progress.test.mjs`
Expected: `ℹ tests 43`, `ℹ pass 37`, `ℹ fail 6`, the failing tests being "one day's numbers come from its live answers"; "today's ring is the share of the day's studying and speaking that is done"; "week and month totals add words, reviews, study days and minutes"; "speaking counts in the minutes and as words spoken, but not in the accuracy"; "the log names a spoken word with its result, and the Daily minutes include speaking"; "stats show this week and month, the all-time records, the levels and the goals".

- [ ] **Step 3: Count speaking in the minutes, the ring, Stats and the Sheet**

In `docs/js/stats.js`, replace:

```js
export function answerEvents(events) {
  return liveEvents(events).filter((e) => ANSWER_KINDS.includes(e.kind));
}
```

with:

```js
export function answerEvents(events) {
  return liveEvents(events).filter((e) => ANSWER_KINDS.includes(e.kind));
}

// The events whose times count as study time, which are the quiz answers and the speak events of
// the speaking panel (one per finished word). Minutes studied follow their times, so they include
// speaking, while accuracy follows the quiz answers alone (speaking practice spec, section 6).
export function timedEvents(events) {
  return [...answerEvents(events), ...events.filter((e) => e.kind === 'speak')];
}
```

In `docs/js/counters.js`, replace:

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
```

with:

```js
// Counters for Today, the check-in screen and Stats (spec of 2026-10-03, section 2). All of them
// come from the answers, speak events and check-ins the app saves. Pure functions, so Node tests them.
//   events       saved events (store.allEvents() or store.eventsFrom(day)), with Undo still in them
//   checkedDays  the checked-in study days, such as ['2026-10-05', '2026-10-06']
// Definitions:
//   accuracy   the share of a day's quiz answers that were right (right or Know it), a whole percent
//   minutes    the gaps between a day's answers and speak events, each at most 5 minutes
//              (minutesOf and timedEvents in stats.js)
//   spoken     the words finished in speaking practice that were spoken, not skipped
//   study day  a day with any answer, speak event or check-in
//   perfect    a checked-in day with at least one answer, every one of them right
//   week       Monday to Sunday;  month  the calendar month
```

In `docs/js/counters.js`, replace:

```js
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
```

with:

```js
import { bestStreak } from './checkin.js';

const emptyDay = (day) => ({ day, newWords: 0, reviews: 0, answers: 0, right: 0, accuracy: null, spoken: 0, minutes: 0 });
const round1 = (n) => Math.round(n * 10) / 10;
const sum = (rows, key) => rows.reduce((total, r) => total + r[key], 0);

// Each day's numbers, worked out in one pass, as a Map from day to
// { day, newWords, reviews, answers, right, accuracy, spoken, minutes }. Days without answers
// and speak events are absent. A day with speak events only has accuracy null.
export function statsByDay(events) {
  const byDay = new Map();
  const of = (day) => {
    if (!byDay.has(day)) byDay.set(day, { answers: [], speaks: [] });
    return byDay.get(day);
  };
  for (const e of answerEvents(events)) of(e.day).answers.push(e);
  for (const e of events) if (e.kind === 'speak') of(e.day).speaks.push(e);
  const out = new Map();
  for (const [day, { answers, speaks }] of byDay) {
    const right = answers.filter((e) => PASS.has(e.grade)).length;
    out.set(day, {
```

In `docs/js/counters.js`, replace:

```js
      answers: answers.length,
      right,
      accuracy: Math.round((100 * right) / answers.length),
      minutes: minutesOf(answers),
    });
  }
```

with:

```js
      answers: answers.length,
      right,
      accuracy: answers.length ? Math.round((100 * right) / answers.length) : null,
      spoken: speaks.filter((e) => e.result !== 'skip').length,
      minutes: minutesOf([...answers, ...speaks]),
    });
  }
```

In `docs/js/counters.js`, replace:

```js
}

// Today's numbers and the ring of the Today screen. plan is planDay's result for today. The ring
// is the share of today's planned work that is done. For example, 2 reviews done and 6 reviews and
// new words left give 2 / 8 = 0.25. With nothing planned at all the ring is full.
export function todayCounters({ events, plan, day }) {
  const done = plan.reviewsDone + plan.newDone;
  const left = plan.reviews.length + plan.newWords.length;
  return { ...dayStats(events, day), done, left, ring: left === 0 ? 1 : done / (done + left) };
}
```

with:

```js
}

// Today's numbers and the ring of the Today screen. plan is planDay's result for today and speak
// the speaking list's status (speakStatus in speaklist.js). The ring is the share of today's work
// that is done, where the work is every planned word to study and every word to speak. A word
// still to study will also be spoken, so it counts twice, unless it is on the speaking list
// already (skipped on an earlier day). For example, with 2 reviews studied and spoken, and 2
// reviews and 4 new words left, 4 of 16 are done and the ring is 0.25. With nothing to do at all
// the ring is full.
export function todayCounters({ events, plan, day, speak = { list: [], done: [], left: [] } }) {
  const toStudy = [...plan.reviews, ...plan.newWords];
  const listed = new Set(speak.list);
  const done = plan.reviewsDone + plan.newDone + speak.done.length;
  const left = toStudy.length + speak.left.length + toStudy.filter((id) => !listed.has(id)).length;
  return { ...dayStats(events, day), done, left, ring: left === 0 ? 1 : done / (done + left) };
}
```

In `docs/js/counters.js`, replace:

```js
}

// Totals from `from` to `to`, both included, as { newWords, reviews, studyDays, minutes }.
export function periodTotals(events, checkedDays, from, to) {
  const inRange = (day) => day >= from && day <= to;
```

with:

```js
}

// Totals from `from` to `to`, both included, as { newWords, reviews, spoken, studyDays, minutes }.
export function periodTotals(events, checkedDays, from, to) {
  const inRange = (day) => day >= from && day <= to;
```

In `docs/js/counters.js`, replace:

```js
    newWords: sum(days, 'newWords'),
    reviews: sum(days, 'reviews'),
    studyDays: studyDays(byDay, checkedDays, inRange),
    minutes: round1(sum(days, 'minutes')),
```

with:

```js
    newWords: sum(days, 'newWords'),
    reviews: sum(days, 'reviews'),
    spoken: sum(days, 'spoken'),
    studyDays: studyDays(byDay, checkedDays, inRange),
    minutes: round1(sum(days, 'minutes')),
```

In `docs/js/counters.js`, replace:

```js
  return [...new Set(checkedDays)].sort().filter((day) => {
    const s = byDay.get(day);
    return Boolean(s) && s.right === s.answers;
  });
}
```

with:

```js
  return [...new Set(checkedDays)].sort().filter((day) => {
    const s = byDay.get(day);
    return Boolean(s) && s.answers > 0 && s.right === s.answers;
  });
}
```

In `docs/js/counters.js`, replace:

```js
  if (now.newWords > 0 && beats(earlier, 'newWords')) out.push('Most words in a day!');
  if (now.reviews > 0 && beats(earlier, 'reviews')) out.push('Most reviews in a day!');
  if (beats(week, 'accuracy')) out.push('Best accuracy this week!');
  if (now.minutes > 0 && beats(week, 'minutes')) out.push('Most minutes this week!');
  return out;
```

with:

```js
  if (now.newWords > 0 && beats(earlier, 'newWords')) out.push('Most words in a day!');
  if (now.reviews > 0 && beats(earlier, 'reviews')) out.push('Most reviews in a day!');
  if (now.accuracy !== null && beats(week.filter((d) => d.accuracy !== null), 'accuracy')) out.push('Best accuracy this week!');
  if (now.minutes > 0 && beats(week, 'minutes')) out.push('Most minutes this week!');
  return out;
```

In `docs/js/sheet.js`, replace:

```js
// They never go into the backup file, the Sheet or the repository.
import { isLearned, isMastered } from './srs.js';
import { answerEvents, minutesOf } from './stats.js';
import { bestStreak, currentStreak } from './checkin.js';
import { studyDay } from './dates.js';
```

with:

```js
// They never go into the backup file, the Sheet or the repository.
import { isLearned, isMastered } from './srs.js';
import { answerEvents, minutesOf, timedEvents } from './stats.js';
import { bestStreak, currentStreak } from './checkin.js';
import { studyDay } from './dates.js';
```

In `docs/js/sheet.js`, replace:

```js
  review: 'review', reask: 'asked again', learn: 'learning card', check: 'group check',
  final: 'final check', undo: 'undo', checkin: 'check-in', badges: 'badges', settings: 'settings',
  rewind: 'went back to a day', reset: 'reset everything',
};
const GRADE_TEXT = { right: 'right', wrong: 'wrong', know: 'Know it', unsure: 'Unsure', dontknow: "Don't know" };
```

with:

```js
  review: 'review', reask: 'asked again', learn: 'learning card', check: 'group check',
  final: 'final check', undo: 'undo', checkin: 'check-in', badges: 'badges', settings: 'settings',
  rewind: 'went back to a day', reset: 'reset everything', speak: 'spoke',
};
const GRADE_TEXT = { right: 'right', wrong: 'wrong', know: 'Know it', unsure: 'Unsure', dontknow: "Don't know" };
```

In `docs/js/sheet.js`, replace:

```js
  if (e.kind === 'badges') result = (e.badges ?? []).join(', ');
  if (e.kind === 'rewind') result = `back to ${e.to}`;
  return [e.seq, e.day, e.ts ?? '', KIND_TEXT[e.kind] ?? e.kind, e.id ?? '', word?.hz ?? '', QUIZ_TEXT[e.quiz] ?? '',
    GRADE_TEXT[e.grade] ?? '', result, JSON.stringify(e)];
```

with:

```js
  if (e.kind === 'badges') result = (e.badges ?? []).join(', ');
  if (e.kind === 'rewind') result = `back to ${e.to}`;
  if (e.kind === 'speak') result = e.result;
  return [e.seq, e.day, e.ts ?? '', KIND_TEXT[e.kind] ?? e.kind, e.id ?? '', word?.hz ?? '', QUIZ_TEXT[e.quiz] ?? '',
    GRADE_TEXT[e.grade] ?? '', result, JSON.stringify(e)];
```

In `docs/js/sheet.js`, replace:

```js
// One row per study day. dayRecord is the saved check-in record of that day, or undefined.
// Minutes are those of the day's answers (minutesOf in stats.js, the same as the app's counters).
// ['2026-10-06', 'yes', 12, 0.917, 12, 21.5, '{"day":"2026-10-06",...}']
export function dailyRow(day, events, dayRecord) {
```

with:

```js
// One row per study day. dayRecord is the saved check-in record of that day, or undefined.
// Minutes are those of the day's answers and speak events (minutesOf and timedEvents in stats.js,
// the same as the app's counters).
// ['2026-10-06', 'yes', 12, 0.917, 12, 21.5, '{"day":"2026-10-06",...}']
export function dailyRow(day, events, dayRecord) {
```

In `docs/js/sheet.js`, replace:

```js
  const learned = answers.filter((e) => e.outcome === 'learned').length;
  return [day, dayRecord ? 'yes' : 'no', reviews.length, reviews.length ? Math.round((right / reviews.length) * 1000) / 1000 : '',
    learned, minutesOf(answers), dayRecord ? JSON.stringify(dayRecord) : ''];
}
```

with:

```js
  const learned = answers.filter((e) => e.outcome === 'learned').length;
  return [day, dayRecord ? 'yes' : 'no', reviews.length, reviews.length ? Math.round((right / reviews.length) * 1000) / 1000 : '',
    learned, minutesOf(timedEvents(events.filter((e) => e.day === day))), dayRecord ? JSON.stringify(dayRecord) : ''];
}
```

In `docs/js/view/progress.js`, replace:

```js
const grouped = (n) => Number(n).toLocaleString('en-US'); // 1234 gives '1,234'

// The four numbers of a week or month as tiles.
function periodTiles(t) {
  return [
    { label: 'words learned', value: grouped(t.newWords) },
    { label: 'reviews', value: grouped(t.reviews) },
    { label: 'study days', value: grouped(t.studyDays) },
    { label: 'minutes', value: grouped(Math.round(t.minutes)) },
```

with:

```js
const grouped = (n) => Number(n).toLocaleString('en-US'); // 1234 gives '1,234'

// The five numbers of a week or month as tiles. "words spoken" counts the words finished in
// speaking practice that were not skipped (speaking practice spec, section 6).
function periodTiles(t) {
  return [
    { label: 'words learned', value: grouped(t.newWords) },
    { label: 'reviews', value: grouped(t.reviews) },
    { label: 'words spoken', value: grouped(t.spoken) },
    { label: 'study days', value: grouped(t.studyDays) },
    { label: 'minutes', value: grouped(Math.round(t.minutes)) },
```

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/js/counters.test.mjs tests/js/sheet.test.mjs tests/js/view-progress.test.mjs`
Expected: `ℹ tests 43`, `ℹ pass 43`, `ℹ fail 0`.

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 356`, `ℹ pass 356`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/counters.js docs/js/sheet.js docs/js/stats.js docs/js/view/progress.js tests/js/counters.test.mjs tests/js/sheet.test.mjs tests/js/view-progress.test.mjs && git commit -F - <<'EOF'
feat(counters): minutes with speaking in the app and the Sheet, words spoken in Stats, and a ring with the speaking

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 10: The speaking badges and their countdown (`docs/js/badges.js`, `docs/js/goals.js`)

The spec adds a "Speaking" badge group that counts words spoken well (result 'pass') at 10, 50, 100, 500 and 1000. It is one more row of Plan 6's `BADGE_GROUPS`, so earning, titles and the greyed "next badge" of the Badges screen follow from the table. Each word counts once (choice 3). The goal countdowns of Today and Stats get the next speaking badge too, as Plan 6's `goals` did for the other counted badges.

Worked example (the new badge test). 我 is said well on 5 and on 6 October, 你 once, 他 is skipped and 好 only listened to. That is 2 words spoken well, so the Badges screen shows "10 words spoken well" greyed with "2 / 10 words", and the countdown reads "8 more words to say well for the 10-word speaking badge".

Going back to a day removes the later speak events with every other event (Plan 6's `rewindPlan` keeps only settings, rewind and reset events), and the speaking badges by their dates. The last test of this task plays it through, with the panel's controller.

**Files:**
- Modify: `docs/js/config.js`, `docs/js/badges.js`, `docs/js/goals.js`
- Test: `tests/js/badges.test.mjs`, `tests/js/goals.test.mjs`, `tests/js/rewind.test.mjs`

- [ ] **Step 1: Write the failing tests**

In `tests/js/badges.test.mjs`, replace:

```js
const data = loadFixture();
const NONE = {
  bestStreak: 0, checkIns: 0, learned: 0, mastered: 0, totalWords: 5000, reviews: 0, minutes: 0, perfectDays: 0, fullWeeks: 0,
  themesDone: [], groupsDone: [], perfectSession: false,
};
```

with:

```js
const data = loadFixture();
const NONE = {
  bestStreak: 0, checkIns: 0, learned: 0, mastered: 0, totalWords: 5000, reviews: 0, minutes: 0, perfectDays: 0, spokenWell: 0,
  fullWeeks: 0, themesDone: [], groupsDone: [], perfectSession: false,
};
```

In `tests/js/badges.test.mjs`, replace:

```js
test('the Badges screen shows the groups in this order', () => {
  assert.deepEqual(BADGE_GROUPS.map((g) => g.id),
    ['streak', 'checkins', 'learned', 'mastered', 'reviews', 'minutes', 'perfectday', 'week', 'theme', 'hsk', 'perfect']);
});
```

with:

```js
test('the Badges screen shows the groups in this order', () => {
  assert.deepEqual(BADGE_GROUPS.map((g) => g.id),
    ['streak', 'checkins', 'learned', 'mastered', 'reviews', 'minutes', 'spoken', 'perfectday', 'week', 'theme', 'hsk', 'perfect']);
});
```

In `tests/js/badges.test.mjs`, replace:

```js
  const days = [{ day: '2026-10-05' }, { day: '2026-10-06' }];
  assert.deepEqual(badgeFacts({ data, progress, days, events, perfectSession: true }), {
    bestStreak: 2, checkIns: 2, learned: 12, mastered: 0, totalWords: 61, reviews: 2, minutes: 2.5, perfectDays: 1, fullWeeks: 0,
    themesDone: ['t01'], groupsDone: [], perfectSession: true,
    // The unfinished theme with the fewest words left, and the first unfinished level group.
```

with:

```js
  const days = [{ day: '2026-10-05' }, { day: '2026-10-06' }];
  assert.deepEqual(badgeFacts({ data, progress, days, events, perfectSession: true }), {
    bestStreak: 2, checkIns: 2, learned: 12, mastered: 0, totalWords: 61, reviews: 2, minutes: 2.5, perfectDays: 1, spokenWell: 0, fullWeeks: 0,
    themesDone: ['t01'], groupsDone: [], perfectSession: true,
    // The unfinished theme with the fewest words left, and the first unfinished level group.
```

In `tests/js/badges.test.mjs`, replace:

```js
  assert.deepEqual([streak.next.id, streak.next.text], ['streak-14', '9 / 14 days']);
});
```

with:

```js
  assert.deepEqual([streak.next.id, streak.next.text], ['streak-14', '9 / 14 days']);
});

test('the speaking badges count the words spoken well, each word once', () => {
  assert.deepEqual(earnedBadges({ ...NONE, spokenWell: 99 }), ['spoken-10', 'spoken-50']);
  assert.deepEqual(earnedBadges({ ...NONE, spokenWell: 1000 }), ['spoken-10', 'spoken-50', 'spoken-100', 'spoken-500', 'spoken-1000']);
  assert.equal(badgeTitle('spoken-10'), '10 words spoken well');
  assert.equal(badgeTitle('spoken-1000'), '1,000 words spoken well');
  // 我 is spoken well twice and 你 once, 他 is skipped and 好 only listened to, which makes 2 words spoken well.
  const speak = (seq, id, result) => ({ seq, day: '2026-10-05', kind: 'speak', id, result, tries: 1, check: { tones: 1, heard: null } });
  const events = [speak(1, 'w0001', 'pass'), speak(2, 'w0002', 'pass'), speak(3, 'w0003', 'skip'), speak(4, 'w0009', 'listened'),
    { ...speak(5, 'w0001', 'pass'), day: '2026-10-06' }];
  assert.equal(badgeFacts({ data, progress: [], days: [], events }).spokenWell, 2);
  const ladder = badgeLadder({ ...NONE, spokenWell: 2 }, {});
  assert.deepEqual(ladder.find((g) => g.id === 'spoken').next, { id: 'spoken-10', title: '10 words spoken well', text: '2 / 10 words', share: 0.2 });
});
```

In `tests/js/goals.test.mjs`, replace:

```js
const t02 = data.words.filter((w) => w.theme === 't02');
const progressById = learned([...data.words.filter((w) => w.theme === 't01'), ...t02.slice(0, 2)]);
const facts = { bestStreak: 27, learned: 14, totalWords: 61, reviews: 95, minutes: 52.5 };

test('every countdown says how far the next milestone is, in its own unit, nearest first', () => {
```

with:

```js
const t02 = data.words.filter((w) => w.theme === 't02');
const progressById = learned([...data.words.filter((w) => w.theme === 't01'), ...t02.slice(0, 2)]);
const facts = { bestStreak: 27, learned: 14, totalWords: 61, reviews: 95, minutes: 52.5, spokenWell: 4 };

test('every countdown says how far the next milestone is, in its own unit, nearest first', () => {
```

In `tests/js/goals.test.mjs`, replace:

```js
    ['minutes', '8 minutes to the 60-minute badge', 8],
    ['learned', '11 more words to the 25-word badge', 11],
    ['group', '47 more words to finish HSK 1-2', 47],
    ['theme', '8 more words to finish Greetings & Courtesy', 8],
  ]);
  // The share left to go is 5 of 100 reviews, 3 of 30 days, and so on up to 8 of the tile's 10 words.
  assert.deepEqual(list.map((g) => Math.round(g.share * 100)), [5, 10, 13, 44, 77, 80]);
});
```

with:

```js
    ['minutes', '8 minutes to the 60-minute badge', 8],
    ['learned', '11 more words to the 25-word badge', 11],
    ['spoken', '6 more words to say well for the 10-word speaking badge', 6],
    ['group', '47 more words to finish HSK 1-2', 47],
    ['theme', '8 more words to finish Greetings & Courtesy', 8],
  ]);
  // The share left to go is 5 of 100 reviews, 3 of 30 days, and so on up to 8 of the tile's 10 words.
  assert.deepEqual(list.map((g) => Math.round(g.share * 100)), [5, 10, 13, 44, 60, 77, 80]);
});
```

In `tests/js/goals.test.mjs`, replace:

```js
test('a goal with nothing left is not shown', () => {
  const done = goals({
    data, progressById: learned(data.words), facts: { bestStreak: 365, learned: 61, totalWords: 61, reviews: 10000, minutes: 3000 }, streak: 365,
  });
  assert.deepEqual(done, []);
```

with:

```js
test('a goal with nothing left is not shown', () => {
  const done = goals({
    data, progressById: learned(data.words), facts: { bestStreak: 365, learned: 61, totalWords: 61, reviews: 10000, minutes: 3000, spokenWell: 1000 }, streak: 365,
  });
  assert.deepEqual(done, []);
```

In `tests/js/rewind.test.mjs`, replace:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { loadFixture, localDate, speakAll } from './helpers.mjs';
```

with:

```js
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { Speaking } from '../../docs/js/speaking.js';
import { loadFixture, localDate, speakAll } from './helpers.mjs';
```

In `tests/js/rewind.test.mjs`, replace:

```js
  assert.deepEqual(study.plan.newWords, data.words.slice(0, 8).map((w) => w.id));
});
```

with:

```js
  assert.deepEqual(study.plan.newWords, data.words.slice(0, 8).map((w) => w.id));
});

test('going back removes the later speak events, and a speaking badge earned later', async () => {
  // Says the first `wellLimit` words of the day's list well, through the speaking panel's controller, and skips the rest.
  const speakDay = async (store, day, wellLimit) => {
    const at = localDate(day, 10);
    const speaking = await Speaking.start({ store, data, now: at, mode: 'tones' });
    let well = 0;
    while (!speaking.finished) {
      if (well >= wellLimit) { await speaking.send({ type: 'skip' }, at); continue; }
      for (const input of [{ type: 'done' }, { type: 'done' }, { type: 'done' }, { type: 'done' }, { type: 'tap' }]) await speaking.send(input, at);
      await speaking.send({ type: 'heard', tones: { pass: true, share: 1, problem: null } }, at);
      well += 1;
    }
    return speaking.close(at);
  };
  const store = new MemoryStore();
  const learn = async (day) => {
    const now = localDate(day, 9);
    const study = await Study.start({ store, data, now });
    while (!study.finished) {
      if (study.card.type === 'learn') study.next();
      else await study.answer(right(study.card), now);
    }
  };
  await learn('2026-10-01');
  assert.deepEqual((await speakDay(store, '2026-10-01', 9)).newBadges.filter((b) => b.startsWith('spoken')), []);
  await learn('2026-10-02');
  // On 2 October one more word is said well, the 10th, which earns the first speaking badge.
  assert.ok((await speakDay(store, '2026-10-02', 24)).newBadges.includes('spoken-10'));
  const before = (await store.allEvents()).filter((e) => e.kind === 'speak');
  await rewindTo({ store, toDay: '2026-10-01', now: localDate('2026-10-03', 9) });
  const after = (await store.allEvents()).filter((e) => e.kind === 'speak');
  assert.deepEqual(after, before.filter((e) => e.day === '2026-10-01'));
  assert.equal(after.length, 12);
  assert.equal('spoken-10' in (await store.getMeta('badges')), false);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/badges.test.mjs tests/js/goals.test.mjs tests/js/rewind.test.mjs`
Expected: `ℹ tests 30`, `ℹ pass 25`, `ℹ fail 5`, the failing tests being "the Badges screen shows the groups in this order"; "the facts come from the saved words, check-ins and events"; "the speaking badges count the words spoken well, each word once"; "every countdown says how far the next milestone is, in its own unit, nearest first"; "going back removes the later speak events, and a speaking badge earned later".

- [ ] **Step 3: Add the speaking group and its countdown**

In `docs/js/config.js`, replace:

```js
    reviews: Object.freeze([100, 1000, 5000, 10000]),
    minutes: Object.freeze([60, 300, 1000, 3000]),
  }),
```

with:

```js
    reviews: Object.freeze([100, 1000, 5000, 10000]),
    minutes: Object.freeze([60, 300, 1000, 3000]),
    spoken: Object.freeze([10, 50, 100, 500, 1000]), // words spoken well (speaking practice spec)
  }),
```

In `docs/js/badges.js`, replace:

```js
// Milestone badges. A badge ID is a short text, for example 'streak-7', 'learned-all',
// 'reviews-1000', 'minutes-60', 'perfectday-7', 'week-2', 'theme-t05', 'hsk-1-2' or 'perfect'.
// Earned badges are kept in the meta store as { badgeId: dayEarned }, so each one is awarded once.
import { CONFIG } from './config.js';
```

with:

```js
// Milestone badges. A badge ID is a short text, for example 'streak-7', 'learned-all',
// 'reviews-1000', 'minutes-60', 'spoken-10', 'perfectday-7', 'week-2', 'theme-t05', 'hsk-1-2' or 'perfect'.
// Earned badges are kept in the meta store as { badgeId: dayEarned }, so each one is awarded once.
import { CONFIG } from './config.js';
```

In `docs/js/badges.js`, replace:

```js
//   list   one per finished theme ('theme-t05') or level group ('hsk-1-2')
//   once   'perfect', a session with at least 30 reviews, all right first time
// Plan 7 adds a speaking group here as one more steps row.
export const BADGE_GROUPS = Object.freeze([
  { id: 'streak', title: 'Streaks', kind: 'steps', fact: 'bestStreak', steps: CONFIG.badges.streak, unit: 'days' },
```

with:

```js
//   list   one per finished theme ('theme-t05') or level group ('hsk-1-2')
//   once   'perfect', a session with at least 30 reviews, all right first time
// The speaking group counts the words spoken well in the speaking panel (speak events with the
// result 'pass'), each word once.
export const BADGE_GROUPS = Object.freeze([
  { id: 'streak', title: 'Streaks', kind: 'steps', fact: 'bestStreak', steps: CONFIG.badges.streak, unit: 'days' },
```

In `docs/js/badges.js`, replace:

```js
  { id: 'reviews', title: 'Reviews answered', kind: 'steps', fact: 'reviews', steps: CONFIG.badges.reviews, unit: 'reviews' },
  { id: 'minutes', title: 'Minutes studied', kind: 'steps', fact: 'minutes', steps: CONFIG.badges.minutes, unit: 'minutes' },
  { id: 'perfectday', title: 'Perfect days', kind: 'steps', fact: 'perfectDays', steps: CONFIG.badges.perfectDays, unit: 'days' },
  { id: 'week', title: 'Full weeks', kind: 'count', fact: 'fullWeeks', steps: null, unit: 'weeks' },
```

with:

```js
  { id: 'reviews', title: 'Reviews answered', kind: 'steps', fact: 'reviews', steps: CONFIG.badges.reviews, unit: 'reviews' },
  { id: 'minutes', title: 'Minutes studied', kind: 'steps', fact: 'minutes', steps: CONFIG.badges.minutes, unit: 'minutes' },
  { id: 'spoken', title: 'Speaking', kind: 'steps', fact: 'spokenWell', steps: CONFIG.badges.spoken, unit: 'words' },
  { id: 'perfectday', title: 'Perfect days', kind: 'steps', fact: 'perfectDays', steps: CONFIG.badges.perfectDays, unit: 'days' },
  { id: 'week', title: 'Full weeks', kind: 'count', fact: 'fullWeeks', steps: null, unit: 'weeks' },
```

In `docs/js/badges.js`, replace:

```js
    case 'reviews': return `${grouped(value)} reviews answered`;
    case 'minutes': return `${grouped(value)} minutes studied`;
    case 'perfectday': return value === '1' ? '1 perfect day' : `${value} perfect days`;
    case 'week': return value === '1' ? 'Full week' : `Full week ×${value}`;
```

with:

```js
    case 'reviews': return `${grouped(value)} reviews answered`;
    case 'minutes': return `${grouped(value)} minutes studied`;
    case 'spoken': return `${grouped(value)} words spoken well`;
    case 'perfectday': return value === '1' ? '1 perfect day' : `${value} perfect days`;
    case 'week': return value === '1' ? 'Full week' : `Full week ×${value}`;
```

In `docs/js/badges.js`, replace:

```js
    minutes: all.minutes,
    perfectDays: all.perfectDays,
    fullWeeks: fullWeeks(checked),
    themesDone: themesDone(data.themes, data.words, byId),
```

with:

```js
    minutes: all.minutes,
    perfectDays: all.perfectDays,
    spokenWell: new Set(events.filter((e) => e.kind === 'speak' && e.result === 'pass').map((e) => e.id)).size,
    fullWeeks: fullWeeks(checked),
    themesDone: themesDone(data.themes, data.words, byId),
```

In `docs/js/goals.js`, replace:

```js
// it names. Today shows the two nearest, Stats shows them all. A goal's `share` is the part of its
// target still to go, so 3 days left of a 30-day streak is 0.1, and the smallest share is nearest.
import { CONFIG } from './config.js';
import { LEVEL_GROUPS, mapSections, wordsOfGroup } from './stats.js';
```

with:

```js
// it names. Today shows the two nearest, Stats shows them all. A goal's `share` is the part of its
// target still to go, so 3 days left of a 30-day streak is 0.1, and the smallest share is nearest.
// Plan 7 adds the next speaking badge.
import { CONFIG } from './config.js';
import { LEVEL_GROUPS, mapSections, wordsOfGroup } from './stats.js';
```

In `docs/js/goals.js`, replace:

```js
    out.push(goal('minutes', `${plural(left, 'minute')} to the ${grouped(minutes)}-minute badge`, left, minutes));
  }
  return nearest(out, out.length);
}
```

with:

```js
    out.push(goal('minutes', `${plural(left, 'minute')} to the ${grouped(minutes)}-minute badge`, left, minutes));
  }
  // The next speaking badge, counted in words spoken well (badges.js).
  const spokenWell = facts.spokenWell ?? 0;
  const spoken = nextStep(CONFIG.badges.spoken, spokenWell);
  if (spoken) {
    const left = spoken - spokenWell;
    out.push(goal('spoken', `${plural(left, 'more word')} to say well for the ${grouped(spoken)}-word speaking badge`, left, spoken));
  }
  return nearest(out, out.length);
}
```

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/js/badges.test.mjs tests/js/goals.test.mjs tests/js/rewind.test.mjs`
Expected: `ℹ tests 30`, `ℹ pass 30`, `ℹ fail 0`.

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 358`, `ℹ pass 358`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/badges.js docs/js/config.js docs/js/goals.js tests/js/badges.test.mjs tests/js/goals.test.mjs tests/js/rewind.test.mjs && git commit -F - <<'EOF'
feat(badges): the speaking badges for 10 to 1,000 words spoken well, and their countdown

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 11: What the screens show (`docs/js/view/speak.js`, Today, the check-in screen and the route)

The view modules say what the screens show, without touching the page, so Node tests them.

**The panel** (`speakView`) shows the word (characters, pinyin, short meaning), its example sentence with the word marked, where the learner is ("Word 3 of 18"), a heading and a line for the phase, and what was wrong after a miss.

| Phase | Heading | Line |
|---|---|---|
| listen | Listen | Listen to the word and its example sentence. |
| repeat | Repeat after me 2 of 3 | Say it after the voice. Nothing is recorded. |
| turn | Your turn | Tap the microphone and say the word. (After a miss it starts with "Try again.") |
| sounds | Say the word | Say it now, for the sound check. |
| record | Say the word | Listening... (in mode 'twice' it says "Now say it once more, for the tone check.") |
| missed | Not quite | Listen again. |

**Today** gets the spec's "Speaking practice" button under Start or Continue, with the count under it, for example "18 words to speak" (`speakButton`). When the learning is done and the check-in waits only for the speaking, Today says the spec's "Learning done. Speaking practice is left before today's check-in." and Start is hidden.

**The check-in screen** after a session with the learning done says "Learning done" and "12 words of speaking practice are left before today's check-in.", and offers "Next: speaking practice". After the panel it counts the session's words, for example "11 said well and 1 skipped in speaking practice."

**Settings** says which checks work on this phone (`checkText`), and repeats the one-time note about Google (`GOOGLE_NOTE`).

**The route** `#/speak` opens the panel. It is a full screen like the study session (`FULL_SCREEN`), so it is not drawn again when the app comes back on a new study day (`needsRedraw`).

**Files:**
- Create: `docs/js/view/speak.js`
- Modify: `docs/js/view/today.js`, `docs/js/view/progress.js`, `docs/js/view/route.js`, `docs/sw.js`
- Test: `tests/js/view-speak.test.mjs`, `tests/js/view-today.test.mjs`, `tests/js/view-progress.test.mjs`, `tests/js/view-misc.test.mjs`

- [ ] **Step 1: Write the failing tests**

Create `tests/js/view-speak.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOOGLE_NOTE, checkText, speakButton, speakView, spokenLine } from '../../docs/js/view/speak.js';
import { next, startWord } from '../../docs/js/speakflow.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const wo = word(data, '我');
const DONE = { type: 'done' };

test('the screen of a word shows its characters, pinyin, meaning and example, and what to do now', () => {
  let s = startWord({ id: wo.id, mode: 'tones' });
  const listen = speakView({ word: wo, state: s, position: { done: 2, total: 18 } });
  assert.deepEqual([listen.progress, listen.hz, listen.py, listen.heading, listen.counter, listen.mic],
    ['Word 3 of 18', '我', 'wǒ', 'Listen', null, false]);
  assert.equal(listen.wordAudio, `audio/${wo.au}`);
  assert.equal(listen.sentenceAudio, `audio/${wo.ex.au}`);
  assert.ok(listen.sentence.some((p) => p.hl && p.text === '我'));
  s = next(next(s, DONE), DONE);
  const repeat = speakView({ word: wo, state: s, position: { done: 2, total: 18 } });
  assert.deepEqual([repeat.heading, repeat.counter, repeat.prompt], ['Repeat after me', '2 of 3', 'Say it after the voice. Nothing is recorded.']);
  s = next(next(s, DONE), DONE);
  const turn = speakView({ word: wo, state: s, position: { done: 2, total: 18 } });
  assert.deepEqual([turn.heading, turn.mic, turn.prompt], ['Your turn', true, 'Tap the microphone and say the word.']);
});

test('after a miss the screen says what was wrong, and the next try says try again', () => {
  let s = startWord({ id: wo.id, spokenWell: true, mode: 'one' });
  s = next(next(s, { type: 'tap' }), { type: 'heard', tones: { pass: true, share: 1 }, sounds: { ok: false, heard: '是' } });
  const missed = speakView({ word: wo, state: s, position: { done: 0, total: 1 } });
  assert.deepEqual([missed.heading, missed.problems, missed.prompt, missed.mic], ['Not quite', ['Heard: 是'], 'Listen again.', false]);
  const twice = startWord({ id: wo.id, spokenWell: true, mode: 'twice' });
  assert.equal(speakView({ word: wo, state: next(twice, { type: 'tap' }), position: { done: 0, total: 1 } }).prompt, 'Say it now, for the sound check.');
  const second = next(next(twice, { type: 'tap' }), { type: 'heard', sounds: { ok: true, heard: '我' } });
  assert.equal(speakView({ word: wo, state: second, position: { done: 0, total: 1 } }).prompt, 'Now say it once more, for the tone check.');
});

test('Today\'s button counts the words left to speak', () => {
  assert.deepEqual(speakButton({ list: ['a', 'b'], done: [], left: ['a', 'b'] }), { label: 'Speaking practice', count: '2 words to speak', enabled: true });
  assert.deepEqual(speakButton({ list: ['a'], done: ['a'], left: [] }), { label: 'Speaking practice', count: 'All 1 word spoken.', enabled: false });
  assert.equal(speakButton({ list: [], done: [], left: [] }).count, 'No words to speak yet. Study first.');
});

test('Settings says which checks work on this phone, and the Google note', () => {
  assert.equal(checkText('one'), 'Speaking check on this phone: sounds and tones.');
  assert.equal(checkText('twice'), 'Speaking check on this phone: sounds and tones, saying each word twice.');
  assert.match(checkText('tones'), /^Speaking check on this phone: tones only\./);
  assert.match(checkText(null), /not tried yet/);
  assert.match(GOOGLE_NOTE, /sends your voice to Google/);
});

test('the check-in line about speaking', () => {
  assert.equal(spokenLine({ pass: 11, listened: 0, skip: 1 }), '11 said well and 1 skipped in speaking practice.');
  assert.equal(spokenLine({ pass: 3, listened: 2, skip: 1 }), '3 said well, 2 listened to and 1 skipped in speaking practice.');
  assert.equal(spokenLine({ pass: 0, listened: 12, skip: 0 }), '12 listened to in speaking practice.');
  assert.equal(spokenLine({ pass: 0, listened: 0, skip: 0 }), null);
});
```

Append to the end of `tests/js/view-today.test.mjs`:

```js
test('the speaking button sits under Start, and Today waits for the speaking before the check-in', () => {
  const speak = { list: ids(18), done: [], left: ids(18) };
  const v = todayView({ plan: plan({ reviewsDone: 6, newDone: 12 }), checkedDays: [], today: TODAY, settings: SETTINGS, speak });
  assert.deepEqual(v.speak, { label: 'Speaking practice', count: '18 words to speak', enabled: true });
  assert.equal(v.status, 'Learning done. Speaking practice is left before today\'s check-in.');
  assert.equal(v.canStart, false);
  // Before any learning, the list holds only the words carried over from earlier days.
  const morning = todayView({ plan: plan({ reviews: ids(20), newWords: ids(12) }), checkedDays: [], today: TODAY, settings: SETTINGS, speak: { list: ['x'], done: [], left: ['x'] } });
  assert.deepEqual([morning.status, morning.canStart, morning.speak.count], ['20 reviews and 12 new words today.', true, '1 word to speak']);
  // Spoken and checked in, the day is done.
  const done = todayView({ plan: plan({ reviewsDone: 6 }), checkedDays: [TODAY], today: TODAY, settings: SETTINGS, speak: { list: ['x'], done: ['x'], left: [] } });
  assert.deepEqual([done.status, done.canStart, done.speak.enabled], ['Done for today. See you tomorrow!', false, false]);
});
```

Append to the end of `tests/js/view-progress.test.mjs`:

```js
test('after the learning, the check-in screen sends the learner on to speaking practice', () => {
  const left = { reviews: [], newWords: [] };
  const learned = {
    day: TODAY, checkedIn: false, justCheckedIn: false, streak: 2, newBadges: [],
    summary: { reviews: 0, firstRight: 0, learned: 12, failed: 0, perfect: false }, left, speak: { list: ['a', 'b'], done: [], left: ['a', 'b'] },
  };
  const v = checkinView({ result: learned, checkedDays: [], today: TODAY, themes: data.themes });
  assert.equal(v.title, 'Learning done');
  assert.deepEqual(v.lines, ['12 new words learned.', '2 words of speaking practice are left before today\'s check-in.']);
  assert.deepEqual(v.next, { label: 'Next: speaking practice', href: '#/speak' });
  // The speaking panel's result has the counts of its words instead of a session summary.
  const spoken = { ...learned, checkedIn: true, justCheckedIn: true, summary: undefined, speak: { list: ['a', 'b'], done: ['a', 'b'], left: [] },
    spoken: { pass: 1, listened: 0, skip: 1 } };
  const w = checkinView({ result: spoken, checkedDays: [TODAY], today: TODAY, themes: data.themes });
  assert.deepEqual([w.title, w.lines, w.next, w.confetti], ['Checked in!', ['1 said well and 1 skipped in speaking practice.'], null, true]);
});
```

In `tests/js/view-misc.test.mjs`, replace:

```js
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today' });
  assert.deepEqual(parseRoute('#/rewind'), { name: 'rewind' }); // "Go back to a day", opened from Settings
  assert.deepEqual(parseRoute('#/theme'), { name: 'today' });
  // A map tile opens one level group's words of a theme, for example the HSK 3 words of t05.
```

with:

```js
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today' });
  assert.deepEqual(parseRoute('#/rewind'), { name: 'rewind' }); // "Go back to a day", opened from Settings
  assert.deepEqual(parseRoute('#/speak'), { name: 'speak' }); // the speaking panel, opened from Today
  assert.deepEqual(parseRoute('#/theme'), { name: 'today' });
  // A map tile opens one level group's words of a theme, for example the HSK 3 words of t05.
```

In `tests/js/view-misc.test.mjs`, replace:

```js
  // A running session keeps the day it started on, and Settings keeps what is being typed.
  assert.equal(needsRedraw({ drawnDay, today: '2026-10-06', route: { name: 'session' } }), false);
  assert.equal(needsRedraw({ drawnDay, today: '2026-10-06', route: { name: 'settings' } }), false);
});
```

with:

```js
  // A running session keeps the day it started on, and Settings keeps what is being typed.
  assert.equal(needsRedraw({ drawnDay, today: '2026-10-06', route: { name: 'session' } }), false);
  assert.equal(needsRedraw({ drawnDay, today: '2026-10-06', route: { name: 'speak' } }), false);
  assert.equal(needsRedraw({ drawnDay, today: '2026-10-06', route: { name: 'settings' } }), false);
});
```

- [ ] **Step 2: Run them and see them fail**

Run: `node --test tests/js/view-speak.test.mjs tests/js/view-today.test.mjs tests/js/view-progress.test.mjs tests/js/view-misc.test.mjs`
Expected: `ℹ tests 27`, `ℹ pass 22`, `ℹ fail 5`, the new test file stopping with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\view\speak.js`, and the failing tests being "addresses name the screens"; "a screen drawn on an earlier study day is drawn again when the app comes back"; "after the learning, the check-in screen sends the learner on to speaking practice"; "the speaking button sits under Start, and Today waits for the speaking before the check-in".

- [ ] **Step 3: Write the views**

Create `docs/js/view/speak.js`:

```js
// What the speaking panel shows (ui/speak.js draws it), and the speaking lines of Today and
// Settings. It never touches the page, so Node tests it.
import { AUDIO_BASE, highlightParts } from './card.js';
import { plural } from './format.js';
import { ROUNDS } from '../speakflow.js';

// The line in Settings that says which checks work on this phone. mode is what ui/recognize.js
// found the first time the panel was used, or null before that.
export function checkText(mode) {
  const lines = {
    one: 'sounds and tones.',
    twice: 'sounds and tones, saying each word twice.',
    tones: 'tones only. The sound check needs Chrome\'s speech recognition and the internet.',
    none: 'none, because the microphone is not allowed. Words are listened to and repeated.',
  };
  return `Speaking check on this phone: ${lines[mode] ?? 'not tried yet. Open speaking practice once to find out.'}`;
}

// The one-time note before the first try, also shown in Settings and on the credits page.
export const GOOGLE_NOTE = 'The sound check uses Google\'s speech recognition in Chrome, which sends your voice to Google. '
  + 'This app never saves your recordings.';

// The "Speaking practice" button of Today, under Start or Continue. speak is the day's speaking
// list as speakStatus (speaklist.js) gives it.
//   { list: 18 IDs, done: [], left: 18 IDs } gives { enabled: true, count: '18 words to speak' }
export function speakButton(speak) {
  const left = speak.left.length;
  let count;
  if (left) count = `${plural(left, 'word')} to speak`;
  else if (speak.list.length) count = `All ${plural(speak.list.length, 'word')} spoken.`;
  else count = 'No words to speak yet. Study first.';
  return { label: 'Speaking practice', count, enabled: left > 0 };
}

const HEADINGS = {
  listen: 'Listen',
  repeat: 'Repeat after me',
  turn: 'Your turn',
  sounds: 'Say the word',
  record: 'Say the word',
  missed: 'Not quite',
};

// The screen of one word. word is the words file's word, state the routine's state
// (speakflow.js) and position the controller's { done, total }.
//   phase 'repeat', round 2 gives heading 'Repeat after me', counter '2 of 3'
export function speakView({ word, state, position }) {
  const view = {
    progress: `Word ${position.done + 1} of ${position.total}`,
    hz: word.hz,
    py: word.py,
    en: word.enShort,
    wordAudio: AUDIO_BASE + word.au,
    sentence: highlightParts(word.ex.hz, word.hz),
    sentencePy: word.ex.py,
    sentenceEn: word.ex.en,
    sentenceAudio: AUDIO_BASE + word.ex.au,
    heading: HEADINGS[state.phase] ?? '',
    counter: state.phase === 'repeat' ? `${state.round} of ${ROUNDS}` : null,
    prompt: '',
    problems: state.phase === 'missed' || (state.phase === 'turn' && state.tries > 0) ? state.problems : [],
    mic: state.phase === 'turn',
    listening: state.phase === 'sounds' || state.phase === 'record',
    tries: state.tries,
  };
  if (state.phase === 'listen') view.prompt = 'Listen to the word and its example sentence.';
  if (state.phase === 'repeat') view.prompt = 'Say it after the voice. Nothing is recorded.';
  if (state.phase === 'turn') view.prompt = state.tries ? 'Try again. Tap the microphone and say the word.' : 'Tap the microphone and say the word.';
  if (state.phase === 'sounds') view.prompt = 'Say it now, for the sound check.';
  if (state.phase === 'record') view.prompt = state.mode === 'twice' ? 'Now say it once more, for the tone check.' : 'Listening...';
  if (state.phase === 'missed') view.prompt = 'Listen again.';
  return view;
}

// The line of the check-in screen about speaking, from the panel's counts of this session.
//   { pass: 11, listened: 0, skip: 1 } gives '11 said well and 1 skipped in speaking practice.'
export function spokenLine(spoken) {
  const parts = [];
  if (spoken.pass) parts.push(`${spoken.pass} said well`);
  if (spoken.listened) parts.push(`${spoken.listened} listened to`);
  if (spoken.skip) parts.push(`${spoken.skip} skipped`);
  if (!parts.length) return null;
  const joined = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : parts[0];
  return `${joined} in speaking practice.`;
}
```

In `docs/js/view/today.js`, replace:

```js
import { weekdayIndex } from '../dates.js';
import { WEEKDAY_LETTERS, percent, plural } from './format.js';

// The four tiles of a day's numbers (counters.js dayStats), for Today and the check-in screen.
```

with:

```js
import { weekdayIndex } from '../dates.js';
import { WEEKDAY_LETTERS, percent, plural } from './format.js';
import { speakButton } from './speak.js';

// The four tiles of a day's numbers (counters.js dayStats), for Today and the check-in screen.
```

In `docs/js/view/today.js`, replace:

```js
// resumable is true when a session stopped earlier today can continue (canContinue in study.js).
// rewound is the meta 'rewound' list of day ranges, which the streak skips. counters is
// counters.js todayCounters' result and goals the nearest goals (goals.js nearest).
// With 150 reviews waiting and the default settings, the note says that new words are halved.
export function todayView({
  plan, checkedDays, today, settings, resumable = false, rewound = [], counters = null, goals = [],
}) {
  const checkedInToday = checkedDays.includes(today);
```

with:

```js
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
```

In `docs/js/view/today.js`, replace:

```js
  const newWords = plan.newWords.length;
  const nothingLeft = reviews === 0 && newWords === 0;
  let note = null;
  if (plan.quota === 0 && settings.newPerDay > 0) {
```

with:

```js
  const newWords = plan.newWords.length;
  const nothingLeft = reviews === 0 && newWords === 0;
  const speakingLeft = speak.left.length > 0 && !checkedInToday;
  let note = null;
  if (plan.quota === 0 && settings.newPerDay > 0) {
```

In `docs/js/view/today.js`, replace:

```js
  let status;
  if (nothingLeft && checkedInToday) status = 'Done for today. See you tomorrow!';
  else if (nothingLeft) status = 'Nothing is due. Tap Start to check in.';
  else status = `${plural(reviews, 'review')} and ${plural(newWords, 'new word')} today.`;
```

with:

```js
  let status;
  if (nothingLeft && checkedInToday) status = 'Done for today. See you tomorrow!';
  else if (nothingLeft && speakingLeft) status = 'Learning done. Speaking practice is left before today\'s check-in.';
  else if (nothingLeft) status = 'Nothing is due. Tap Start to check in.';
  else status = `${plural(reviews, 'review')} and ${plural(newWords, 'new word')} today.`;
```

In `docs/js/view/today.js`, replace:

```js
    status,
    checkedInToday,
    canStart: !(nothingLeft && checkedInToday),
    startLabel: resumable || plan.reviewsDone + plan.newDone > 0 ? 'Continue' : 'Start',
  };
}
```

with:

```js
    status,
    checkedInToday,
    canStart: !(nothingLeft && (checkedInToday || speakingLeft)),
    startLabel: resumable || plan.reviewsDone + plan.newDone > 0 ? 'Continue' : 'Start',
    speak: speakButton(speak),
  };
}
```

In `docs/js/view/progress.js`, replace:

```js
import { WEEKDAY_LETTERS, WEEKDAY_SHORT, monthTitle, percent, plural, themeColor } from './format.js';
import { tilesOf } from './today.js';

const STATUS_LABEL = Object.freeze({ done: 'Done', current: 'Now', locked: 'Locked' });
```

with:

```js
import { WEEKDAY_LETTERS, WEEKDAY_SHORT, monthTitle, percent, plural, themeColor } from './format.js';
import { tilesOf } from './today.js';
import { spokenLine } from './speak.js';

const STATUS_LABEL = Object.freeze({ done: 'Done', current: 'Now', locked: 'Locked' });
```

In `docs/js/view/progress.js`, replace:

```js
}

// The check-in screen. result is Study.finish()'s result, or null when the screen is
// opened from the streak on the Today screen. counters is the day's numbers (counters.js
// dayStats) and bests the personal-best notes (counters.js personalBests). confetti is true
// right after the day was checked in.
export function checkinView({ result, checkedDays, today, themes, counters = null, bests = [] }) {
  const month = today.slice(0, 7);
```

with:

```js
}

// The check-in screen. result is Study.finish()'s result, the speaking panel's (speaking.js
// close(), with `spoken` instead of `summary`), or null when the screen is opened from the
// streak on the Today screen. counters is the day's numbers (counters.js dayStats) and bests
// the personal-best notes (counters.js personalBests). confetti is true right after the day was
// checked in. next is the button to speaking practice while its list has words left.
export function checkinView({ result, checkedDays, today, themes, counters = null, bests = [] }) {
  const month = today.slice(0, 7);
```

In `docs/js/view/progress.js`, replace:

```js
    badges: [],
    confetti: Boolean(result?.justCheckedIn),
    streak: result ? result.streak : null,
    monthTitle: monthTitle(month),
```

with:

```js
    badges: [],
    confetti: Boolean(result?.justCheckedIn),
    next: null,
    streak: result ? result.streak : null,
    monthTitle: monthTitle(month),
```

In `docs/js/view/progress.js`, replace:

```js
  if (!result) return view;
  const s = result.summary;
  if (result.justCheckedIn) view.title = 'Checked in!';
  else if (result.checkedIn) view.title = 'Already checked in today';
  else view.title = 'Not checked in yet';
  if (s.reviews) view.lines.push(`${plural(s.reviews, 'review')}, ${s.firstRight} right first time.`);
  if (s.learned) view.lines.push(`${plural(s.learned, 'new word')} learned.`);
  if (s.failed) view.lines.push(`${plural(s.failed, 'new word')} will come back next time.`);
  if (!result.checkedIn) {
    view.lines.push(`Still left today: ${plural(result.left.reviews.length, 'review')} and ${plural(result.left.newWords.length, 'new word')}.`);
  }
  view.badges = result.newBadges.map((id) => badgeTitle(id, themes));
  return view;
```

with:

```js
  if (!result) return view;
  const s = result.summary;
  const studyLeft = result.left.reviews.length + result.left.newWords.length;
  const speakLeft = result.speak?.left.length ?? 0;
  if (result.justCheckedIn) view.title = 'Checked in!';
  else if (result.checkedIn) view.title = 'Already checked in today';
  else if (!studyLeft) view.title = 'Learning done';
  else view.title = 'Not checked in yet';
  if (s?.reviews) view.lines.push(`${plural(s.reviews, 'review')}, ${s.firstRight} right first time.`);
  if (s?.learned) view.lines.push(`${plural(s.learned, 'new word')} learned.`);
  if (s?.failed) view.lines.push(`${plural(s.failed, 'new word')} will come back next time.`);
  if (result.spoken && spokenLine(result.spoken)) view.lines.push(spokenLine(result.spoken));
  if (!result.checkedIn && studyLeft) {
    view.lines.push(`Still left today: ${plural(result.left.reviews.length, 'review')} and ${plural(result.left.newWords.length, 'new word')}.`);
  } else if (!result.checkedIn && speakLeft) {
    view.lines.push(`${plural(speakLeft, 'word')} of speaking practice ${speakLeft === 1 ? 'is' : 'are'} left before today's check-in.`);
  }
  if (speakLeft) view.next = { label: 'Next: speaking practice', href: '#/speak' };
  view.badges = result.newBadges.map((id) => badgeTitle(id, themes));
  return view;
```

In `docs/js/view/route.js`, replace:

```js
]);

const SIMPLE = new Set(['today', 'session', 'checkin', 'map', 'stats', 'badges', 'settings', 'rewind']);

// parseRoute('#/word/w0026') gives { name: 'word', id: 'w0026' }, and parseRoute('#/theme/t05/3')
```

with:

```js
]);

const SIMPLE = new Set(['today', 'session', 'checkin', 'map', 'stats', 'badges', 'settings', 'rewind', 'speak']);

// The study session and the speaking panel are full screens without the bottom bar.
export const FULL_SCREEN = Object.freeze(['session', 'speak']);

// parseRoute('#/word/w0026') gives { name: 'word', id: 'w0026' }, and parseRoute('#/theme/t05/3')
```

In `docs/js/view/route.js`, replace:

```js
// When the app comes back from the background, a screen drawn on an earlier study day is out
// of date (Today drawn on 5 October would still say "Done for today" on 6 October), so it is
// drawn again. A running session keeps the day it started on, and Settings is left alone so
// nothing being typed there is lost.
export function needsRedraw({ drawnDay, today, route }) {
  return route.name !== 'session' && route.name !== 'settings' && drawnDay !== today;
}
```

with:

```js
// When the app comes back from the background, a screen drawn on an earlier study day is out
// of date (Today drawn on 5 October would still say "Done for today" on 6 October), so it is
// drawn again. A running session or speaking panel keeps the day it started on, and Settings is
// left alone so nothing being typed there is lost.
export function needsRedraw({ drawnDay, today, route }) {
  return !FULL_SCREEN.includes(route.name) && route.name !== 'settings' && drawnDay !== today;
}
```

- [ ] **Step 4: Run them and see them pass**

Run: `node --test tests/js/view-speak.test.mjs tests/js/view-today.test.mjs tests/js/view-progress.test.mjs tests/js/view-misc.test.mjs`
Expected: `ℹ tests 31`, `ℹ pass 31`, `ℹ fail 0`.

- [ ] **Step 5: Save the new file for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/view/route.js',
  'js/view/settings.js',
  'js/view/today.js',
  'vendor/hanzi-writer-3.7.3.esm.js',
```

with:

```js
  'js/view/route.js',
  'js/view/settings.js',
  'js/view/speak.js',
  'js/view/today.js',
  'vendor/hanzi-writer-3.7.3.esm.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 365`, `ℹ pass 365`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/view/progress.js docs/js/view/route.js docs/js/view/speak.js docs/js/view/today.js docs/sw.js tests/js/view-misc.test.mjs tests/js/view-progress.test.mjs tests/js/view-speak.test.mjs tests/js/view-today.test.mjs && git commit -F - <<'EOF'
feat(views): the speaking panel's screen, Today's speaking button, the check-in after the learning, and the #/speak route

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 12: The microphone and the recognizer (`docs/js/ui/mic.js`, `docs/js/ui/recognize.js`)

**The microphone.** Each try opens the microphone, records, and closes it again, so the phone's microphone light goes off between tries. The raw samples come from an audio worklet, `mic-worklet.js`, a small script that runs inside the browser's sound engine and hands every block of 128 samples to the page. Where the phone has no audio worklet, MediaRecorder records the try and `decodeAudioData` turns it into samples. A recording stays in memory for "Play my voice" and is never saved.

A try ends by itself (`stopper`). Worked example (the first test). The quietest of the first 300 ms sets the room's noise, here 0.002, and voice is anything 4 times louder and above 0.01. A word is said from 0.5 to 1.2 seconds, so the voice stops at 1.2 seconds, and after 0.7 seconds of quiet the try ends at 1.9 seconds. With no voice the try ends after 4 seconds, and any try ends after 6.

**The recognizer.** `ui/recognize.js` starts Chrome's recognizer in Chinese with 5 guesses, from the panel's own microphone track or from a microphone it opens itself. `sharesMic` finds out which this phone can do, and `findMode` picks the mode for a new panel session (choice 10). Chrome 135 and later take a track, and the Chrome 154 of this PC refuses `start(null)` with a TypeError, which is how `sharesMic` knows. The mode found is kept in localStorage `hsk-speak-check` for Settings.

Node can test `stopper` only. The rest needs a page, so `node --check` checks the syntax here, and the browser checks of Task 15 run them.

**Files:**
- Create: `docs/js/ui/mic-worklet.js`, `docs/js/ui/mic.js`, `docs/js/ui/recognize.js`
- Modify: `docs/sw.js`
- Test: `tests/js/mic.test.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/js/mic.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stopper } from '../../docs/js/ui/mic.js';

// Feeds a level every 50 ms and says when the try ended and why.
function runLevels(levels) {
  const decide = stopper();
  for (let i = 0; i < levels.length; i += 1) {
    const said = decide(levels[i], i * 50);
    if (said) return [said, i * 50];
  }
  return [null, levels.length * 50];
}

test('a try ends 0.7 seconds after the voice stops', () => {
  // A quiet room (0.002), a word from 0.5 s to 1.2 s (0.2), then quiet again.
  const levels = [...Array(10).fill(0.002), ...Array(14).fill(0.2), ...Array(40).fill(0.002)];
  assert.deepEqual(runLevels(levels), ['done', 1900]);
});

test('with no voice the try ends after 4 seconds, and a long one after 6', () => {
  assert.deepEqual(runLevels(Array(200).fill(0.002)), ['silent', 4000]);
  assert.deepEqual(runLevels([...Array(6).fill(0.002), ...Array(200).fill(0.3)]), ['done', 6000]);
});

test('a noisy room needs a voice four times louder than its noise', () => {
  // With noise at 0.05 from the start, 0.15 is not voice and 0.3 is.
  const levels = [...Array(10).fill(0.05), ...Array(10).fill(0.15), ...Array(10).fill(0.3), ...Array(20).fill(0.05)];
  assert.deepEqual(runLevels(levels), ['done', 2200]); // voice from 1.0 s to 1.5 s, then 0.7 s of quiet
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/mic.test.mjs`
Expected: `ℹ fail 1`, with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module` naming `docs\js\ui\mic.js`.

- [ ] **Step 3: Write the microphone and the recognizer**

Create `docs/js/ui/mic-worklet.js`:

```js
// An audio worklet, which is a small script that runs inside the browser's sound engine. It hands
// every block of 128 microphone samples to the page (ui/mic.js), so a try is recorded as raw
// numbers. It is loaded with audioWorklet.addModule() and has no imports.
class PcmTap extends AudioWorkletProcessor {
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) this.port.postMessage(channel.slice(0));
    return true;
  }
}

registerProcessor('pcm-tap', PcmTap);
```

Create `docs/js/ui/mic.js`:

```js
// The microphone of the speaking panel. Each try opens the microphone, records until the
// learner has spoken and stopped, and closes it again, so the phone's microphone light goes off
// between tries. A recording stays in memory for "Play my voice" and is never saved.
//
// Raw samples come from an audio worklet (mic-worklet.js). Where the phone has none, the
// browser's recorder (MediaRecorder) records the try and decodeAudioData turns it into samples.
// Both ways, a level meter decides when to stop. After the voice started, 0.7 seconds of quiet
// end the try. With no voice after 4 seconds, or after 6 seconds in all, the try ends anyway.
const WORKLET_URL = new URL('./mic-worklet.js', import.meta.url);

// Opens the microphone. Rejects with NotAllowedError when the learner or the phone refuses it.
export function openMic() {
  return navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
  });
}

export function closeMic(stream) {
  for (const track of stream?.getTracks() ?? []) track.stop();
}

const rms = (block) => {
  let sum = 0;
  for (let i = 0; i < block.length; i += 1) sum += block[i] * block[i];
  return Math.sqrt(sum / Math.max(1, block.length));
};

// Decides when a try is over, from the loudness of each block of sound. The quietest of the
// first blocks sets the noise floor, and voice is anything 4 times louder (and above 0.01).
export function stopper({ quietMs = 700, waitMs = 4000, maxMs = 6000 } = {}) {
  let floor = Infinity;
  let voiceAt = null;
  let quietSince = null;
  return (level, ms) => {
    if (ms < 300) floor = Math.min(floor, level);
    const loud = level > Math.max(0.01, 4 * (Number.isFinite(floor) ? floor : 0.0025));
    if (loud) {
      voiceAt = voiceAt ?? ms;
      quietSince = null;
    } else if (voiceAt !== null) {
      quietSince = quietSince ?? ms;
    }
    if (ms >= maxMs) return 'done';
    if (voiceAt === null && ms >= waitMs) return 'silent';
    if (voiceAt !== null && quietSince !== null && ms - quietSince >= quietMs) return 'done';
    return null;
  };
}

function joined(chunks) {
  const out = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
  let at = 0;
  for (const c of chunks) { out.set(c, at); at += c.length; }
  return out;
}

// Records one try from an open stream. Resolves { samples, rate, voice }, where voice is false
// when nothing louder than the room was heard. onLevel(level) is called about 20 times a second
// for the meter. stop() on the returned object ends the try early.
export function recordTry(stream, { onLevel = () => {} } = {}) {
  let stopNow = () => {};
  const done = (async () => {
    const ctx = new AudioContext();
    const source = ctx.createMediaStreamSource(stream);
    const decide = stopper();
    const started = performance.now();
    const chunks = [];
    let outcome = null;
    let finish;
    const ended = new Promise((resolve) => { finish = resolve; });
    const check = (level) => {
      onLevel(level);
      outcome = outcome ?? decide(level, performance.now() - started);
      if (outcome) finish();
    };
    stopNow = () => { outcome = outcome ?? 'done'; finish(); };
    let node = null;
    let recorder = null;
    let analyser = null;
    let timer = null;
    try {
      await ctx.audioWorklet.addModule(WORKLET_URL);
      node = new AudioWorkletNode(ctx, 'pcm-tap');
      let block = [];
      node.port.onmessage = (e) => {
        chunks.push(e.data);
        block.push(e.data);
        if (block.length >= 8) { check(rms(joined(block))); block = []; }
      };
      const mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(node).connect(mute).connect(ctx.destination);
    } catch {
      // Without an audio worklet, MediaRecorder records and an analyser watches the level.
      recorder = new MediaRecorder(stream);
      const parts = [];
      recorder.ondataavailable = (e) => parts.push(e.data);
      recorder.start();
      analyser = ctx.createAnalyser();
      source.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      timer = setInterval(() => { analyser.getFloatTimeDomainData(buf); check(rms(buf)); }, 50);
      recorder.parts = parts;
    }
    await ended;
    let samples;
    if (recorder) {
      clearInterval(timer);
      const stopped = new Promise((resolve) => { recorder.onstop = resolve; });
      recorder.stop();
      await stopped;
      const audio = await ctx.decodeAudioData(await new Blob(recorder.parts).arrayBuffer());
      samples = audio.getChannelData(0).slice(0);
    } else {
      node.port.onmessage = null;
      source.disconnect();
      samples = joined(chunks);
    }
    const rate = ctx.sampleRate;
    await ctx.close();
    return { samples, rate, voice: outcome !== 'silent' };
  })();
  return { done, stop: () => stopNow() };
}

// Plays a recording back ("Play my voice"). Resolves when it has played.
export async function playSamples({ samples, rate }) {
  const ctx = new AudioContext();
  const buffer = ctx.createBuffer(1, samples.length, rate);
  buffer.copyToChannel(samples, 0);
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  src.connect(ctx.destination);
  await new Promise((resolve) => { src.onended = resolve; src.start(); });
  await ctx.close();
}
```

Create `docs/js/ui/recognize.js`:

```js
// Chrome's speech recognizer for the sound check of the speaking panel. It sends the voice to
// Google, so it works only online, and the panel says so once (view/speak.js GOOGLE_NOTE).
//
// Which checks run on this phone (the modes of speakflow.js):
//   one    the recognizer can listen to the panel's own microphone track (Chrome 135 and
//          later), so one recording feeds both checks
//   twice  the recognizer opens the microphone itself, so the learner says the word twice,
//          first for the recognizer, then for the recording of the tone check
//   tones  the tone check alone, when there is no recognizer or the phone is offline
// The mode found is kept in this browser (localStorage) for the line in Settings.
export const CHECK_KEY = 'hsk-speak-check';

const Recognition = () => globalThis.SpeechRecognition ?? globalThis.webkitSpeechRecognition;

// True when the recognizer takes a microphone track. Such a recognizer refuses anything that
// is not a track with a TypeError, while an older one ignores the argument and starts
// listening, which is stopped at once.
export function sharesMic() {
  const R = Recognition();
  if (!R) return false;
  const r = new R();
  try {
    r.start(null);
  } catch (err) {
    return err instanceof TypeError;
  }
  try { r.abort(); } catch { /* already stopped */ }
  return false;
}

// The mode for a new panel session.
export function findMode({ online = navigator.onLine } = {}) {
  if (!Recognition() || !online) return 'tones';
  return sharesMic() ? 'one' : 'twice';
}

export function savedMode(storage = globalThis.localStorage) {
  try { return storage.getItem(CHECK_KEY); } catch { return null; }
}

export function saveMode(mode, storage = globalThis.localStorage) {
  try { storage.setItem(CHECK_KEY, mode); } catch { /* private mode: only Settings misses it */ }
}

// Listens for one word, in Chinese, from `track` or else from the microphone the recognizer
// opens itself. Returns { done, stop }. done resolves { texts, error }, where texts are the
// recognizer's guesses, best first, and error is null, 'no-speech' (it heard nothing), or
// another error such as 'network' or 'not-allowed', after which the panel uses the tone check
// alone. stop() ends the listening, as when the recording has ended.
export function listen({ track = null, lang = 'zh-CN', alternatives = 5, timeoutMs = 10000 } = {}) {
  const R = Recognition();
  if (!R) return { done: Promise.resolve({ texts: [], error: 'no-recognizer' }), stop: () => {} };
  const r = new R();
  r.lang = lang;
  r.maxAlternatives = alternatives;
  r.interimResults = false;
  r.continuous = false;
  let texts = [];
  let error = null;
  let timer;
  const done = new Promise((resolve) => {
    const end = () => { clearTimeout(timer); resolve({ texts, error }); };
    r.onresult = (e) => { texts = [...e.results[0]].map((alt) => alt.transcript); };
    r.onerror = (e) => { error = e.error; };
    r.onend = end;
    timer = setTimeout(() => {
      error = error ?? 'timeout';
      try { r.abort(); } catch { /* ended */ }
      end();
    }, timeoutMs);
    try {
      if (track) r.start(track);
      else r.start();
    } catch (err) {
      error = 'start-failed';
      end();
    }
  });
  return { done, stop: () => { try { r.stop(); } catch { /* ended */ } } };
}
```

- [ ] **Step 4: Run the test, and check the syntax of the page modules**

Run: `node --test tests/js/mic.test.mjs`
Expected: `ℹ tests 3`, `ℹ pass 3`, `ℹ fail 0`.

Run: `node --check docs/js/ui/mic-worklet.js && node --check docs/js/ui/recognize.js && echo syntax-ok`
Expected: no output from the syntax checks, then `syntax-ok`.

- [ ] **Step 5: Save the new files for offline use, and run every test**

In `docs/sw.js`, replace:

```js
  'js/ui/confetti.js',
  'js/ui/dom.js',
  'js/ui/rewind.js',
  'js/ui/screens.js',
```

with:

```js
  'js/ui/confetti.js',
  'js/ui/dom.js',
  'js/ui/mic-worklet.js',
  'js/ui/mic.js',
  'js/ui/recognize.js',
  'js/ui/rewind.js',
  'js/ui/screens.js',
```

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 368`, `ℹ pass 368`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/ui/mic-worklet.js docs/js/ui/mic.js docs/js/ui/recognize.js docs/sw.js tests/js/mic.test.mjs && git commit -F - <<'EOF'
feat(mic): recording a try through an audio worklet that stops by itself, and Chrome's recognizer with or without the microphone track

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 13: The speaking panel screen and its buttons (`docs/js/ui/speak.js`, `app.js`, `screens.js`, `settings.js`)

`ui/speak.js` draws the panel and runs each phase:
- **Opening.** `startSpeaking` finds the mode (choice 10), asks the browser whether the microphone is denied, builds the map of readings for the sound check once, starts the controller and opens `#/speak`.
- **A phase.** `renderSpeak` draws the word and carries out the phase's effects in order. A sound plays once (`playOnce`), and the time it took sets the pause of the repeat rounds. When the effects are done, it sends 'done' to the controller.
- **A try.** In the phase 'record', `recordAndCheck` opens the microphone, starts the recognizer on the same track in mode 'one', records until the try ends, closes the microphone, judges the tones with the learner's voice range and strictness, matches what the recognizer heard, adds the recording's pitch to the voice range, and sends the checks to the controller. In mode 'twice' the recognizer listens alone first (`soundsFirst`).
- **Leaving.** `endSpeaking` closes the day, runs the 'sessionEnd' hook (the Google Sheet backup) and shows the check-in screen. Leaving the panel by the bottom bar or the phone's Back button does the same, as for the study session.
- **Stop and Skip** sit at the top, and "Play the word" and, after a try, "Play my voice" under the microphone button.

The rest of this task joins the panel to the app:
- `app.js` opens `#/speak`, hides the bottom bar there, ends the panel when another screen opens, and stops its sounds and recording when the app goes to the background.
- Today gets the "Speaking practice" button with its count, and the check-in screen "Next: speaking practice". The tiles of a week or month get a fifth column for "words spoken".
- Settings gets the strictness (a choice of Gentle, Normal or Strict, labelled "Speaking check (how close the tones must be)"), the line that says which checks work on this phone, and the note about Google.
- The credits page says that the sound check sends the voice to Google and that recordings are never saved.
- The stylesheet gets the panel's microphone button and level meter, and the strictness choice at the height of the other Settings fields (48 pixels). The bottom bar is hidden by Plan 6's `[hidden]` rule.

**Files:**
- Create: `docs/js/ui/speak.js`
- Modify: `docs/js/app.js`, `docs/js/ui/screens.js`, `docs/js/ui/settings.js`, `docs/js/hooks.js`, `docs/credits.html`, `docs/css/app.css`, `docs/sw.js`
- Test: `tests/js/look.test.mjs`

- [ ] **Step 1: Write the failing test**

Append to the end of `tests/js/look.test.mjs`:

```js
test('the strictness choice in Settings is as easy to tap as the other fields', () => {
  assert.match(css, /\.field select \{[^}]*min-height: 3rem;/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/look.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 6`, `ℹ fail 1`, the failing tests being "the strictness choice in Settings is as easy to tap as the other fields".

- [ ] **Step 3: Write the panel**

Create `docs/js/ui/speak.js`:

```js
// The speaking panel ('#/speak'), a full screen without the bottom bar, like the study session.
// It asks the controller (speaking.js) for the current word and its phase, does what the phase
// asks (view/speak.js says what to show, speakflow.js effectsOf what to do), and sends back what
// happened, such as a sound that has played, a pause that is over, a tap on the microphone
// button, or the checks of a try.
import { Speaking } from '../speaking.js';
import { effectsOf, pauseMs } from '../speakflow.js';
import { trackPitch } from '../pitch.js';
import { addToVoice, emptyVoice, judgeTones } from '../tones.js';
import { matchWord, readingsOf, recognizerOutcome } from '../speakcheck.js';
import { GOOGLE_NOTE, speakView } from '../view/speak.js';
import { closeMic, openMic, playSamples, recordTry } from './mic.js';
import { findMode, listen, saveMode } from './recognize.js';
import { h, show } from './dom.js';

// Two things are kept in this browser only. They are the learner's voice range (tones.js
// addToVoice, a count of pitch values, never a recording) and whether the Google note was seen.
const VOICE_KEY = 'hsk-voice';
const NOTE_KEY = 'hsk-speak-note';

function readStore(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeStore(key, value) {
  try { localStorage.setItem(key, value); } catch { /* private mode: nothing kept */ }
}
function loadVoice() {
  try { return JSON.parse(readStore(VOICE_KEY)) ?? emptyVoice(); } catch { return emptyVoice(); }
}

const wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

// Opens the panel, from Today or the check-in screen. The tap also lets Chrome play sound.
export async function startSpeaking(app) {
  app.player.stop();
  let mode = findMode();
  const permission = await navigator.permissions?.query({ name: 'microphone' }).catch(() => null);
  if (permission?.state === 'denied') mode = 'none';
  saveMode(mode);
  app.readings = app.readings ?? readingsOf(app.data.words);
  app.lastVoice = null;
  app.speaking = await Speaking.start({ store: app.store, data: app.data, mode });
  window.location.hash = '#/speak';
}

// Ends the panel, finished or not, closes the day (the check-in when the learning is done too)
// and shows the check-in screen unless `quiet`.
export async function endSpeaking(app, { quiet = false } = {}) {
  const speaking = app.speaking;
  if (!speaking) return;
  app.speaking = null;
  app.speakRun = (app.speakRun ?? 0) + 1;
  app.player.stop();
  app.stopTry?.();
  const result = await speaking.close();
  app.lastResult = result;
  await app.hooks.emit('sessionEnd', { store: app.store, result });
  if (!quiet) window.location.hash = '#/checkin';
}

// Plays one sound once. Resolves 'done', or 'stopped' when the phone wants a tap first (the
// "Tap to continue" screen then starts the phase again) or the sound was cut short.
async function playOnce(app, url) {
  try {
    return await app.player.play(url, 1);
  } catch (err) {
    if (err && err.name === 'NotAllowedError') {
      app.needTap(() => renderSpeak(app));
      return 'stopped';
    }
    app.note('Sound is not on this phone yet. It plays when the phone is online.');
    return 'done';
  }
}

function draw(app, flash = null) {
  const speaking = app.speaking;
  const v = speakView({ word: speaking.word, state: speaking.state, position: speaking.position });
  const needNote = v.mic && ['one', 'twice'].includes(speaking.state.mode) && readStore(NOTE_KEY) !== 'seen';
  const micButton = h('button', {
    class: 'mic',
    disabled: needNote,
    'aria-label': 'Microphone: tap and say the word',
    onclick: () => advance(app, { type: 'tap' }),
  }, 'Tap and say it');
  show(app.main,
    h('div', { class: 'session-top' },
      h('button', {
        class: 'small',
        onclick: () => { if (window.confirm('Stop for now? The words finished so far are saved.')) endSpeaking(app); },
      }, 'Stop'),
      h('span', { class: 'muted' }, v.progress),
      h('button', { class: 'small', onclick: () => advance(app, { type: 'skip' }) }, 'Skip')),
    h('section', { class: 'card speak-card' },
      h('div', { class: 'hz speak-hz', lang: 'zh-CN' }, v.hz),
      h('div', { class: 'py' }, v.py),
      h('div', { class: 'en' }, v.en),
      h('div', { class: 'example' },
        h('div', { class: 'ex-hz', lang: 'zh-CN' }, v.sentence.map((p) => (p.hl ? h('mark', {}, p.text) : p.text))),
        h('div', { class: 'ex-py' }, v.sentencePy),
        h('div', { class: 'ex-en' }, v.sentenceEn))),
    flash ? h('div', { class: `banner ${flash.right ? 'right' : 'wrong'}` }, flash.text) : null,
    h('h2', { class: 'speak-heading' }, v.heading, v.counter ? h('span', { class: 'counter' }, ` ${v.counter}`) : null),
    h('p', { class: 'prompt' }, v.prompt),
    v.problems.map((p) => h('p', { class: 'problem' }, p)),
    needNote ? h('div', { class: 'note' }, h('p', {}, GOOGLE_NOTE),
      h('button', { class: 'small', onclick: () => { writeStore(NOTE_KEY, 'seen'); draw(app); } }, 'OK')) : null,
    v.mic ? micButton : null,
    v.listening ? h('div', { class: 'meter' }, h('span', { class: 'meter-level' })) : null,
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => playOnce(app, v.wordAudio) }, 'Play the word'),
      app.lastVoice ? h('button', { class: 'small', onclick: () => playSamples(app.lastVoice) }, 'Play my voice') : null));
}

function meter(app, level) {
  const bar = app.main.querySelector('.meter-level');
  if (bar) bar.style.width = `${Math.min(100, Math.round(level * 400))}%`;
}

// Sends one input to the controller and draws what follows. A finished word gets a short
// message before the next word.
async function advance(app, input) {
  const speaking = app.speaking;
  if (!speaking || app.busy) return;
  app.busy = true;
  app.speakRun = (app.speakRun ?? 0) + 1;
  app.player.stop();
  app.stopTry?.();
  let finished;
  try {
    finished = await speaking.send(input);
  } finally {
    app.busy = false;
  }
  if (finished && finished.result !== 'listened' && app.speaking === speaking && !speaking.finished) {
    const text = finished.result === 'pass' ? 'Well said!' : 'Skipped. It comes back next time.';
    app.speakRun += 1;
    const run = app.speakRun;
    draw(app, { right: finished.result === 'pass', text });
    await wait(900);
    if (app.speakRun !== run) return;
  }
  renderSpeak(app);
}

// The 'record' phase makes one recording for the tone check, and for the sound check too when the
// recognizer can listen to the same microphone (mode 'one').
async function recordAndCheck(app, withSounds, alive) {
  const speaking = app.speaking;
  const word = speaking.word;
  let stream;
  try {
    stream = await openMic();
  } catch {
    saveMode('none');
    await speaking.setMode('none');
    renderSpeak(app);
    return;
  }
  const recognizer = withSounds ? listen({ track: stream.getAudioTracks()[0] }) : null;
  const recording = recordTry(stream, { onLevel: (level) => meter(app, level) });
  app.stopTry = recording.stop;
  const audio = await recording.done;
  recognizer?.stop();
  const heard = recognizer ? await recognizer.done : null;
  closeMic(stream);
  app.stopTry = null;
  if (!alive()) return;
  app.lastVoice = audio.voice ? audio : null;
  // The recognizer failing, or missing a voice twice in a row, leaves the tone check alone.
  const outcome = recognizerOutcome(heard, audio.voice);
  app.missedVoice = outcome === 'empty' ? (app.missedVoice ?? 0) + 1 : 0;
  if (outcome === 'failed' || app.missedVoice >= 2) {
    saveMode('tones');
    await speaking.setMode('tones');
  }
  const sounds = outcome === 'heard' ? matchWord(word, heard.texts, app.readings) : null;
  const track = trackPitch(audio.samples, audio.rate);
  const voice = loadVoice();
  const tones = judgeTones({ track, word, voice, strictness: (await app.settings()).speakStrictness });
  if (audio.voice) writeStore(VOICE_KEY, JSON.stringify(addToVoice(voice, track.f0)));
  await advance(app, { type: 'heard', tones, sounds });
}

// In the 'sounds' phase of mode 'twice' the recognizer listens alone, and the recording follows.
async function soundsFirst(app, alive) {
  const speaking = app.speaking;
  const heard = await listen().done;
  if (!alive()) return;
  if (heard.error && heard.error !== 'no-speech') {
    saveMode('tones');
    await speaking.setMode('tones');
    renderSpeak(app);
    return;
  }
  await advance(app, { type: 'heard', sounds: matchWord(speaking.word, heard.texts, app.readings) });
}

// Draws the current word and carries out its phase.
export async function renderSpeak(app) {
  const speaking = app.speaking;
  if (!speaking) {
    window.location.hash = '#/today';
    return;
  }
  if (speaking.finished) {
    endSpeaking(app);
    return;
  }
  app.speakRun = (app.speakRun ?? 0) + 1;
  const run = app.speakRun;
  const alive = () => app.speaking === speaking && app.speakRun === run;
  draw(app);
  const v = speakView({ word: speaking.word, state: speaking.state, position: speaking.position });
  for (const fx of effectsOf(speaking.state)) {
    if (!alive()) return;
    if (fx.type === 'play') {
      const started = performance.now();
      const how = await playOnce(app, fx.what === 'word' ? v.wordAudio : v.sentenceAudio);
      if (how === 'stopped') return;
      if (fx.what === 'word') app.wordSeconds = (performance.now() - started) / 1000;
    } else if (fx.type === 'pause') {
      await wait(pauseMs(app.wordSeconds ?? 1));
    } else if (fx.type === 'listen') {
      await soundsFirst(app, alive);
      return;
    } else if (fx.type === 'record') {
      await recordAndCheck(app, fx.sounds, alive);
      return;
    }
  }
  if (alive() && ['listen', 'repeat', 'missed'].includes(speaking.state.phase)) await advance(app, { type: 'done' });
}
```

- [ ] **Step 4: Join it to the app**

In `docs/js/app.js`, replace:

```js
import { createHooks, loadPlugins } from './hooks.js';
import { createPlayer } from './audio.js';
import { NAV, needsRedraw, parseRoute } from './view/route.js';
import { h, show } from './ui/dom.js';
import { setupUpdates } from './ui/update.js';
```

with:

```js
import { createHooks, loadPlugins } from './hooks.js';
import { createPlayer } from './audio.js';
import { FULL_SCREEN, NAV, needsRedraw, parseRoute } from './view/route.js';
import { h, show } from './ui/dom.js';
import { setupUpdates } from './ui/update.js';
```

In `docs/js/app.js`, replace:

```js
import { renderSettings } from './ui/settings.js';
import { renderRewind } from './ui/rewind.js';

const app = {
```

with:

```js
import { renderSettings } from './ui/settings.js';
import { renderRewind } from './ui/rewind.js';
import { endSpeaking, renderSpeak } from './ui/speak.js';

const app = {
```

In `docs/js/app.js`, replace:

```js
  player: createPlayer(),
  study: null,
  lastResult: null,
  feedback: null,
```

with:

```js
  player: createPlayer(),
  study: null,
  speaking: null, // the speaking panel's controller (speaking.js) while '#/speak' is open
  lastResult: null,
  feedback: null,
```

In `docs/js/app.js`, replace:

```js
function drawNav(route) {
  const hidden = route.name === 'session';
  app.nav.hidden = hidden;
  if (hidden) return;
```

with:

```js
function drawNav(route) {
  const hidden = FULL_SCREEN.includes(route.name);
  app.nav.hidden = hidden;
  if (hidden) return;
```

In `docs/js/app.js`, replace:

```js
  const route = parseRoute(window.location.hash);
  if (route.name !== 'session' && app.study) await endSession(app, { quiet: true });
  app.drawnDay = studyDay();
  drawNav(route);
```

with:

```js
  const route = parseRoute(window.location.hash);
  if (route.name !== 'session' && app.study) await endSession(app, { quiet: true });
  if (route.name !== 'speak' && app.speaking) await endSpeaking(app, { quiet: true });
  app.drawnDay = studyDay();
  drawNav(route);
```

In `docs/js/app.js`, replace:

```js
      case 'settings': await renderSettings(app); break;
      case 'rewind': await renderRewind(app); break;
      default: await renderToday(app);
    }
```

with:

```js
      case 'settings': await renderSettings(app); break;
      case 'rewind': await renderRewind(app); break;
      case 'speak': renderSpeak(app); break;
      default: await renderToday(app);
    }
```

In `docs/js/app.js`, replace:

```js
    if (document.visibilityState === 'hidden') {
      app.player.stop();
      app.hooks.emit('hidden', { store: app.store });
    } else {
```

with:

```js
    if (document.visibilityState === 'hidden') {
      app.player.stop();
      if (app.speaking) {
        app.speakRun = (app.speakRun ?? 0) + 1; // the panel's sounds and recording stop
        app.stopTry?.();
      }
      app.hooks.emit('hidden', { store: app.store });
    } else {
```

In `docs/js/app.js`, replace:

```js
      // Back from the background during a session, a tap restores sound (the design's "Tap to continue").
      if (app.study) app.needTap(() => renderSession(app));
      // Back on a new study day, the screen is drawn again, so Today shows the new day's reviews.
      else if (needsRedraw({ drawnDay: app.drawnDay, today: studyDay(), route: parseRoute(window.location.hash) })) render();
```

with:

```js
      // Back from the background during a session, a tap restores sound (the design's "Tap to continue").
      if (app.study) app.needTap(() => renderSession(app));
      else if (app.speaking) app.needTap(() => renderSpeak(app));
      // Back on a new study day, the screen is drawn again, so Today shows the new day's reviews.
      else if (needsRedraw({ drawnDay: app.drawnDay, today: studyDay(), route: parseRoute(window.location.hash) })) render();
```

In `docs/js/ui/screens.js`, replace:

```js
import { cardElement } from './card.js';
import { startSession } from './session.js';
import { h, show } from './dom.js';
```

with:

```js
import { cardElement } from './card.js';
import { startSession } from './session.js';
import { startSpeaking } from './speak.js';
import { speakStatus } from '../speaklist.js';
import { h, show } from './dom.js';
```

In `docs/js/ui/screens.js`, replace:

```js
}

// The four numbers of a day as tiles (tilesOf in view/today.js).
function tilesElement(tiles) {
  return h('div', { class: 'tiles4' }, tiles.map((t) => h('div', { class: 'tile4' }, h('b', {}, t.value), h('span', {}, t.label))));
}
```

with:

```js
}

// The four numbers of a day as tiles (tilesOf in view/today.js), or the five of a week or month.
function tilesElement(tiles) {
  return h('div', { class: tiles.length === 5 ? 'tiles4 five' : 'tiles4' },
    tiles.map((t) => h('div', { class: 'tile4' }, h('b', {}, t.value), h('span', {}, t.label))));
}

// A button that opens the speaking panel (ui/speak.js).
function speakingButton(app, label, enabled = true) {
  return h('button', {
    class: 'big speak-start',
    disabled: !enabled,
    onclick: async (e) => { e.target.disabled = true; await startSpeaking(app); },
  }, label);
}
```

In `docs/js/ui/screens.js`, replace:

```js
  const byId = new Map(s.progress.map((p) => [p.id, p]));
  const streak = currentStreak(checked, today, s.rewound);
  const v = todayView({
    plan, checkedDays: checked, today, settings, resumable, rewound: s.rewound,
    counters: todayCounters({ events: s.events, plan, day: today }),
    goals: nearest(goals({ data: app.data, progressById: byId, facts: s.facts, streak }), 2),
  });
```

with:

```js
  const byId = new Map(s.progress.map((p) => [p.id, p]));
  const streak = currentStreak(checked, today, s.rewound);
  const speak = speakStatus({ progress: s.progress, events: s.events, day: today });
  const v = todayView({
    plan, checkedDays: checked, today, settings, resumable, rewound: s.rewound, speak,
    counters: todayCounters({ events: s.events, plan, day: today, speak }),
    goals: nearest(goals({ data: app.data, progressById: byId, facts: s.facts, streak }), 2),
  });
```

In `docs/js/ui/screens.js`, replace:

```js
      onclick: async (e) => { e.target.disabled = true; await startSession(app); },
    }, v.startLabel) : null,
    h('h2', {}, 'Done today'),
    tilesElement(v.tiles),
```

with:

```js
      onclick: async (e) => { e.target.disabled = true; await startSession(app); },
    }, v.startLabel) : null,
    speakingButton(app, v.speak.label, v.speak.enabled),
    h('p', { class: 'speak-count muted' }, v.speak.count),
    h('h2', {}, 'Done today'),
    tilesElement(v.tiles),
```

In `docs/js/ui/screens.js`, replace:

```js
    v.streak !== null ? h('p', { class: 'streak' }, h('span', { class: 'streak-n' }, v.streak), ' day streak') : null,
    v.lines.map((line) => h('p', {}, line)),
    tilesElement(v.numbers),
    v.bests.map((b) => h('p', { class: 'best' }, b)),
```

with:

```js
    v.streak !== null ? h('p', { class: 'streak' }, h('span', { class: 'streak-n' }, v.streak), ' day streak') : null,
    v.lines.map((line) => h('p', {}, line)),
    v.next ? speakingButton(app, v.next.label) : null,
    tilesElement(v.numbers),
    v.bests.map((b) => h('p', { class: 'best' }, b)),
```

In `docs/js/ui/settings.js`, replace:

```js
import { filesForWords } from '../view/files.js';
import { backupFileName, backupText, parseBackup, settingsFromForm, settingsView } from '../view/settings.js';
import { h, show } from './dom.js';
```

with:

```js
import { filesForWords } from '../view/files.js';
import { backupFileName, backupText, parseBackup, settingsFromForm, settingsView } from '../view/settings.js';
import { GOOGLE_NOTE, checkText } from '../view/speak.js';
import { savedMode } from './recognize.js';
import { h, show } from './dom.js';
```

In `docs/js/ui/settings.js`, replace:

```js
      e.preventDefault();
      const f = new FormData(form);
      const next = settingsFromForm({ newPerDay: f.get('newPerDay'), reviewCap: f.get('reviewCap'), autoplay: f.get('autoplay') === 'on' }, saved);
      await app.store.commit({ meta: { settings: next }, event: { day: studyDay(), kind: 'settings', settings: next } });
      status.textContent = `Saved: ${next.newPerDay} new words and up to ${next.reviewCap} reviews a day.`;
```

with:

```js
      e.preventDefault();
      const f = new FormData(form);
      const next = settingsFromForm({
        newPerDay: f.get('newPerDay'), reviewCap: f.get('reviewCap'), autoplay: f.get('autoplay') === 'on', speakStrictness: f.get('speakStrictness'),
      }, saved);
      await app.store.commit({ meta: { settings: next }, event: { day: studyDay(), kind: 'settings', settings: next } });
      status.textContent = `Saved: ${next.newPerDay} new words and up to ${next.reviewCap} reviews a day.`;
```

In `docs/js/ui/settings.js`, replace:

```js
  numberField('Most reviews per day', 'reviewCap', v.reviewCap, v.capRange),
  h('label', { class: 'field check' }, h('input', { type: 'checkbox', name: 'autoplay', checked: v.autoplay }), ' Play sounds automatically'),
  h('button', { class: 'big', type: 'submit' }, 'Save'), status);
```

with:

```js
  numberField('Most reviews per day', 'reviewCap', v.reviewCap, v.capRange),
  h('label', { class: 'field check' }, h('input', { type: 'checkbox', name: 'autoplay', checked: v.autoplay }), ' Play sounds automatically'),
  h('label', { class: 'field' }, 'Speaking check (how close the tones must be)',
    h('select', { name: 'speakStrictness' }, v.strictness.map((c) => h('option', { value: c.value, selected: c.value === v.speakStrictness }, c.label)))),
  h('button', { class: 'big', type: 'submit' }, 'Save'), status);
```

In `docs/js/ui/settings.js`, replace:

```js
  show(app.main, h('h1', {}, 'Settings'),
    h('h2', {}, 'Daily amounts and sound'), form,
    h('h2', {}, 'Offline'), audioText, downloadButton,
    h('button', { class: 'small', onclick: () => { stop = true; } }, 'Stop downloading'),
```

with:

```js
  show(app.main, h('h1', {}, 'Settings'),
    h('h2', {}, 'Daily amounts and sound'), form,
    h('h2', {}, 'Speaking practice'),
    h('p', { class: 'speak-check' }, checkText(savedMode())),
    h('p', { class: 'muted' }, GOOGLE_NOTE),
    h('h2', {}, 'Offline'), audioText, downloadButton,
    h('button', { class: 'small', onclick: () => { stop = true; } }, 'Stop downloading'),
```

In `docs/js/hooks.js`, replace:

```js
//   'open'        ({ store, data })          when the app starts and when it comes back to the screen
//   'hidden'      ({ store })                when the app goes to the background or is closed
//   'sessionEnd'  ({ store, result })        after a session ends (result is Study.finish()'s result)
//   'settings'    ({ container, store })     when Settings is drawn, to add a section to container
//   'rewound'     ({ store })                after "Go back to a day" (ui/rewind.js) or "Reset everything"
```

with:

```js
//   'open'        ({ store, data })          when the app starts and when it comes back to the screen
//   'hidden'      ({ store })                when the app goes to the background or is closed
//   'sessionEnd'  ({ store, result })        after a study session or the speaking panel ends (result is
//                                            Study.finish()'s or speaking.js close()'s result)
//   'settings'    ({ container, store })     when Settings is drawn, to add a section to container
//   'rewound'     ({ store })                after "Go back to a day" (ui/rewind.js) or "Reset everything"
```

In `docs/credits.html`, replace:

```html
  <h2>Audio</h2>
  <p>The sound files were made with Microsoft's neural voice zh-CN-XiaoxiaoNeural through the open-source tool <a href="https://github.com/rany2/edge-tts">edge-tts</a>.</p>
  <h2>Stroke order</h2>
  <p><a href="https://github.com/chanind/hanzi-writer">Hanzi Writer</a> by David Chanin, MIT License (<a href="vendor/hanzi-writer-LICENSE.txt">licence text</a>).</p>
```

with:

```html
  <h2>Audio</h2>
  <p>The sound files were made with Microsoft's neural voice zh-CN-XiaoxiaoNeural through the open-source tool <a href="https://github.com/rany2/edge-tts">edge-tts</a>.</p>
  <h2>Speaking practice</h2>
  <p>The sound check of speaking practice uses Google's speech recognition in Chrome, which sends your voice to Google. The tone check runs on the phone. This app never saves your recordings.</p>
  <h2>Stroke order</h2>
  <p><a href="https://github.com/chanind/hanzi-writer">Hanzi Writer</a> by David Chanin, MIT License (<a href="vendor/hanzi-writer-LICENSE.txt">licence text</a>).</p>
```

In `docs/css/app.css`, replace:

```css
.sheet-message { min-height: 1.4em; }

/* Feedback motion. A right answer bounces, a wrong one shakes, and new badges pop up. */
@keyframes bounce { 0% { transform: scale(0.9); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
```

with:

```css
.sheet-message { min-height: 1.4em; }

/* Speaking practice (the panel of Plan 7) */
.field select { display: block; font: inherit; padding: 0.5rem; min-height: 3rem; margin-top: 0.25rem; border: 2px solid var(--line); border-radius: 0.75rem; background: var(--card); }
button.speak-start { background: var(--card); color: var(--accent); border: 2px solid var(--accent); }
.speak-count { margin-top: -0.6rem; text-align: center; }
.tiles4.five { grid-template-columns: repeat(5, 1fr); }
.speak-hz { font-size: 3.5rem; }
.speak-heading .counter { color: var(--accent); }
.problem { background: var(--soft); border-left: 6px solid var(--wrong); border-radius: 0.75rem; padding: 0.6rem 0.8rem; font-weight: 600; }
button.mic {
  display: block; width: 7rem; height: 7rem; margin: 1rem auto; border-radius: 50%; border: none;
  background: var(--accent); color: #fff; font-weight: 700; font-size: 1rem;
}
.meter { height: 0.6rem; margin: 1rem 0; background: var(--soft); border-radius: 0.3rem; overflow: hidden; }
.meter-level { display: block; height: 100%; width: 0; background: var(--right); transition: width 0.08s linear; }

/* Feedback motion. A right answer bounces, a wrong one shakes, and new badges pop up. */
@keyframes bounce { 0% { transform: scale(0.9); } 60% { transform: scale(1.04); } 100% { transform: scale(1); } }
```

- [ ] **Step 5: Save the new file for offline use, check the syntax, and run every test**

In `docs/sw.js`, replace:

```js
  'js/ui/session.js',
  'js/ui/settings.js',
  'js/ui/update.js',
  'js/view/card.js',
```

with:

```js
  'js/ui/session.js',
  'js/ui/settings.js',
  'js/ui/speak.js',
  'js/ui/update.js',
  'js/view/card.js',
```

Run: `node --test tests/js/look.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

Run: `node --check docs/js/ui/speak.js && node --check docs/js/app.js && node --check docs/js/ui/screens.js && node --check docs/js/ui/settings.js && echo syntax-ok`
Expected: no output from the syntax checks, then `syntax-ok`.

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 369`, `ℹ pass 369`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/credits.html docs/css/app.css docs/js/app.js docs/js/hooks.js docs/js/ui/screens.js docs/js/ui/settings.js docs/js/ui/speak.js docs/sw.js tests/js/look.test.mjs && git commit -F - <<'EOF'
feat(speak): the speaking panel at #/speak, Today's speaking button, Next: speaking practice, and the speaking settings

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 14: The tone check on the app's own recordings (`tests/browser/tones-check.js`, `check.mjs tones`)

The spec asks for the tone classifier to be checked on the app's real one- and two-syllable recordings. Node cannot decode MP3, so the check runs in Chrome. `tests/browser/tones-check.js` decodes each held-out word's recording at 48,000 samples a second, as a phone's microphone records, so the downsampling of `pitch.js` runs too. It builds the voice range from all of them, as after a learner's first few tries, and judges each word at every strictness. The check mode `tones` prints the shares and fails when they fall below the pass bars, which are a little below what was measured (see "Facts verified"):
- at least 90% of the syllables heard with the right tone,
- at least 94% of the one-syllable words and 92% of the two-syllable words passing the normal check,
- every one of the user's tone samples passing the normal check, when their folder is given.

The mode `wav` writes the app's recording of 是 shì as a WAV file, with 0.3 seconds of silence before it and 1.5 seconds after, for Chrome's fake microphone in Task 15.

**Files:**
- Create: `tests/browser/tones.html`, `tests/browser/tones-check.js`
- Modify: `tests/browser/check.mjs`

- [ ] **Step 1: The page and the measurement**

Create `tests/browser/tones.html`:

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>ready</title>
</head>
<body>
  <h1>Tone check measurements</h1>
  <p>Serve the project folder (not docs/) with <code>python -m http.server 8124</code>. The check
  <code>node tests/browser/check.mjs tones</code> opens this page and runs <code>tones-check.js</code> in it.</p>
</body>
</html>
```

Create `tests/browser/tones-check.js`:

```js
// Measures the tone check of the speaking panel on the app's own word recordings (the Xiaoxiao
// voice of docs/audio/w/), in Chrome, which can decode MP3. check.mjs 'tones' imports this file
// into a page of the project folder (served on port 8124) and prints what it returns.
//
// The words measured are those whose recordings were not used to make the tone shapes of
// tones.js (SHAPES). They are the one-syllable words at odd places in the words file, the
// two-syllable words at places 1, 4, 7, ... (counting from 0), and every word of 3 or more
// syllables. Each recording is decoded at 48,000 samples a second, as a phone's microphone
// records, so the downsampling of pitch.js runs too. The learner's voice range is made from all
// the recordings, as it is after a learner's first few tries.
import { trackPitch } from '../../docs/js/pitch.js';
import { addToVoice, emptyVoice, expectedTones, judgeTones } from '../../docs/js/tones.js';

const RATE = 48000;

async function decode(buffer) {
  const ctx = new OfflineAudioContext(1, RATE, RATE);
  const audio = await ctx.decodeAudioData(buffer);
  return audio.getChannelData(0);
}

// The words to measure, as described at the top.
export function heldOut(words) {
  const ofLength = (n) => words.filter((w) => expectedTones(w).length === n);
  return [
    ...ofLength(1).filter((_, i) => i % 2 === 1),
    ...ofLength(2).filter((_, i) => i % 3 === 1),
    ...words.filter((w) => expectedTones(w).length >= 3),
  ];
}

const share = (right, total) => (total ? Math.round((1000 * right) / total) / 10 : null);

// Decodes and judges every held-out word, and the extra recordings in `samples` (WAV files as
// base64, with the word they say). Returns the shares in percent:
//   syllables   tone heard right, per tone, per tone in words of 1, 2 and 3+ syllables, per place
//               (alone, first, later) and in all
//   words       words that pass, per number of syllables and strictness
//   confusion   'said->heard' counts of the syllables heard wrong, such as { '2->3': 60 }
//   samples     the extra recordings, each with its result at the normal strictness
export async function measure({ wordsFile, base, samples = [] }) {
  const data = await (await fetch(wordsFile)).json();
  const words = heldOut(data.words);
  const tracks = [];
  let voice = emptyVoice();
  for (const w of words) {
    const buffer = await (await fetch(`${base}audio/${w.au}`)).arrayBuffer();
    const track = trackPitch(await decode(buffer), RATE);
    tracks.push(track);
    voice = addToVoice(voice, track.f0);
  }
  const tally = {};
  const count = (key, ok) => {
    tally[key] = tally[key] ?? [0, 0];
    tally[key][1] += 1;
    if (ok) tally[key][0] += 1;
  };
  const confusion = {};
  words.forEach((w, i) => {
    const n = expectedTones(w).length;
    const size = n >= 3 ? '3+' : String(n);
    for (const strictness of ['gentle', 'normal', 'strict']) {
      const j = judgeTones({ track: tracks[i], word: w, voice, strictness });
      count(`words ${size} ${strictness}`, j.pass);
      if (strictness !== 'normal') continue;
      j.syllables.forEach((s, k) => {
        if (s.say === 5) return;
        const place = n === 1 ? 'alone' : k === 0 ? 'first' : 'later';
        const right = s.heard === s.say;
        for (const key of ['all', `tone ${s.say}`, `tone ${s.say} in ${size}`, `place ${place}`]) count(`syllables ${key}`, right);
        if (!right) confusion[`${s.say}->${s.heard ?? 0}`] = (confusion[`${s.say}->${s.heard ?? 0}`] ?? 0) + 1;
      });
    }
  });
  const out = { measured: words.length, syllables: {}, words: {}, confusion, samples: [] };
  for (const [key, [right, total]] of Object.entries(tally)) {
    const [group, ...rest] = key.split(' ');
    out[group][rest.join(' ')] = { share: share(right, total), of: total };
  }
  for (const sample of samples) {
    const bytes = Uint8Array.from(atob(sample.wav), (c) => c.charCodeAt(0));
    const j = judgeTones({ track: trackPitch(await decode(bytes.buffer), RATE), word: sample.word, voice, strictness: 'normal' });
    out.samples.push({ name: sample.name, pass: j.pass, heard: j.syllables.map((s) => s.heard) });
  }
  return out;
}
```

- [ ] **Step 2: The `tones` and `wav` modes**

In `tests/browser/check.mjs`, replace:

```js
//   node tests/browser/check.mjs look      always light in dark mode, 48-pixel tap targets, theme
//                                          colours, and no confetti or bounce with reduced motion
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
const PORT = 9333;
```

with:

```js
//   node tests/browser/check.mjs look      always light in dark mode, 48-pixel tap targets, theme
//                                          colours, and no confetti or bounce with reduced motion
//   node tests/browser/check.mjs tones FOLDER   the tone check on the app's own word recordings (project
//                                          folder on 8124), and on the WAV files of FOLDER (optional)
//   node tests/browser/check.mjs wav       writes .claude/scratch/speak_shi.wav, the recording of 是 that
//                                          Chrome's fake microphone plays for the speaking checks
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
const PORT = 9333;
```

In `tests/browser/check.mjs`, replace:

```js
}

const mode = process.argv[2];
const modes = { store, day, offline, update, sheet, rewind, look };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update|sheet|rewind|look');
} else {
  try {
```

with:

```js
}

// ---- Speaking practice (Plan 7) ----

// The tone check on the app's own recordings (tests/browser/tones-check.js), with the pass bars
// of Plan 7, which are a little below what was measured there. A folder of WAV files named like
// '我 wo3 - third tone v2.wav' (the user's tone samples) adds recordings that must pass too.
async function tones() {
  const folder = process.argv[3];
  const samples = [];
  if (folder) {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { markTone } = await import('../../docs/js/pinyin.js');
    for (const name of readdirSync(folder).filter((n) => n.endsWith('.wav'))) {
      const m = name.match(/^(\S+) ([a-zü]+)([1-5]) /u); // '我 wo3 - third tone v2.wav'
      if (!m) continue;
      const word = { hz: m[1], py: markTone(m[2], Number(m[3])), pyNum: `${m[2]}${m[3]}` };
      samples.push({ name, word, wav: readFileSync(`${folder}/${name}`).toString('base64') });
    }
  }
  const { WORDS_FILE } = await import('../../docs/js/release.js');
  const page = await openPage(STORE_PAGE.replace('store-idb.html', 'tones.html'));
  await page.until("document.title === 'ready'", 20000);
  const r = await page.eval(`import('./tones-check.js').then((m) => m.measure({ wordsFile: '/docs/${WORDS_FILE}', base: '/docs/',
    samples: ${JSON.stringify(samples)} }))`);
  const s = r.syllables;
  const pct = (x) => `${x.share}% of ${x.of}`;
  check('the tone of a syllable is heard right at least 90% of the time', s.all.share >= 90, `${pct(s.all)}; tones 1-4 ${[1, 2, 3, 4].map((t) => pct(s[`tone ${t}`])).join(', ')}`);
  check('one-syllable words by the app\'s voice pass the normal check at least 94% of the time', r.words['1 normal'].share >= 94,
    `${pct(r.words['1 normal'])}; tones 1-4 heard right ${[1, 2, 3, 4].map((t) => `${s[`tone ${t} in 1`].share}%`).join(', ')}`);
  check('two-syllable words pass the normal check at least 92% of the time', r.words['2 normal'].share >= 92,
    `${pct(r.words['2 normal'])}; tones 1-4 heard right ${[1, 2, 3, 4].map((t) => `${s[`tone ${t} in 2`].share}%`).join(', ')}`);
  results.push(`INFO gentle, normal, strict: 1 syllable ${['gentle', 'normal', 'strict'].map((k) => r.words[`1 ${k}`].share).join(', ')}; `
    + `2 syllables ${['gentle', 'normal', 'strict'].map((k) => r.words[`2 ${k}`].share).join(', ')}; `
    + `3 or more ${['gentle', 'normal', 'strict'].map((k) => r.words[`3+ ${k}`].share).join(', ')}; heard wrong ${JSON.stringify(r.confusion)}`);
  if (folder) check('every tone sample passes the normal check', r.samples.length > 0 && r.samples.every((x) => x.pass), `${r.samples.filter((x) => x.pass).length} of ${r.samples.length}`);
  await page.close();
}

// Writes the app's recording of 是 shì (a 4th tone) as a WAV file, 0.3 s of silence before it and
// 1.5 s after, for Chrome's fake microphone (--use-file-for-fake-audio-capture).
async function wav() {
  const { WORDS_FILE } = await import('../../docs/js/release.js');
  const page = await openPage(STORE_PAGE.replace('store-idb.html', 'tones.html'));
  await page.until("document.title === 'ready'", 20000);
  const b64 = await page.eval(`(async () => {
    const data = await (await fetch('/docs/${WORDS_FILE}')).json();
    const shi = data.words.find((w) => w.hz === '是');
    const rate = 48000;
    const x = (await new OfflineAudioContext(1, rate, rate).decodeAudioData(await (await fetch('/docs/audio/' + shi.au)).arrayBuffer())).getChannelData(0);
    const parts = [new Float32Array(0.3 * rate), x, new Float32Array(1.5 * rate)];
    const n = parts.reduce((a, p) => a + p.length, 0);
    const v = new DataView(new ArrayBuffer(44 + 2 * n));
    const text = (at, s) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
    text(0, 'RIFF'); v.setUint32(4, 36 + 2 * n, true); text(8, 'WAVE'); text(12, 'fmt '); v.setUint32(16, 16, true);
    v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true); v.setUint32(28, 2 * rate, true);
    v.setUint16(32, 2, true); v.setUint16(34, 16, true); text(36, 'data'); v.setUint32(40, 2 * n, true);
    let at = 44;
    for (const p of parts) for (const s of p) { v.setInt16(at, Math.max(-32768, Math.min(32767, Math.round(s * 32767))), true); at += 2; }
    const bytes = new Uint8Array(v.buffer);
    let str = '';
    for (let i = 0; i < bytes.length; i += 8192) str += String.fromCharCode(...bytes.subarray(i, i + 8192));
    return btoa(str); })()`);
  const { mkdirSync, writeFileSync } = await import('node:fs');
  mkdirSync('.claude/scratch', { recursive: true });
  writeFileSync('.claude/scratch/speak_shi.wav', Buffer.from(b64, 'base64'));
  check('the recording of 是 is written for the fake microphone', b64.length > 100000, `.claude/scratch/speak_shi.wav, ${Buffer.from(b64, 'base64').length} bytes`);
  await page.close();
}

const mode = process.argv[2];
const modes = { store, day, offline, update, sheet, rewind, look, tones, wav };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update|sheet|rewind|look|tones|wav');
} else {
  try {
```

Run: `node --check tests/browser/check.mjs && node --check tests/browser/tones-check.js && echo syntax-ok`
Expected: no output from the syntax checks, then `syntax-ok`.

- [ ] **Step 3: Measure in Chrome**

Start these in background shells (the project folder, as in Plan 4 Task 17, and a headless Chrome with a new profile):
```bash
rm -rf "$TEMP/hskchk"
python -m http.server 8124
```
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir="$TEMP\\hskchk" --no-first-run --autoplay-policy=no-user-gesture-required about:blank
```
To check that Chrome listens, run `curl -s http://127.0.0.1:9333/json/version`, which prints a `"Browser": "Chrome/...` line. If Chrome's output says `bind() returned an error`, another Chrome holds port 9333. Do not end it unless its command line contains `hskchk`, because the user may have their own Chrome open.

Run: `node tests/browser/check.mjs tones '<project folder>/.claude/scratch/tone_samples'`
Expected after about 1.5 minutes, and exit code 0:
```
PASS the tone of a syllable is heard right at least 90% of the time (91.8% of 3879; tones 1-4 93.3% of 837, 89.6% of 966, 86.8% of 605, 94.3% of 1471)
PASS one-syllable words by the app's voice pass the normal check at least 94% of the time (96.1% of 359; tones 1-4 heard right 91.1%, 95.4%, 98.6%, 99.1%)
PASS two-syllable words pass the normal check at least 92% of the time (94.3% of 1352; tones 1-4 heard right 94.5%, 93.3%, 85.2%, 95.2%)
INFO gentle, normal, strict: 1 syllable 96.7, 96.1, 96.1; 2 syllables 96.2, 94.3, 87.2; 3 or more 98.1, 75, 62.3; heard wrong {"1->4":49,"2->3":36,"4->3":18,"3->4":21,"2->1":29,"3->2":59,"2->4":35,"4->1":46,"1->2":5,"4->2":20,"1->3":2}
PASS every tone sample passes the normal check (16 of 16)
```
The folder is in single quotes, because `!` in double quotes is special to an interactive Git Bash. Leave the server and Chrome running for Task 15.

- [ ] **Step 4: Commit**

```bash
git add tests/browser/check.mjs tests/browser/tones-check.js tests/browser/tones.html && git commit -F - <<'EOF'
test(browser): the tone check measured on the app's own word recordings and the user's tone samples

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

### Task 15: Release r009 and the browser checks (`docs/js/release.js`, `docs/sw.js`, `tests/browser/check.mjs`)

Everything in `docs/` changed, so the release goes up by one, and phones show "Update available, tap to reload". The browser checks change in two ways.

**`day` and `rewind` now speak.** After the learning, the check-in screen says "Learning done" and offers "Next: speaking practice". Both checks open the panel and skip every word, which ends the panel and checks in the day.

**Four new modes test the panel** in Chrome started with a fake microphone that plays the app's recording of 是 shì, a 4th tone, for every try. Each runs in a new, empty browser context, studies day 1 (12 new words, every answer right) and opens speaking practice from the check-in screen. All sounds play 4 times faster, so a word's listen and repeat rounds take a few seconds.
- **`speak`** takes Chrome's recognizer away, so the tone check decides alone, as on a phone without the recognizer or offline. It tries every word once and skips a word that misses. The 4th-tone words (是, 在, 不, 这) and the neutral-tone words (的, 了) must pass, and 我 (a 3rd tone) and 他 (a 1st) must miss with the tone they should have. The day must check in at the last word, with one speak event per word.
- **`speakboth`** puts a stand-in recognizer in place, which takes the microphone track and hears the word on the screen, so one recording feeds both checks. Before 在 it is made to hear 十 instead, which must fail with "Heard: 十". 我 must fail on its tone although the recognizer heard it right.
- **`speaktwice`** puts a stand-in recognizer in place that opens the microphone itself, so the panel asks for the word twice, "Say it now, for the sound check." then "Now say it once more, for the tone check."
- **`nomic`** refuses the microphone (`Browser.setPermission`). No microphone button is shown, every word is listened to and repeated, ends as 'listened', and the day still checks in.

Each of the four also checks the line in Settings that says which checks work on this phone. The order of all checks is below.

**Files:**
- Modify: `docs/js/release.js`, `docs/sw.js`, `tests/browser/check.mjs`

- [ ] **Step 1: Raise the release**

In `docs/js/release.js`, replace:

```js
// "Update available, tap to reload". When Plan 3 writes a newer words file, WORDS_FILE
// names it, and the release test fails until it does.
export const RELEASE = 'r008';
export const WORDS_FILE = 'data/words_v002.json';
```

with:

```js
// "Update available, tap to reload". When Plan 3 writes a newer words file, WORDS_FILE
// names it, and the release test fails until it does.
export const RELEASE = 'r009';
export const WORDS_FILE = 'data/words_v002.json';
```

In `docs/sw.js`, replace:

```js
// sends the message 'skipWaiting'.
// RELEASE and WORDS_FILE repeat docs/js/release.js, and tests/js/release.test.mjs checks them.
const RELEASE = 'r008';
const WORDS_FILE = 'data/words_v002.json';
const MEDIA_CACHE = 'media-v1';
```

with:

```js
// sends the message 'skipWaiting'.
// RELEASE and WORDS_FILE repeat docs/js/release.js, and tests/js/release.test.mjs checks them.
const RELEASE = 'r009';
const WORDS_FILE = 'data/words_v002.json';
const MEDIA_CACHE = 'media-v1';
```

Run: `node --test tests/js/release.test.mjs tests/js/sw.test.mjs`
Expected: `ℹ tests 11`, `ℹ pass 11`, `ℹ fail 0`.

- [ ] **Step 2: Speaking in the `day`, `rewind` and `offline` checks, and the four speaking modes**

In `tests/browser/check.mjs`, replace:

```js
//   node tests/browser/check.mjs wav       writes .claude/scratch/speak_shi.wav, the recording of 是 that
//                                          Chrome's fake microphone plays for the speaking checks
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
const PORT = 9333;
```

with:

```js
//   node tests/browser/check.mjs wav       writes .claude/scratch/speak_shi.wav, the recording of 是 that
//                                          Chrome's fake microphone plays for the speaking checks
// The speaking checks need Chrome started with the fake microphone (Task 19 of Plan 7). Each runs
// in a new, empty browser profile of its own, studies day 1, then opens speaking practice:
//   node tests/browser/check.mjs speak       the tone check alone (the recognizer fails headless)
//   node tests/browser/check.mjs speakboth   both checks from one recording, with a stand-in recognizer
//   node tests/browser/check.mjs speaktwice  the word said twice, with a stand-in recognizer
//   node tests/browser/check.mjs nomic       with the microphone refused, words are listened to and the day checks in
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
const PORT = 9333;
```

In `tests/browser/check.mjs`, replace:

```js
async function openPage(url) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
```

with:

```js
async function openPage(url) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  return connect(target.webSocketDebuggerUrl, () => fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`));
}

// A page in a new, empty browser profile of its own (a browser context), so a check starts as a
// phone that never used the app. init are scripts that run before the app's own, and denied
// lists the permissions to refuse, such as ['microphone'].
async function openFreshPage(url, { init = [], denied = [] } = {}) {
  const { webSocketDebuggerUrl } = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
  const browser = await connect(webSocketDebuggerUrl, () => {}, { browser: true });
  const { browserContextId } = await browser.send('Target.createBrowserContext');
  for (const name of denied) await browser.send('Browser.setPermission', { permission: { name }, setting: 'denied', browserContextId });
  const { targetId } = await browser.send('Target.createTarget', { url: 'about:blank', browserContextId });
  const page = await connect(`ws://127.0.0.1:${PORT}/devtools/page/${targetId}`, async () => {
    await browser.send('Target.closeTarget', { targetId });
    await browser.send('Target.disposeBrowserContext', { browserContextId });
    await browser.close();
  });
  await page.send('Page.enable');
  for (const source of init) await page.send('Page.addScriptToEvaluateOnNewDocument', { source });
  await page.send('Page.navigate', { url });
  return page;
}

// Talks to one page (or, with browser: true, to the browser itself) over its DevTools socket.
async function connect(socketUrl, closeTarget, { browser = false } = {}) {
  const ws = new WebSocket(socketUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
```

In `tests/browser/check.mjs`, replace:

```js
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
```

with:

```js
    ws.send(JSON.stringify({ id, method, params }));
  });
  if (browser) return { send, close: async () => ws.close() };
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
```

In `tests/browser/check.mjs`, replace:

```js
    async close() {
      ws.close();
      await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
    },
  };
```

with:

```js
    async close() {
      ws.close();
      await closeTarget();
    },
  };
```

In `tests/browser/check.mjs`, replace:

```js
const CLICK = (label) => `[...document.querySelectorAll('button')].find((b) => b.textContent === '${label}').click()`;
const POSITION = "document.querySelector('.session-top .muted').textContent";

// Reloads the page in the middle of the new words, as closing the app would, then taps Start
```

with:

```js
const CLICK = (label) => `[...document.querySelectorAll('button')].find((b) => b.textContent === '${label}').click()`;
const POSITION = "document.querySelector('.session-top .muted').textContent";

// Opens speaking practice from the check-in screen after the learning and skips every word,
// which ends the panel, checks in the day and shows the check-in screen again.
async function skipSpeaking(page) {
  await page.eval(CLICK('Next: speaking practice'));
  await page.until("location.hash === '#/speak' && !!document.querySelector('.speak-hz')");
  for (let i = 0; i < 200 && (await page.eval('location.hash')) === '#/speak'; i += 1) {
    await page.eval("[...document.querySelectorAll('button')].find((b) => b.textContent === 'Skip')?.click(); true");
    await page.sleep(150);
  }
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await page.sleep(300);
}

// Reloads the page in the middle of the new words, as closing the app would, then taps Start
```

In `tests/browser/check.mjs`, replace:

```js
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await page.sleep(300);
  const checkin = await page.text();
  check('the check-in screen says Checked in! with a 1-day streak', /Checked in! \| 1 day streak \| 12 new words learned/.test(checkin), checkin.slice(0, 120));
  check('the service worker controls the page', await page.eval('!!navigator.serviceWorker.controller'));
  const media = await page.eval("caches.open('media-v1').then((c) => c.keys()).then((k) => k.length)");
```

with:

```js
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await page.sleep(300);
  const learned = await page.text();
  check('after the learning the day waits for speaking practice',
    /^Learning done \| 0 day streak \| 12 new words learned\. \| 12 words of speaking practice are left before today's check-in\. \| Next: speaking practice/.test(learned), learned.slice(0, 160));
  await skipSpeaking(page);
  const checkin = await page.text();
  check('after speaking practice the check-in screen says Checked in! with a 1-day streak', /^Checked in! \| 1 day streak \| 12 skipped in speaking practice\./.test(checkin), checkin.slice(0, 120));
  check('the service worker controls the page', await page.eval('!!navigator.serviceWorker.controller'));
  const media = await page.eval("caches.open('media-v1').then((c) => c.keys()).then((k) => k.length)");
```

In `tests/browser/check.mjs`, replace:

```js
  await page.sleep(2500);
  check('its stroke order draws offline', (await page.eval("document.querySelectorAll('.strokes svg').length")) > 0);
  await page.close();
}
```

with:

```js
  await page.sleep(2500);
  check('its stroke order draws offline', (await page.eval("document.querySelectorAll('.strokes svg').length")) > 0);
  const panelFiles = await page.eval("Promise.all(['js/ui/speak.js', 'js/ui/mic-worklet.js', 'js/tones.js'].map((f) => fetch(f).then((r) => r.status, () => 'failed')))");
  check('the speaking panel files are on the phone', panelFiles.every((s) => s === 200), JSON.stringify(panelFiles));
  await page.close();
}
```

In `tests/browser/check.mjs`, replace:

```js
  await answerAll(page);
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  const pieces = await page.eval("document.querySelectorAll('.confetti-piece').length");
  const checkin = await page.text();
```

with:

```js
  await answerAll(page);
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await skipSpeaking(page);
  const pieces = await page.eval("document.querySelectorAll('.confetti-piece').length");
  const checkin = await page.text();
```

In `tests/browser/check.mjs`, replace:

```js
}

const mode = process.argv[2];
const modes = { store, day, offline, update, sheet, rewind, look, tones, wav };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update|sheet|rewind|look|tones|wav');
} else {
  try {
```

with:

```js
}

// Plays every sound 4 times faster, so the listen and repeat rounds of a word take a few seconds.
const FAST_SOUND = `(() => { const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { this.defaultPlaybackRate = 4; this.playbackRate = 4; return play.call(this); }; })();`;

// A stand-in for Chrome's speech recognizer, which needs Google's servers and gives an error in a
// headless Chrome. It hears window.__heard, or else the word on the screen, 1.5 seconds after it
// starts or as soon as it is stopped. With share true it takes a microphone track, as Chrome 135
// and later do, and refuses anything else with a TypeError. __starts records how it was started.
const RECOGNIZER = (share) => `(() => { window.__starts = [];
  class FakeRecognition {
    start(track) {
      if (${share} && arguments.length && !(track instanceof MediaStreamTrack)) throw new TypeError('parameter 1 is not of type MediaStreamTrack');
      __starts.push(track instanceof MediaStreamTrack ? 'track' : 'own');
      this.timer = setTimeout(() => this.finish(), 1500);
    }
    stop() { this.finish(); }
    abort() { clearTimeout(this.timer); this.done = true; }
    finish() {
      if (this.done) return;
      this.done = true;
      clearTimeout(this.timer);
      const text = window.__heard ?? document.querySelector('.speak-hz')?.textContent ?? '';
      this.onresult?.({ results: [[{ transcript: text + '。', confidence: 0.9 }]] });
      this.onend?.();
    }
  }
  window.SpeechRecognition = FakeRecognition;
  window.webkitSpeechRecognition = FakeRecognition; })();`;

// What the panel shows now.
const PANEL = `(() => { const m = document.getElementById('main');
  const text = (sel) => m.querySelector(sel)?.textContent ?? null;
  return { hash: location.hash, word: text('.speak-hz'), prompt: text('.prompt'), banner: text('.banner'),
    problems: [...m.querySelectorAll('.problem')].map((p) => p.textContent), mic: !!m.querySelector('button.mic:not([disabled])'),
    note: !!m.querySelector('.note'), myVoice: [...m.querySelectorAll('button')].some((b) => b.textContent === 'Play my voice') }; })()`;
const SPOKEN = `(async () => { const { openIdbStore } = await import(location.origin + '/js/store.js');
  const s = await openIdbStore(); const e = (await s.allEvents()).filter((x) => x.kind === 'speak'); s.db.close();
  return e.map((x) => ({ id: x.id, result: x.result, tries: x.tries, check: x.check })); })()`;
const SETTINGS_CHECK = `(async () => { location.hash = '#/settings'; await new Promise((r) => setTimeout(r, 700));
  return document.querySelector('.speak-check')?.textContent ?? ''; })()`;

// Studies day 1 in a fresh profile, every answer right, then opens speaking practice from the
// check-in screen.
async function learnThenSpeak(page) {
  await page.until("!!document.querySelector('.start')", 20000);
  await page.eval(COUNT_PLAYS);
  await page.eval("document.querySelector('.start').click()");
  await page.until("location.hash === '#/session' && !!document.querySelector('.session-top')");
  await answerAll(page);
  await page.until("location.hash === '#/checkin' && [...document.querySelectorAll('button')].some((b) => b.textContent === 'Next: speaking practice')");
  await page.eval(CLICK('Next: speaking practice'));
  await page.until("location.hash === '#/speak' && !!document.querySelector('.speak-hz')");
}

// Waits for the microphone button of the current word, after its listen and repeat rounds, taps
// it (and OK on the one-time Google note first), and waits for the verdict. Returns the word,
// 'pass' or 'miss' with the problems shown, and the prompts seen during the try.
async function tryWord(page) {
  await page.until(`(() => { const p = ${PANEL}; return p.mic || p.note; })()`, 40000);
  if ((await page.eval(PANEL)).note) await page.eval(CLICK('OK'));
  await page.until(`${PANEL}.mic`, 5000);
  const { word } = await page.eval(PANEL);
  await page.eval("document.querySelector('button.mic').click()");
  const prompts = [];
  for (let i = 0; i < 150; i += 1) {
    const p = await page.eval(PANEL);
    if (p.prompt && !prompts.includes(p.prompt)) prompts.push(p.prompt);
    if (p.hash !== '#/speak' || p.banner === 'Well said!') return { word, result: 'pass', prompts };
    if (p.problems.length) return { word, result: 'miss', problems: p.problems, prompts, myVoice: p.myVoice };
    await page.sleep(100);
  }
  return { word, result: 'timeout', prompts };
}

// Tries every word of the list once, skipping a word that misses, until the panel ends.
async function tryAll(page, before = async () => {}) {
  const out = {};
  for (let i = 0; i < 30 && (await page.eval('location.hash')) === '#/speak'; i += 1) {
    await before((await page.eval(PANEL)).word);
    const r = await tryWord(page);
    out[r.word] = r;
    if (r.result === 'miss') await page.eval(CLICK('Skip'));
    await page.sleep(1200);
  }
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await page.sleep(300);
  return out;
}

// Takes Chrome's speech recognizer away, as on a phone without it. In a headless Chrome it
// exists but hears nothing.
const NO_RECOGNIZER = '(() => { delete window.SpeechRecognition; delete window.webkitSpeechRecognition; })();';

// The tone check alone, as on a phone without the recognizer or offline. Chrome's fake microphone
// plays the app's recording of 是 shì, a 4th tone, for every try.
async function speak() {
  const page = await openFreshPage(`${SITE}#/today`, { init: [FAST_SOUND, NO_RECOGNIZER] });
  await learnThenSpeak(page);
  const panelNav = await page.eval("getComputedStyle(document.getElementById('nav')).display");
  const tried = await tryAll(page);
  const said = (hz) => tried[hz]?.result;
  check('the 4th-tone words pass with the recording of 是', ['是', '在', '不', '这'].every((hz) => said(hz) === 'pass'), JSON.stringify(Object.fromEntries(Object.entries(tried).map(([k, v]) => [k, v.result]))));
  check('neutral-tone words pass on any voice', said('的') === 'pass' && said('了') === 'pass');
  check('a 3rd tone said as a 4th is named', tried['我']?.problems?.[0] === 'Tone: heard a falling tone, it should go low.', JSON.stringify(tried['我']));
  check('a 1st tone said as a 4th is named', tried['他']?.problems?.[0] === 'Tone: heard a falling tone, it should stay high and level.', JSON.stringify(tried['他']));
  check('after a try the learner can play their own voice', tried['我']?.myVoice === true);
  check('the bottom bar was hidden on the panel', panelNav === 'none', panelNav);
  const checkin = await page.text();
  check('the last word closes the day, which shows Checked in! and the speaking line', /^Checked in! \| 1 day streak \| \d+ said well and \d+ skipped in speaking practice\./.test(checkin), checkin.slice(0, 100));
  const spoken = await page.eval(SPOKEN);
  check('one speak event per word, with the tone share and nothing heard', spoken.length === 12 && spoken.every((e) => e.tries === 1 && e.check.heard === null && (e.result === 'pass' ? e.check.tones === 1 : e.result === 'skip')),
    JSON.stringify(spoken.slice(0, 3)));
  const line = await page.eval(SETTINGS_CHECK);
  check('Settings says the tone check alone works here', line.startsWith('Speaking check on this phone: tones only.'), line);
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

// Both checks from one recording, with the stand-in recognizer that takes the microphone track.
async function speakboth() {
  const page = await openFreshPage(`${SITE}#/today`, { init: [FAST_SOUND, RECOGNIZER(true)] });
  await learnThenSpeak(page);
  // Before 在 the recognizer is made to hear 十 shí, which is not a homophone of 在 zài.
  const tried = await tryAll(page, (hz) => page.eval(`window.__heard = ${hz === '在' ? "'十'" : 'null'}; true`));
  check('a word said right passes both checks', tried['是']?.result === 'pass' && tried['不']?.result === 'pass', JSON.stringify(tried['是']));
  check('a wrong sound fails the try and says what was heard', tried['在']?.problems?.[0] === 'Heard: 十', JSON.stringify(tried['在']));
  check('a wrong tone fails the try although the sounds are right', tried['我']?.problems?.[0] === 'Tone: heard a falling tone, it should go low.', JSON.stringify(tried['我']));
  check('the recognizer listened to the recording\'s own microphone track', await page.eval("__starts.length > 0 && __starts.every((s) => s === 'track')"), await page.eval('JSON.stringify(__starts)'));
  const spoken = await page.eval(SPOKEN);
  const shi = spoken.find((e) => e.result === 'pass' && e.check.heard === '是');
  check('the saved event holds what the recognizer heard and the tone share', Boolean(shi) && shi.check.tones === 1, JSON.stringify(shi));
  const line = await page.eval(SETTINGS_CHECK);
  check('Settings says sounds and tones are checked from one recording', line === 'Speaking check on this phone: sounds and tones.', line);
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

// The word said twice, with the stand-in recognizer that opens the microphone itself.
async function speaktwice() {
  const page = await openFreshPage(`${SITE}#/today`, { init: [FAST_SOUND, RECOGNIZER(false)] });
  await learnThenSpeak(page);
  const first = await tryWord(page);
  check('each try asks for the word twice, sounds first', first.prompts.includes('Say it now, for the sound check.')
    && first.prompts.includes('Now say it once more, for the tone check.')
    && first.prompts.indexOf('Say it now, for the sound check.') < first.prompts.indexOf('Now say it once more, for the tone check.'), JSON.stringify(first.prompts));
  check('the recognizer opened the microphone itself', await page.eval("__starts.length > 0 && __starts.every((s) => s === 'own')"), await page.eval('JSON.stringify(__starts)'));
  const line = await page.eval(SETTINGS_CHECK);
  check('Settings says the word is said twice on this phone', line === 'Speaking check on this phone: sounds and tones, saying each word twice.', line);
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

// With the microphone refused, every word is listened to and repeated and ends as 'listened',
// and the day still checks in.
async function nomic() {
  const page = await openFreshPage(`${SITE}#/today`, { init: [FAST_SOUND], denied: ['microphone'] });
  await learnThenSpeak(page);
  let micSeen = false;
  for (let i = 0; i < 1200 && (await page.eval('location.hash')) === '#/speak'; i += 1) {
    micSeen = micSeen || (await page.eval(PANEL)).mic;
    await page.sleep(100);
  }
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await page.sleep(300);
  const checkin = await page.text();
  check('without a microphone no microphone button is shown', micSeen === false);
  check('the day still checks in', /^Checked in! \| 1 day streak \| 12 listened to in speaking practice\./.test(checkin), checkin.slice(0, 100));
  const spoken = await page.eval(SPOKEN);
  check('every word is saved as listened', spoken.length === 12 && spoken.every((e) => e.result === 'listened' && e.tries === 0), JSON.stringify(spoken.slice(0, 2)));
  const line = await page.eval(SETTINGS_CHECK);
  check('Settings says the microphone is not allowed', line.startsWith('Speaking check on this phone: none, because the microphone is not allowed.'), line);
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

const mode = process.argv[2];
const modes = { store, day, offline, update, sheet, rewind, look, tones, wav, speak, speakboth, speaktwice, nomic };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update|sheet|rewind|look|tones|wav|speak|speakboth|speaktwice|nomic');
} else {
  try {
```

Run: `node --check tests/browser/check.mjs && node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 369`, `ℹ pass 369`, `ℹ fail 0`.

Run: `python -m pytest tests -q`
Expected: `247 passed, 5 skipped`.

- [ ] **Step 3: Build the smoke site and start the servers**

The project folder server (port 8124) and Chrome still run from Task 14. If not, start them as in Task 14 Step 3. Then build the smoke site, which copies `docs/` with the real words file and sounds:
```bash
PYTHONIOENCODING=utf-8 python tools/14_smoke_site.py
```
It prints `Smoke site: .claude\scratch\smoke_v001` (or a higher number) and `Stroke files new 0, already there 82, missing none`. Then start each of these in its own background shell, with the `smoke_vNNN` folder it printed:
```bash
cd .claude/scratch/smoke_vNNN && python -m http.server 8123
```
```bash
node tests/browser/fake-sheet-server.mjs
```

- [ ] **Step 4: Run the checks of the first Chrome, in this order**

Run: `node tests/browser/check.mjs store`
Expected: the 9 `PASS` lines of Plan 6.

Run: `node tests/browser/check.mjs day`
Expected: 25 `PASS` lines and exit code 0, among them
```
PASS the bottom bar is hidden during the session
PASS after the learning the day waits for speaking practice (Learning done | 0 day streak | 12 new words learned. | 12 words of speaking practice are left before today's check-in. | Next: speaking practice | 12 | new word)
PASS after speaking practice the check-in screen says Checked in! with a 1-day streak (Checked in! | 1 day streak | 12 skipped in speaking practice. | 12 | new words | 0 | reviews | 100% | accuracy | 0 | min)
```

Run: `node tests/browser/check.mjs sheet`
Expected: the 10 `PASS` lines of Plan 5 Task 5, with `Backed up. 39 changes sent.`, because the 12 skipped words are 12 more events.

Run: `node tests/browser/check.mjs rewind`
Expected: the 13 `PASS` lines of Plan 6, among them
```
PASS day 2 checks in with a 2-day streak and confetti (Checked in! | 2 day streak | 24 skipped in speaking practice, 40 pieces)
PASS the Sheet is replaced by the rewound progress ({"log":101,"progress":24,"daily":2} before, {"log":41,"progress":12,"daily":2} after, 41 events on the phone)
```

Run: `node tests/browser/check.mjs look`
Expected: the 7 `PASS` lines of Plan 6.

Run: `node tests/browser/check.mjs wav`
Expected:
```
PASS the recording of 是 is written for the fake microphone (.claude/scratch/speak_shi.wav, 373292 bytes)
```

- [ ] **Step 5: Start Chrome again with the fake microphone, and run the speaking checks**

End the background shell of Chrome. If it keeps running, stop only the check's own Chrome. In PowerShell:
```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*hskchk*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Confirm:$false }
```
Then start it again in a background shell, with the same profile (the `offline` and `update` checks below need what `day` saved) and the fake microphone. `pwd -W` gives the worktree's Windows path, which Chrome needs:
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir="$TEMP\\hskchk" --no-first-run --autoplay-policy=no-user-gesture-required --use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture="$(pwd -W)/.claude/scratch/speak_shi.wav" about:blank
```

Run: `node tests/browser/check.mjs speak`
Expected after about 2.5 minutes, exit code 0:
```
PASS the 4th-tone words pass with the recording of 是 ({"的":"pass","了":"pass","我":"miss","是":"pass","你":"miss","在":"pass","不":"pass","有":"miss","他":"miss","这":"pass","和":"miss","我们":"miss"})
PASS neutral-tone words pass on any voice
PASS a 3rd tone said as a 4th is named ({"word":"我","result":"miss","problems":["Tone: heard a falling tone, it should go low."],"prompts":["Listening...","Listen again."],"myVoice":true})
PASS a 1st tone said as a 4th is named ({"word":"他","result":"miss","problems":["Tone: heard a falling tone, it should stay high and level."],"prompts":["Listening...","Listen again."],"myVoice":true})
PASS after a try the learner can play their own voice
PASS the bottom bar was hidden on the panel (none)
PASS the last word closes the day, which shows Checked in! and the speaking line (Checked in! | 1 day streak | 6 said well and 6 skipped in speaking practice. | 12 | new words | 0 | )
PASS one speak event per word, with the tone share and nothing heard ([{"id":"w0001","result":"pass","tries":1,"check":{"tones":1,"heard":null}},{"id":"w0002","result":"pass","tries":1,"check":{"tones":1,"heard":null}},{"id":"w0003","result":"skip","tries":1,"check":{"tones":0,"heard":null}}])
PASS Settings says the tone check alone works here (Speaking check on this phone: tones only. The sound check needs Chrome's speech recognition and the internet.)
PASS no uncaught errors on the page
```

Run: `node tests/browser/check.mjs speakboth`
Expected after about 2.5 minutes, exit code 0:
```
PASS a word said right passes both checks ({"word":"是","result":"pass","prompts":["Listening...","Listen to the word and its example sentence."]})
PASS a wrong sound fails the try and says what was heard ({"word":"在","result":"miss","problems":["Heard: 十"],"prompts":["Listening...","Listen again."],"myVoice":true})
PASS a wrong tone fails the try although the sounds are right ({"word":"我","result":"miss","problems":["Tone: heard a falling tone, it should go low."],"prompts":["Listening...","Listen again."],"myVoice":true})
PASS the recognizer listened to the recording's own microphone track (["track","track","track","track","track","track","track","track","track","track","track","track"])
PASS the saved event holds what the recognizer heard and the tone share ({"id":"w0004","result":"pass","tries":1,"check":{"tones":1,"heard":"是"}})
PASS Settings says sounds and tones are checked from one recording (Speaking check on this phone: sounds and tones.)
PASS no uncaught errors on the page
```

Run: `node tests/browser/check.mjs speaktwice`
Expected, exit code 0:
```
PASS each try asks for the word twice, sounds first (["Say it now, for the sound check.","Now say it once more, for the tone check.","Listen to the word and its example sentence."])
PASS the recognizer opened the microphone itself (["own","own"])
PASS Settings says the word is said twice on this phone (Speaking check on this phone: sounds and tones, saying each word twice.)
PASS no uncaught errors on the page
```

Run: `node tests/browser/check.mjs nomic`
Expected after about 2 minutes, exit code 0:
```
PASS without a microphone no microphone button is shown
PASS the day still checks in (Checked in! | 1 day streak | 12 listened to in speaking practice. | 12 | new words | 0 | reviews | 1)
PASS every word is saved as listened ([{"id":"w0001","result":"listened","tries":0,"check":{"tones":null,"heard":null}},{"id":"w0002","result":"listened","tries":0,"check":{"tones":null,"heard":null}}])
PASS Settings says the microphone is not allowed (Speaking check on this phone: none, because the microphone is not allowed. Words are listened to and repeated.)
PASS no uncaught errors on the page
```

- [ ] **Step 6: The offline and update checks**

End the background shell of the server on port 8123, then run: `node tests/browser/check.mjs offline`
Expected:
```
PASS the app opens with the server stopped (1 day streak | M | T | W | T | F | S | S | 100% | 0 | reviews | 0 | new words | )
PASS a word card opens offline
PASS its saved sound plays offline (ended)
PASS its stroke order draws offline
PASS the speaking panel files are on the phone ([200,200,200])
```

In the smoke copy only, never in `docs/`, raise the release and serve it again in a background shell:
```bash
cd .claude/scratch/smoke_vNNN && sed -i "s/RELEASE = 'r009'/RELEASE = 'r010'/" sw.js js/release.js && python -m http.server 8123
```
Run: `node tests/browser/check.mjs update`
Expected:
```
PASS the update message appears (Update available, tap to reload)
PASS after the tap only the new app cache is left (["media-v1","app-r010"])
PASS progress is kept after the update (1 day streak | M | T | W | T | F | S | S | 100% | 0 | review)
```

- [ ] **Step 7: Clean up**

End the background shells of the servers and of Chrome. If one keeps running, stop only the check's own processes. In PowerShell, Chrome first, choosing only the processes whose command line contains `hskchk`:
```powershell
Get-CimInstance Win32_Process -Filter "Name='chrome.exe'" | Where-Object { $_.CommandLine -like '*hskchk*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Confirm:$false }
Get-CimInstance Win32_Process -Filter "Name='python.exe' OR Name='node.exe'" | Where-Object { $_.CommandLine -like '*http.server 812*' -or $_.CommandLine -like '*fake-sheet-server*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Confirm:$false }
```
Never stop every `chrome.exe`. Then delete the check profile, the smoke site and the WAV file, which have served their purpose:
```bash
rm -rf "$TEMP/hskchk" .claude/scratch/smoke_vNNN .claude/scratch/speak_shi.wav
```

- [ ] **Step 8: Run the publish check**

Run: `PYTHONIOENCODING=utf-8 python tools/15_publish_check.py`
Expected: a line such as `13211 tracked files, docs/ 177.7 MB`, then `OK, nothing private or oversized found`.

- [ ] **Step 9: Name the new browser checks in the project notes**

The project folder's `.claude/CLAUDE.md` (`<project folder>\.claude\CLAUDE.md`) is not in the repository. In its "Browser checks" line, replace

```text
then `node tests/browser/check.mjs store|day|sheet|rewind|look|offline|update` (in that order; rewind needs day and sheet first; sheet needs the fake Sheet server on 8125).
```

by

```text
then `node tests/browser/check.mjs store|tones|day|sheet|rewind|look|wav`, then, in a Chrome started again with the fake microphone (Plan 7 Task 15), `speak|speakboth|speaktwice|nomic|offline|update` (in that order; rewind needs day and sheet first; sheet needs the fake Sheet server on 8125; tones takes the folder .claude/scratch/tone_samples).
```

- [ ] **Step 10: Commit**

```bash
git add docs/js/release.js docs/sw.js tests/browser/check.mjs && git commit -F - <<'EOF'
chore(release): r009 with the speaking practice panel, and the speaking browser checks

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_013FsmHpsEqNXnAGdTecDcjd
EOF
```

---

## After the tasks: merge and publish (waits for the user)

The push publishes the site to the learner's phone, so it waits for the user's yes.

1. Show the user what r009 changes, in plain words: the speaking practice panel, the button on Today and "Next: speaking practice" after a session, that the day's check-in now needs the speaking too, the speaking badges and countdown, the words spoken in Stats, the strictness in Settings, and that the sound check sends the learner's voice to Google. Ask whether to publish.
2. After the user says yes, merge the branch into `main` in the project folder with `git merge --ff-only plan7-speaking-practice`. Every git command there needs `git -c safe.directory='<project folder>'`, because Box reports the files as owned by Everyone. If `main` moved on meanwhile, rebase the branch in the worktree first and run the tests again.
3. Follow the release checklist of `.claude/plans/2026-09-28-plan5-sync-publish.md`. `node --test "tests/js/*.test.mjs"` and `python -m pytest tests -q` pass, `python tools/15_publish_check.py` prints `OK, nothing private or oversized found`, then `git push`.
4. After 1 to 5 minutes, `node tools/16_check_live.mjs https://wen-tan.com/hsk-flashcards/` prints its `PASS` lines with release r009. (The GitHub address `https://xiao-wen-tan.github.io/hsk-flashcards/` now redirects there.)
5. Remove the worktree when the branch is merged: `git --git-dir=~/git/hsk-flashcards.git worktree remove ~/git/hsk-wt-plan7`.

## On the phone after r009 (the user's checks, from the spec's section 7)

1. The app shows "Update available, tap to reload". After the tap, Settings, About shows release r009.
2. Study the day, then tap "Next: speaking practice". Chrome asks for the microphone once. Allow it.
3. Before the first try the note about Google shows. After OK, say the word. Settings, "Speaking practice" then says which checks work on this phone: "sounds and tones" (one recording), "sounds and tones, saying each word twice", or "tones only".
4. Try a few words on purpose with a wrong tone, and see whether the panel names it. If the check feels too strict or too loose with the learner's voice, change "Speaking check" in Settings. The `check` numbers of each word go to the Sheet's log (column Data), so the thresholds of `CONFIG.speak` can be tuned from them later.
5. Check that the day is checked in only after the speaking list is done, and that the confetti comes then.

---

## Self-review

### The spec, requirement by requirement

| Requirement (speaking practice spec of 2026-10-03, with the user's decisions) | Task |
|---|---|
| Words only; the example sentence plays once at the start and is not tested | 6 (listen phase), 13 |
| Listen, then repeat after the voice three times with a pause of 1.5 times the sound plus 1 second and a "1 of 3" counter; nothing recorded | 6, 11, 13 |
| At "Your turn" a pass moves on, and a miss says what was wrong, plays the correct sound again and asks again; the learner can play their own voice next to the model; Skip always; no try limit | 6, 11, 13 |
| A word spoken well before starts at "Your turn"; its miss runs listen and repeat first | 5, 6 |
| Both checks, Chrome's recognizer in Chinese (characters or a homophone with the same pinyin and tones, punctuation and spaces ignored) and the tone check of each syllable relative to the learner's voice range | 3, 4, 13 |
| Expected tones from `py` with the changes of 一 and 不, the third-tone change, neutral tones not judged | 3 |
| One microphone stream feeds both checks where Chrome allows it, otherwise the word is said twice, recognizer first; the phone's ability shown in Settings | 6, 12, 13 |
| Offline, or the recognizer failing, the tone check decides alone | 4, 12, 13 |
| Without microphone permission the panel runs listen and repeat only, the word counts as 'listened', and the streak does not break | 6, 13, 15 (`nomic`) |
| Strictness setting, gentle, normal or strict, default normal, thresholds set on the app's own recordings | 1, 3, 14 |
| Recordings never saved; a one-time note before the first try and the credits page say that the sound check sends the voice to Google | 12, 13 |
| One event per finished word, `{ day, kind: 'speak', id, result, tries, check: { tones, heard }, ts }`, never audio; speaking never changes the review schedule | 7 |
| The Sheet script needs no change; the phone's log label is "spoke" | 9 |
| The list holds every word studied today, new and reviewed, plus words skipped earlier and not yet passed, and is done when every word has a speak event that day | 5 |
| Today has the button under Start/Continue with a count, only carried words before any learning, and "Learning done. Speaking practice is left before today's check-in." | 11, 13 |
| The end of a learning session offers "Next: speaking practice" | 11, 13 |
| The panel is a full screen `#/speak` with the bottom bar hidden, like the study session | 11, 13 (with Plan 6's `[hidden]` rule), 15 |
| The check-in needs the learning and the speaking, from whichever screen finishes last, through the shared `closeDay` | 8 |
| A "Speaking" badge group for 10, 50, 100, 500 and 1000 words spoken well | 10 |
| Minutes include speaking, accuracy leaves it out, the ring counts the speaking words, Stats adds "words spoken" to the week and month | 9 |
| Going back to a day removes the later speak events, and speaking badges by date | 10 (test of Plan 6's rewind) |
| Release r009, after r007 and r008 | 15 |
| Node tests of `pitch.js` (error under 2%), `tones.js` (expected tones, third-tone change, at least 90% on made-up shapes with noise), `speakcheck.js` (homophones, punctuation, numbers), `speaklist.js`, `speakflow.js` (every path) and the check-in rule | 2 to 8 |
| Browser checks of the classifier on the real one- and two-syllable recordings, the panel with the fake microphone (tone check) and a stand-in recognizer (both checks), and the microphone denied | 14, 15 |
| The user's checks on the phone after r009 | "On the phone after r009" |

### Left out on purpose

- Practising or testing the example sentences, saving recordings, and a paid pronunciation service (the spec's "Not in this spec").
- A switch to turn the sound check off. The spec chose both checks, and the one-time note says where the voice goes.
- Tuning the tone shapes to the learner's voice. They are averages of the app's voice, made relative to the learner's own voice range, and the spec leaves the test with the learner's voice to the phone (above).
