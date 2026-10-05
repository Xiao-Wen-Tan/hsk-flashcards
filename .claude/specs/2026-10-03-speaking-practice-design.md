# HSK Flashcards: speaking practice panel

Design approved by the user on 2026-10-03, through questions answered one by one and the approved plan. It
extends the original design in `.claude/specs/2026-09-27-hsk-flashcards-design.md` and the rewind, counters
and look spec in `.claude/specs/2026-10-03-rewind-counters-look-design.md`, and changes them where it says
so. It is built inside the current app: plain ES modules in `docs/js/` with no npm packages, the logic as
pure functions tested with `node --test`, and the screens in `docs/js/ui/`.

## The user's request

"Add a test for the learner to speak. First read the character/phrase and sentence, then ask the learner to
follow for three times, then ask the learner to pronounce on his/her own, and record and test the
pronunciation, repeat until the pronunciation is good enough, if mispronounced then repeat the correct
pronunciation playing again. Design this as a standalone panel pairing with each day's learning, do not mix
together."

## Decisions (the user's, 2026-10-03)

| Question | Decision |
|---|---|
| What the panel practises | Words only. The example sentence is played once at the start for context and is not repeated or tested. |
| How pronunciation is judged | Both checks. Chrome's Chinese speech recognition checks the sounds, and a tone check inside the app measures the pitch of each syllable. |
| If the phone cannot run both checks on one recording | The learner says the word twice in that turn, once for each check. Offline, the tone check alone decides. |
| Many misses | No limit on tries, and a Skip button is always shown. A skipped word goes into tomorrow's speaking list. |
| How separate it is | Its own record and its own badge group. It counts for the day, so the check-in, the streak and the confetti need both the learning and the speaking done. |
| Which words | Every word studied today, new and reviewed, plus words skipped earlier and not yet passed. |
| Review words | A word already spoken well on an earlier day starts at "say it alone". The full listen-and-repeat runs only after a miss. |
| Where it lives | A "Speaking practice" button directly under Start/Continue on Today, opening its own full screen. |
| Release | Its own update (r009), after the bug fixes (r007) and the rewind, counters and look (r008). |

This changes the original design's rule that the day is checked in when the learning is done. From r009 the
day is checked in when the learning and the speaking are both done.

## 1. Entry

- Today shows a "Speaking practice" button under Start/Continue, with a count, for example "18 words to
  speak". Before any learning the list holds only words carried over from earlier days.
- The end of a learning session offers "Next: speaking practice".
- The panel is a full screen (`#/speak`) with the bottom bar hidden, like the study session.
- When only speaking is left, Today says "Learning done. Speaking practice is left before today's check-in."

## 2. The list

The speaking list of a study day holds:
- every word with a progress record whose `lessonDay` or `lastReview` is that day (new words, including
  lessons that ended without passing, and reviewed words), and
- every word skipped on an earlier day and not passed since (a "listened" result, when there was no
  microphone, does not clear the skip).

The list is done when every word in it has a speak event on that day.

## 3. Routine for one word (about 30 seconds for a new word)

1. **Listen.** The screen shows the word (characters, pinyin, meaning) and its example sentence. The app
   plays the word, then the sentence once.
2. **Repeat after me, three rounds.** Each round plays the word, then pauses (about 1.5 times the length of
   the sound plus 1 second) for the learner to say it. A counter shows "1 of 3". Nothing is recorded.
3. **Your turn.** The learner taps the microphone button and says the word. A pass moves to the next word.
   A miss shows what was wrong (for example "2nd syllable: heard a falling tone, it should rise", or
   "Heard: 是"), plays the correct sound again, and asks again. The learner can replay their own voice next
   to the model. Skip is always available.
4. **Review words.** A word spoken well on an earlier day starts at step 3. A miss there runs steps 1 and 2
   before the next try.

## 4. The check

A try passes when both checks that ran pass.

**Sounds.** Chrome's speech recognizer, set to Chinese, must hear the word's characters, or a homophone
with the same pinyin and tones. A character-to-pinyin map is built from the words file. For example, with
the target 他 tā, "她" (tā) passes and "塔" (tǎ) fails. Punctuation and spaces in the answer are ignored.

**Tones.** The recording is pitch-tracked in the app, cut into syllables, and each syllable's pitch shape
(level, rising, dipping, falling) is compared with the expected tone, relative to the learner's own voice
range. The expected tones come from the card pinyin `py`, which shows the tone changes of 一 and 不 (the
numbered `pyNum` does not), plus the third-tone change, where a third tone before another third tone is said
as a second tone (你好 nǐ hǎo is said ní hǎo). Neutral tones are not judged.

**One microphone, two listeners.** One microphone stream feeds the recording and, where Chrome allows it,
the recognizer. Where Chrome does not allow both at once, the learner says the word twice in that turn,
first for the recognizer, then for the tone check. The app finds out which works on the phone and shows it
in Settings ("Speaking check on this phone: sounds and tones").

**Fallbacks.**
- Offline, or when the recognizer fails, the tone check decides alone.
- Without microphone permission, the panel runs steps 1 and 2 only, and the word counts as done with the
  result "listened", so a microphone problem cannot break the streak.

**Strictness.** Settings gets "Speaking check: gentle, normal, strict" (default normal). The thresholds are
first set on the app's own recordings and still need a test with the learner's voice.

**Privacy.** Recordings are never saved. A one-time note before the first try, and the credits page, say
that the sound check uses Google's speech recognition, which sends the voice to Google.

## 5. What is saved

One event per finished word:

```
{ day, kind: 'speak', id, result: 'pass' | 'skip' | 'listened', tries, check: { tones, heard }, ts }
```

`check` holds the numbers of the last try (the share of syllables with the right tone, and what the
recognizer heard), never audio, so thresholds can be tuned from the Sheet's log. Speaking never changes the
review schedule. The Google Sheet backup already stores every event with its full content, so the Sheet
script needs no change. The phone's log label for the event is "spoke".

## 6. Counting for the day

- The day is checked in when the learning is done (`isDayDone`) and the speaking list is done, from
  whichever screen finishes last.
- The check-in and the badges move from `Study.finish` in `docs/js/study.js` into one shared function,
  `closeDay` in `docs/js/closeday.js`, which the study session and the speaking panel both call.
- A "Speaking" badge group counts words spoken well (result "pass"): 10, 50, 100, 500 and 1000.
- Minutes studied include speaking, because they follow the times of all events. Accuracy leaves speaking
  out. Today's ring counts the speaking words as part of the day's work. Stats adds "words spoken" to the
  week and month section.
- Going back to a day removes speak events after it like any other event, and speaking badges are kept or
  removed by date like the others.

## 7. Testing

- Pure modules with node tests: `pitch.js` (pitch tracking on synthetic tones, error under 2%),
  `tones.js` (expected tones from `py`, the third-tone change, a classifier at least 90% right on synthetic
  shapes with noise), `speakcheck.js` (homophones, punctuation, numbers), `speaklist.js` (the list, carried
  skips, done), `speakflow.js` (every path of the routine) and the check-in rule.
- Browser checks: the tone classifier on the app's real single- and two-syllable recordings; the panel end
  to end with Chrome's fake microphone fed a model recording (tone check path) and a stubbed recognizer
  (both checks); microphone permission denied (words end as "listened" and the day still checks in).
- On the phone after r009, the user checks the microphone prompt, which checks work, and whether the
  strictness feels fair with the learner's voice.

## Not in this spec

- Practising or testing the example sentences (the user chose words only).
- Saving recordings.
- A paid pronunciation service.
