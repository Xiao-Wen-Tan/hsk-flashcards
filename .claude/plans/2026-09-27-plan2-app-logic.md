# HSK Flashcards Plan 2: App Logic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and test the logic of the flashcard app (review schedule, daily queue, quiz choices, check-in, badges, stats and saved progress) as small browser-ready JavaScript files that later plans connect to screens and to the Google Sheet.

**Architecture:** Each rule of the design lives in its own plain JavaScript ES module in `docs/js/` (an ES module is a `.js` file that shares functions through `import` and `export`, which browsers and Node both understand). The modules never touch the page (no DOM, the browser's page model) and use no npm packages, so Node's built-in test runner (`node --test`) can test them directly. One small controller, `study.js`, joins them for the screens of Plan 4, and a storage layer, `store.js`, offers the same methods in memory (for tests) and in IndexedDB (the browser's built-in database, for the phone).

**Tech Stack:** Node v24.16.0 with `node:test` and `node:assert`, plain JavaScript ES modules, Git Bash on Windows. Python 3.10 and pytest stay as they are for the build scripts.

**Spec:** `.claude/specs/2026-09-27-hsk-flashcards-design.md` (the design). The word data contract is `.claude/plans/words-json-schema.md`.

**Where this plan sits:**
- Plan 1 (done) decoded the PDFs.
- Plan 2 (this plan) builds the app logic.
- Plan 3 builds the word list, which ends in `docs/data/words_vNNN.json`.
- Plan 4 builds the screens, audio, stroke order and offline support.
- Plan 5 adds the Google Sheet backup and deploys the site.

This plan can be carried out before Plan 3 finishes, because its tests use a small hand-written word file (a "fixture") that follows the same contract.

---

## The pinyin style sheet the user fixed (2026-09-28)

The section "Pinyin style sheet" of `.claude/plans/words-json-schema.md` now governs the card pinyin `py` and the sentence pinyin `ex.py` that this plan reads. Where it leaves a case open, the PDFs' print decides first, then the rule that a single entry of the card list or the public lists is written joined, then the national standard GB/T 16159-2012. Its fixed choices are these:
1. 这个, 那个 and 哪个 are "zhège", "nàge" and "nǎge", and 这些 and 那些 "zhèxiē" and "nàxiē". Before any other measure word 这, 那 and 哪 stand apart ("zhè běn shū").
2. Month and weekday names are one word ("bāyuè", "xīngqīyī"), and a day number stands apart ("bāyuè jiǔ rì").
3. 了, 着 and 过 right after a verb join it ("kànle", "kànzhe", "kànguo"), and a 了 that ends a sentence or clause stands apart.
4. A verb and a one-syllable result or direction are one word ("xiěhǎo", "shōudào", "liúxià"), and a two-syllable complement stands apart ("zǒu jìnlai").
5. A potential complement is three words with a neutral bu ("zhǎo bu dào", "tīng bu dǒng", "mǎi bu qǐ"), except a card, which keeps its printed or listed form ("duìbuqǐ", "shòubuliǎo", "láibují", "kànbuqǐ").
6. Numbers follow GB/T 16159-2012 6.1.5 ("sānshísān", "yìqiān wǔbǎi", "jǐshí", "yì-liǎng", "dì-shí", "sān gè rén", "sān fēn zhī yī", and a decimal digit by digit, "sān diǎn yī sì").
7. A surname and a given name are two words with capitals ("Lǐ Míng"), a title stands apart in lower case ("Wáng lǎoshī"), every word of a place name takes a capital ("Fújiàn Shěng"), names of languages, countries and peoples take a capital ("Hànyǔ", "Zhōngguó"), and common nouns are in lower case ("xīngqīrì", "měiyuán").
8. The tone changes of 一 and 不 are written as spoken ("yí gè", "bú shì", "yìqǐ"), and neutral tones as the dictionary gives them ("dōngxi", "xiàlai").
9. A sentence and a quotation after a colon start with a capital, and Chinese punctuation becomes Western punctuation.

For this plan that means two changes. The fixture's example pinyin follows the sheet (Task 5), and the pinyin quiz now prefers real wrong choices that already look like the answer, meaning the same word spacing, capitals and 儿 ending, before it reshapes a choice (Task 11, Choices 13 and 14).

---

## Facts verified before writing this plan (2026-09-27, revised 2026-09-28)

Each fact below was checked with a command or by reading a file. The date in brackets says when. Facts marked 2026-09-28 were checked again after the revision described under "Decisions the user made on 2026-09-28".

- **Tools.** `node --version` prints `v24.16.0` (2026-09-28). `python --version` prints `Python 3.10.6` and `python -m pytest tests -q` prints `69 passed` (2026-09-27, not re-run, because this revision changes no Python file).
- **Project state (2026-09-28).** There is no `docs/` folder and no `package.json` yet. `.gitignore` lists `.claude/`, so plan files are not committed. It does not list `docs/` or `tests/js/`.
- **How to run the tests on this machine (2026-09-28).** `node --test "tests/js/*.test.mjs"` (a quoted pattern that Node expands itself) runs every test file. `node --test tests/js/` (a bare folder) does not work here and fails with `'test failed'`.
- **Time zones in tests (2026-09-28).** Setting `process.env.TZ = 'America/Chicago'` at the top of a test file changes the time zone for that file on this Windows machine. A test read a UTC offset of 360 minutes in January and 300 minutes in July.
- **Missing-module failure text (2026-09-28).** When a test imports a file that does not exist yet, Node 24 prints `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...'` and `ℹ fail 1`.
- **The fixture words are real (2026-09-28).** The fixture has 61 words.
  - 60 of them were matched against `data/public/hsk2_old_exclusive_v001.json` (the public old-HSK list from Plan 1). Every one of these 60 matched on HSK level and numbered pinyin. 你好 is in neither public list, so the fixture uses 您 instead.
  - Their card pinyin was compared with the pinyin that the HSK 1 and HSK 2 PDFs print, as decoded in Plan 1 (`data/decode/entry_match_v004.csv`). In the first version of the fixture, 58 matched exactly, including the textbook spacing of 不客气 "bú kèqi", 没关系 "méi guānxi" and 对不起 "duìbuqǐ". The two others were 女儿 and 喂. 女儿 matches except that the PDF prints a curly apostrophe (nǚ’ér), and the fixture keeps the straight one that Plan 3 writes. 喂 was "wéi", while the PDF prints "wèi", so the fixture now uses wèi (wei4), which the public list also gives. So 59 of these 60 now match exactly.
  - The 61st word, 一点儿, was added for the 儿 ending. It is entry 131 of the HSK 1 PDF, printed "yìdiǎnr", with the meaning "a little". The public old-HSK list does not have it. The complete public list (`data/public/hsk_complete_v001.json`) gives its numbered pinyin as "yi1 dian3 r5".
- **All code in this plan has been run (2026-09-28).** Every file below was extracted from this plan into a scratch folder and tested there task by task, including every expected failure. The result was 135 tests with 134 passing and 1 skipped (the real-data test, which waits for Plan 3). The count includes the three tests for capital letters added after the cross-review of 2026-09-28 and the four tests for word spacing added after the third cross-review of that day.
- **Each quiz rule has a test that fails without it (2026-09-28).** Each check was removed from a scratch copy one at a time, and every test except the simulation was run again.
  - In `distractors.js`, removing any one of these checks made at least one test fail: same characters, `noDistract` (each side on its own), a meaning shared with the answer, English length, exact homophones, syllable count, toneless pinyin equal to the answer's, two choices sharing a meaning, two choices sharing toneless pinyin, tone variants only from step 2, a tone variant never using the dictionary tone, the same-theme tiers, a real tone twin needing the same word spacing as the answer, a made-up tone variant keeping the answer's spacing, searching first for words with the answer's kind of first letter, and showing each choice with the answer's capitals. Only the check against two choices showing the same text made no test fail. Two such choices would also share a meaning key (listening quiz) or toneless pinyin (pinyin quiz), which other checks already block, so that check is only a backstop.
  - For the quiz type of a review, removing or changing any one of these made at least one test fail: recall after a wrong answer, Unsure not counting as wrong, `review` saving `lastGrade`, listen at step 1, pinyin at step 2, the turn order recall, listen, pinyin, a re-ask being a recall card, and a re-ask not counting as a scheduled review.
  - In `pinyin.js`, the same was true for skipping hyphens and apostrophes between syllables, leaving the 儿 ending out of the syllable count, and treating a curly apostrophe like a straight one.
- **The worked example (2026-09-28).** Replaying the design's corrected 苹果 table through `review` and `quizForReview` (Task 4) gives every row of the table, meaning the quiz, the step after and the next review, for all nine reviews from 6 October 2026 to 13 December 2026. The word reaches step 7 with its next review on 11 February 2027.
- **The daylight-saving tests catch the usual bug (2026-09-27).** A version of `studyDay` that subtracts 4 hours of real time failed both daylight-saving tests. The version in this plan passes them. `dates.js` did not change in this revision.
- **Quiz-choice speed on a list of real size (2026-09-28).** A stand-in list of 4,991 words was built from the public old-HSK list, only to measure (it is not a project file). Picking wrong choices took about 0.56 to 0.60 ms per quiz in two runs. All 9,982 quizzes (every word, both quiz types, at step 2) got 3 wrong choices, with no rule broken. The stand-in writes every word's pinyin joined, so it does not test spaces or hyphens at this size.
- **Capital letters on the real list (2026-09-28).** Plan 3a's word list has 5,043 cards, 20 of them with a capital. It was tested with stand-ins for two fields that Plan 3b fills later (the theme set by level, and an empty `noDistract`). Each word got the pinyin quiz at step 2 on 2 days, and each name on 40 days, 10,846 quizzes in all. Without the capital rule of Task 11, 887 of them had a choice whose capital differed from the answer's, for example 北京 "Běijīng" with "xuésheng / xīngqī / xuéxiào", and 背景 "bèijǐng" with the tone twin "Běijīng". With the rule there were none, every quiz had 3 wrong choices, and `brokenRules` found nothing. 北京 then got, for example, "Hànyǔ / Zhōngguó / Chángjiāng". The same held on the Plan 3a list from before its capital fix, which had 23 names (1,023 of 10,960 quizzes before the rule, none after).
- **Word spacing of the pinyin choices (2026-09-28, third cross-review).** The same Plan 3a word list, with the same stand-ins and the four-character forms of Plan 3a's stand-in form answers, was given the pinyin quiz at step 2 on 2 days for every word, 10,086 quizzes. Before the change of Task 11, 142 of them had a choice whose spaces or hyphens differed from the answer's, so the answer could be picked by its spacing alone. For example 烟花爆竹 "yānhuā bàozhú" was the only choice with a space among idioms such as "jiéjìn-quánlì", and of the 268 quizzes whose answer has a space, a hyphen or "…", 78 gave it away. With every choice shown in the answer's word spacing there were none, every quiz had 3 wrong choices, and `brokenRules` found nothing. Removing that change made three tests fail, the fixture test through the new spacing check of `brokenRules` and the two new spacing tests of Task 11. `node --test "tests/js/*.test.mjs"` gave 135 tests, 134 passing and 1 skipped.
- **The same check after Plan 3a's fourth cross-review (2026-09-28).** Plan 3a now joins a four-character idiom that does not divide into two pairs, which changed 3 cards (总而言之 "zǒng'éryánzhī", 层出不穷 "céngchūbùqióng", 兢兢业业 "jīngjīngyèyè"). A stand-in words file built from that word list, with stand-in themes and the sentence pinyin of Plan 3b's prototype, gave again 10,086 pinyin quizzes at step 2 on 2 days. 262 of them have an answer with a space, a hyphen or "…", no quiz has a choice in another spacing, every quiz has 3 wrong choices, and `brokenRules` finds nothing. With that file in `docs/data/`, `node --test "tests/js/*.test.mjs"` gave 135 tests, all passing, because the real-data test is no longer skipped.
- **Real choices in the answer's look, and the 儿 ending (2026-09-28, after the pinyin style sheet).** A words file built in Plan 3b's scratch run from the Plan 3a word list of the style-sheet revision, with stand-in themes by level, the `noDistract` lists of Plan 3b Task 1 and the final sentence pinyin of that run, was given the pinyin quiz at step 2 on 2 days for every word, 10,086 quizzes with 25,289 real wrong choices. Before the change of Task 11, 164 of those choices were reshaped into the answer's spacing or capitals. With real words that already look like the answer searched first, 16 were, and every quiz still had 3 wrong choices. 13 cards end in the 儿 ending, so 26 of the quizzes had such an answer. Before the change, 24 of them had fewer than two choices that end in it, so the answer's "r" gave it away, and after the change none had. `brokenRules`, which now checks this too, found nothing. `node --test "tests/js/*.test.mjs"` gave 138 tests, 137 passing and 1 skipped (the real-data test), and with that stand-in words file in `docs/data/`, 138 passing. Each of the two new tests of Task 11 fails on the code from before this change.
- **The fixture's example pinyin (2026-09-28).** Five example lines wrote 个 without its tone after a number ("yí ge", "sān ge", "liù ge", "liǎng ge") and 了 apart from its verb ("mǎi le"). They now follow the style sheet ("yí gè", "mǎile liù gè"). The sentence of the card 个 was "这个人是我爸爸。", where point 1 of the style sheet writes 这个 "zhège" but the headword 个 must show its card's "gè", so it is now "我有三个朋友。" ("Wǒ yǒu sān gè péngyou."). A new fixture test checks a few lines against the style sheet.
- **Words of the public list in the example pinyin (2026-09-28, after a review).** The style sheet's reference order writes a word that is a single entry of the card list or the public lists as one word (its rule 2), and Plan 3b's draft does so. Four example lines split such words. The public list (`data/public/hsk_complete_v001.json`) has 吃饭 "chī fàn", 回家 "huí jiā" and 在家 "zài jiā" as single entries, and Plan 3b's prototype draft writes "chīfàn" (w0710), "huíjiā" (w0061) and "zàijiā" (w0013). So the fixture now has "Wǒmen bā diǎn chīfàn.", "Nǐ chīfàn le ma?", "Wǒ wǔ diǎn huíjiā." and "Māma zàijiā.", and the style-sheet fixture test checks the line of 吃. `node --test "tests/js/*.test.mjs"` still gives 138 tests, 137 passing and 1 skipped. The new assertion fails on the fixture from before this change.
- **Simulation result (2026-09-28).** The 450-day simulation (Task 16) ran in about 9 seconds. It never went over 100 reviews a day. From day 301 to day 450 it averaged 96.1 reviews and 9.2 new words a day. After 450 days, 4,571 words were learned and 3,931 mastered. These numbers are the same as before the revision. The simulated learner's chance of a right answer depends only on the word's step, not on the quiz type, so asking a recall card after a wrong answer changes no count.

## Choices this plan makes where the design is silent

The design does not settle these points. Each is set in one place (`config.js`, or the named function) so it is easy to change.

1. **"Unsure" rounds the half gap down.** At step 4 (7 days) Unsure gives 3 days, at step 1 it gives 1 day.
2. **Re-asks of a missed review pass only on "Know it".** A re-ask is a recall card. "Unsure" and "Don't know" both count as not yet right, so the word comes back again (at most 3 re-asks in all).
3. **New-word checks allow 3 retries.** A word missed in its group check or in the final check is asked again (at the group end, or at the very end), at most 3 more times. A word that still misses ends its lesson unlearned (step 0). It counts toward today's quota, and it comes back first in the next study day.
4. **A "missed word shown again" is the learning card.** The design shows the full learning card after every answer, so the logic does not add a second learning card. Plan 4's screens show it.
5. **A re-ask can land among the new-word cards.** When fewer than 4 reviews are left, the re-ask still comes 4 cards later, even if that is between learning cards.
6. **Tone-variant choices appear half the time from step 2.** `toneVariantChance` is 0.5, so the learner cannot tell the answer by looking for two choices that differ only in tone. A made-up tone variant never uses the syllable's dictionary tone. 不客气 is shown as "bú kèqi", so "bù kèqi" is never offered as a wrong choice. A tone variant always has the same spaces, hyphens and apostrophes as the answer, so it differs only in tone. A real word with the same letters but other spacing is not used as a tone variant.
7. **Undo goes back one answer.** It is available right after an answer, until the next answer.
8. **Check-in happens at the end of a session.** The day is checked in when the session ends and nothing is left for today. A learner with nothing due who opens the app and taps Start also checks in.
9. **The review cap setting runs from 20 to 300.** The new-word setting runs from 4 to 30, as the design says.
10. **"Unsure" does not count as right** for the 7-day accuracy or for a perfect session.
11. **Time estimate.** The simulation prints an estimated daily time from guessed seconds per card (review 8, re-ask 6, learning card 20, check 8). These guesses are in `config.js` and have not been measured on the phone.
12. **Capital letters in the pinyin quiz.** The design wants wrong choices that are plausible, but a name such as 北京 "Běijīng" is often the only choice with a capital. So a name's wrong choices are other names where there are enough, and every choice is shown with the answer's capitals (`inCaseOf` in Task 11). A plain word offered for a name is shown with a capital ("Zhuōzi"), and a name offered for a plain word in lower case ("běijīng"). The other way to solve this, showing every pinyin choice in lower case, would make the right answer differ from the learning card, so this plan does not use it. The user can still choose it.
13. **Word spacing in the pinyin quiz.** Card pinyin has spaces and hyphens ("bú kèqi", "bámiáo-zhùzhǎng"), so a choice spaced differently from the answer would give it away. Real words that already have the answer's look, meaning its word spacing, its capitals and its 儿 ending (`lookOf` in Task 11), are therefore searched first, in every tier, and shown as they are. Only when too few of them exist in the tiers is another word reshaped. It is then shown in the answer's word spacing, with the same number of syllables in each word and the same separators, which is always possible, because every choice has the answer's number of syllables. A reshaped choice keeps its own syllables and tones, and an apostrophe is added or dropped as the new spacing needs (`inAnswerForm` in Task 11). So for 不客气 "bú kèqi" the real 没关系 "méi guānxi" comes first, and 对不起 is shown as "duì buqǐ" only to fill the third slot, while for 对不起 "duìbuqǐ", 不客气 is shown as "búkèqi". The learning card still shows each word in its own spacing.
14. **The 儿 ending in the pinyin quiz.** An answer that ends in the 儿 ending, such as 一点儿 "yìdiǎnr", would stand out as the only choice ending in "r". So words with the 儿 ending come first for it, and at least two wrong choices end in "r" wherever the word list has two such words that may be offered. A made-up tone variant keeps the answer's "r" and counts as one of them.

## Decisions the user made on 2026-09-28

The first version of this plan asked the user one open question. The worked example's quiz column did not follow the design's quiz rule. On 2026-09-28 the user settled it and made two more decisions, and the design was updated. This revision of the plan follows all three.

**1. Which quiz a review uses.** The design's section "Which quiz a review uses" now sets the rule, and the user chose that a recall card always follows a wrong answer.
- If the word's previous scheduled review was answered wrong ("wrong" or "Don't know"), this review is a recall card. "Unsure" is not a wrong answer.
- Otherwise a word at step 1 gets "listen, pick meaning", and a word at step 2 gets "meaning, pick pinyin".
- From step 3 on, the three types take turns in the order recall, listen, pinyin, set by how many scheduled reviews the word has had before. After 0, 3, 6... earlier reviews it is recall, after 1, 4, 7... it is listen, and after 2, 5, 8... it is pinyin.
- Re-asks within the same session are always recall cards and do not count as scheduled reviews.

In code, each progress record now keeps `lastGrade`, the grade of its last scheduled review, and `quizForReview` moved from `plan.js` to `srs.js` (Task 4), next to `review`, which writes `lastGrade`. Undo needs nothing new, because Undo already puts back the whole saved record from before the answer, `lastGrade` included (Task 15 tests this).

Worked example with 苹果, from the design's corrected table:

| Date | Step before | Earlier reviews | Last grade | Quiz | Why |
|---|---|---|---|---|---|
| Oct 6 | 1 | 0 | none | listen | step 1 |
| Oct 8 | 2 | 1 | right | pinyin | step 2 |
| Oct 9 | 1 | 2 | wrong | recall | the last review was wrong |
| Oct 11 | 2 | 3 | Know it | pinyin | step 2 |
| Oct 15 | 3 | 4 | right | listen | 4 earlier reviews, so turn 2 of 3 |
| Oct 22 | 4 | 5 | right | pinyin | 5 earlier reviews, turn 3 |
| Nov 6 | 5 | 6 | right | recall | 6 earlier reviews, turn 1 |
| Nov 13 | 5 | 7 | Unsure | listen | Unsure is not wrong, 7 earlier reviews, turn 2 |
| Dec 13 | 6 | 8 | right | pinyin | 8 earlier reviews, turn 3 |

The Oct 8 re-ask of 苹果 in the same session is a recall card. It does not change the step, the count of earlier reviews or the last grade.

**2. The worked-example test checks the whole table.** It now checks the quiz column as well as the dates, answers, steps and next reviews, through to the next review on 11 February 2027 (Task 4).

**3. Card pinyin uses textbook word spacing.** `py` follows the textbook rules (汉语拼音正词法). The syllables of one word are joined, words are separated by spaces, and a four-character idiom that divides into two pairs is written as two joined pairs with a hyphen, for example "bú kèqi" (不客气), "bámiáo-zhùzhǎng" (拔苗助长) and "yìdiǎnr" (一点儿). An idiom that does not divide into two pairs is joined (总而言之 "zǒng'éryánzhī"). An apostrophe comes before a syllable that starts with a, o or e, as in "xī'ān" and "nǚ'ér". Every part of this plan that reads or builds `py` handles these:
- `syllableSpans` finds each syllable across spaces, hyphens and apostrophes, and gives the 儿 ending the span of its "r" (Task 10).
- `syllableCount` leaves the 儿 ending ("r5" in `pyNum`) out, as the schema's `syl` does (Task 10).
- `normPy` drops spaces, apostrophes and hyphens, so homophones are still found (Task 10).
- A made-up tone variant changes one syllable and keeps the answer's spacing, so "méi guānxi" becomes "mèi guānxi" and "yílù-píng'ān" becomes "yǐlù-píng'ān". A real word is used as a tone variant only when its pinyin has the same spacing (Task 11).
- Every other wrong choice of the pinyin quiz is shown in the answer's word spacing (`spacingOf` and `inShape` in Task 10, `inAnswerForm` in Task 11), so no space or hyphen gives the answer away (Choice 13 above).
- The fixture checks `pyBase` without hyphens and `syl` without the 儿 ending, and it now includes 一点儿 (Task 5).

The design also widened the Starter Kit theme to about 40 words on the same day. The fixture keeps a small stand-in Starter Kit of 12 words and adds 一点儿, one of the new words, to it.

---

## Words used in this plan

- **Study day.** A date written as text, such as `'2026-10-05'`. A new study day starts at 04:00 local time, so 01:30 on 6 October still counts as 5 October.
- **Step and ladder.** Each learned word sits on a step from 1 to 9. The ladder gives the days until the next review for each step: 1, 2, 4, 7, 15, 30, 60, 120 and 240. A word at step 7 or higher is "mastered". Step 0 means the word's lesson ended without passing.
- **Due.** The study day of a word's next review. A word is due today when its due day is today or earlier.
- **Backlog.** All reviews due today, counting ones already answered today.
- **Re-ask.** A missed review asked again later in the same session. It is always a recall card and does not count as a scheduled review.
- **Quiz types.** `'listen'` plays the sound and asks for the English meaning. `'pinyin'` shows the English meaning and asks for the pinyin. `'recall'` shows characters, pinyin and sound, and the learner rates themself Know it, Unsure or Don't know. Which one a scheduled review uses is set by `quizForReview` (Task 4), as described under "Decisions the user made on 2026-09-28".
- **Card pinyin (`py`).** Tone-marked pinyin with textbook word spacing, such as "bú kèqi", "bámiáo-zhùzhǎng" or "yìdiǎnr". `pyNum` is the numbered pinyin with one item per character, such as "yi1 dian3 r5", where "r5" is the 儿 ending.
- **Grades.** A multiple-choice answer is `'right'` or `'wrong'`. A recall answer is `'know'`, `'unsure'` or `'dontknow'`.
- **Distractor.** A wrong choice in a multiple-choice quiz.
- **Seeded random generator.** A function that gives numbers that look random but are the same every time for the same starting value (the seed). Seeding with the word's ID and the study day keeps a quiz's choices fixed for that day.
- **Progress record.** One word's saved place:
  `{ id, step, due, reps, lapses, lastReview, lastGrade, learned, lessonDay }`. For example, after 苹果 is learned on 5 October it is
  `{ id: 'w0026', step: 1, due: '2026-10-06', reps: 0, lapses: 0, lastReview: null, lastGrade: null, learned: '2026-10-05', lessonDay: '2026-10-05' }`.
  `reps` counts scheduled reviews, `lapses` counts wrong ones, `lastReview` is the day of the last scheduled review, `lastGrade` is the grade given at that review, `learned` is the day the lesson was passed, and `lessonDay` is the day the last lesson ended. After 苹果 is answered wrong on 8 October, `lastGrade` is `'wrong'`, so its review on 9 October is a recall card.
- **Event.** One line of the answer log, such as
  `{ seq: 14, day: '2026-10-06', kind: 'review', id: 'w0026', quiz: 'listen', grade: 'right', first: true, outcome: null, ts, before, after }`.
  `seq` is a number the store gives each event, always increasing. Plan 5 sends the Sheet only the events with a higher `seq` than last time. `before` and `after` are the word's progress record around the answer, which is what Undo needs.
- **Commit.** One store call that writes progress records and exactly one event together, so the log and the saved state never disagree.
- **ord.** A word's place in the whole course (1 to N), from the word data file. New words are taught in `ord` order.

## File map

| File | Responsibility |
|---|---|
| `package.json` | Marks the project's `.js` files as ES modules for Node. No dependencies. |
| `docs/js/config.js` | Every tunable number, and clean-up of the learner's settings |
| `docs/js/rng.js` | Seeded random numbers and shuffling |
| `docs/js/dates.js` | Study day with the 04:00 start, day arithmetic that ignores daylight saving |
| `docs/js/srs.js` | The review ladder, meaning what one answer does to a word's step and due day, and the quiz type of the word's next review |
| `docs/js/curriculum.js` | The next new words, in `ord` order |
| `docs/js/plan.js` | One day's plan, with the capped reviews in order and the new-word quota |
| `docs/js/session.js` | One session as a list of cards, with learning groups, checks, re-asks and Undo |
| `docs/js/checkin.js` | Streaks, the week strip and the month calendar |
| `docs/js/pinyin.js` | Reading, removing, placing and changing pinyin tone marks, across textbook word spacing |
| `docs/js/distractors.js` | Wrong choices for the two multiple-choice quizzes |
| `docs/js/badges.js` | Which milestone badges are earned, and their titles |
| `docs/js/stats.js` | Totals, per-level and per-theme progress, activity, forecast, accuracy |
| `docs/js/store.js` | Saved progress, with the storage contract, an in-memory store and an IndexedDB store |
| `docs/js/study.js` | The controller the screens call to start, answer, undo and finish (with check-in and badges) |
| `tests/js/helpers.mjs` | Test helpers that load the fixture, make dates, make many plain words and check quiz-choice rules |
| `tests/js/fixtures/words_fixture.json` | 61 real HSK 1 and 2 words in 5 themes, following the word data contract |
| `tests/js/*.test.mjs` | One test file per module, plus the worked example, the real-data check and the simulation |

`docs/` is the public web root. Only app code goes there. The fixture and tests stay in `tests/`.

---

### Task 1: Project setup and tunable numbers (`package.json`, `docs/js/config.js`)

**Files:**
- Create: `package.json`, `docs/js/config.js`
- Test: `tests/js/config.test.mjs`

- [ ] **Step 1: Write `package.json`**

```json
{
  "type": "module",
  "private": true
}
```

- [ ] **Step 2: Write the failing test `tests/js/config.test.mjs`**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, normalizeSettings } from '../../docs/js/config.js';

test('the ladder has nine steps from 1 to 240 days', () => {
  assert.deepEqual(CONFIG.ladder, [1, 2, 4, 7, 15, 30, 60, 120, 240]);
  assert.equal(CONFIG.masteredStep, 7);
});

test('config cannot be changed at run time', () => {
  assert.throws(() => { CONFIG.reviewCap = 5; }, TypeError);
  assert.throws(() => { CONFIG.ladder.push(480); }, TypeError);
});

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

- [ ] **Step 3: Run it and see it fail**

Run: `node --test tests/js/config.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\config.js'` and `ℹ fail 1`.

- [ ] **Step 4: Write `docs/js/config.js`**

```js
// Every tunable number of the app logic lives here, so a change is made in one place.
// Values marked "learner setting" are defaults that the Settings screen (Plan 4) can change.

export const CONFIG = Object.freeze({
  dayStartHour: 4, // a new study day starts at 04:00 local time

  // Days until the next review for steps 1 to 9 (the forgetting-curve ladder).
  ladder: Object.freeze([1, 2, 4, 7, 15, 30, 60, 120, 240]),
  masteredStep: 7, // a word at step 7 or above counts as mastered
  wrongDrop: 2, // a wrong answer drops the word this many steps (never below step 1)

  reviewCap: 100, // most reviews in one study day (learner setting)
  reviewCapMin: 20,
  reviewCapMax: 300,
  newPerDay: 12, // new words per study day (learner setting)
  newPerDayMin: 4,
  newPerDayMax: 30,

  groupSize: 4, // new words are taught in groups of this size
  reaskGap: 4, // a missed review comes back this many cards later
  maxReasks: 3, // at most this many re-asks of a missed review in one session
  lessonMaxRetries: 3, // at most this many re-asks of a missed new-word check

  wrongChoices: 3, // wrong choices in a multiple-choice quiz
  toneVariantChance: 0.5, // chance that one pinyin choice is a tone variant, from step 2 on

  perfectMinReviews: 30, // a perfect session needs at least this many reviews

  badges: Object.freeze({
    streak: Object.freeze([7, 30, 100, 365]),
    checkIns: Object.freeze([10, 50, 200]),
    learned: Object.freeze([50, 100, 500, 1000, 2000, 3000]),
    mastered: Object.freeze([100, 500, 1000, 2500]),
  }),

  statsDays: Object.freeze({ activity: 30, forecast: 7, accuracy: 7 }),

  // Rough seconds per card, used only to print an estimated daily time in the simulation test.
  secondsPerCard: Object.freeze({ review: 8, reask: 6, learn: 20, check: 8, final: 8 }),
});

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

// Fill in missing learner settings and keep them inside their allowed range.
// For example, normalizeSettings({ newPerDay: 50 }) gives { reviewCap: 100, newPerDay: 30 }.
export function normalizeSettings(raw = {}) {
  const s = raw ?? {};
  return {
    ...s,
    reviewCap: clampInt(s.reviewCap, CONFIG.reviewCapMin, CONFIG.reviewCapMax, CONFIG.reviewCap),
    newPerDay: clampInt(s.newPerDay, CONFIG.newPerDayMin, CONFIG.newPerDayMax, CONFIG.newPerDay),
  };
}
```

- [ ] **Step 5: Run it and see it pass**

Run: `node --test tests/js/config.test.mjs`
Expected: `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add package.json docs/js/config.js tests/js/config.test.mjs && git commit -F - <<'EOF'
feat(app): package.json and tunable numbers in config.js

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 2: Seeded random numbers (`docs/js/rng.js`)

**Files:**
- Create: `docs/js/rng.js`
- Test: `tests/js/rng.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashString, mulberry32, seeded, shuffled } from '../../docs/js/rng.js';

test('hashString matches the published FNV-1a values', () => {
  assert.equal(hashString(''), 2166136261);
  assert.equal(hashString('a'), 3826002220);
});

test('the same seed gives the same numbers, all from 0 up to 1', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 1000; i++) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('seeded is keyed by all its parts', () => {
  assert.equal(seeded('w0001', '2026-10-05')(), seeded('w0001', '2026-10-05')());
  assert.notEqual(seeded('w0001', '2026-10-05')(), seeded('w0001', '2026-10-06')());
});

test('shuffled keeps every item and leaves the input alone', () => {
  const input = [1, 2, 3, 4, 5, 6];
  const out = shuffled(input, mulberry32(7));
  assert.deepEqual(input, [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(out.slice().sort(), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(shuffled(input, mulberry32(7)), out);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/rng.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\rng.js'`.

- [ ] **Step 3: Write `docs/js/rng.js`**

```js
// Small seeded random numbers. The same seed always gives the same sequence, so a quiz
// shows the same choices every time the same word is asked on the same study day.

// hashString uses FNV-1a, a standard simple hash, to turn a text into a 32-bit whole
// number. For example, hashString('a') === 3826002220.
export function hashString(text) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

// Mulberry32 is a tiny generator that returns numbers from 0 (included) to 1 (excluded).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// seeded('w0001', '2026-10-05') gives a generator keyed by those parts.
export function seeded(...parts) {
  return mulberry32(hashString(parts.join('|')));
}

// A shuffled copy (Fisher-Yates). The input list is not changed.
export function shuffled(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/rng.test.mjs`
Expected: `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/rng.js tests/js/rng.test.mjs && git commit -F - <<'EOF'
feat(app): seeded random numbers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 3: Study days and day arithmetic (`docs/js/dates.js`)

The tests run in US Central time, which has daylight saving time (DST, when clocks move one hour forward in spring and back in autumn). On those mornings "4 hours after midnight" and "04:00 on the clock" are different moments, which is the bug these tests look for.

**Files:**
- Create: `docs/js/dates.js`
- Test: `tests/js/dates.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
// US Central time has daylight saving. Clocks jump from 02:00 to 03:00 on 8 March 2026
// and fall back from 02:00 to 01:00 on 1 November 2026. Each test file runs in its own
// process, so setting TZ here affects only this file.
process.env.TZ = 'America/Chicago';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayRange, daysBetween, isDay, mondayOf, studyDay, weekdayIndex } from '../../docs/js/dates.js';

test('the time zone for this file is in effect', () => {
  assert.equal(new Date(2026, 0, 15, 12).getTimezoneOffset(), 360);
  assert.equal(new Date(2026, 6, 15, 12).getTimezoneOffset(), 300);
});

test('a study day starts at 04:00 local time', () => {
  assert.equal(studyDay(new Date(2026, 9, 6, 1, 30)), '2026-10-05');
  assert.equal(studyDay(new Date(2026, 9, 6, 3, 59, 59)), '2026-10-05');
  assert.equal(studyDay(new Date(2026, 9, 6, 4, 0)), '2026-10-06');
  assert.equal(studyDay(new Date(2026, 9, 6, 23, 59)), '2026-10-06');
});

test('the cutoff crosses month and year ends', () => {
  assert.equal(studyDay(new Date(2026, 10, 1, 0, 10)), '2026-10-31');
  assert.equal(studyDay(new Date(2027, 0, 1, 2, 0)), '2026-12-31');
});

test('the spring-forward morning keeps the right study day', () => {
  // 03:30 on 8 March is still 7 March. 04:30 is 8 March, although only 3.5 real hours
  // have passed since midnight.
  assert.equal(studyDay(new Date(2026, 2, 8, 3, 30)), '2026-03-07');
  assert.equal(studyDay(new Date(2026, 2, 8, 4, 30)), '2026-03-08');
});

test('the fall-back morning keeps the right study day', () => {
  // 03:59 on 1 November is 5 real hours after midnight but still before 04:00 on the clock.
  assert.equal(studyDay(new Date(2026, 10, 1, 3, 59)), '2026-10-31');
  assert.equal(studyDay(new Date(2026, 10, 1, 4, 0)), '2026-11-01');
});

test('day arithmetic ignores daylight saving', () => {
  assert.equal(addDays('2026-03-07', 1), '2026-03-08');
  assert.equal(addDays('2026-03-08', 1), '2026-03-09');
  assert.equal(addDays('2026-10-31', 2), '2026-11-02');
  assert.equal(addDays('2026-12-08', 60), '2027-02-06');
  assert.equal(addDays('2026-10-05', -5), '2026-09-30');
  assert.equal(daysBetween('2026-03-01', '2026-04-01'), 31);
  assert.equal(daysBetween('2026-10-15', '2026-10-05'), -10);
});

test('weekdays, Mondays and ranges', () => {
  assert.equal(weekdayIndex('2026-10-05'), 0); // Monday
  assert.equal(weekdayIndex('2026-10-11'), 6); // Sunday
  assert.equal(mondayOf('2026-10-11'), '2026-10-05');
  assert.deepEqual(dayRange('2026-10-30', 3), ['2026-10-30', '2026-10-31', '2026-11-01']);
});

test('isDay accepts only real calendar days', () => {
  assert.ok(isDay('2028-02-29'));
  assert.ok(!isDay('2027-02-29'));
  assert.ok(!isDay('2026-10-5'));
  assert.ok(!isDay(20261005));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/dates.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\dates.js'`.

- [ ] **Step 3: Write `docs/js/dates.js`**

```js
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
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/dates.test.mjs`
Expected: `ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/dates.js tests/js/dates.test.mjs && git commit -F - <<'EOF'
feat(app): study day with 04:00 start and DST-safe day arithmetic

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 4: The review ladder, the quiz rule and the 苹果 worked example (`docs/js/srs.js`)

"SRS" stands for spaced repetition system, the forgetting-curve schedule. For example, a word at step 2 answered wrong on 8 October drops two steps to step 1 (never lower) and is due on 9 October. Because that answer was wrong, `review` saves `lastGrade: 'wrong'`, and `quizForReview` then makes the 9 October review a recall card. The quiz rule sits in this module, next to the ladder, because both read and write the same progress record.

**Files:**
- Create: `docs/js/srs.js`
- Test: `tests/js/srs.test.mjs`, `tests/js/worked-example.test.mjs`

- [ ] **Step 1: Write the failing ladder test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  failedLessonProgress, intervalFor, isLearned, isMastered, learnedProgress, quizForReview, review,
} from '../../docs/js/srs.js';

const DAY = '2026-10-10';
const at = (step, extra = {}) => ({ ...learnedProgress('w0001', '2026-01-01'), step, ...extra });

test('a learned word is step 1 and due tomorrow', () => {
  assert.deepEqual(learnedProgress('w0001', '2026-10-05'), {
    id: 'w0001', step: 1, due: '2026-10-06', reps: 0, lapses: 0, lastReview: null, lastGrade: null,
    learned: '2026-10-05', lessonDay: '2026-10-05',
  });
});

test('a failed lesson is step 0 with no due day', () => {
  const p = failedLessonProgress('w0001', '2026-10-05');
  assert.equal(p.step, 0);
  assert.equal(p.due, null);
  assert.equal(p.lessonDay, '2026-10-05');
  assert.ok(!isLearned(p));
});

test('right or Know it moves up one step, with that step\'s gap', () => {
  const expected = [[1, 2, '2026-10-12'], [2, 3, '2026-10-14'], [3, 4, '2026-10-17'], [4, 5, '2026-10-25'],
    [5, 6, '2026-11-09'], [6, 7, '2026-12-09'], [7, 8, '2027-02-07'], [8, 9, '2027-06-07'], [9, 9, '2027-06-07']];
  for (const [from, to, due] of expected) {
    for (const grade of ['right', 'know']) {
      const p = review(at(from), grade, DAY);
      assert.equal(p.step, to, `step ${from} ${grade}`);
      assert.equal(p.due, due, `step ${from} ${grade}`);
    }
  }
});

test('Unsure keeps the step and comes back after half the gap, at least 1 day', () => {
  const expected = [[1, '2026-10-11'], [2, '2026-10-11'], [3, '2026-10-12'], [4, '2026-10-13'],
    [5, '2026-10-17'], [6, '2026-10-25'], [9, '2027-02-07']];
  for (const [step, due] of expected) {
    const p = review(at(step), 'unsure', DAY);
    assert.equal(p.step, step);
    assert.equal(p.due, due, `step ${step}`);
  }
});

test('wrong or Don\'t know drops two steps, never below 1, due tomorrow', () => {
  const expected = [[1, 1], [2, 1], [3, 1], [4, 2], [7, 5], [9, 7]];
  for (const [from, to] of expected) {
    for (const grade of ['wrong', 'dontknow']) {
      const p = review(at(from), grade, DAY);
      assert.equal(p.step, to, `step ${from} ${grade}`);
      assert.equal(p.due, '2026-10-11');
      assert.equal(p.lapses, 1);
    }
  }
});

test('only the first answer of a study day changes the schedule', () => {
  const first = review(at(3), 'wrong', DAY);
  assert.equal(first.step, 1);
  assert.equal(first.reps, 1);
  assert.equal(first.lastGrade, 'wrong');
  const second = review(first, 'right', DAY);
  assert.equal(second, first);
  const nextDay = review(first, 'right', '2026-10-11');
  assert.equal(nextDay.step, 2);
  assert.equal(nextDay.reps, 2);
});

test('mastered means step 7 or above', () => {
  assert.ok(!isMastered(at(6)));
  assert.ok(isMastered(at(7)));
  assert.ok(isMastered(at(9)));
  assert.ok(!isMastered(undefined));
});

test('step 1 gets listen, step 2 gets pinyin, and from step 3 the turn follows the review count', () => {
  assert.equal(quizForReview(at(1, { reps: 5 })), 'listen');
  assert.equal(quizForReview(at(2, { reps: 5 })), 'pinyin');
  assert.deepEqual([0, 1, 2, 3, 4, 5, 6, 7, 8].map((reps) => quizForReview(at(3, { reps }))),
    ['recall', 'listen', 'pinyin', 'recall', 'listen', 'pinyin', 'recall', 'listen', 'pinyin']);
  assert.equal(quizForReview(at(7, { reps: 8 })), 'pinyin');
});

test('the first review after a wrong answer is always a recall card, at any step', () => {
  for (const grade of ['wrong', 'dontknow']) {
    for (let step = 1; step <= 9; step++) {
      for (const reps of [0, 1, 2]) {
        const p = review(at(step, { reps }), grade, DAY);
        assert.equal(quizForReview(p), 'recall', `step ${step}, reps ${reps}, ${grade}`);
      }
    }
  }
});

test('Unsure and right answers do not force a recall card', () => {
  assert.equal(quizForReview(review(at(1), 'unsure', DAY)), 'listen');
  assert.equal(quizForReview(at(2, { reps: 3, lastGrade: 'unsure' })), 'pinyin');
  assert.equal(quizForReview(at(5, { reps: 7, lastGrade: 'unsure' })), 'listen');
  assert.equal(quizForReview(at(5, { reps: 7, lastGrade: 'know' })), 'listen');
  assert.equal(quizForReview(review(review(at(2), 'wrong', DAY), 'know', '2026-10-11')), 'pinyin');
});

test('bad input is refused', () => {
  assert.throws(() => review(at(2), 'maybe', DAY), /Unknown grade/);
  assert.throws(() => review(failedLessonProgress('w0001', DAY), 'right', DAY), /not learned/);
  assert.equal(intervalFor(9), 240);
});
```

- [ ] **Step 2: Write the failing worked-example test**

The rows are the design's 苹果 table as corrected on 2026-09-28, with every column checked, the quiz type included. `w0026` is 苹果's ID in the fixture of Task 5. This test only needs the ID as a label.

```js
// The design's worked example is 苹果 (píngguǒ, apple), first learned on Monday 5 October 2026.
// Each row is [date, quiz, answer, step after, next review], copied from the design's
// table as corrected on 2026-09-28. The quiz names are 'listen' (listen, pick meaning),
// 'pinyin' (meaning, pick pinyin) and 'recall' (recall and self-rate).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isMastered, learnedProgress, quizForReview, review } from '../../docs/js/srs.js';

const ROWS = [
  ['2026-10-06', 'listen', 'right', 2, '2026-10-08'],
  ['2026-10-08', 'pinyin', 'wrong', 1, '2026-10-09'],
  ['2026-10-09', 'recall', 'know', 2, '2026-10-11'],
  ['2026-10-11', 'pinyin', 'right', 3, '2026-10-15'],
  ['2026-10-15', 'listen', 'right', 4, '2026-10-22'],
  ['2026-10-22', 'pinyin', 'right', 5, '2026-11-06'],
  ['2026-11-06', 'recall', 'unsure', 5, '2026-11-13'],
  ['2026-11-13', 'listen', 'right', 6, '2026-12-13'],
  ['2026-12-13', 'pinyin', 'right', 7, '2027-02-11'],
];

test('苹果 follows the design table row by row, quiz column included', () => {
  let p = learnedProgress('w0026', '2026-10-05');
  assert.equal(p.step, 1);
  assert.equal(p.due, '2026-10-06');
  for (const [day, quiz, grade, step, due] of ROWS) {
    assert.equal(p.due, day, `the word is due on ${day}`);
    assert.equal(quizForReview(p), quiz, `quiz on ${day}`);
    p = review(p, grade, day);
    assert.equal(p.step, step, `step after ${day}`);
    assert.equal(p.due, due, `next review after ${day}`);
  }
  assert.ok(isMastered(p));
  assert.equal(p.reps, 9);
});

test('the Oct 8 re-ask the same day does not move the word or change the Oct 9 quiz', () => {
  let p = learnedProgress('w0026', '2026-10-05');
  p = review(p, 'right', '2026-10-06');
  p = review(p, 'wrong', '2026-10-08');
  const again = review(p, 'know', '2026-10-08');
  assert.equal(again.step, 1);
  assert.equal(again.due, '2026-10-09');
  assert.equal(again.reps, 2);
  assert.equal(quizForReview(again), 'recall');
});
```

- [ ] **Step 3: Run both and see them fail**

Run: `node --test tests/js/srs.test.mjs tests/js/worked-example.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\srs.js'`, `ℹ fail 2`.

- [ ] **Step 4: Write `docs/js/srs.js`**

```js
// The review schedule (spaced repetition). A progress record holds one word's place:
//   { id, step, due, reps, lapses, lastReview, lastGrade, learned, lessonDay }
//   step        0 = lesson not passed yet, 1 to 9 = place on the ladder
//   due         study day of the next review (null at step 0)
//   reps        scheduled reviews answered so far
//   lapses      scheduled reviews answered wrong so far
//   lastReview  study day of the last scheduled review (null before the first)
//   lastGrade   grade of the last scheduled review (null before the first), which
//               decides whether the next review is a recall card
//   learned     study day the word passed its lesson (null at step 0)
//   lessonDay   study day the word's last lesson ended, passed or not
import { CONFIG } from './config.js';
import { addDays } from './dates.js';

export const GRADES = Object.freeze(['right', 'wrong', 'know', 'unsure', 'dontknow']);
export const PASS = new Set(['right', 'know']);
export const FAIL = new Set(['wrong', 'dontknow']);

export function intervalFor(step) {
  return CONFIG.ladder[step - 1];
}

export function isLearned(p) {
  return Boolean(p) && p.step >= 1;
}

export function isMastered(p) {
  return Boolean(p) && p.step >= CONFIG.masteredStep;
}

// A word that passed both lesson checks today goes to step 1 and is due tomorrow.
export function learnedProgress(id, day) {
  return {
    id, step: 1, due: addDays(day, 1), reps: 0, lapses: 0, lastReview: null, lastGrade: null,
    learned: day, lessonDay: day,
  };
}

// A word whose lesson ended today without passing. It is taught again next study day.
export function failedLessonProgress(id, day) {
  return {
    id, step: 0, due: null, reps: 0, lapses: 0, lastReview: null, lastGrade: null,
    learned: null, lessonDay: day,
  };
}

// Apply one scheduled review answer. Only the first answer of a study day counts, so a
// second call on the same day returns the record unchanged.
// For example, step 2 answered 'wrong' on 2026-10-08 gives step 1, due 2026-10-09.
export function review(p, grade, day) {
  if (!GRADES.includes(grade)) throw new Error(`Unknown grade: ${grade}`);
  if (!isLearned(p)) throw new Error(`Word ${p?.id} is not learned yet`);
  if (p.lastReview === day) return p;
  const top = CONFIG.ladder.length;
  let { step, lapses } = p;
  let due;
  if (PASS.has(grade)) {
    step = Math.min(top, step + 1);
    due = addDays(day, intervalFor(step));
  } else if (grade === 'unsure') {
    due = addDays(day, Math.max(1, Math.floor(intervalFor(step) / 2)));
  } else {
    step = Math.max(1, step - CONFIG.wrongDrop);
    due = addDays(day, 1);
    lapses += 1;
  }
  return { ...p, step, due, reps: p.reps + 1, lapses, lastReview: day, lastGrade: grade };
}

// The quiz type of a word's next scheduled review, as the design's "Which quiz a review
// uses" (decided by the user on 2026-09-28) sets it:
// 1. If the previous scheduled review was answered wrong ('wrong' or 'dontknow'), it is
//    'recall'. 'unsure' is not a wrong answer.
// 2. Otherwise a word at step 1 gets 'listen' and a word at step 2 gets 'pinyin'.
// 3. From step 3 on the three types take turns by the number of earlier scheduled
//    reviews (reps): 0, 3, 6... give 'recall', 1, 4, 7... give 'listen', and 2, 5, 8...
//    give 'pinyin'. For example, 苹果 at step 3 with 4 earlier reviews gets 'listen'.
// Re-asks inside a session are always recall cards (session.js). They never call
// review(), so they do not count in reps and do not change lastGrade.
export function quizForReview(p) {
  if (FAIL.has(p.lastGrade)) return 'recall';
  if (p.step === 1) return 'listen';
  if (p.step === 2) return 'pinyin';
  return ['recall', 'listen', 'pinyin'][p.reps % 3];
}
```

- [ ] **Step 5: Run both and see them pass**

Run: `node --test tests/js/srs.test.mjs tests/js/worked-example.test.mjs`
Expected: `ℹ tests 13`, `ℹ pass 13`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/srs.js tests/js/srs.test.mjs tests/js/worked-example.test.mjs && git commit -F - <<'EOF'
feat(app): review ladder, quiz rule and the design's worked example

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 5: Test helpers and the word fixture (`tests/js/helpers.mjs`, `tests/js/fixtures/words_fixture.json`)

The fixture holds 61 real HSK 1 and 2 words in 5 themes, in the exact shape of `.claude/plans/words-json-schema.md`. The example sentences are marked `"src": "claude"`, and the audio names are placeholders, because the fixture is only test data. The IDs of the first 60 words follow HSK level and then pinyin, so they are not in curriculum (`ord`) order. That way a test catches any code that mixes up the two. 一点儿 was added later and got the next free ID, w0061, just as the schema says new words get new IDs at the end.

Every `py` uses textbook word spacing. The values match the pinyin printed in the HSK 1 and HSK 2 PDFs (see the facts at the top), so 不客气 is "bú kèqi" and 没关系 is "méi guānxi", with a space, while 对不起 is "duìbuqǐ", joined.

It includes the cases the quiz-choice rules need:
- example pinyin that follows the pinyin style sheet ("Wǒ yǒu yí gè mèimei.", "Wǒ mǎile liù gè píngguǒ.", "Zhège píngguǒ hěn hǎochī.", and "Nǐ chīfàn le ma?", where 吃饭 is one word because it is a single entry of the public list);
- exact homophones 他, 她 and 它 (all tā);
- tone twins 买 mǎi and 卖 mài, and 十 shí and 是 shì;
- same-meaning pairs 高兴 and 快乐, 二 and 两, 你 and 您, each listed in `noDistract` (the field for words that must never be offered as each other's wrong choice);
- four three-syllable words, so the pinyin quiz can always find 3 of the same length;
- 不客气 written "bú kèqi" with numbered pinyin "bu4 ke4 qi5", which tests tone changes made by sandhi (the rule that changes a tone next to another tone), and two words written as two words, 不客气 and 没关系;
- 女儿 "nǚ'ér", with an apostrophe;
- 一点儿 "yìdiǎnr", whose numbered pinyin "yi1 dian3 r5" has 3 items for 3 characters but only 2 syllables (`syl` 2), because the 儿 ending joins the syllable before it.

Four-character idioms are not HSK 1 or 2 words, so the idiom cases live in small hand-made lists inside the pinyin and quiz-choice tests (Tasks 10 and 11).

`helpers.mjs` also holds `brokenRules`, which checks one quiz's wrong choices against every rule of the design without using `distractors.js`'s way of picking them. It is given the function that makes meaning keys as an argument. Among other rules, it checks that a tone variant has exactly the answer's letters, spaces, hyphens and apostrophes, with at least one tone changed. In the pinyin quiz it also checks that every choice starts with a capital exactly when the answer does, that every choice has the answer's word spacing, meaning the same separators at the same places between syllables, and that an answer with the 儿 ending has at least two choices ending in it wherever the list has two such words that may be offered. Task 11 uses it.

**Files:**
- Create: `tests/js/helpers.mjs`, `tests/js/fixtures/words_fixture.json`
- Test: `tests/js/fixture.test.mjs`

- [ ] **Step 1: Write the helpers**

```js
// Shared test helpers. Paths are resolved from this file, so tests run from any folder.
import { readFileSync } from 'node:fs';

export function loadFixture() {
  const url = new URL('./fixtures/words_fixture.json', import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8'));
}

// The fixture word with these characters, for example word(data, '苹果').
export function word(data, hz) {
  const w = data.words.find((x) => x.hz === hz);
  if (!w) throw new Error(`No fixture word ${hz}`);
  return w;
}

// localDate gives a local-time Date, so localDate('2026-10-05', 9) is 09:00 on 5 October.
export function localDate(day, hour = 9) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d, hour);
}

// Checks one quiz's wrong choices against every rule in the design, independently of how
// distractors.js picks them. Returns a list of broken rules (empty when all is well).
const MARK = /[\u0304\u0301\u030c\u0300]/g;
// exact(py) is how the pinyin sounds, and shape(py) is its letters and word spacing
// without tones. A tone variant must keep the answer's shape and change its sound.
const exact = (s) => s.normalize('NFC').toLowerCase().replace(/[\s'’-]/g, '');
const shape = (s) => s.normalize('NFD').replace(MARK, '').normalize('NFC').toLowerCase().replace(/’/g, "'");
const idMaps = new WeakMap();
// The word spacing of a pinyin text, as the joints between its syllables and the text after
// the last one. pyNum gives the syllables. A joint is '' inside a word (an apostrophe counts as
// inside), ' ' between words, '-' in an idiom and '…' in a pattern word, and the 儿 ending "r5"
// has no joint. So 'bú kèqi' with 'bu4 ke4 qi5' gives ' ||', and 'duìbuqǐ' gives '||'.
function spacing(text, pyNum) {
  const t = shape(text);
  const joints = [];
  let i = 0;
  pyNum.split(' ').forEach((item, k) => {
    let sep = '';
    while (i < t.length && !/[a-zü]/.test(t[i])) sep += t[i++];
    if (k && item !== 'r5') joints.push(sep.includes('…') ? '…' : sep.includes('-') ? '-' : sep.includes(' ') ? ' ' : '');
    i += item.replace(/[1-5]$/, '').replace(/u:|v/g, 'ü').length;
  });
  return `${joints.join('|')}|${t.slice(i)}`;
}

export function brokenRules(words, keysOf, answer, quiz, wrong, step) {
  const problems = [];
  if (!idMaps.has(words)) idMaps.set(words, new Map(words.map((w) => [w.id, w])));
  const byId = idMaps.get(words);
  const say = (text) => problems.push(`${answer.hz} ${quiz}: ${text}`);
  if (wrong.length !== 3) say(`${wrong.length} wrong choices`);
  const texts = wrong.map((c) => c.text);
  if (new Set(texts).size !== texts.length) say('repeated choice');
  if (wrong.filter((c) => c.toneVariant).length > (quiz === 'pinyin' && step >= 2 ? 1 : 0)) say('tone variant not allowed');
  const shares = (a, b) => [...keysOf(a)].some((k) => keysOf(b).has(k));
  const real = wrong.filter((c) => c.id !== null).map((c) => byId.get(c.id));
  for (const c of real) {
    if (c.hz === answer.hz) say(`same characters ${c.hz}`);
    if (answer.noDistract.includes(c.id) || c.noDistract.includes(answer.id)) say(`noDistract ${c.hz}`);
    if (shares(answer, c)) say(`same meaning ${c.hz}`);
    for (const o of real) if (o !== c && shares(o, c)) say(`choices ${o.hz} and ${c.hz} share a meaning`);
  }
  if (quiz === 'listen') {
    for (const c of real) {
      if (exact(c.py) === exact(answer.py)) say(`homophone ${c.hz}`);
      if (c.enShort.length * 2 < answer.enShort.length || c.enShort.length > answer.enShort.length * 2) say(`length ${c.enShort}`);
    }
  } else {
    for (const c of wrong) {
      if (c.toneVariant) {
        if (shape(c.text) !== shape(answer.py) || exact(c.text) === exact(answer.py)) say(`bad tone variant ${c.text}`);
        continue;
      }
      const w = byId.get(c.id);
      if (w.syl !== answer.syl) say(`syllables ${w.hz}`);
      if (w.pyBase === answer.pyBase) say(`same toneless pinyin ${w.hz}`);
    }
    const bases = wrong.filter((c) => !c.toneVariant).map((c) => byId.get(c.id).pyBase);
    if (new Set(bases).size !== bases.length) say('two choices share toneless pinyin');
    // Every choice starts with a capital exactly when the answer does, so no capital gives the answer away.
    const capital = (s) => /^\p{Lu}/u.test(s.normalize('NFC'));
    for (const c of wrong) if (capital(c.text) !== capital(answer.py)) say(`capital of ${c.text} differs from the answer's`);
    // All four choices have one word spacing, so no space or hyphen gives the answer away.
    const want = spacing(answer.py, answer.pyNum);
    for (const c of wrong) {
      if (spacing(c.text, c.id === null ? answer.pyNum : byId.get(c.id).pyNum) !== want) say(`spacing of ${c.text} differs from the answer's`);
    }
    // An answer that ends in the 儿 ending gets at least two wrong choices that end in it too, when
    // the list has that many words that may be offered (same syllable count, other toneless pinyin,
    // no shared meaning and no noDistract), so the "r" alone does not give the answer away.
    const endsInR = (w) => w.pyNum.trim().split(/\s+/).at(-1) === 'r5';
    if (endsInR(answer)) {
      const offered = words.filter((c) => endsInR(c) && c.id !== answer.id && c.hz !== answer.hz && c.syl === answer.syl
        && c.pyBase !== answer.pyBase && !answer.noDistract.includes(c.id) && !c.noDistract.includes(answer.id)
        && !shares(answer, c)).length;
      const got = wrong.filter((c) => c.id === null || endsInR(byId.get(c.id))).length;
      if (got < Math.min(2, offered)) say(`only ${got} choices end in the 儿 ending, although ${offered} words could`);
    }
  }
  return problems;
}

// Plain made-up words for tests that need thousands of words but no real content.
// Word i (from 1) has id 'x00001', ord i, theme 't01' to 't30' in blocks, and level 1 to 6.
export function syntheticWords(count, perTheme = 180) {
  return Array.from({ length: count }, (_, k) => {
    const i = k + 1;
    const theme = `t${String(Math.min(30, Math.ceil(i / perTheme))).padStart(2, '0')}`;
    return { id: `x${String(i).padStart(5, '0')}`, ord: i, theme, lv: 1 + (k % 6) };
  });
}
```

- [ ] **Step 2: Write the failing fixture test**

```js
// Checks that the hand-written fixture follows the word-data contract
// (.claude/plans/words-json-schema.md), so the app logic is tested on the real shape.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const TONES = /[\u0304\u0301\u030c\u0300]/g;
// pyBase is the pinyin without tone marks, spaces, apostrophes or hyphens, in lower case.
const toneless = (py) => py.normalize('NFD').replace(TONES, '').normalize('NFC').toLowerCase().replace(/[\s'’-]/g, '');
const POS = new Set(['n.', 'v.', 'adj.', 'adv.', 'm.', 'pron.', 'prep.', 'conj.', 'part.', 'num.', 'int.']);

test('top-level fields and themes', () => {
  assert.equal(data.version, 'v001');
  assert.match(data.generated, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(typeof data.license, 'string');
  data.themes.forEach((t, i) => {
    assert.equal(t.id, `t${String(i + 1).padStart(2, '0')}`);
    assert.equal(t.order, i + 1);
    assert.equal(t.count, data.words.filter((w) => w.theme === t.id).length);
  });
  assert.equal(data.words.length, 61);
});

test('every word has every field with the right shape', () => {
  const ids = new Set(data.words.map((w) => w.id));
  assert.equal(ids.size, data.words.length);
  for (const w of data.words) {
    assert.match(w.id, /^w\d{4}$/);
    assert.equal(w.pyBase, toneless(w.py), w.hz);
    // One pyNum item per character, where the 儿 ending is the item "r5". syl leaves r5 out.
    const items = w.pyNum.split(' ');
    assert.equal(items.length, [...w.hz].length, w.hz);
    assert.equal(w.syl, items.filter((s) => s !== 'r5').length, w.hz);
    assert.ok(w.lv >= 1 && w.lv <= 6);
    assert.ok(w.pos.every((p) => POS.has(p)), w.hz);
    assert.ok(w.en.length > 0 && w.en.length <= 80);
    assert.ok(w.enShort.length > 0 && w.enShort.length <= 30);
    assert.ok(data.themes.some((t) => t.id === w.theme));
    assert.match(w.au, new RegExp(`^w/${w.id}_[0-9a-f]{8}\\.mp3$`));
    assert.ok(w.noDistract.every((id) => ids.has(id)));
    assert.ok(w.ex.hz.includes(w.hz), `${w.hz} is in its sentence`);
    assert.match(w.ex.au, new RegExp(`^s/${w.id}_[0-9a-f]{8}\\.mp3$`));
    assert.ok(['pdf', 'claude'].includes(w.ex.src));
  }
});

test('ord runs 1 to N, in theme order, and the level never goes down within a theme', () => {
  const sorted = data.words.slice().sort((a, b) => a.ord - b.ord);
  sorted.forEach((w, i) => assert.equal(w.ord, i + 1));
  const themeOrder = new Map(data.themes.map((t) => [t.id, t.order]));
  for (let i = 1; i < sorted.length; i++) {
    const a = sorted[i - 1], b = sorted[i];
    assert.ok(themeOrder.get(a.theme) <= themeOrder.get(b.theme));
    if (a.theme === b.theme) assert.ok(a.lv <= b.lv, `${a.hz} then ${b.hz}`);
  }
});

test('the fixture holds the cases the quiz-choice tests need', () => {
  const hz = (h) => data.words.find((w) => w.hz === h);
  assert.equal(hz('他').py, hz('她').py); // exact homophones
  assert.equal(hz('买').pyBase, hz('卖').pyBase); // tone twins
  assert.deepEqual(hz('高兴').noDistract, [hz('快乐').id]); // same meaning
  assert.equal(data.words.filter((w) => w.syl === 3).length, 4); // enough three-syllable words
  assert.equal(hz('不客气').py, 'bú kèqi'); // textbook word spacing with a space
  assert.equal(hz('女儿').py, "nǚ'ér"); // an apostrophe before a syllable starting with a, o or e
  const erhua = hz('一点儿'); // the 儿 ending joins the syllable before it
  assert.deepEqual([erhua.py, erhua.pyNum, erhua.pyBase, erhua.syl], ['yìdiǎnr', 'yi1 dian3 r5', 'yidianr', 2]);
});

test('the example pinyin follows the pinyin style sheet', () => {
  const hz = (h) => data.words.find((w) => w.hz === h);
  assert.equal(hz('好').ex.py, 'Zhège píngguǒ hěn hǎochī.'); // point 1: 这个 is one word, zhège
  assert.equal(hz('九').ex.py, 'Jiǔyuè wǒ qù Zhōngguó.'); // point 2: a month name is one word
  assert.equal(hz('六').ex.py, 'Wǒ mǎile liù gè píngguǒ.'); // points 3 and 6: 了 joins its verb, a numeral stands apart
  assert.equal(hz('老师').ex.py, 'Wáng lǎoshī hěn hǎo.'); // point 7: a surname with a capital, a title in lower case
  assert.equal(hz('没关系').ex.py, 'Méi guānxi, wǒ bú lèi.'); // points 8 and 9: 不 changes tone, a Western comma
  assert.equal(hz('吃').ex.py, 'Nǐ chīfàn le ma?'); // reference rule 2: 吃饭 is one entry of the public list, so one word
  // 个 after a number keeps its dictionary tone ("yí gè"), and the headword 个 is written "gè" as on its card.
  for (const w of data.words) assert.ok(!/ ge[ .,!?]/.test(w.ex.py), `${w.hz}: ${w.ex.py}`);
  assert.equal(hz('个').ex.py, 'Wǒ yǒu sān gè péngyou.');
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `node --test tests/js/fixture.test.mjs`
Expected: FAIL with `Error: ENOENT: no such file or directory, open '...tests\js\fixtures\words_fixture.json'`.

- [ ] **Step 4: Write `tests/js/fixtures/words_fixture.json`**

```json
{
 "version": "v001",
 "generated": "2026-09-28",
 "license": "Hand-written test fixture of real HSK 1-2 words for the app logic tests.",
 "themes": [
  {"id": "t01", "order": 1, "name": "Starter Kit", "count": 12},
  {"id": "t02", "order": 2, "name": "Greetings & Courtesy", "count": 10},
  {"id": "t03", "order": 3, "name": "Numbers & Measure Words", "count": 12},
  {"id": "t04", "order": 4, "name": "Family & People", "count": 12},
  {"id": "t05", "order": 5, "name": "Food & Drink", "count": 15}
 ],
 "words": [
  {"id": "w0039", "hz": "我", "py": "wǒ", "pyNum": "wo3", "pyBase": "wo", "syl": 1, "lv": 1, "pos": ["pron."], "en": "I; me", "enShort": "I; me", "theme": "t01", "ord": 1, "au": "w/w0039_a36ee9e4.mp3", "noDistract": [], "ex": {"hz": "我是学生。", "py": "Wǒ shì xuésheng.", "en": "I am a student.", "au": "s/w0039_dc78c050.mp3", "src": "claude"}},
  {"id": "w0023", "hz": "你", "py": "nǐ", "pyNum": "ni3", "pyBase": "ni", "syl": 1, "lv": 1, "pos": ["pron."], "en": "you", "enShort": "you", "theme": "t01", "ord": 2, "au": "w/w0023_52c96429.mp3", "noDistract": ["w0057"], "ex": {"hz": "你是老师吗？", "py": "Nǐ shì lǎoshī ma?", "en": "Are you a teacher?", "au": "s/w0023_20506bb1.mp3", "src": "claude"}},
  {"id": "w0036", "hz": "他", "py": "tā", "pyNum": "ta1", "pyBase": "ta", "syl": 1, "lv": 1, "pos": ["pron."], "en": "he; him", "enShort": "he; him", "theme": "t01", "ord": 3, "au": "w/w0036_2df5e6bb.mp3", "noDistract": [], "ex": {"hz": "他是我哥哥。", "py": "Tā shì wǒ gēge.", "en": "He is my older brother.", "au": "s/w0036_7d5c60c7.mp3", "src": "claude"}},
  {"id": "w0037", "hz": "她", "py": "tā", "pyNum": "ta1", "pyBase": "ta", "syl": 1, "lv": 1, "pos": ["pron."], "en": "she; her", "enShort": "she; her", "theme": "t01", "ord": 4, "au": "w/w0037_c470ad15.mp3", "noDistract": [], "ex": {"hz": "她是我妈妈。", "py": "Tā shì wǒ māma.", "en": "She is my mom.", "au": "s/w0037_95fc2916.mp3", "src": "claude"}},
  {"id": "w0032", "hz": "是", "py": "shì", "pyNum": "shi4", "pyBase": "shi", "syl": 1, "lv": 1, "pos": ["v."], "en": "to be; yes", "enShort": "to be", "theme": "t01", "ord": 5, "au": "w/w0032_cd1f867e.mp3", "noDistract": [], "ex": {"hz": "这是我的书。", "py": "Zhè shì wǒ de shū.", "en": "This is my book.", "au": "s/w0032_a98c91a7.mp3", "src": "claude"}},
  {"id": "w0045", "hz": "有", "py": "yǒu", "pyNum": "you3", "pyBase": "you", "syl": 1, "lv": 1, "pos": ["v."], "en": "to have; there is", "enShort": "to have", "theme": "t01", "ord": 6, "au": "w/w0045_d690f8d2.mp3", "noDistract": [], "ex": {"hz": "我有一个妹妹。", "py": "Wǒ yǒu yí gè mèimei.", "en": "I have a younger sister.", "au": "s/w0045_cdff36f9.mp3", "src": "claude"}},
  {"id": "w0003", "hz": "不", "py": "bù", "pyNum": "bu4", "pyBase": "bu", "syl": 1, "lv": 1, "pos": ["adv."], "en": "not; no", "enShort": "not", "theme": "t01", "ord": 7, "au": "w/w0003_146a7470.mp3", "noDistract": [], "ex": {"hz": "我不喝茶。", "py": "Wǒ bù hē chá.", "en": "I don't drink tea.", "au": "s/w0003_de5ccdac.mp3", "src": "claude"}},
  {"id": "w0015", "hz": "很", "py": "hěn", "pyNum": "hen3", "pyBase": "hen", "syl": 1, "lv": 1, "pos": ["adv."], "en": "very; quite", "enShort": "very", "theme": "t01", "ord": 8, "au": "w/w0015_cfcf673a.mp3", "noDistract": [], "ex": {"hz": "我很好。", "py": "Wǒ hěn hǎo.", "en": "I am very well.", "au": "s/w0015_d181c28d.mp3", "src": "claude"}},
  {"id": "w0013", "hz": "好", "py": "hǎo", "pyNum": "hao3", "pyBase": "hao", "syl": 1, "lv": 1, "pos": ["adj."], "en": "good; well; fine", "enShort": "good", "theme": "t01", "ord": 9, "au": "w/w0013_410dbced.mp3", "noDistract": [], "ex": {"hz": "这个苹果很好吃。", "py": "Zhège píngguǒ hěn hǎochī.", "en": "This apple is very tasty.", "au": "s/w0013_e16cda7f.mp3", "src": "claude"}},
  {"id": "w0061", "hz": "一点儿", "py": "yìdiǎnr", "pyNum": "yi1 dian3 r5", "pyBase": "yidianr", "syl": 2, "lv": 1, "pos": ["m."], "en": "a little; a bit", "enShort": "a little", "theme": "t01", "ord": 10, "au": "w/w0061_5e1d3b7a.mp3", "noDistract": [], "ex": {"hz": "我会说一点儿汉语。", "py": "Wǒ huì shuō yìdiǎnr Hànyǔ.", "en": "I can speak a little Chinese.", "au": "s/w0061_c2f09a64.mp3", "src": "claude"}},
  {"id": "w0059", "hz": "它", "py": "tā", "pyNum": "ta1", "pyBase": "ta", "syl": 1, "lv": 2, "pos": ["pron."], "en": "it", "enShort": "it", "theme": "t01", "ord": 11, "au": "w/w0059_9acf6a22.mp3", "noDistract": [], "ex": {"hz": "它是我的猫。", "py": "Tā shì wǒ de māo.", "en": "It is my cat.", "au": "s/w0059_8a0c8b53.mp3", "src": "claude"}},
  {"id": "w0057", "hz": "您", "py": "nín", "pyNum": "nin2", "pyBase": "nin", "syl": 1, "lv": 2, "pos": ["pron."], "en": "you (polite)", "enShort": "you (polite)", "theme": "t01", "ord": 12, "au": "w/w0057_c1991d05.mp3", "noDistract": ["w0023"], "ex": {"hz": "您好！", "py": "Nín hǎo!", "en": "Hello! (polite)", "au": "s/w0057_9a7bd6ed.mp3", "src": "claude"}},
  {"id": "w0041", "hz": "谢谢", "py": "xièxie", "pyNum": "xie4 xie5", "pyBase": "xiexie", "syl": 2, "lv": 1, "pos": ["v."], "en": "to thank; thanks", "enShort": "thanks", "theme": "t02", "ord": 13, "au": "w/w0041_91af55a1.mp3", "noDistract": [], "ex": {"hz": "谢谢你的茶。", "py": "Xièxie nǐ de chá.", "en": "Thank you for the tea.", "au": "s/w0041_05cb6e3f.mp3", "src": "claude"}},
  {"id": "w0004", "hz": "不客气", "py": "bú kèqi", "pyNum": "bu4 ke4 qi5", "pyBase": "bukeqi", "syl": 3, "lv": 1, "pos": [], "en": "you're welcome; don't mention it", "enShort": "you're welcome", "theme": "t02", "ord": 14, "au": "w/w0004_80c514f9.mp3", "noDistract": [], "ex": {"hz": "不客气，再见！", "py": "Bú kèqi, zàijiàn!", "en": "You're welcome, goodbye!", "au": "s/w0004_80dc9ad5.mp3", "src": "claude"}},
  {"id": "w0046", "hz": "再见", "py": "zàijiàn", "pyNum": "zai4 jian4", "pyBase": "zaijian", "syl": 2, "lv": 1, "pos": ["v."], "en": "goodbye; see you again", "enShort": "goodbye", "theme": "t02", "ord": 15, "au": "w/w0046_96ae2678.mp3", "noDistract": [], "ex": {"hz": "老师，再见！", "py": "Lǎoshī, zàijiàn!", "en": "Goodbye, teacher!", "au": "s/w0046_48823b75.mp3", "src": "claude"}},
  {"id": "w0008", "hz": "对不起", "py": "duìbuqǐ", "pyNum": "dui4 bu5 qi3", "pyBase": "duibuqi", "syl": 3, "lv": 1, "pos": ["v."], "en": "sorry; excuse me", "enShort": "sorry", "theme": "t02", "ord": 16, "au": "w/w0008_d0527a5d.mp3", "noDistract": [], "ex": {"hz": "对不起，我来晚了。", "py": "Duìbuqǐ, wǒ lái wǎn le.", "en": "Sorry, I'm late.", "au": "s/w0008_1e31dfcf.mp3", "src": "claude"}},
  {"id": "w0021", "hz": "没关系", "py": "méi guānxi", "pyNum": "mei2 guan1 xi5", "pyBase": "meiguanxi", "syl": 3, "lv": 1, "pos": ["v."], "en": "it doesn't matter; never mind", "enShort": "it doesn't matter", "theme": "t02", "ord": 17, "au": "w/w0021_1a2a059d.mp3", "noDistract": [], "ex": {"hz": "没关系，我不累。", "py": "Méi guānxi, wǒ bú lèi.", "en": "It doesn't matter, I'm not tired.", "au": "s/w0021_ff580b37.mp3", "src": "claude"}},
  {"id": "w0028", "hz": "请", "py": "qǐng", "pyNum": "qing3", "pyBase": "qing", "syl": 1, "lv": 1, "pos": ["v."], "en": "please; to invite", "enShort": "please", "theme": "t02", "ord": 18, "au": "w/w0028_74d035a4.mp3", "noDistract": [], "ex": {"hz": "请喝茶。", "py": "Qǐng hē chá.", "en": "Please have some tea.", "au": "s/w0028_8dac5041.mp3", "src": "claude"}},
  {"id": "w0038", "hz": "喂", "py": "wèi", "pyNum": "wei4", "pyBase": "wei", "syl": 1, "lv": 1, "pos": ["int."], "en": "hello (on the phone)", "enShort": "hello (on the phone)", "theme": "t02", "ord": 19, "au": "w/w0038_12f82a11.mp3", "noDistract": [], "ex": {"hz": "喂，你在哪儿？", "py": "Wèi, nǐ zài nǎr?", "en": "Hello, where are you?", "au": "s/w0038_99b0573b.mp3", "src": "claude"}},
  {"id": "w0011", "hz": "高兴", "py": "gāoxìng", "pyNum": "gao1 xing4", "pyBase": "gaoxing", "syl": 2, "lv": 1, "pos": ["adj."], "en": "happy; glad", "enShort": "happy", "theme": "t02", "ord": 20, "au": "w/w0011_8a372dcb.mp3", "noDistract": ["w0053"], "ex": {"hz": "认识你很高兴。", "py": "Rènshi nǐ hěn gāoxìng.", "en": "Nice to meet you.", "au": "s/w0011_84452a07.mp3", "src": "claude"}},
  {"id": "w0029", "hz": "认识", "py": "rènshi", "pyNum": "ren4 shi5", "pyBase": "renshi", "syl": 2, "lv": 1, "pos": ["v."], "en": "to know (someone); to meet", "enShort": "to know (someone)", "theme": "t02", "ord": 21, "au": "w/w0029_108f9c99.mp3", "noDistract": [], "ex": {"hz": "我认识他。", "py": "Wǒ rènshi tā.", "en": "I know him.", "au": "s/w0029_5d30b24e.mp3", "src": "claude"}},
  {"id": "w0053", "hz": "快乐", "py": "kuàilè", "pyNum": "kuai4 le4", "pyBase": "kuaile", "syl": 2, "lv": 2, "pos": ["adj."], "en": "happy; joyful", "enShort": "happy", "theme": "t02", "ord": 22, "au": "w/w0053_55e1cbf2.mp3", "noDistract": ["w0011"], "ex": {"hz": "生日快乐！", "py": "Shēngrì kuàilè!", "en": "Happy birthday!", "au": "s/w0053_44867af0.mp3", "src": "claude"}},
  {"id": "w0043", "hz": "一", "py": "yī", "pyNum": "yi1", "pyBase": "yi", "syl": 1, "lv": 1, "pos": ["num."], "en": "one", "enShort": "one", "theme": "t03", "ord": 23, "au": "w/w0043_86e7dee7.mp3", "noDistract": [], "ex": {"hz": "我有一本书。", "py": "Wǒ yǒu yì běn shū.", "en": "I have one book.", "au": "s/w0043_c391610a.mp3", "src": "claude"}},
  {"id": "w0009", "hz": "二", "py": "èr", "pyNum": "er4", "pyBase": "er", "syl": 1, "lv": 1, "pos": ["num."], "en": "two", "enShort": "two", "theme": "t03", "ord": 24, "au": "w/w0009_2c590d93.mp3", "noDistract": ["w0054"], "ex": {"hz": "二月很冷。", "py": "Èryuè hěn lěng.", "en": "February is very cold.", "au": "s/w0009_a5e04016.mp3", "src": "claude"}},
  {"id": "w0030", "hz": "三", "py": "sān", "pyNum": "san1", "pyBase": "san", "syl": 1, "lv": 1, "pos": ["num."], "en": "three", "enShort": "three", "theme": "t03", "ord": 25, "au": "w/w0030_160985a9.mp3", "noDistract": [], "ex": {"hz": "我家有三个人。", "py": "Wǒ jiā yǒu sān gè rén.", "en": "There are three people in my family.", "au": "s/w0030_05e08e51.mp3", "src": "claude"}},
  {"id": "w0035", "hz": "四", "py": "sì", "pyNum": "si4", "pyBase": "si", "syl": 1, "lv": 1, "pos": ["num."], "en": "four", "enShort": "four", "theme": "t03", "ord": 26, "au": "w/w0035_f6201c56.mp3", "noDistract": [], "ex": {"hz": "他四岁了。", "py": "Tā sì suì le.", "en": "He is four years old.", "au": "s/w0035_111c7a5d.mp3", "src": "claude"}},
  {"id": "w0040", "hz": "五", "py": "wǔ", "pyNum": "wu3", "pyBase": "wu", "syl": 1, "lv": 1, "pos": ["num."], "en": "five", "enShort": "five", "theme": "t03", "ord": 27, "au": "w/w0040_0719a3af.mp3", "noDistract": [], "ex": {"hz": "我五点回家。", "py": "Wǒ wǔ diǎn huíjiā.", "en": "I go home at five o'clock.", "au": "s/w0040_d6a2f280.mp3", "src": "claude"}},
  {"id": "w0018", "hz": "六", "py": "liù", "pyNum": "liu4", "pyBase": "liu", "syl": 1, "lv": 1, "pos": ["num."], "en": "six", "enShort": "six", "theme": "t03", "ord": 28, "au": "w/w0018_066ede21.mp3", "noDistract": [], "ex": {"hz": "我买了六个苹果。", "py": "Wǒ mǎile liù gè píngguǒ.", "en": "I bought six apples.", "au": "s/w0018_a249744a.mp3", "src": "claude"}},
  {"id": "w0027", "hz": "七", "py": "qī", "pyNum": "qi1", "pyBase": "qi", "syl": 1, "lv": 1, "pos": ["num."], "en": "seven", "enShort": "seven", "theme": "t03", "ord": 29, "au": "w/w0027_d5ab0acd.mp3", "noDistract": [], "ex": {"hz": "今天是七号。", "py": "Jīntiān shì qī hào.", "en": "Today is the seventh.", "au": "s/w0027_d4cd6642.mp3", "src": "claude"}},
  {"id": "w0001", "hz": "八", "py": "bā", "pyNum": "ba1", "pyBase": "ba", "syl": 1, "lv": 1, "pos": ["num."], "en": "eight", "enShort": "eight", "theme": "t03", "ord": 30, "au": "w/w0001_0d809699.mp3", "noDistract": [], "ex": {"hz": "我们八点吃饭。", "py": "Wǒmen bā diǎn chīfàn.", "en": "We eat at eight o'clock.", "au": "s/w0001_01750bba.mp3", "src": "claude"}},
  {"id": "w0016", "hz": "九", "py": "jiǔ", "pyNum": "jiu3", "pyBase": "jiu", "syl": 1, "lv": 1, "pos": ["num."], "en": "nine", "enShort": "nine", "theme": "t03", "ord": 31, "au": "w/w0016_6a61542e.mp3", "noDistract": [], "ex": {"hz": "九月我去中国。", "py": "Jiǔyuè wǒ qù Zhōngguó.", "en": "I am going to China in September.", "au": "s/w0016_11e4e001.mp3", "src": "claude"}},
  {"id": "w0031", "hz": "十", "py": "shí", "pyNum": "shi2", "pyBase": "shi", "syl": 1, "lv": 1, "pos": ["num."], "en": "ten", "enShort": "ten", "theme": "t03", "ord": 32, "au": "w/w0031_3dadc921.mp3", "noDistract": [], "ex": {"hz": "我有十块钱。", "py": "Wǒ yǒu shí kuài qián.", "en": "I have ten yuan.", "au": "s/w0031_37e63151.mp3", "src": "claude"}},
  {"id": "w0012", "hz": "个", "py": "gè", "pyNum": "ge4", "pyBase": "ge", "syl": 1, "lv": 1, "pos": ["m."], "en": "general measure word", "enShort": "general measure word", "theme": "t03", "ord": 33, "au": "w/w0012_9d2efa8f.mp3", "noDistract": [], "ex": {"hz": "我有三个朋友。", "py": "Wǒ yǒu sān gè péngyou.", "en": "I have three friends.", "au": "s/w0012_b93f5d53.mp3", "src": "claude"}},
  {"id": "w0054", "hz": "两", "py": "liǎng", "pyNum": "liang3", "pyBase": "liang", "syl": 1, "lv": 2, "pos": ["num."], "en": "two (before a measure word); both", "enShort": "two (of something)", "theme": "t03", "ord": 34, "au": "w/w0054_f50d4320.mp3", "noDistract": ["w0009"], "ex": {"hz": "我有两个哥哥。", "py": "Wǒ yǒu liǎng gè gēge.", "en": "I have two older brothers.", "au": "s/w0054_de4546e1.mp3", "src": "claude"}},
  {"id": "w0002", "hz": "爸爸", "py": "bàba", "pyNum": "ba4 ba5", "pyBase": "baba", "syl": 2, "lv": 1, "pos": ["n."], "en": "dad; father", "enShort": "dad", "theme": "t04", "ord": 35, "au": "w/w0002_69f3acbb.mp3", "noDistract": [], "ex": {"hz": "我爸爸是医生。", "py": "Wǒ bàba shì yīshēng.", "en": "My dad is a doctor.", "au": "s/w0002_2b792cb9.mp3", "src": "claude"}},
  {"id": "w0020", "hz": "妈妈", "py": "māma", "pyNum": "ma1 ma5", "pyBase": "mama", "syl": 2, "lv": 1, "pos": ["n."], "en": "mom; mother", "enShort": "mom", "theme": "t04", "ord": 36, "au": "w/w0020_0789b664.mp3", "noDistract": [], "ex": {"hz": "妈妈在家。", "py": "Māma zàijiā.", "en": "Mom is at home.", "au": "s/w0020_9e1e17c7.mp3", "src": "claude"}},
  {"id": "w0010", "hz": "儿子", "py": "érzi", "pyNum": "er2 zi5", "pyBase": "erzi", "syl": 2, "lv": 1, "pos": ["n."], "en": "son", "enShort": "son", "theme": "t04", "ord": 37, "au": "w/w0010_05c8460d.mp3", "noDistract": [], "ex": {"hz": "他儿子五岁。", "py": "Tā érzi wǔ suì.", "en": "His son is five years old.", "au": "s/w0010_740c0c08.mp3", "src": "claude"}},
  {"id": "w0024", "hz": "女儿", "py": "nǚ'ér", "pyNum": "nü3 er2", "pyBase": "nüer", "syl": 2, "lv": 1, "pos": ["n."], "en": "daughter", "enShort": "daughter", "theme": "t04", "ord": 38, "au": "w/w0024_ce6bc75d.mp3", "noDistract": [], "ex": {"hz": "我女儿喜欢吃鱼。", "py": "Wǒ nǚ'ér xǐhuan chī yú.", "en": "My daughter likes to eat fish.", "au": "s/w0024_6c27d4bc.mp3", "src": "claude"}},
  {"id": "w0025", "hz": "朋友", "py": "péngyou", "pyNum": "peng2 you5", "pyBase": "pengyou", "syl": 2, "lv": 1, "pos": ["n."], "en": "friend", "enShort": "friend", "theme": "t04", "ord": 39, "au": "w/w0025_aafcf365.mp3", "noDistract": [], "ex": {"hz": "他是我的好朋友。", "py": "Tā shì wǒ de hǎo péngyou.", "en": "He is my good friend.", "au": "s/w0025_5a282636.mp3", "src": "claude"}},
  {"id": "w0017", "hz": "老师", "py": "lǎoshī", "pyNum": "lao3 shi1", "pyBase": "laoshi", "syl": 2, "lv": 1, "pos": ["n."], "en": "teacher", "enShort": "teacher", "theme": "t04", "ord": 40, "au": "w/w0017_0509ac45.mp3", "noDistract": [], "ex": {"hz": "王老师很好。", "py": "Wáng lǎoshī hěn hǎo.", "en": "Teacher Wang is very nice.", "au": "s/w0017_65b0ce2d.mp3", "src": "claude"}},
  {"id": "w0042", "hz": "学生", "py": "xuésheng", "pyNum": "xue2 sheng5", "pyBase": "xuesheng", "syl": 2, "lv": 1, "pos": ["n."], "en": "student", "enShort": "student", "theme": "t04", "ord": 41, "au": "w/w0042_472e360f.mp3", "noDistract": [], "ex": {"hz": "我们都是学生。", "py": "Wǒmen dōu shì xuésheng.", "en": "We are all students.", "au": "s/w0042_ec84816f.mp3", "src": "claude"}},
  {"id": "w0044", "hz": "医生", "py": "yīshēng", "pyNum": "yi1 sheng1", "pyBase": "yisheng", "syl": 2, "lv": 1, "pos": ["n."], "en": "doctor", "enShort": "doctor", "theme": "t04", "ord": 42, "au": "w/w0044_42040af5.mp3", "noDistract": [], "ex": {"hz": "她是医生。", "py": "Tā shì yīshēng.", "en": "She is a doctor.", "au": "s/w0044_b82221ec.mp3", "src": "claude"}},
  {"id": "w0049", "hz": "哥哥", "py": "gēge", "pyNum": "ge1 ge5", "pyBase": "gege", "syl": 2, "lv": 2, "pos": ["n."], "en": "older brother", "enShort": "older brother", "theme": "t04", "ord": 43, "au": "w/w0049_6e8f0ce7.mp3", "noDistract": [], "ex": {"hz": "哥哥比我高。", "py": "Gēge bǐ wǒ gāo.", "en": "My older brother is taller than me.", "au": "s/w0049_79891000.mp3", "src": "claude"}},
  {"id": "w0051", "hz": "姐姐", "py": "jiějie", "pyNum": "jie3 jie5", "pyBase": "jiejie", "syl": 2, "lv": 2, "pos": ["n."], "en": "older sister", "enShort": "older sister", "theme": "t04", "ord": 44, "au": "w/w0051_d10127a6.mp3", "noDistract": [], "ex": {"hz": "我姐姐在北京工作。", "py": "Wǒ jiějie zài Běijīng gōngzuò.", "en": "My older sister works in Beijing.", "au": "s/w0051_cc1613b7.mp3", "src": "claude"}},
  {"id": "w0047", "hz": "弟弟", "py": "dìdi", "pyNum": "di4 di5", "pyBase": "didi", "syl": 2, "lv": 2, "pos": ["n."], "en": "younger brother", "enShort": "younger brother", "theme": "t04", "ord": 45, "au": "w/w0047_47bc4086.mp3", "noDistract": [], "ex": {"hz": "弟弟喜欢喝牛奶。", "py": "Dìdi xǐhuan hē niúnǎi.", "en": "My younger brother likes to drink milk.", "au": "s/w0047_53d7239c.mp3", "src": "claude"}},
  {"id": "w0056", "hz": "妹妹", "py": "mèimei", "pyNum": "mei4 mei5", "pyBase": "meimei", "syl": 2, "lv": 2, "pos": ["n."], "en": "younger sister", "enShort": "younger sister", "theme": "t04", "ord": 46, "au": "w/w0056_ad72273c.mp3", "noDistract": [], "ex": {"hz": "我妹妹很漂亮。", "py": "Wǒ mèimei hěn piàoliang.", "en": "My younger sister is very pretty.", "au": "s/w0056_b55f6881.mp3", "src": "claude"}},
  {"id": "w0026", "hz": "苹果", "py": "píngguǒ", "pyNum": "ping2 guo3", "pyBase": "pingguo", "syl": 2, "lv": 1, "pos": ["n."], "en": "apple", "enShort": "apple", "theme": "t05", "ord": 47, "au": "w/w0026_6ce06b7e.mp3", "noDistract": [], "ex": {"hz": "我想吃苹果。", "py": "Wǒ xiǎng chī píngguǒ.", "en": "I want to eat an apple.", "au": "s/w0026_814ba0af.mp3", "src": "claude"}},
  {"id": "w0022", "hz": "米饭", "py": "mǐfàn", "pyNum": "mi3 fan4", "pyBase": "mifan", "syl": 2, "lv": 1, "pos": ["n."], "en": "cooked rice", "enShort": "cooked rice", "theme": "t05", "ord": 48, "au": "w/w0022_8dbb5491.mp3", "noDistract": [], "ex": {"hz": "我喜欢吃米饭。", "py": "Wǒ xǐhuan chī mǐfàn.", "en": "I like to eat rice.", "au": "s/w0022_83274321.mp3", "src": "claude"}},
  {"id": "w0006", "hz": "茶", "py": "chá", "pyNum": "cha2", "pyBase": "cha", "syl": 1, "lv": 1, "pos": ["n."], "en": "tea", "enShort": "tea", "theme": "t05", "ord": 49, "au": "w/w0006_3a3cc750.mp3", "noDistract": [], "ex": {"hz": "你喝茶吗？", "py": "Nǐ hē chá ma?", "en": "Do you drink tea?", "au": "s/w0006_24c613d4.mp3", "src": "claude"}},
  {"id": "w0033", "hz": "水", "py": "shuǐ", "pyNum": "shui3", "pyBase": "shui", "syl": 1, "lv": 1, "pos": ["n."], "en": "water", "enShort": "water", "theme": "t05", "ord": 50, "au": "w/w0033_f13d94e4.mp3", "noDistract": [], "ex": {"hz": "我想喝水。", "py": "Wǒ xiǎng hē shuǐ.", "en": "I want to drink water.", "au": "s/w0033_401bbc55.mp3", "src": "claude"}},
  {"id": "w0005", "hz": "菜", "py": "cài", "pyNum": "cai4", "pyBase": "cai", "syl": 1, "lv": 1, "pos": ["n."], "en": "dish; vegetable", "enShort": "dish (food)", "theme": "t05", "ord": 51, "au": "w/w0005_cbc56b87.mp3", "noDistract": [], "ex": {"hz": "这个菜很好吃。", "py": "Zhège cài hěn hǎochī.", "en": "This dish is very tasty.", "au": "s/w0005_37175767.mp3", "src": "claude"}},
  {"id": "w0034", "hz": "水果", "py": "shuǐguǒ", "pyNum": "shui3 guo3", "pyBase": "shuiguo", "syl": 2, "lv": 1, "pos": ["n."], "en": "fruit", "enShort": "fruit", "theme": "t05", "ord": 52, "au": "w/w0034_fe49a5c1.mp3", "noDistract": [], "ex": {"hz": "你喜欢吃什么水果？", "py": "Nǐ xǐhuan chī shénme shuǐguǒ?", "en": "What fruit do you like to eat?", "au": "s/w0034_f829b13e.mp3", "src": "claude"}},
  {"id": "w0007", "hz": "吃", "py": "chī", "pyNum": "chi1", "pyBase": "chi", "syl": 1, "lv": 1, "pos": ["v."], "en": "to eat", "enShort": "to eat", "theme": "t05", "ord": 53, "au": "w/w0007_ddbc323e.mp3", "noDistract": [], "ex": {"hz": "你吃饭了吗？", "py": "Nǐ chīfàn le ma?", "en": "Have you eaten?", "au": "s/w0007_2ed22dc9.mp3", "src": "claude"}},
  {"id": "w0014", "hz": "喝", "py": "hē", "pyNum": "he1", "pyBase": "he", "syl": 1, "lv": 1, "pos": ["v."], "en": "to drink", "enShort": "to drink", "theme": "t05", "ord": 54, "au": "w/w0014_1655e9f8.mp3", "noDistract": [], "ex": {"hz": "我不喝咖啡。", "py": "Wǒ bù hē kāfēi.", "en": "I don't drink coffee.", "au": "s/w0014_8db48016.mp3", "src": "claude"}},
  {"id": "w0019", "hz": "买", "py": "mǎi", "pyNum": "mai3", "pyBase": "mai", "syl": 1, "lv": 1, "pos": ["v."], "en": "to buy", "enShort": "to buy", "theme": "t05", "ord": 55, "au": "w/w0019_9916efe8.mp3", "noDistract": [], "ex": {"hz": "我去商店买东西。", "py": "Wǒ qù shāngdiàn mǎi dōngxi.", "en": "I'm going to the shop to buy things.", "au": "s/w0019_7fde122d.mp3", "src": "claude"}},
  {"id": "w0055", "hz": "卖", "py": "mài", "pyNum": "mai4", "pyBase": "mai", "syl": 1, "lv": 2, "pos": ["v."], "en": "to sell", "enShort": "to sell", "theme": "t05", "ord": 56, "au": "w/w0055_a743503e.mp3", "noDistract": [], "ex": {"hz": "这儿卖水果吗？", "py": "Zhèr mài shuǐguǒ ma?", "en": "Do they sell fruit here?", "au": "s/w0055_8ac758fd.mp3", "src": "claude"}},
  {"id": "w0050", "hz": "鸡蛋", "py": "jīdàn", "pyNum": "ji1 dan4", "pyBase": "jidan", "syl": 2, "lv": 2, "pos": ["n."], "en": "egg", "enShort": "egg", "theme": "t05", "ord": 57, "au": "w/w0050_05fa156e.mp3", "noDistract": [], "ex": {"hz": "我每天吃一个鸡蛋。", "py": "Wǒ měi tiān chī yí gè jīdàn.", "en": "I eat one egg every day.", "au": "s/w0050_204d8603.mp3", "src": "claude"}},
  {"id": "w0058", "hz": "牛奶", "py": "niúnǎi", "pyNum": "niu2 nai3", "pyBase": "niunai", "syl": 2, "lv": 2, "pos": ["n."], "en": "milk", "enShort": "milk", "theme": "t05", "ord": 58, "au": "w/w0058_69c71dcb.mp3", "noDistract": [], "ex": {"hz": "早上我喝牛奶。", "py": "Zǎoshang wǒ hē niúnǎi.", "en": "I drink milk in the morning.", "au": "s/w0058_9cff8093.mp3", "src": "claude"}},
  {"id": "w0052", "hz": "咖啡", "py": "kāfēi", "pyNum": "ka1 fei1", "pyBase": "kafei", "syl": 2, "lv": 2, "pos": ["n."], "en": "coffee", "enShort": "coffee", "theme": "t05", "ord": 59, "au": "w/w0052_c8c2089f.mp3", "noDistract": [], "ex": {"hz": "这杯咖啡很热。", "py": "Zhè bēi kāfēi hěn rè.", "en": "This cup of coffee is very hot.", "au": "s/w0052_593f7afc.mp3", "src": "claude"}},
  {"id": "w0060", "hz": "鱼", "py": "yú", "pyNum": "yu2", "pyBase": "yu", "syl": 1, "lv": 2, "pos": ["n."], "en": "fish", "enShort": "fish", "theme": "t05", "ord": 60, "au": "w/w0060_f8cc45a5.mp3", "noDistract": [], "ex": {"hz": "我不吃鱼。", "py": "Wǒ bù chī yú.", "en": "I don't eat fish.", "au": "s/w0060_d03c73bc.mp3", "src": "claude"}},
  {"id": "w0048", "hz": "服务员", "py": "fúwùyuán", "pyNum": "fu2 wu4 yuan2", "pyBase": "fuwuyuan", "syl": 3, "lv": 2, "pos": ["n."], "en": "waiter; waitress", "enShort": "waiter", "theme": "t05", "ord": 61, "au": "w/w0048_c70d375e.mp3", "noDistract": [], "ex": {"hz": "服务员，请给我一杯水。", "py": "Fúwùyuán, qǐng gěi wǒ yì bēi shuǐ.", "en": "Waiter, please give me a glass of water.", "au": "s/w0048_2bc360dc.mp3", "src": "claude"}}
 ]
}
```

- [ ] **Step 5: Run it and see it pass**

Run: `node --test tests/js/fixture.test.mjs`
Expected: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add tests/js/helpers.mjs tests/js/fixtures/words_fixture.json tests/js/fixture.test.mjs && git commit -F - <<'EOF'
test(app): 61-word HSK 1-2 fixture and shared test helpers

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 6: The next new words (`docs/js/curriculum.js`)

For example, with an empty store the first 4 words are 我, 你, 他 and 她 (ord 1 to 4), although their IDs are w0039, w0023, w0036 and w0037.

**Files:**
- Create: `docs/js/curriculum.js`
- Test: `tests/js/curriculum.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nextNewWords } from '../../docs/js/curriculum.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const idsByOrd = data.words.slice().sort((a, b) => a.ord - b.ord).map((w) => w.id);
const map = (...records) => new Map(records.map((p) => [p.id, p]));

test('new words come in ord order, not id order', () => {
  const ids = nextNewWords(data.words, new Map(), 4, '2026-10-05');
  assert.deepEqual(ids, idsByOrd.slice(0, 4));
  assert.deepEqual(ids.map((id) => data.words.find((w) => w.id === id).hz), ['我', '你', '他', '她']);
});

test('learned words are skipped', () => {
  const progress = map(learnedProgress(idsByOrd[0], '2026-10-01'), learnedProgress(idsByOrd[2], '2026-10-01'));
  assert.deepEqual(nextNewWords(data.words, progress, 3, '2026-10-05'), [idsByOrd[1], idsByOrd[3], idsByOrd[4]]);
});

test('a failed lesson waits for the next study day, then comes first', () => {
  const progress = map(learnedProgress(idsByOrd[0], '2026-10-05'), failedLessonProgress(idsByOrd[1], '2026-10-05'));
  assert.deepEqual(nextNewWords(data.words, progress, 2, '2026-10-05'), [idsByOrd[2], idsByOrd[3]]);
  assert.deepEqual(nextNewWords(data.words, progress, 2, '2026-10-06'), [idsByOrd[1], idsByOrd[2]]);
});

test('zero asked gives none, and the list ends with the words', () => {
  assert.deepEqual(nextNewWords(data.words, new Map(), 0, '2026-10-05'), []);
  assert.equal(nextNewWords(data.words, new Map(), 500, '2026-10-05').length, 61);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/curriculum.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\curriculum.js'`.

- [ ] **Step 3: Write `docs/js/curriculum.js`**

```js
// Which new words come next. Words are taught in `ord` order (theme by theme, easiest
// HSK level first). A word is skipped once learned. A word whose lesson ended today
// without passing waits until the next study day, where it comes first again because
// its ord is lower than any word not yet taught.
const sortedCache = new WeakMap();

function byOrd(words) {
  let sorted = sortedCache.get(words);
  if (!sorted) {
    sorted = words.slice().sort((a, b) => a.ord - b.ord);
    sortedCache.set(words, sorted);
  }
  return sorted;
}

// nextNewWords(words, progressById, 12, '2026-10-05') gives up to 12 word IDs.
export function nextNewWords(words, progressById, count, today) {
  const out = [];
  if (count <= 0) return out;
  for (const w of byOrd(words)) {
    const p = progressById.get(w.id);
    if (!p || (p.step === 0 && p.lessonDay !== today)) {
      out.push(w.id);
      if (out.length === count) break;
    }
  }
  return out;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/curriculum.test.mjs`
Expected: `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/curriculum.js tests/js/curriculum.test.mjs && git commit -F - <<'EOF'
feat(app): next new words in curriculum order

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 7: One day's plan (`docs/js/plan.js`)

This module was split out of the "session" idea in the design because it is a separate job. It decides how much to do today, and `session.js` (Task 8) decides the order of the cards. The quiz type of each review is not decided here. `session.js` asks `quizForReview` from Task 4 when it builds the cards.

For example, with the defaults (cap 100, 12 new words) and 150 reviews due, the plan asks the 100 most overdue and teaches 6 new words. Overdue is measured as days late divided by the word's gap. A word 3 days late on a 2-day gap scores 1.5 and comes before a word 10 days late on a 30-day gap, which scores 0.33.

**Files:**
- Create: `docs/js/plan.js`
- Test: `tests/js/plan.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDayDone, newQuota, planDay, sortDue } from '../../docs/js/plan.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';
import { syntheticWords } from './helpers.mjs';

const TODAY = '2026-10-20';
const SETTINGS = { reviewCap: 100, newPerDay: 12 };
const rec = (id, step, due, extra = {}) => ({ ...learnedProgress(id, '2026-09-01'), step, due, ...extra });

test('the new-word quota is full up to the cap, halved up to twice the cap, and zero above', () => {
  assert.equal(newQuota(0, 100, 12), 12);
  assert.equal(newQuota(100, 100, 12), 12);
  assert.equal(newQuota(101, 100, 12), 6);
  assert.equal(newQuota(200, 100, 12), 6);
  assert.equal(newQuota(201, 100, 12), 0);
  assert.equal(newQuota(150, 100, 13), 6);
});

test('most overdue first, by days overdue divided by the gap, then lower step', () => {
  const list = [
    rec('late30', 6, '2026-10-10'), // 10 days late on a 30-day gap gives 0.33
    rec('late2', 2, '2026-10-17'), // 3 days late on a 2-day gap gives 1.5
    // The next two tie at 0 and share a due day. Their IDs sort the opposite way to their
    // steps ('a-step4' comes before 'b-step1' alphabetically), so only the lower-step rule
    // can put 'b-step1' first. Without that rule the ID fallback would put 'a-step4' first.
    rec('a-step4', 4, TODAY), // 0
    rec('b-step1', 1, TODAY), // 0, and a lower step than a-step4
    rec('late1', 1, '2026-10-19'), // 1 day late on a 1-day gap gives 1.0
  ];
  assert.deepEqual(sortDue(list, TODAY).map((p) => p.id), ['late2', 'late1', 'late30', 'b-step1', 'a-step4']);
});

function progressWithDue(n) {
  return Array.from({ length: n }, (_, i) =>
    rec(`x${String(i + 1).padStart(5, '0')}`, 1 + (i % 5), TODAY));
}

test('a normal day has all due reviews and 12 new words', () => {
  const words = syntheticWords(300);
  const plan = planDay({ words, progress: progressWithDue(40), today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviews.length, 40);
  assert.equal(plan.quota, 12);
  assert.deepEqual(plan.newWords, words.slice(40, 52).map((w) => w.id));
});

test('150 due reviews give 100 reviews and 6 new words', () => {
  const plan = planDay({ words: syntheticWords(400), progress: progressWithDue(150), today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviews.length, 100);
  assert.equal(plan.backlog, 150);
  assert.equal(plan.newWords.length, 6);
});

test('250 due reviews give 100 reviews and no new words', () => {
  const plan = planDay({ words: syntheticWords(400), progress: progressWithDue(250), today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviews.length, 100);
  assert.equal(plan.newWords.length, 0);
});

test('a second session the same day only gets what is left of the cap and quota', () => {
  const progress = progressWithDue(150);
  for (let i = 0; i < 100; i++) progress[i] = { ...progress[i], lastReview: TODAY, due: '2026-10-22' };
  const words = syntheticWords(400);
  progress.push(learnedProgress(words[200].id, TODAY), learnedProgress(words[201].id, TODAY));
  const plan = planDay({ words, progress, today: TODAY, settings: SETTINGS });
  assert.equal(plan.reviewsDone, 100);
  assert.equal(plan.backlog, 150);
  assert.equal(plan.reviews.length, 0);
  assert.equal(plan.newDone, 2);
  assert.equal(plan.newWords.length, 4);
});

test('an unfinished word from yesterday comes first and counts toward the quota', () => {
  const words = syntheticWords(100);
  const progress = [failedLessonProgress(words[0].id, '2026-10-19')];
  const plan = planDay({ words, progress, today: TODAY, settings: SETTINGS });
  assert.equal(plan.newWords.length, 12);
  assert.equal(plan.newWords[0], words[0].id);
});

test('the day is done when no reviews and no new words are left', () => {
  assert.ok(isDayDone({ reviews: [], newWords: [] }));
  assert.ok(!isDayDone({ reviews: ['a'], newWords: [] }));
  assert.ok(!isDayDone({ reviews: [], newWords: ['a'] }));
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/plan.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\plan.js'`.

- [ ] **Step 3: Write `docs/js/plan.js`**

```js
// Plans one study day. It picks the due reviews to ask (most overdue first, up to the cap)
// and how many new words to teach (fewer when reviews pile up). The quiz type of each
// review is chosen by quizForReview in srs.js, when session.js builds the cards.
import { daysBetween } from './dates.js';
import { intervalFor } from './srs.js';
import { nextNewWords } from './curriculum.js';

// New words for the day, given how many reviews were due in total.
// With the default cap of 100 and 12 new words, 100 due reviews give 12 new words,
// 101 to 200 give 6, and 201 or more give 0.
export function newQuota(backlog, cap, perDay) {
  if (backlog <= cap) return perDay;
  if (backlog <= 2 * cap) return Math.floor(perDay / 2);
  return 0;
}

// Most overdue first, measured as days overdue divided by the word's gap, so a word
// 3 days late on a 2-day gap (1.5) comes before one 10 days late on a 30-day gap (0.33).
// Ties go to the lower step, then the earlier due day, then the ID.
export function sortDue(due, today) {
  const ratio = (p) => daysBetween(p.due, today) / intervalFor(p.step);
  return due.slice().sort((a, b) => ratio(b) - ratio(a) || a.step - b.step
    || a.due.localeCompare(b.due) || a.id.localeCompare(b.id));
}

// The plan for `today`. It also works for a second session on the same day, because it
// counts the reviews and lessons already done today.
export function planDay({ words, progress, today, settings }) {
  const { reviewCap, newPerDay } = settings;
  const progressById = new Map(progress.map((p) => [p.id, p]));
  const reviewsDone = progress.filter((p) => p.lastReview === today).length;
  const newDone = progress.filter((p) => p.lessonDay === today).length;
  const due = sortDue(progress.filter((p) => p.step >= 1 && p.due <= today), today);
  const backlog = due.length + reviewsDone;
  const quota = newQuota(backlog, reviewCap, newPerDay);
  return {
    day: today,
    reviews: due.slice(0, Math.max(0, reviewCap - reviewsDone)).map((p) => p.id),
    newWords: nextNewWords(words, progressById, Math.max(0, quota - newDone), today),
    backlog,
    quota,
    reviewsDone,
    newDone,
  };
}

// The day can be checked in when no capped reviews and no new words are left.
export function isDayDone(plan) {
  return plan.reviews.length === 0 && plan.newWords.length === 0;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/plan.test.mjs`
Expected: `ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/plan.js tests/js/plan.test.mjs && git commit -F - <<'EOF'
feat(app): daily plan with review cap, backlog order and new-word quota

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 8: One session's cards (`docs/js/session.js`)

Worked example of a re-ask. Reviews 一 二 三 四 五 六 are due, and 一 is answered wrong. The cards become 一 二 三 四 **一** 五 六, so the re-ask of 一 is the 4th card after the miss. The re-ask is a recall card and is not a scheduled review, so 一's `reps` and `lastGrade` stay as the wrong answer left them. At 一's next scheduled review, in a later session, `quizForReview` sees `lastGrade: 'wrong'` and makes it a recall card too.

Worked example of a group check. New words 爸爸 妈妈 儿子 女儿 朋友 are taught. After the learning cards of the first group, 妈妈 is missed in the check, so the cards become check 爸爸, check 妈妈, check 儿子, check 女儿, **check 妈妈**, learn 朋友, check 朋友, and then the final checks.

**Files:**
- Create: `docs/js/session.js`
- Test: `tests/js/session.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  advance, answerCard, canUndo, createSession, currentCard, isFinished, sessionSummary, undoAnswer,
} from '../../docs/js/session.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const DAY = '2026-10-20';
const id = (hz) => word(data, hz).id;
const REVIEWS = ['一', '二', '三', '四', '五', '六'].map(id);
const NEW = ['爸爸', '妈妈', '儿子', '女儿', '朋友'].map(id);

function progressMap(ids, step = 1) {
  return new Map(ids.map((w) => [w, { ...learnedProgress(w, '2026-10-01'), step, due: DAY }]));
}

const show = (state) => state.cards.map((c) => `${c.type}:${data.words.find((w) => w.id === c.id).hz}`);

// Answers every card. Learning cards are passed with Next, and questions get grade(card).
function play(state, progress, grade) {
  const events = [];
  while (!isFinished(state)) {
    const card = currentCard(state);
    if (card.type === 'learn') { state = advance(state); continue; }
    const out = answerCard(state, grade(card), progress);
    if (out.progress) progress.set(out.progress.id, out.progress);
    events.push(out.event);
    state = out.state;
  }
  return { state, events };
}
const allRight = (card) => (card.quiz === 'recall' ? 'know' : 'right');

test('reviews come first, then groups of 4 with learn and check cards, then final checks', () => {
  const s = createSession({ day: DAY, reviews: REVIEWS.slice(0, 2), newWords: NEW }, progressMap(REVIEWS));
  assert.deepEqual(show(s), [
    'review:一', 'review:二',
    'learn:爸爸', 'learn:妈妈', 'learn:儿子', 'learn:女儿',
    'check:爸爸', 'check:妈妈', 'check:儿子', 'check:女儿',
    'learn:朋友', 'check:朋友',
    'final:爸爸', 'final:妈妈', 'final:儿子', 'final:女儿', 'final:朋友',
  ]);
  assert.equal(s.cards[0].quiz, 'listen');
  assert.equal(s.cards[6].quiz, 'listen');
  assert.equal(s.cards[12].quiz, 'pinyin');
});

test('a missed review comes back 4 cards later as a recall card', () => {
  const progress = progressMap(REVIEWS, 3);
  let s = createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress);
  const out = answerCard(s, s.cards[0].quiz === 'recall' ? 'dontknow' : 'wrong', progress);
  s = out.state;
  assert.equal(out.progress.step, 1);
  assert.equal(out.progress.due, '2026-10-21');
  assert.deepEqual(out.event, { day: DAY, kind: 'review', id: REVIEWS[0], quiz: out.event.quiz,
    grade: out.event.grade, first: true, outcome: null });
  assert.deepEqual(show(s), ['review:一', 'review:二', 'review:三', 'review:四', 'reask:一', 'review:五', 'review:六']);
  assert.equal(s.cards[4].quiz, 'recall');
});

test('re-asks stop after a right answer, and never exceed 3', () => {
  const progress = progressMap(REVIEWS, 1);
  const first = createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress);
  const wrongOne = (card) => (card.id === REVIEWS[0] ? (card.quiz === 'recall' ? 'dontknow' : 'wrong') : allRight(card));
  const { state, events } = play(first, progress, wrongOne);
  assert.equal(state.cards.filter((c) => c.type === 'reask').length, 3);
  assert.equal(events.filter((e) => e.kind === 'reask').length, 3);
  assert.ok(events.filter((e) => e.kind === 'reask').every((e) => e.first === false));
  assert.equal(progress.get(REVIEWS[0]).step, 1);
  assert.equal(progress.get(REVIEWS[0]).due, '2026-10-21');
  assert.equal(progress.get(REVIEWS[0]).reps, 1); // the 3 re-asks are not scheduled reviews

  const rightOnReask = (card) => (card.id === REVIEWS[0] && card.type === 'review' ? 'wrong' : allRight(card));
  const progress2 = progressMap(REVIEWS, 1);
  const again = play(createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress2), progress2, rightOnReask);
  assert.equal(again.state.cards.filter((c) => c.type === 'reask').length, 1);
  assert.equal(progress2.get(REVIEWS[0]).lastGrade, 'wrong'); // a right re-ask does not change it
});

test('the next session asks a word missed last time as a recall card', () => {
  const progress = progressMap(REVIEWS, 1);
  const wrongFirst = (card) => (card.id === REVIEWS[0] && card.type === 'review' ? 'wrong' : allRight(card));
  play(createSession({ day: DAY, reviews: REVIEWS, newWords: [] }, progress), progress, wrongFirst);
  const next = createSession({ day: '2026-10-21', reviews: [REVIEWS[0]], newWords: [] }, progress);
  assert.deepEqual([next.cards[0].type, next.cards[0].quiz], ['review', 'recall']);
});

test('a re-ask near the end of the reviews may fall among the new-word cards', () => {
  const progress = progressMap(REVIEWS, 1);
  const s = createSession({ day: DAY, reviews: REVIEWS.slice(0, 1), newWords: NEW }, progress);
  const { state } = answerCard(s, 'wrong', progress);
  assert.deepEqual(show(state).slice(0, 6), ['review:一', 'learn:爸爸', 'learn:妈妈', 'learn:儿子', 'reask:一', 'learn:女儿']);
});

test('Unsure on a recall review keeps the step and is not re-asked', () => {
  const progress = new Map([[REVIEWS[0], { ...learnedProgress(REVIEWS[0], '2026-10-01'), step: 3, reps: 3, due: DAY }]]);
  const s = createSession({ day: DAY, reviews: [REVIEWS[0]], newWords: [] }, progress);
  assert.equal(s.cards[0].quiz, 'recall');
  const out = answerCard(s, 'unsure', progress);
  assert.equal(out.progress.step, 3);
  assert.equal(out.progress.due, '2026-10-22');
  assert.equal(out.state.cards.length, 1);
});

test('grades must fit the card', () => {
  const progress = new Map([[REVIEWS[0], { ...learnedProgress(REVIEWS[0], '2026-10-01'), step: 3, reps: 3, due: DAY }]]);
  const s = createSession({ day: DAY, reviews: [REVIEWS[0]], newWords: NEW.slice(0, 1) }, progress);
  assert.throws(() => answerCard(s, 'right', progress), /does not fit/);
  const s2 = answerCard(s, 'know', progress).state;
  assert.throws(() => answerCard(s2, 'right', progress), /no question/);
  assert.throws(() => advance(s), /not a learning card/);
});

test('new words that pass both checks are learned at step 1 and due tomorrow', () => {
  const progress = new Map();
  const { state, events } = play(createSession({ day: DAY, reviews: [], newWords: NEW }, progress), progress, allRight);
  for (const w of NEW) {
    assert.deepEqual(progress.get(w), learnedProgress(w, DAY));
    assert.equal(progress.get(w).due, '2026-10-21');
  }
  assert.equal(events.filter((e) => e.outcome === 'learned').length, 5);
  assert.deepEqual(sessionSummary(state), { reviews: 0, firstRight: 0, learned: 5, failed: 0, perfect: false });
});

test('a missed group check is shown again at the end of its group', () => {
  const progress = new Map();
  let s = createSession({ day: DAY, reviews: [], newWords: NEW }, progress);
  for (let i = 0; i < 4; i++) s = advance(s);
  s = answerCard(s, 'right', progress).state; // 爸爸
  s = answerCard(s, 'wrong', progress).state; // 妈妈 missed
  assert.deepEqual(show(s).slice(4, 11), ['check:爸爸', 'check:妈妈', 'check:儿子', 'check:女儿', 'check:妈妈', 'learn:朋友', 'check:朋友']);
  assert.equal(s.cards[8].retry, 1);
});

test('a word that misses its group check 4 times fails, with no final check and step 0', () => {
  const progress = new Map();
  const failMama = (card) => (card.id === NEW[1] && card.type === 'check' ? 'wrong' : 'right');
  const { state, events } = play(createSession({ day: DAY, reviews: [], newWords: NEW }, progress), progress, failMama);
  assert.equal(state.cards.filter((c) => c.type === 'check' && c.id === NEW[1]).length, 4);
  assert.ok(!state.cards.some((c) => c.type === 'final' && c.id === NEW[1]));
  assert.equal(progress.get(NEW[1]).step, 0);
  assert.equal(progress.get(NEW[1]).lessonDay, DAY);
  assert.equal(events.filter((e) => e.outcome === 'failed').length, 1);
  assert.equal(sessionSummary(state).learned, 4);
});

test('a missed final check is asked again at the end, and passing it still counts', () => {
  const progress = new Map();
  let missed = false;
  const missOnce = (card) => {
    if (card.type === 'final' && card.id === NEW[0] && !missed) { missed = true; return 'wrong'; }
    return 'right';
  };
  const { state } = play(createSession({ day: DAY, reviews: [], newWords: NEW }, progress), progress, missOnce);
  const last = state.cards[state.cards.length - 1];
  assert.deepEqual([last.type, last.id, last.retry], ['final', NEW[0], 1]);
  assert.equal(progress.get(NEW[0]).step, 1);
});

test('Undo returns to the question before the last answer, once', () => {
  const progress = progressMap(REVIEWS, 1);
  const s0 = createSession({ day: DAY, reviews: REVIEWS.slice(0, 1), newWords: NEW.slice(0, 1) }, progress);
  assert.ok(!canUndo(s0));
  const s1 = answerCard(s0, 'wrong', progress).state;
  assert.ok(canUndo(s1));
  const s2 = advance(s1); // leave the learning card
  const back = undoAnswer(s2);
  assert.deepEqual(back, s0);
  assert.ok(!canUndo(back));
  assert.throws(() => undoAnswer(back), /Nothing to undo/);
});

test('a perfect session needs 30 or more reviews, all right first time', () => {
  const ids = data.words.slice(0, 30).map((w) => w.id);
  const progress = progressMap(ids, 1);
  const perfect = play(createSession({ day: DAY, reviews: ids, newWords: [] }, progress), progressMap(ids, 1), allRight);
  assert.equal(sessionSummary(perfect.state).perfect, true);
  const short = play(createSession({ day: DAY, reviews: ids.slice(1), newWords: [] }, progress), progressMap(ids, 1), allRight);
  assert.equal(sessionSummary(short.state).perfect, false);
  const oneMiss = (card) => (card.id === ids[5] && card.type === 'review' ? 'wrong' : allRight(card));
  const flawed = play(createSession({ day: DAY, reviews: ids, newWords: [] }, progress), progressMap(ids, 1), oneMiss);
  assert.equal(sessionSummary(flawed.state).perfect, false);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/session.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\session.js'`.

- [ ] **Step 3: Write `docs/js/session.js`**

```js
// One study session as a list of cards. The state is never changed in place. Every
// function returns a new state, so Undo only needs to keep the previous one.
//
// Card types:
//   review  a scheduled review ({ quiz: 'listen' | 'pinyin' | 'recall' }, from quizForReview)
//   reask   a missed review asked again 4 cards later, always as a recall card. It is
//           not a scheduled review, so it changes neither reps nor lastGrade.
//   learn   a new word's learning card (no answer, the learner taps Next)
//   check   listen-then-pick-meaning check of a new word inside its group of 4
//   final   meaning-then-pick-pinyin check of every new word after all groups
//
// Example with 2 due reviews (A, B) and 5 new words (a to e):
//   review A, review B,
//   learn a, learn b, learn c, learn d, check a, check b, check c, check d,
//   learn e, check e,
//   final a, final b, final c, final d, final e
import { CONFIG } from './config.js';
import { FAIL, PASS, failedLessonProgress, learnedProgress, quizForReview, review } from './srs.js';

const MC_GRADES = new Set(['right', 'wrong']);
const RECALL_GRADES = new Set(['know', 'unsure', 'dontknow']);

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

export function createSession(plan, progressById) {
  const cards = plan.reviews.map((id) => ({ type: 'review', id, quiz: quizForReview(progressById.get(id)) }));
  const lesson = {};
  chunk(plan.newWords, CONFIG.groupSize).forEach((ids, group) => {
    for (const id of ids) {
      cards.push({ type: 'learn', id, group });
      lesson[id] = { group, checkMisses: 0, finalMisses: 0, result: null };
    }
    for (const id of ids) cards.push({ type: 'check', id, quiz: 'listen', group, retry: 0 });
  });
  for (const id of plan.newWords) cards.push({ type: 'final', id, quiz: 'pinyin', retry: 0 });
  return {
    day: plan.day,
    cards,
    pos: 0,
    lesson,
    reasks: {},
    tally: { reviews: 0, firstRight: 0, learned: 0, failed: 0 },
    prev: null,
  };
}

export function currentCard(state) {
  return state.cards[state.pos] ?? null;
}

export function isFinished(state) {
  return state.pos >= state.cards.length;
}

// Leave a learning card. Undo still returns to the last answered question.
export function advance(state) {
  const card = currentCard(state);
  if (!card || card.type !== 'learn') throw new Error('The current card is not a learning card');
  return { ...state, pos: state.pos + 1 };
}

function checkGrade(card, grade) {
  const allowed = card.quiz === 'recall' ? RECALL_GRADES : MC_GRADES;
  if (!allowed.has(grade)) throw new Error(`Grade ${grade} does not fit a ${card.quiz} card`);
}

// A missed review comes back as the 4th card after this one, at most 3 times.
function queueReask(next, id) {
  const count = next.reasks[id] ?? 0;
  if (count >= CONFIG.maxReasks) return;
  next.reasks[id] = count + 1;
  const at = Math.min(next.pos + CONFIG.reaskGap, next.cards.length);
  next.cards.splice(at, 0, { type: 'reask', id, quiz: 'recall', retry: count + 1 });
}

// Just after the last check card of the group (its end), including earlier retries.
function groupEnd(cards, group) {
  for (let i = cards.length - 1; i >= 0; i--) {
    if (cards[i].type === 'check' && cards[i].group === group) return i + 1;
  }
  return cards.length;
}

function removeFinal(next, id) {
  const i = next.cards.findIndex((c, k) => k > next.pos && c.type === 'final' && c.id === id);
  if (i >= 0) next.cards.splice(i, 1);
}

// Answer the current question. Returns the new state, the word's new progress record
// (null when the schedule does not change) and the event to log.
export function answerCard(state, grade, progressById) {
  const card = currentCard(state);
  if (!card || card.type === 'learn') throw new Error('The current card has no question');
  checkGrade(card, grade);
  const next = {
    ...state,
    cards: state.cards.slice(),
    lesson: { ...state.lesson },
    reasks: { ...state.reasks },
    tally: { ...state.tally },
    prev: { ...state, prev: null },
  };
  const { id } = card;
  const day = state.day;
  const pass = PASS.has(grade);
  let progress = null;
  let outcome = null;

  if (card.type === 'review') {
    progress = review(progressById.get(id), grade, day);
    next.tally.reviews += 1;
    if (pass) next.tally.firstRight += 1;
    if (FAIL.has(grade)) queueReask(next, id);
  } else if (card.type === 'reask') {
    if (!pass) queueReask(next, id);
  } else {
    const L = { ...next.lesson[id] };
    next.lesson[id] = L;
    const missKey = card.type === 'check' ? 'checkMisses' : 'finalMisses';
    if (pass && card.type === 'final') {
      progress = learnedProgress(id, day);
      outcome = 'learned';
      L.result = outcome;
      next.tally.learned += 1;
    } else if (!pass && L[missKey] < CONFIG.lessonMaxRetries) {
      L[missKey] += 1;
      const retry = { ...card, retry: L[missKey] };
      next.cards.splice(card.type === 'check' ? groupEnd(next.cards, card.group) : next.cards.length, 0, retry);
    } else if (!pass) {
      progress = failedLessonProgress(id, day);
      outcome = 'failed';
      L.result = outcome;
      next.tally.failed += 1;
      removeFinal(next, id);
    }
  }
  next.pos += 1;
  const event = { day, kind: card.type, id, quiz: card.quiz, grade, first: card.type === 'review', outcome };
  return { state: next, progress, event };
}

export function canUndo(state) {
  return state.prev !== null;
}

// The state just before the last answer.
export function undoAnswer(state) {
  if (!state.prev) throw new Error('Nothing to undo');
  return state.prev;
}

export function sessionSummary(state) {
  const { reviews, firstRight, learned, failed } = state.tally;
  return {
    reviews,
    firstRight,
    learned,
    failed,
    perfect: reviews >= CONFIG.perfectMinReviews && firstRight === reviews,
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/session.test.mjs`
Expected: `ℹ tests 13`, `ℹ pass 13`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/session.js tests/js/session.test.mjs && git commit -F - <<'EOF'
feat(app): session cards with learning groups, checks, re-asks and Undo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 9: Streaks and calendars (`docs/js/checkin.js`)

This is also split out of "session", because streaks only read the list of checked-in days. For example, with check-ins on 3, 4 and 5 October the streak is 3 on 5 October, still 3 on 6 October before that day's check-in, and 0 on 7 October.

**Files:**
- Create: `docs/js/checkin.js`
- Test: `tests/js/checkin.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestStreak, currentStreak, monthCalendar, weekStrip } from '../../docs/js/checkin.js';

const CHECKED = ['2026-10-03', '2026-10-04', '2026-10-05'];

test('the streak counts days in a row up to today', () => {
  assert.equal(currentStreak(CHECKED, '2026-10-05'), 3);
});

test('before today\'s check-in the streak still counts up to yesterday', () => {
  assert.equal(currentStreak(CHECKED, '2026-10-06'), 3);
});

test('one missed day resets the streak, with no freeze', () => {
  assert.equal(currentStreak(CHECKED, '2026-10-07'), 0);
  assert.equal(currentStreak([...CHECKED, '2026-10-07'], '2026-10-07'), 1);
  assert.equal(currentStreak([], '2026-10-07'), 0);
});

test('the streak runs across month ends', () => {
  assert.equal(currentStreak(['2026-09-29', '2026-09-30', '2026-10-01'], '2026-10-01'), 3);
});

test('best streak is the longest run ever', () => {
  assert.equal(bestStreak(['2026-10-01', '2026-10-02', '2026-10-04', '2026-10-05', '2026-10-06', '2026-10-06']), 3);
  assert.equal(bestStreak([]), 0);
});

test('the week strip runs Monday to Sunday', () => {
  const strip = weekStrip(CHECKED, '2026-10-07'); // a Wednesday
  assert.deepEqual(strip.map((d) => d.day), ['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08',
    '2026-10-09', '2026-10-10', '2026-10-11']);
  assert.deepEqual(strip.map((d) => d.checkedIn), [true, false, false, false, false, false, false]);
  assert.equal(strip[2].isToday, true);
  assert.equal(strip[3].future, true);
});

test('the month calendar has every day of the month', () => {
  const oct = monthCalendar(CHECKED, '2026-10');
  assert.equal(oct.length, 31);
  assert.deepEqual(oct.filter((d) => d.checkedIn).map((d) => d.day), CHECKED);
  assert.equal(monthCalendar([], '2028-02').length, 29);
  assert.equal(monthCalendar([], '2026-12').at(-1).day, '2026-12-31');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/checkin.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\checkin.js'`.

- [ ] **Step 3: Write `docs/js/checkin.js`**

```js
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
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/checkin.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/checkin.js tests/js/checkin.test.mjs && git commit -F - <<'EOF'
feat(app): check-in streaks, week strip and month calendar

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 10: Tone-mark helpers (`docs/js/pinyin.js`)

The pinyin quiz needs to change one syllable's tone, for example 老师 lǎoshī to lǎoshì. That means finding each syllable inside the tone-marked pinyin and putting the mark on the right vowel. Unicode NFD is a way of storing text where "ǎ" is kept as "a" plus a separate mark, which makes this easy.

Card pinyin uses textbook word spacing, so the syllables must be found across spaces, hyphens and apostrophes, and the 儿 ending needs care. For example, 拔苗助长 is written "bámiáo-zhùzhǎng" and its numbered pinyin is "ba2 miao2 zhu4 zhang3". `syllableSpans` skips the hyphen and gives the positions [0, 2], [2, 6], [7, 10] and [10, 15], so changing the third syllable to tone 2 gives "bámiáo-zhúzhǎng", with the hyphen still in place. 一点儿 is "yìdiǎnr" with numbered pinyin "yi1 dian3 r5". Its "r" gets its own span, [6, 7], and `syllableCount` gives 2, because the 儿 ending is not a syllable of its own. `pyShape` gives the letters and spacing without tones ("bamiao-zhuzhang"), which Task 11 uses to check that a tone variant differs from the answer only in tone.

`spacingOf` gives a word's spacing as one joint per gap between syllables, so "bú kèqi" has the joints [' ', ''], and `inShape` writes another word in that spacing, so 对不起 "duìbuqǐ" becomes "duì buqǐ". An apostrophe is added before a syllable starting with a, o or e inside a word, and dropped where a space takes its place ("yílù-píng'ān" becomes "yílù píng'ān" in the spacing of "tōnghuò péngzhàng"). `syllableSpans` also skips the "…" of a pattern word ("suīrán…dànshì…"). Task 11 uses these to show every pinyin choice in the answer's spacing.

**Files:**
- Create: `docs/js/pinyin.js`
- Test: `tests/js/pinyin.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  changeTone, inShape, markTone, normPy, pyShape, spacingOf, stripTones, syllableCount, syllableSpans, syllables,
  toneOf,
} from '../../docs/js/pinyin.js';
import { loadFixture } from './helpers.mjs';

test('tones are read and removed, and ü is kept', () => {
  assert.equal(stripTones('lǜsè'), 'lüse');
  assert.equal(toneOf('lǜ'), 4);
  assert.equal(toneOf('hǎo'), 3);
  assert.equal(toneOf('ma'), 5);
});

test('tone marks go on the right vowel', () => {
  assert.equal(markTone('hao', 3), 'hǎo');
  assert.equal(markTone('lüe', 4), 'lüè');
  assert.equal(markTone('gui', 4), 'guì');
  assert.equal(markTone('liu', 2), 'liú');
  assert.equal(markTone('zhou', 1), 'zhōu');
  assert.equal(markTone('Bei', 3), 'Běi');
  assert.equal(markTone('nü', 3), 'nǚ');
  assert.equal(markTone('shí', 4), 'shì');
  assert.equal(markTone('ma', 5), 'ma');
});

test('normPy ignores case, spaces, apostrophes and hyphens but keeps tones', () => {
  assert.equal(normPy("Nǚ'ér "), 'nǚér');
  assert.equal(normPy('nǚ’ér'), 'nǚér');
  assert.equal(normPy('bú kèqi'), 'búkèqi');
  assert.equal(normPy('bámiáo-zhùzhǎng'), 'bámiáozhùzhǎng');
  assert.notEqual(normPy('mǎi'), normPy('mài'));
});

test('pyShape drops tones but keeps the word spacing', () => {
  assert.equal(pyShape('bú kèqi'), 'bu keqi');
  assert.equal(pyShape('bámiáo-zhùzhǎng'), 'bamiao-zhuzhang');
  assert.equal(pyShape('Xī’ān'), "xi'an");
  assert.equal(pyShape('yìdiǎnr'), pyShape('yídiǎnr'));
  assert.notEqual(pyShape('bámiáo-zhùzhǎng'), pyShape('bámiáo zhùzhǎng'));
});

test('numbered pinyin splits into syllables', () => {
  assert.deepEqual(syllables('nü3 er2'), [{ base: 'nü', tone: 3 }, { base: 'er', tone: 2 }]);
  assert.deepEqual(syllables('lu:4 se4'), [{ base: 'lü', tone: 4 }, { base: 'se', tone: 4 }]);
  assert.deepEqual(syllables('xie4 xie5'), [{ base: 'xie', tone: 4 }, { base: 'xie', tone: 5 }]);
  assert.deepEqual(syllables('ma'), [{ base: 'ma', tone: 5 }]);
  assert.deepEqual(syllables('yi1 dian3 r5'), [{ base: 'yi', tone: 1 }, { base: 'dian', tone: 3 }, { base: 'r', tone: 5 }]);
});

test('the 儿 ending is not counted as a syllable', () => {
  assert.equal(syllableCount('yi1 dian3 r5'), 2);
  assert.equal(syllableCount('nü3 er2'), 2);
  assert.equal(syllableCount('ba2 miao2 zhu4 zhang3'), 4);
  assert.equal(syllableCount('bu4 ke4 qi5'), 3);
});

test('syllables are found inside tone-marked pinyin', () => {
  assert.deepEqual(syllableSpans("nǚ'ér", 'nü3 er2'), [[0, 2], [3, 5]]);
  assert.deepEqual(syllableSpans('bú kèqi', 'bu4 ke4 qi5'), [[0, 2], [3, 5], [5, 7]]);
  assert.deepEqual(syllableSpans('Běijīng', 'bei3 jing1'), [[0, 3], [3, 7]]);
  assert.deepEqual(syllableSpans('méi guānxi', 'mei2 guan1 xi5'), [[0, 3], [4, 8], [8, 10]]);
  assert.deepEqual(syllableSpans('bámiáo-zhùzhǎng', 'ba2 miao2 zhu4 zhang3'), [[0, 2], [2, 6], [7, 10], [10, 15]]);
  assert.deepEqual(syllableSpans("yílù-píng'ān", 'yi1 lu4 ping2 an1'), [[0, 2], [2, 4], [5, 9], [10, 12]]);
  assert.deepEqual(syllableSpans('xī’ān', 'xi1 an1'), [[0, 2], [3, 5]]);
  assert.deepEqual(syllableSpans('yìdiǎnr', 'yi1 dian3 r5'), [[0, 2], [2, 6], [6, 7]]);
  assert.equal(syllableSpans('yìdiǎnr', 'yi1 dian3'), null);
  assert.equal(syllableSpans('píngguǒ', 'ping2'), null);
  assert.equal(syllableSpans('píngguǒ', 'pang2 guo3'), null);
});

test('one syllable\'s tone can be changed', () => {
  assert.equal(changeTone('bú kèqi', [3, 5], 2), 'bú kéqi');
  assert.equal(changeTone('lǎoshī', [3, 6], 4), 'lǎoshì');
});

test('changing a tone keeps the spaces, hyphens, apostrophes and 儿 ending', () => {
  assert.equal(changeTone('méi guānxi', [0, 3], 4), 'mèi guānxi');
  assert.equal(changeTone('bámiáo-zhùzhǎng', [7, 10], 2), 'bámiáo-zhúzhǎng');
  assert.equal(changeTone("yílù-píng'ān", [10, 12], 2), "yílù-píng'án");
  assert.equal(changeTone('yìdiǎnr', [2, 6], 1), 'yìdiānr');
});

test('the word spacing of a pinyin text is its joints and what follows the last syllable', () => {
  assert.deepEqual(spacingOf('bú kèqi', 'bu4 ke4 qi5'), { joints: [' ', ''], tail: '' });
  assert.deepEqual(spacingOf('bámiáo-zhùzhǎng', 'ba2 miao2 zhu4 zhang3'), { joints: ['', '-', ''], tail: '' });
  assert.deepEqual(spacingOf("nǚ'ér", 'nü3 er2'), { joints: [''], tail: '' });
  assert.deepEqual(spacingOf('yìdiǎnr', 'yi1 dian3 r5'), { joints: [''], tail: '' });
  assert.deepEqual(spacingOf('suīrán…dànshì…', 'sui1 ran2 dan4 shi4'), { joints: ['', '…', ''], tail: '…' });
  assert.equal(spacingOf('píngguǒ', 'ping2'), null);
});

test('a pinyin text can be rewritten in another word spacing', () => {
  assert.equal(inShape('duìbuqǐ', 'dui4 bu5 qi3', { joints: [' ', ''], tail: '' }), 'duì buqǐ');
  assert.equal(inShape('bú kèqi', 'bu4 ke4 qi5', { joints: ['', ''], tail: '' }), 'búkèqi');
  assert.equal(inShape('tōnghuò péngzhàng', 'tong1 huo4 peng2 zhang4', { joints: ['', '-', ''], tail: '' }),
    'tōnghuò-péngzhàng');
  assert.equal(inShape("yílù-píng'ān", 'yi1 lu4 ping2 an1', { joints: ['', ' ', ''], tail: '' }), "yílù píng'ān");
  assert.equal(inShape("nǚ'ér", 'nü3 er2', { joints: [' '], tail: '' }), 'nǚ ér');
  assert.equal(inShape('yìdiǎnr', 'yi1 dian3 r5', { joints: [' '], tail: '' }), 'yì diǎnr');
  assert.equal(inShape('tōnghuò péngzhàng', 'tong1 huo4 peng2 zhang4', { joints: ['', '…', ''], tail: '…' }),
    'tōnghuò…péngzhàng…');
  assert.equal(inShape('píngguǒ', 'ping2 guo3', { joints: ['', ''], tail: '' }), null);
});

test('every fixture word\'s py lines up with its pyNum, and syl leaves out the 儿 ending', () => {
  for (const w of loadFixture().words) {
    assert.ok(syllableSpans(w.py, w.pyNum), `${w.hz} ${w.py} ${w.pyNum}`);
    assert.equal(syllableCount(w.pyNum), w.syl, w.hz);
  }
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/pinyin.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\pinyin.js'`.

- [ ] **Step 3: Write `docs/js/pinyin.js`**

```js
// Pinyin helpers for quiz choices. Tones are numbered 1 (ā), 2 (á), 3 (ǎ) and 4 (à), and
// 5 is the neutral tone, which has no mark. Text is handled in Unicode NFD form, where a
// marked vowel is the plain vowel followed by a separate tone mark, so marks can be
// removed or added one by one.
//
// A card's py uses textbook word spacing. The syllables of one word are joined, words
// are separated by spaces, a four-character idiom that divides into two pairs is two
// joined pairs with a hyphen, an apostrophe comes before a syllable starting with a, o or
// e, and the 儿 ending is a bare "r" joined to the syllable before it. Examples: "bú kèqi",
// "bámiáo-zhùzhǎng", "xī'ān", "yìdiǎnr". In pyNum the 儿 ending is its own item "r5", so
// 一点儿 is "yi1 dian3 r5".
// A pattern word puts "…" after each half, as in "suīrán…dànshì…".
const MARKS = ['', '̄', '́', '̌', '̀'];
const TONE_MARK = /[̄́̌̀]/g;
const SEPARATORS = /[\s'’…-]/;

export function stripTones(text) {
  return text.normalize('NFD').replace(TONE_MARK, '').normalize('NFC');
}

// toneOf('hǎo') === 3, toneOf('ma') === 5.
export function toneOf(syllable) {
  const m = syllable.normalize('NFD').match(TONE_MARK);
  return m ? MARKS.indexOf(m[0]) : 5;
}

// The standard rule puts the tone mark on a or e if present, on the o of ou, and otherwise
// on the last vowel. For example, markTone('liu', 2) === 'liú', markTone('Bei', 3) === 'Běi'.
export function markTone(syllable, tone) {
  const bare = stripTones(syllable);
  if (tone < 1 || tone > 4) return bare;
  const lower = bare.toLowerCase();
  let i = lower.search(/[ae]/);
  if (i < 0) i = lower.indexOf('ou');
  if (i < 0) {
    for (let k = lower.length - 1; k >= 0; k--) {
      if ('iouü'.includes(lower[k])) { i = k; break; }
    }
  }
  if (i < 0) return bare;
  return (bare.slice(0, i + 1) + MARKS[tone] + bare.slice(i + 1)).normalize('NFC');
}

// normPy makes pinyin lower case and drops spaces, apostrophes and hyphens but keeps tone
// marks, so normPy("Nǚ'ér") === 'nǚér' and normPy('bú kèqi') === 'búkèqi'.
// Two words with the same normPy sound exactly alike.
export function normPy(py) {
  return py.normalize('NFC').toLowerCase().replace(/[\s'’-]/g, '');
}

// pyShape is the pinyin without tone marks, in lower case, with its spaces, hyphens and
// apostrophes kept (a curly apostrophe becomes a straight one). So
// pyShape('bámiáo-zhùzhǎng') === 'bamiao-zhuzhang' and pyShape('bú kèqi') === 'bu keqi'.
// Two pinyin texts with the same shape differ at most in their tones.
export function pyShape(py) {
  return stripTones(py.normalize('NFC')).toLowerCase().replace(/’/g, "'");
}

// syllables splits numbered pinyin, so syllables('nü3 er2') gives
// [{ base: 'nü', tone: 3 }, { base: 'er', tone: 2 }]. "u:" and "v" are read as ü.
// The 儿 ending "r5" gives { base: 'r', tone: 5 }.
export function syllables(pyNum) {
  return pyNum.trim().toLowerCase().split(/\s+/).map((s) => {
    const m = s.match(/^(.*?)([1-5])?$/);
    return { base: m[1].replace(/u:|v/g, 'ü'), tone: m[2] ? Number(m[2]) : 5 };
  });
}

// The number of syllables, leaving out the 儿 ending, which joins the syllable before it.
// syllableCount('yi1 dian3 r5') === 2, while syllableCount('nü3 er2') === 2 as well.
export function syllableCount(pyNum) {
  return syllables(pyNum).filter((s) => !(s.base === 'r' && s.tone === 5)).length;
}

// Where each item of pyNum sits inside the tone-marked py, as [start, end] positions.
// Spaces, hyphens, apostrophes and "…" between syllables are skipped, and a 儿 ending gets
// the span of its "r". syllableSpans('bú kèqi', 'bu4 ke4 qi5') gives [[0, 2], [3, 5], [5, 7]],
// and syllableSpans('yìdiǎnr', 'yi1 dian3 r5') gives [[0, 2], [2, 6], [6, 7]].
// Returns null when the two do not line up.
export function syllableSpans(py, pyNum) {
  const text = py.normalize('NFC');
  const spans = [];
  let i = 0;
  for (const { base } of syllables(pyNum)) {
    while (i < text.length && SEPARATORS.test(text[i])) i++;
    const start = i;
    for (const letter of base) {
      if (i >= text.length || stripTones(text[i]).toLowerCase() !== letter) return null;
      i++;
    }
    spans.push([start, i]);
  }
  return /[a-zü]/i.test(stripTones(text.slice(i))) ? null : spans;
}

// changeTone changes one syllable's tone and leaves everything else as it is, including
// the spaces, hyphens and apostrophes. changeTone('bú kèqi', [3, 5], 2) === 'bú kéqi'.
export function changeTone(py, [start, end], tone) {
  const text = py.normalize('NFC');
  return text.slice(0, start) + markTone(text.slice(start, end), tone) + text.slice(end);
}

// The word spacing of py is one joint per gap between two syllables, plus the text after
// the last syllable. A joint is '' inside a word, ' ' between words, '-' in the middle of an
// idiom and '…' between the halves of a pattern word. The 儿 ending is part of the syllable
// before it and has no joint of its own. An apostrophe is not a joint, because it only marks
// a syllable inside a word that starts with a, o or e.
// spacingOf('bú kèqi', 'bu4 ke4 qi5') gives { joints: [' ', ''], tail: '' }, and
// spacingOf('suīrán…dànshì…', 'sui1 ran2 dan4 shi4') gives { joints: ['', '…', ''], tail: '…' }.
// Returns null when py and pyNum do not line up.
export function spacingOf(py, pyNum) {
  const spans = syllableSpans(py, pyNum);
  if (!spans) return null;
  const text = py.normalize('NFC');
  const items = syllables(pyNum);
  const joints = [];
  for (let k = 1; k < spans.length; k++) {
    if (items[k].base === 'r' && items[k].tone === 5) continue;
    const gap = text.slice(spans[k - 1][1], spans[k][0]);
    joints.push(gap.includes('…') ? '…' : gap.includes('-') ? '-' : /\s/.test(gap) ? ' ' : '');
  }
  return { joints, tail: text.slice(spans.at(-1)[1]) };
}

// py rewritten in a given word spacing (from spacingOf), with its own syllables and tones.
// Inside a word a syllable starting with a, o or e gets an apostrophe, and the 儿 ending stays
// joined to its syllable. So a wrong choice can be shown with the spacing of the answer:
// inShape('duìbuqǐ', 'dui4 bu5 qi3', { joints: [' ', ''], tail: '' }) === 'duì buqǐ', and
// inShape("píng'ān", 'ping2 an1', { joints: [' '], tail: '' }) === 'píng ān'.
// Returns null when py and pyNum do not line up or the number of syllables differs.
export function inShape(py, pyNum, { joints, tail }) {
  const spans = syllableSpans(py, pyNum);
  if (!spans) return null;
  const text = py.normalize('NFC');
  const items = syllables(pyNum);
  let out = '';
  let n = 0;
  for (let k = 0; k < spans.length; k++) {
    const syllable = text.slice(spans[k][0], spans[k][1]);
    if (k === 0 || (items[k].base === 'r' && items[k].tone === 5)) {
      out += syllable;
      continue;
    }
    if (n >= joints.length) return null;
    const joint = joints[n++];
    out += (joint === '' && /^[aeo]/i.test(stripTones(syllable)) ? "'" : joint) + syllable;
  }
  return n === joints.length ? out + tail : null;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/pinyin.test.mjs`
Expected: `ℹ tests 12`, `ℹ pass 12`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/pinyin.js tests/js/pinyin.test.mjs && git commit -F - <<'EOF'
feat(app): pinyin tone-mark helpers with textbook word spacing

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 11: Wrong choices for quizzes (`docs/js/distractors.js`)

How the wrong choices are picked, with 买 (mǎi, "to buy", Food & Drink, verb, HSK 1) in the pinyin quiz at step 2 as the example:
1. Every word is first checked against the hard rules. It must not have the same characters, must not be in `noDistract`, and must share no meaning key with the answer. A meaning key is one sense of the English meaning in plain form. "to know (someone); to meet" gives the keys "know" and "meet". For the pinyin quiz a choice must also have the same number of syllables (`syl`, where the 儿 ending does not count) and different toneless pinyin.
2. Half the time from step 2, one slot is a tone variant. 卖 mài is a real word with the same toneless pinyin and the same spacing, so it is used. When no such real word exists, one syllable of the answer gets another tone, and everything else stays as it is. So 没关系 "méi guānxi" can become "mèi guānxi", and the idiom 一路平安 "yílù-píng'ān" can become "yǐlù-píng'ān", keeping its hyphen and apostrophe.
3. The other slots come from tiers, best first. The tiers are same theme, part of speech and level within 1 (吃 chī, 喝 hē), then same theme, then same part of speech and level within 1, then any word.
4. Choices already picked must not share a meaning key or toneless pinyin with each other.
5. In the pinyin quiz, a capital letter must not give the answer away. Names such as 北京 "Běijīng" start with a capital, and the real list has 20 of them. So each tier is first searched for words whose first letter has the answer's case (a name gets 中国 "Zhōngguó" before 米饭 "mǐfàn"), and only then for any word. Every wrong choice is also shown with the answer's capitals. For 北京 the real tone twin 背景 is shown as "Bèijǐng", a plain word used when names run out is shown as, say, "Zhuōzi", and for 背景 the tone twin 北京 is shown as "běijīng".
6. In the pinyin quiz, the word spacing must not give the answer away either. Each tier is searched first for real words that already have the answer's look, meaning the same word spacing, the same capitals and the same 儿 ending (`lookOf`), which are shown as they are, then for words with the answer's first capital and 儿 ending, and only then for any word. A choice whose spacing differs is shown in the answer's spacing, with the same separators at the same places between syllables (`inAnswerForm`). For 不客气 "bú kèqi" the real 没关系 "méi guānxi" comes first, and the other three-syllable words are shown as "duì buqǐ" and "fú wùyuán". For the idiom 拔苗助长 "bámiáo-zhùzhǎng", the compound 通货膨胀 "tōnghuò péngzhàng" is shown as "tōnghuò-péngzhàng" when no other idiom is left, and for 通货膨胀 a compound such as 素食主义 "sùshí zhǔyì" comes before the idiom shown as "bámiáo zhùzhǎng".
7. An answer with the 儿 ending (一点儿 "yìdiǎnr") gets at least two wrong choices that end in it, where the word list has them, because the look includes the 儿 ending. A made-up tone variant keeps the "r".

The test file checks every fixture word with `brokenRules` from Task 5. That check is given `distractors.js`'s own `meaningKeys`, so on its own it cannot catch a missing meaning rule. In the fixture, the only words with the same meaning are also each other's `noDistract`, and no two words have the same characters. So three tests near the end use a small hand-made word list inside the test file, and each names the one word that must never be offered:
- 长 cháng "long" and 长 zhǎng "to grow" have the same characters (the same-characters rule);
- 爸爸 "dad" lists 父亲 "father" in `noDistract`, and the two share no meaning key (the `noDistract` rule, checked from both sides);
- 妈妈 "mum; mother" and 母亲 "mother" share the key "mother" but list no `noDistract` (the rule against sharing a meaning with the answer).

Removing any one of these three rules from `distractors.js` makes one of these tests fail.

Two tests add four-character idioms to that hand-made list, written in the textbook way as two joined pairs with a hyphen. They check that a tone variant of an idiom keeps its hyphen and apostrophe. They also include a word made up only for the test, 八庙主张 "bāmiào zhǔzhāng". It has the same letters as 拔苗助长 "bámiáo-zhùzhǎng" but a space instead of the hyphen, so it differs in more than tone and must never be offered as 拔苗助长's tone variant.

The last three tests add names to the hand-made list (北京 "Běijīng", 中国, 汉语 and 长城) and the lower-case word 背景 "bèijǐng", which is 北京's real tone twin. They check that a name gets other names first, that every choice is shown with the answer's capitals, and that a name with too few other names gets plain words shown with a capital. `brokenRules` also checks the capitals of every pinyin quiz.

Two tests check the word spacing. One uses the fixture's 不客气, 对不起 and 没关系, and the other a small list with a four-syllable word in each of the three forms of the textbook rules (拔苗助长 as an idiom, 通货膨胀 as two words and 高速公路 joined), plus 素食主义 as two words. `brokenRules` also checks the spacing of every pinyin quiz. A third test puts two more compounds written as two words (市场经济, 足球比赛) and 素食主义 in another theme, and checks that 通货膨胀 always gets these real words as they are, never the reshaped idiom or joined word of its own theme.

One test checks the 儿 ending. 一点儿 "yìdiǎnr" sits with plain two-syllable words, and 一会儿, 一块儿 and 好玩儿 are in another theme. On every day, and at steps 0 and 2, at least two of its wrong choices end in "r", and `brokenRules`, which checks this rule on every pinyin quiz, finds nothing. The test also shows `brokenRules` naming the rule when only one choice ends in "r".

`distractors-real.test.mjs` runs the same rule checks on every word of the real data file. It is skipped until Plan 3 writes `docs/data/words_vNNN.json`.

**Files:**
- Create: `docs/js/distractors.js`
- Test: `tests/js/distractors.test.mjs`, `tests/js/distractors-real.test.mjs`

- [ ] **Step 1: Write the failing fixture test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildChoices, makePool, meaningKeys, pickDistractors } from '../../docs/js/distractors.js';
import { dayRange } from '../../docs/js/dates.js';
import { brokenRules, loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const pool = makePool(data.words);
const DAYS = dayRange('2026-10-01', 40);
const w = (hz) => word(data, hz);
const pick = (hz, quiz, day, step = 0) => pickDistractors(pool, w(hz), quiz, { day, step });
const hzOf = (choice) => data.words.find((x) => x.id === choice.id)?.hz;

test('meaning keys drop brackets, "to" and articles', () => {
  assert.deepEqual([...meaningKeys(w('认识'))], ['know', 'meet']);
  assert.deepEqual([...meaningKeys(w('两'))], ['two', 'both']);
  assert.deepEqual([...meaningKeys(w('您'))], ['you']);
  assert.deepEqual([...meaningKeys(w('高兴'))], ['happy', 'glad']);
});

test('every fixture word gets 3 valid wrong choices in both quizzes, on every day and step', () => {
  const problems = [];
  for (const answer of data.words) {
    for (const quiz of ['listen', 'pinyin']) {
      for (const day of DAYS.slice(0, 10)) {
        for (const step of [0, 1, 2, 5]) {
          const wrong = pickDistractors(pool, answer, quiz, { day, step });
          problems.push(...brokenRules(data.words, meaningKeys, answer, quiz, wrong, step));
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});

test('the listening quiz never offers exact homophones such as 他, 她 and 它 (all tā)', () => {
  for (const day of DAYS) {
    for (const hz of ['他', '她', '它']) {
      const offered = pick(hz, 'listen', day).map(hzOf);
      assert.ok(!offered.some((h) => ['他', '她', '它'].includes(h)), `${hz} on ${day}: ${offered}`);
    }
  }
});

test('same-meaning words never appear together', () => {
  const pairs = [['高兴', '快乐'], ['二', '两'], ['你', '您']];
  for (const day of DAYS) {
    for (const [a, b] of pairs) {
      for (const quiz of ['listen', 'pinyin']) {
        assert.ok(!pick(a, quiz, day, 3).map(hzOf).includes(b), `${a} ${quiz} ${day}`);
        assert.ok(!pick(b, quiz, day, 3).map(hzOf).includes(a), `${b} ${quiz} ${day}`);
      }
    }
  }
});

test('from step 2 a real tone twin can fill one pinyin slot, so 买 mǎi gets 卖 mài', () => {
  const at = (step) => DAYS.map((day) => pick('买', 'pinyin', day, step).filter((c) => c.toneVariant));
  assert.ok(at(0).every((v) => v.length === 0));
  assert.ok(at(1).every((v) => v.length === 0));
  const step2 = at(2);
  assert.ok(step2.some((v) => v.length === 1));
  assert.ok(step2.every((v) => v.length === 0 || (v[0].text === 'mài' && hzOf(v[0]) === '卖')));
});

test('without a real twin, one syllable\'s tone is changed to a tone a real word uses', () => {
  // For 老师 lǎoshī, shi2 (十) and shi4 (是) exist in the list, while lao1, lao2 and lao4 do not.
  const variants = DAYS.flatMap((day) => pick('老师', 'pinyin', day, 2).filter((c) => c.toneVariant));
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === null && ['lǎoshí', 'lǎoshì'].includes(v.text)));
});

test('a made-up tone variant keeps the word spacing of the answer, so 没关系 méi guānxi gets mèi guānxi', () => {
  // mei4 (妹妹) is the only other tone of mei in the fixture, and guan has no other tone.
  const variants = DAYS.flatMap((day) => pick('没关系', 'pinyin', day, 2).filter((c) => c.toneVariant));
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === null && v.text === 'mèi guānxi'));
});

test('a tone variant never uses the dictionary tone of a sandhi syllable', () => {
  // 不客气 is shown as "bú kèqi", but bu4 is its dictionary tone, so "bù kèqi" is not wrong.
  const texts = DAYS.flatMap((day) => pick('不客气', 'pinyin', day, 3).map((c) => c.text));
  assert.ok(!texts.includes('bù kèqi'));
});

test('every pinyin choice has the answer\'s word spacing, so 不客气 "bú kèqi" gets "duì buqǐ"', () => {
  // 不客气 is 不 + 客气, and 对不起 "duìbuqǐ", 没关系 "méi guānxi" and 服务员 "fúwùyuán" are its
  // wrong choices. For the joined answer 对不起, the others are shown joined.
  const shown = new Map();
  for (const day of DAYS) {
    for (const [hz, step] of [['不客气', 1], ['对不起', 1], ['不客气', 3]]) {
      for (const c of pick(hz, 'pinyin', day, step)) shown.set(`${hz} ${hzOf(c) ?? 'variant'}`, c.text);
    }
  }
  assert.equal(shown.get('不客气 对不起'), 'duì buqǐ');
  assert.equal(shown.get('不客气 没关系'), 'méi guānxi');
  assert.equal(shown.get('不客气 服务员'), 'fú wùyuán');
  assert.equal(shown.get('对不起 不客气'), 'búkèqi');
  assert.equal(shown.get('对不起 没关系'), 'méiguānxi');
});

test('wrong choices come from the same theme first, then wider tiers', () => {
  // 爸爸 (Family & People, n., HSK 1) has enough same-theme nouns of a similar length.
  for (const day of DAYS.slice(0, 10)) {
    assert.ok(pick('爸爸', 'listen', day).every((c) => data.words.find((x) => x.id === c.id).theme === 't04'));
  }
  // 不客气 has 3 syllables and no part of speech, so the 2 other Greetings words with
  // 3 syllables come first, then 服务员 from the "anything" tier.
  for (const day of DAYS.slice(0, 10)) {
    const offered = pick('不客气', 'pinyin', day, 1).map(hzOf);
    assert.deepEqual(offered.slice(0, 2).sort(), ['对不起', '没关系'].sort());
    assert.equal(offered[2], '服务员');
  }
});

test('choices are fixed for a word and day, and change between days', () => {
  assert.deepEqual(pick('苹果', 'listen', '2026-10-06'), pick('苹果', 'listen', '2026-10-06'));
  const seen = new Set(DAYS.map((day) => JSON.stringify(pick('苹果', 'listen', day))));
  assert.ok(seen.size > 1);
});

test('buildChoices gives 4 choices with the answer at answerIndex', () => {
  const { choices, answerIndex } = buildChoices(pool, w('苹果'), 'listen', { day: '2026-10-06' });
  assert.equal(choices.length, 4);
  assert.equal(choices.filter((c) => c.correct).length, 1);
  assert.deepEqual(choices[answerIndex], { id: w('苹果').id, text: 'apple', toneVariant: false, correct: true });
  assert.deepEqual(buildChoices(pool, w('苹果'), 'listen', { day: '2026-10-06' }).choices, choices);
  const positions = new Set(DAYS.map((day) => buildChoices(pool, w('苹果'), 'pinyin', { day }).answerIndex));
  assert.deepEqual([...positions].sort(), [0, 1, 2, 3]);
  assert.throws(() => buildChoices(pool, w('苹果'), 'recall', { day: '2026-10-06' }), /No choices/);
});

// A small hand-made word list for three rules the fixture cannot test on its own, kept
// here so the fixture stays as it is. Each pair sits alone in its own theme, where wrong
// choices are looked for first, and 8 plain words sit in theme t02. So if a rule were
// missing, the word it forbids would be picked on every day.
const mini = (id, hz, py, pyNum, pyBase, pos, en, enShort, theme, noDistract = []) =>
  ({ id, hz, py, pyNum, pyBase, syl: pyNum.split(' ').length, lv: 1, pos: [pos], en, enShort, theme, noDistract });
const PLAIN = [
  ['水', 'shuǐ', 'shui3', 'shui', 'water'], ['书', 'shū', 'shu1', 'shu', 'book'],
  ['茶', 'chá', 'cha2', 'cha', 'tea'], ['猫', 'māo', 'mao1', 'mao', 'cat'],
  ['桌子', 'zhuōzi', 'zhuo1 zi5', 'zhuozi', 'table'], ['椅子', 'yǐzi', 'yi3 zi5', 'yizi', 'chair'],
  ['面包', 'miànbāo', 'mian4 bao1', 'mianbao', 'bread'], ['手机', 'shǒujī', 'shou3 ji1', 'shouji', 'phone'],
];
const MINI = [
  mini('m01', '长', 'cháng', 'chang2', 'chang', 'adj.', 'long', 'long', 't01'),
  mini('m02', '长', 'zhǎng', 'zhang3', 'zhang', 'v.', 'to grow', 'to grow', 't01'),
  mini('m03', '爸爸', 'bàba', 'ba4 ba5', 'baba', 'n.', 'dad', 'dad', 't03', ['m04']),
  mini('m04', '父亲', 'fùqin', 'fu4 qin5', 'fuqin', 'n.', 'father', 'father', 't03'),
  mini('m05', '妈妈', 'māma', 'ma1 ma5', 'mama', 'n.', 'mum; mother', 'mum', 't04'),
  mini('m06', '母亲', 'mǔqin', 'mu3 qin5', 'muqin', 'n.', 'mother', 'mother', 't04'),
  ...PLAIN.map(([hz, py, pyNum, pyBase, en], i) => mini(`m${10 + i}`, hz, py, pyNum, pyBase, 'n.', en, en, 't02')),
];
const miniPool = makePool(MINI);

// The IDs of every wrong choice offered for this word, in both quizzes, over 40 days.
function offeredFor(id) {
  const answer = MINI.find((x) => x.id === id);
  const ids = new Set();
  for (const day of DAYS) {
    for (const quiz of ['listen', 'pinyin']) {
      const wrong = pickDistractors(miniPool, answer, quiz, { day });
      assert.equal(wrong.length, 3, `${answer.hz} ${quiz} ${day}`);
      wrong.forEach((c) => ids.add(c.id));
    }
  }
  return ids;
}

test('a word with the same characters is never offered, so 长 cháng never gets 长 zhǎng', () => {
  assert.ok(!offeredFor('m01').has('m02'));
  assert.ok(!offeredFor('m02').has('m01'));
});

test('a noDistract word is never offered, even when no meaning key is shared', () => {
  // "dad" and "father" share no key. Only 爸爸 lists 父亲, so the second line checks
  // that the rule also works from the other side.
  assert.ok(!offeredFor('m03').has('m04'));
  assert.ok(!offeredFor('m04').has('m03'));
});

test('a word sharing a meaning key with the answer is never offered, even without noDistract', () => {
  // 妈妈 "mum; mother" and 母亲 "mother" share the key "mother" and list no noDistract.
  assert.ok(!offeredFor('m05').has('m06'));
  assert.ok(!offeredFor('m06').has('m05'));
});

// Four-character idioms in textbook spelling, two joined pairs with a hyphen, added to
// the small list above. 八庙主张 is made up for this test. Its pinyin has the same letters
// as 拔苗助长 but a space where the idiom has a hyphen, so it differs in more than tone.
const IDIOM_LIST = [
  ...MINI,
  mini('m20', '拔苗助长', 'bámiáo-zhùzhǎng', 'ba2 miao2 zhu4 zhang3', 'bamiaozhuzhang', 'v.', 'to spoil things through haste', 'to rush things', 't05'),
  mini('m21', '一路平安', "yílù-píng'ān", 'yi1 lu4 ping2 an1', 'yilupingan', 'v.', 'to have a safe journey', 'safe journey', 't05'),
  mini('m22', '画蛇添足', 'huàshé-tiānzú', 'hua4 she2 tian1 zu2', 'huashetianzu', 'v.', 'to ruin something by adding to it', 'to overdo it', 't05'),
  mini('m23', '自言自语', 'zìyán-zìyǔ', 'zi4 yan2 zi4 yu3', 'ziyanziyu', 'v.', 'to talk to oneself', 'to talk to oneself', 't05'),
  mini('m24', '八庙主张', 'bāmiào zhǔzhāng', 'ba1 miao4 zhu3 zhang1', 'bamiaozhuzhang', 'n.', 'made-up test word', 'made-up test word', 't06'),
];
const idiomPool = makePool(IDIOM_LIST);
const idiomVariants = (id) => DAYS.flatMap((day) => {
  const answer = IDIOM_LIST.find((x) => x.id === id);
  const wrong = pickDistractors(idiomPool, answer, 'pinyin', { day, step: 2 });
  assert.deepEqual(brokenRules(IDIOM_LIST, meaningKeys, answer, 'pinyin', wrong, 2), []);
  return wrong.filter((c) => c.toneVariant);
});

test('a tone variant of an idiom keeps its hyphen and apostrophe', () => {
  // yílù is yi1 lu4 in the dictionary, and yi3 (椅子) is the only other tone of yi in use.
  const variants = idiomVariants('m21');
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.text === "yǐlù-píng'ān"));
});

test('a real word with the same letters but other spacing is never a tone variant', () => {
  const variants = idiomVariants('m20');
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === null && /^b.mi.o-zh.zh.ng$/.test(v.text)), JSON.stringify(variants));
});

// Names start with a capital ("Běijīng"). If only the answer had one, the capital would give
// it away, and for a lower-case answer a capitalised wrong choice would stand out. The fixture
// has no names, so they are added to the small list above. 背景 "bèijǐng" is the real tone
// twin of 北京 "Běijīng", and 中国, 汉语 and 长城 are names in another theme.
const NAME_LIST = [
  ...MINI,
  mini('m30', '北京', 'Běijīng', 'bei3 jing1', 'beijing', 'n.', 'Beijing', 'Beijing', 't07'),
  mini('m31', '背景', 'bèijǐng', 'bei4 jing3', 'beijing', 'n.', 'background', 'background', 't07'),
  mini('m32', '中国', 'Zhōngguó', 'zhong1 guo2', 'zhongguo', 'n.', 'China', 'China', 't08'),
  mini('m33', '汉语', 'Hànyǔ', 'han4 yu3', 'hanyu', 'n.', 'Chinese language', 'Chinese', 't08'),
  mini('m34', '长城', 'Chángchéng', 'chang2 cheng2', 'changcheng', 'n.', 'the Great Wall', 'the Great Wall', 't08'),
];
// The wrong choices of the pinyin quiz at step 2 on each of the 40 days, checked with brokenRules.
const pinyinPicks = (list, id) => {
  const listPool = makePool(list);
  const answer = list.find((x) => x.id === id);
  return DAYS.flatMap((day) => {
    const wrong = pickDistractors(listPool, answer, 'pinyin', { day, step: 2 });
    assert.deepEqual(brokenRules(list, meaningKeys, answer, 'pinyin', wrong, 2), []);
    return wrong;
  });
};

// Four-syllable words in each of the three forms of the textbook rules, which are an idiom
// with a hyphen, a compound written as two words, and one word written joined.
const FOUR_LIST = [
  ...MINI,
  IDIOM_LIST.find((x) => x.id === 'm20'),
  mini('m25', '通货膨胀', 'tōnghuò péngzhàng', 'tong1 huo4 peng2 zhang4', 'tonghuopengzhang', 'n.', 'inflation', 'inflation', 't05'),
  mini('m26', '高速公路', 'gāosùgōnglù', 'gao1 su4 gong1 lu4', 'gaosugonglu', 'n.', 'expressway', 'expressway', 't05'),
  mini('m27', '素食主义', 'sùshí zhǔyì', 'su4 shi2 zhu3 yi4', 'sushizhuyi', 'n.', 'vegetarianism', 'vegetarianism', 't05'),
];

test('four-syllable choices take the answer\'s form: idiom, two words or joined', () => {
  const shown = (id) => new Set(pinyinPicks(FOUR_LIST, id).filter((c) => !c.toneVariant).map((c) => c.text));
  assert.deepEqual([...shown('m20')].sort(), ['gāosù-gōnglù', 'sùshí-zhǔyì', 'tōnghuò-péngzhàng']);
  assert.deepEqual([...shown('m25')].sort(), ['bámiáo zhùzhǎng', 'gāosù gōnglù', 'sùshí zhǔyì']);
  assert.deepEqual([...shown('m26')].sort(), ['bámiáozhùzhǎng', 'sùshízhǔyì', 'tōnghuòpéngzhàng']);
});

test('a real word that already has the answer\'s look comes before one that must be reshaped', () => {
  // 通货膨胀 "tōnghuò péngzhàng" is two words. The idiom and the joined word of its own theme would have to be
  // reshaped, while three words of another theme are already written as two words, so they are chosen.
  const list = [
    ...FOUR_LIST,
    mini('m28', '市场经济', 'shìchǎng jīngjì', 'shi4 chang3 jing1 ji4', 'shichangjingji', 'n.', 'market economy', 'market economy', 't09'),
    mini('m29', '足球比赛', 'zúqiú bǐsài', 'zu2 qiu2 bi3 sai4', 'zuqiubisai', 'n.', 'football match', 'football match', 't09'),
  ].map((w) => (w.id === 'm27' ? { ...w, theme: 't09' } : w));
  const picked = pinyinPicks(list, 'm25').filter((c) => !c.toneVariant);
  assert.ok(picked.length > 0);
  for (const c of picked) {
    assert.ok(['m27', 'm28', 'm29'].includes(c.id), c.text);
    assert.equal(c.text, list.find((x) => x.id === c.id).py);
  }
});

test('an answer with the 儿 ending gets at least two choices that end in it', () => {
  // 一点儿 "yìdiǎnr" sits with plain two-syllable words, and three words with the 儿 ending are in another theme.
  const erhua = (id, hz, py, pyNum, pyBase, en, theme) => ({ ...mini(id, hz, py, pyNum, pyBase, 'n.', en, en, theme), syl: 2 });
  const list = [
    ...MINI,
    erhua('m40', '一点儿', 'yìdiǎnr', 'yi1 dian3 r5', 'yidianr', 'a little', 't02'),
    erhua('m41', '一会儿', 'yíhuìr', 'yi1 hui4 r5', 'yihuir', 'a moment', 't10'),
    erhua('m42', '一块儿', 'yíkuàir', 'yi1 kuai4 r5', 'yikuair', 'together', 't10'),
    erhua('m43', '好玩儿', 'hǎowánr', 'hao3 wan2 r5', 'haowanr', 'fun', 't10'),
  ];
  const listPool = makePool(list);
  const answer = list.find((x) => x.id === 'm40');
  for (const day of DAYS) {
    for (const step of [0, 2]) {
      const wrong = pickDistractors(listPool, answer, 'pinyin', { day, step });
      assert.deepEqual(brokenRules(list, meaningKeys, answer, 'pinyin', wrong, step), []);
      assert.ok(wrong.filter((c) => c.text.endsWith('r')).length >= 2, wrong.map((c) => c.text).join(' '));
    }
  }
  // brokenRules finds the broken rule when only one choice ends in the 儿 ending.
  const plain = [{ id: 'm14', text: 'zhuōzi', toneVariant: false }, { id: 'm15', text: 'yǐzi', toneVariant: false }];
  assert.deepEqual(brokenRules(list, meaningKeys, answer, 'pinyin', [...plain, { id: 'm41', text: 'yíhuìr', toneVariant: false }], 0),
    ['一点儿 pinyin: only 1 choices end in the 儿 ending, although 3 words could']);
});

test('a name gets other names as wrong choices, and its tone twin is shown with a capital', () => {
  const picked = pinyinPicks(NAME_LIST, 'm30');
  assert.ok(picked.some((c) => c.toneVariant));
  assert.ok(picked.every((c) => (c.toneVariant ? c.id === 'm31' && c.text === 'Bèijǐng' : ['m32', 'm33', 'm34'].includes(c.id))),
    picked.map((c) => c.text).join(' '));
});

test('a lower-case answer shows a name in lower case, so 背景 bèijǐng gets běijīng', () => {
  const picked = pinyinPicks(NAME_LIST, 'm31');
  const variants = picked.filter((c) => c.toneVariant);
  assert.ok(variants.length > 0);
  assert.ok(variants.every((v) => v.id === 'm30' && v.text === 'běijīng'));
  assert.ok(picked.every((c) => !['m32', 'm33', 'm34'].includes(c.id)));
});

test('with too few other names, a name gets other words shown with a capital', () => {
  // 北京 is the only name here, so its wrong choices are plain words such as 桌子 "Zhuōzi".
  const list = [...MINI, NAME_LIST.find((x) => x.id === 'm30')];
  const picked = pinyinPicks(list, 'm30');
  assert.equal(picked.length, 3 * DAYS.length);
  for (const c of picked) {
    const py = list.find((x) => x.id === c.id).py;
    assert.equal(c.text, py[0].toUpperCase() + py.slice(1));
  }
});
```

- [ ] **Step 2: Write the real-data test**

```js
// Runs the quiz-choice rules on every word of the real data file, once Plan 3 has
// written docs/data/words_vNNN.json. Until then the test is skipped.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { buildChoices, makePool, meaningKeys, pickDistractors } from '../../docs/js/distractors.js';
import { brokenRules } from './helpers.mjs';

const dataDir = new URL('../../docs/data/', import.meta.url);
const files = existsSync(dataDir) ? readdirSync(dataDir).filter((f) => /^words_v\d{3}\.json$/.test(f)).sort() : [];

test('every real word gets 3 valid wrong choices', { skip: files.length === 0 && 'no docs/data/words_vNNN.json yet' }, () => {
  const data = JSON.parse(readFileSync(new URL(files.at(-1), dataDir), 'utf8'));
  const pool = makePool(data.words);
  const problems = [];
  for (const answer of data.words) {
    for (const quiz of ['listen', 'pinyin']) {
      const wrong = pickDistractors(pool, answer, quiz, { day: '2026-10-05', step: 2 });
      problems.push(...brokenRules(data.words, meaningKeys, answer, quiz, wrong, 2));
    }
  }
  for (const answer of data.words.slice(0, 100)) {
    assert.equal(buildChoices(pool, answer, 'pinyin', { day: '2026-10-05', step: 2 }).choices.length, 4);
  }
  assert.deepEqual(problems.slice(0, 20), []);
});
```

- [ ] **Step 3: Run them and see them fail**

Run: `node --test tests/js/distractors.test.mjs tests/js/distractors-real.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\distractors.js'`, `ℹ fail 2`.

- [ ] **Step 4: Write `docs/js/distractors.js`**

```js
// Wrong choices ("distractors") for the two multiple-choice quizzes:
//   'listen'  the sound plays, pick the English meaning (choices show enShort)
//   'pinyin'  the meaning is shown, pick the pinyin (choices show py)
// Choices stay the same for a word on a study day, because the random generator is
// seeded by the word's ID and the day.
import { CONFIG } from './config.js';
import { seeded, shuffled } from './rng.js';
import {
  changeTone, inShape, normPy, pyShape, spacingOf, stripTones, syllableSpans, syllables, toneOf,
} from './pinyin.js';

// The meaning keys of a word are the senses of en and enShort, in lower case, without
// brackets and without a leading "to", "a", "an" or "the".
// For example, en "to know (someone); to meet" gives the keys "know" and "meet".
// Two words that share a key mean the same thing, so they never appear together.
export function meaningKeys(word) {
  const keys = new Set();
  for (const text of [word.en, word.enShort]) {
    for (const part of text.toLowerCase().replace(/\([^)]*\)/g, ' ').split(/[;,/]/)) {
      const key = part.replace(/[^a-z0-9' ]/g, ' ').replace(/\s+/g, ' ').trim().replace(/^(to|a|an|the) /, '');
      if (key) keys.add(key);
    }
  }
  return keys;
}

// makePool does the work needed once per word list. It keeps the meaning keys, each word's
// exact sound (normPy), its look in the pinyin quiz (lookOf), and every syllable-and-tone pair
// that some real word uses (for example 'shi4'), which decides which tone changes are valid.
export function makePool(words) {
  const toneSet = new Set();
  for (const w of words) {
    for (const { base, tone } of syllables(w.pyNum)) if (tone <= 4) toneSet.add(`${base}${tone}`);
  }
  return {
    words,
    keys: new Map(words.map((w) => [w.id, meaningKeys(w)])),
    sound: new Map(words.map((w) => [w.id, normPy(w.py)])),
    look: new Map(words.map((w) => [w.id, lookOf(w)])),
    toneSet,
  };
}

// A name such as 北京 "Běijīng" starts with a capital letter. In the pinyin quiz every choice
// is shown with the answer's capitals, word by word, so a capital never tells the answer apart.
// For 北京 the real word 背景 "bèijǐng" is shown as "Bèijǐng", and for 背景 the name 北京 is
// shown as "běijīng".
const isCapital = (py) => /^\p{Lu}/u.test(py.normalize('NFC'));
export function inCaseOf(py, answerPy) {
  const capitals = answerPy.normalize('NFC').split(' ').map(isCapital);
  return py.normalize('NFC').toLowerCase().split(' ')
    .map((part, i) => ((capitals[i] ?? capitals[0]) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(' ');
}

// In the pinyin quiz every choice is also shown in the answer's word spacing, so a space or
// a hyphen never tells the answer apart either. The choices have the answer's number of
// syllables, so this always works. For 不客气 "bú kèqi", 对不起 "duìbuqǐ" is shown as
// "duì buqǐ", and for 拔苗助长 "bámiáo-zhùzhǎng", 飞禽走兽 "fēiqín zǒushòu" would be shown as
// "fēiqín-zǒushòu". The syllables, tones and 儿 ending stay as they are.
export function inAnswerForm(w, answer) {
  const shape = spacingOf(answer.py, answer.pyNum);
  const spaced = shape && inShape(w.py, w.pyNum, shape);
  return inCaseOf(spaced || w.py, answer.py);
}

// The look of a word's pinyin is its word spacing, which of its words start with a capital, and
// whether it ends in the 儿 ending, because each of these could tell the answer apart. So
// 不客气 "bú kèqi" and 没关系 "méi guānxi" look alike, while 对不起 "duìbuqǐ" does not, and
// 一点儿 "yìdiǎnr" looks like 一会儿 "yíhuìr" but not like 一样 "yíyàng".
const endsInR = (w) => w.pyNum.trim().split(/\s+/).at(-1) === 'r5';
function lookOf(w) {
  const shape = spacingOf(w.py, w.pyNum);
  return JSON.stringify([shape && shape.joints, shape && shape.tail, w.py.normalize('NFC').split(' ').map(isCapital),
    endsInR(w)]);
}

// A wrong choice shows the English meaning, or the pinyin in the answer's form.
const textOf = (w, quiz, answer) => (quiz === 'listen' ? w.enShort : inAnswerForm(w, answer));
const posShare = (a, b) => a.pos.some((p) => b.pos.includes(p));
const nearLevel = (a, b) => Math.abs(a.lv - b.lv) <= 1;

// Where wrong choices come from, best first.
const TIERS = [
  (a, c) => c.theme === a.theme && posShare(a, c) && nearLevel(a, c),
  (a, c) => c.theme === a.theme,
  (a, c) => posShare(a, c) && nearLevel(a, c),
  () => true,
];

function sharesKey(pool, a, b) {
  const kb = pool.keys.get(b.id);
  for (const k of pool.keys.get(a.id)) if (kb.has(k)) return true;
  return false;
}

// Rules every wrong choice follows, whatever the quiz.
function neverWith(pool, answer, c) {
  return c.id === answer.id || c.hz === answer.hz || answer.noDistract.includes(c.id)
    || c.noDistract.includes(answer.id) || sharesKey(pool, answer, c);
}

// The quick checks run first, and the meaning-key comparison last.
function allowed(pool, answer, c, quiz) {
  if (quiz === 'listen') {
    const len = answer.enShort.length;
    if (c.enShort.length * 2 < len || c.enShort.length > len * 2) return false;
    if (pool.sound.get(c.id) === pool.sound.get(answer.id)) return false;
  } else if (c.syl !== answer.syl || c.pyBase === answer.pyBase) {
    return false;
  }
  return !neverWith(pool, answer, c);
}

function fitsWith(pool, answer, c, chosen, quiz) {
  return chosen.every((o) => o.text !== textOf(c, quiz, answer) && (!o.word
    || (!sharesKey(pool, o.word, c) && (quiz !== 'pinyin' || o.word.pyBase !== c.pyBase))));
}

// A pinyin choice that differs from the answer only in tone, with the same spaces,
// hyphens and apostrophes. A real word with the same letters and the same word spacing
// comes first (买 mǎi gets 卖 mài). Otherwise one syllable of the answer gets another
// tone that some real word uses (老师 lǎoshī can become lǎoshí or lǎoshì, and
// 没关系 méi guānxi can become mèi guānxi). changeTone only touches that one syllable,
// so a made-up variant always keeps the answer's spacing.
function toneVariant(pool, answer, rand) {
  const shape = pyShape(answer.py);
  const real = pool.words.filter((c) => c.pyBase === answer.pyBase && c.syl === answer.syl
    && pool.sound.get(c.id) !== pool.sound.get(answer.id) && pyShape(c.py) === shape
    && !neverWith(pool, answer, c));
  if (real.length) {
    const c = real[Math.floor(rand() * real.length)];
    return { id: c.id, text: inCaseOf(c.py, answer.py), toneVariant: true, word: c };
  }
  const spans = syllableSpans(answer.py, answer.pyNum);
  if (!spans) return null;
  const dictionaryTones = syllables(answer.pyNum).map((s) => s.tone);
  const options = [];
  spans.forEach(([start, end], i) => {
    const syllable = answer.py.normalize('NFC').slice(start, end);
    const current = toneOf(syllable);
    const base = stripTones(syllable).toLowerCase();
    // A neutral-tone syllable and the 儿 ending (its span is the bare "r") are left alone.
    if (current === 5) return;
    // The dictionary tone is skipped too, because 不客气 is shown as "bú kèqi" while "bù"
    // is its dictionary tone, so "bù kèqi" would not be wrong.
    for (let t = 1; t <= 4; t++) {
      if (t !== current && t !== dictionaryTones[i] && pool.toneSet.has(`${base}${t}`)) options.push([i, t]);
    }
  });
  if (!options.length) return null;
  const [i, t] = options[Math.floor(rand() * options.length)];
  return { id: null, text: changeTone(answer.py, spans[i], t), toneVariant: true, word: null };
}

// Up to 3 wrong choices as [{ id, text, toneVariant }]. id is null for a made-up tone variant.
// `step` is the word's ladder step; tone variants are allowed from step 2 on.
export function pickDistractors(pool, answer, quiz, { day, step = 0 }) {
  if (quiz !== 'listen' && quiz !== 'pinyin') throw new Error(`No choices for quiz ${quiz}`);
  const rand = seeded(answer.id, day);
  const chosen = [];
  if (quiz === 'pinyin' && step >= 2 && rand() < CONFIG.toneVariantChance) {
    const variant = toneVariant(pool, answer, rand);
    if (variant) chosen.push(variant);
  }
  const candidates = pool.words.filter((c) => allowed(pool, answer, c, quiz));
  // In the pinyin quiz, the tiers are first searched for real words that already look like the
  // answer, with the same word spacing, capitals and 儿 ending (lookOf), shown as they are.
  // So 不客气 "bú kèqi" gets 没关系 "méi guānxi" first, a name gets other names (北京 gets 中国 or
  // 长城 before 米饭), and 一点儿 "yìdiǎnr" gets words that end in the 儿 ending, at least two
  // where the list has them. Next come words with the answer's first capital and 儿 ending, shown
  // in its spacing, and only then any word, shown in its spacing and capitals.
  const passes = quiz === 'pinyin'
    ? [(c) => pool.look.get(c.id) === pool.look.get(answer.id),
      (c) => isCapital(c.py) === isCapital(answer.py) && endsInR(c) === endsInR(answer), () => true]
    : [() => true];
  for (const pass of passes) {
    for (const tier of TIERS) {
      if (chosen.length >= CONFIG.wrongChoices) break;
      const fresh = candidates.filter((c) => pass(c) && tier(answer, c) && !chosen.some((o) => o.id === c.id));
      for (const c of shuffled(fresh, rand)) {
        if (chosen.length >= CONFIG.wrongChoices) break;
        if (fitsWith(pool, answer, c, chosen, quiz)) {
          chosen.push({ id: c.id, text: textOf(c, quiz, answer), toneVariant: false, word: c });
        }
      }
    }
  }
  return chosen.map(({ id, text, toneVariant: tv }) => ({ id, text, toneVariant: tv }));
}

// The four choices in a fixed shuffled order, and where the right one is.
export function buildChoices(pool, answer, quiz, { day, step = 0 }) {
  const wrong = pickDistractors(pool, answer, quiz, { day, step });
  const rand = seeded(answer.id, day, 'order');
  const answerIndex = Math.floor(rand() * (wrong.length + 1));
  const choices = wrong.map((w) => ({ ...w, correct: false }));
  const text = quiz === 'listen' ? answer.enShort : answer.py;
  choices.splice(answerIndex, 0, { id: answer.id, text, toneVariant: false, correct: true });
  return { choices, answerIndex };
}
```

- [ ] **Step 5: Run them and see them pass**

Run: `node --test tests/js/distractors.test.mjs tests/js/distractors-real.test.mjs`
Expected: `ℹ tests 24`, `ℹ pass 23`, `ℹ fail 0`, `ℹ skipped 1` (the real-data test, until Plan 3).

- [ ] **Step 6: Commit**

```bash
git add docs/js/distractors.js tests/js/distractors.test.mjs tests/js/distractors-real.test.mjs && git commit -F - <<'EOF'
feat(app): quiz wrong choices with meaning, homophone, tone, capital and spacing rules

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 12: Badges (`docs/js/badges.js`)

**Files:**
- Create: `docs/js/badges.js`
- Test: `tests/js/badges.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { badgeTitle, earnedBadges, newBadges } from '../../docs/js/badges.js';

const NONE = { bestStreak: 0, checkIns: 0, learned: 0, mastered: 0, totalWords: 5000, themesDone: [], levelsDone: [], perfectSession: false };

test('nothing earned at the start', () => {
  assert.deepEqual(earnedBadges(NONE), []);
});

test('streak badges at 7, 30, 100 and 365 days', () => {
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 6 }), []);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 7 }), ['streak-7']);
  assert.deepEqual(earnedBadges({ ...NONE, bestStreak: 365 }), ['streak-7', 'streak-30', 'streak-100', 'streak-365']);
});

test('check-in badges at 10, 50 and 200', () => {
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 49 }), ['checkins-10']);
  assert.deepEqual(earnedBadges({ ...NONE, checkIns: 200 }), ['checkins-10', 'checkins-50', 'checkins-200']);
});

test('learned badges from 50 to all words', () => {
  assert.deepEqual(earnedBadges({ ...NONE, learned: 499 }), ['learned-50', 'learned-100']);
  assert.deepEqual(earnedBadges({ ...NONE, learned: 3000 }),
    ['learned-50', 'learned-100', 'learned-500', 'learned-1000', 'learned-2000', 'learned-3000']);
  assert.ok(earnedBadges({ ...NONE, learned: 5000 }).includes('learned-all'));
  assert.ok(!earnedBadges({ ...NONE, learned: 4999 }).includes('learned-all'));
});

test('mastered badges at 100, 500, 1000 and 2500', () => {
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 999 }), ['mastered-100', 'mastered-500']);
  assert.deepEqual(earnedBadges({ ...NONE, mastered: 2500 }), ['mastered-100', 'mastered-500', 'mastered-1000', 'mastered-2500']);
});

test('one badge per finished theme and HSK level, and one for a perfect session', () => {
  assert.deepEqual(earnedBadges({ ...NONE, themesDone: ['t01', 't02'], levelsDone: [1], perfectSession: true }),
    ['theme-t01', 'theme-t02', 'level-1', 'perfect']);
});

test('badges already earned are not awarded again', () => {
  const facts = { ...NONE, bestStreak: 30, checkIns: 10 };
  assert.deepEqual(newBadges(facts, { 'streak-7': '2026-10-11', 'checkins-10': '2026-10-14' }), ['streak-30']);
});

test('titles for the badge screen', () => {
  const themes = [{ id: 't05', name: 'Food & Drink' }];
  assert.equal(badgeTitle('streak-7'), '7-day streak');
  assert.equal(badgeTitle('checkins-50'), '50 check-ins');
  assert.equal(badgeTitle('learned-all'), 'Every word learned');
  assert.equal(badgeTitle('learned-500'), '500 words learned');
  assert.equal(badgeTitle('mastered-100'), '100 words mastered');
  assert.equal(badgeTitle('theme-t05', themes), 'Finished Food & Drink');
  assert.equal(badgeTitle('level-2'), 'HSK 2 finished');
  assert.equal(badgeTitle('perfect'), 'Perfect session');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/badges.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\badges.js'`.

- [ ] **Step 3: Write `docs/js/badges.js`**

```js
// Milestone badges. A badge ID is a short text, for example 'streak-7', 'learned-all',
// 'theme-t05', 'level-1' or 'perfect'. Earned badges are kept in the meta store as
// { badgeId: dayEarned }, so each one is awarded once.
import { CONFIG } from './config.js';

// The facts object looks like { bestStreak, checkIns, learned, mastered, totalWords, themesDone: ['t01'],
//          levelsDone: [1], perfectSession: true or false }
export function earnedBadges(facts) {
  const ids = [];
  const { badges } = CONFIG;
  for (const n of badges.streak) if (facts.bestStreak >= n) ids.push(`streak-${n}`);
  for (const n of badges.checkIns) if (facts.checkIns >= n) ids.push(`checkins-${n}`);
  for (const n of badges.learned) if (facts.learned >= n) ids.push(`learned-${n}`);
  if (facts.totalWords > 0 && facts.learned >= facts.totalWords) ids.push('learned-all');
  for (const n of badges.mastered) if (facts.mastered >= n) ids.push(`mastered-${n}`);
  for (const t of facts.themesDone) ids.push(`theme-${t}`);
  for (const lv of facts.levelsDone) ids.push(`level-${lv}`);
  if (facts.perfectSession) ids.push('perfect');
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
    case 'learned': return value === 'all' ? 'Every word learned' : `${value} words learned`;
    case 'mastered': return `${value} words mastered`;
    case 'theme': return `Finished ${themes.find((t) => t.id === value)?.name ?? value}`;
    case 'level': return `HSK ${value} finished`;
    case 'perfect': return 'Perfect session';
    default: return id;
  }
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/badges.test.mjs`
Expected: `ℹ tests 8`, `ℹ pass 8`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/badges.js tests/js/badges.test.mjs && git commit -F - <<'EOF'
feat(app): milestone badges

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 13: Stats and the progress map (`docs/js/stats.js`)

Worked example of the 7-day forecast on 20 October. Words due on 18 October (overdue) and 20 October count on today, one is due on 22 October and one on 26 October, so the counts are 2, 0, 1, 0, 0, 0, 1.

**Files:**
- Create: `docs/js/stats.js`
- Test: `tests/js/stats.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  accuracy, activity, forecast, levelProgress, levelsDone, liveEvents, themeProgress, themesDone, totals,
} from '../../docs/js/stats.js';
import { failedLessonProgress, learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const TODAY = '2026-10-20';
const at = (id, step, due = '2026-10-25') => ({ ...learnedProgress(id, '2026-10-01'), step, due });
const mapOf = (list) => new Map(list.map((p) => [p.id, p]));

test('Undo takes an event out of every count', () => {
  const events = [
    { seq: 1, day: TODAY, kind: 'review', grade: 'right' },
    { seq: 2, day: TODAY, kind: 'review', grade: 'wrong' },
    { seq: 3, day: TODAY, kind: 'undo', target: 2 },
  ];
  assert.deepEqual(liveEvents(events).map((e) => e.seq), [1]);
});

test('learned and mastered totals', () => {
  const list = [at('a', 1), at('b', 6), at('c', 7), at('d', 9), failedLessonProgress('e', TODAY)];
  assert.deepEqual(totals(list), { learned: 4, mastered: 2 });
});

test('progress per HSK level, and finished levels', () => {
  const lv1 = data.words.filter((w) => w.lv === 1);
  const progress = mapOf([...lv1.map((w) => at(w.id, 1)), at(data.words.find((w) => w.lv === 2).id, 8)]);
  assert.deepEqual(levelProgress(data.words, progress), [
    { lv: 1, total: 47, learned: 47, mastered: 0 },
    { lv: 2, total: 14, learned: 1, mastered: 1 },
  ]);
  assert.deepEqual(levelsDone(data.words, progress), [1]);
});

test('the progress map marks themes done, current or locked, with learned and mastered shares', () => {
  const t01 = data.words.filter((w) => w.theme === 't01');
  const t02 = data.words.filter((w) => w.theme === 't02');
  const progress = mapOf([...t01.map((w) => at(w.id, 7)), at(t02[0].id, 1), at(t02[1].id, 2)]);
  const map = themeProgress(data.themes, data.words, progress);
  assert.deepEqual(map.map((t) => t.status), ['done', 'current', 'locked', 'locked', 'locked']);
  assert.equal(map[0].masteredShare, 1);
  assert.equal(map[1].learned, 2);
  assert.equal(map[1].learnedShare, 0.2);
  assert.equal(map[1].masteredShare, 0);
  assert.deepEqual(themesDone(data.themes, data.words, progress), ['t01']);
});

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
  const list = [at('a', 1, '2026-10-18'), at('b', 1, TODAY), at('c', 2, '2026-10-22'), at('d', 3, '2026-10-26'),
    at('e', 3, '2026-10-27'), failedLessonProgress('f', TODAY)];
  assert.deepEqual(forecast(list, TODAY).map((r) => r.due), [2, 0, 1, 0, 0, 0, 1]);
});

test('7-day accuracy counts only scheduled reviews', () => {
  const events = [
    { seq: 1, day: '2026-10-13', kind: 'review', grade: 'wrong' }, // 8 days ago, so left out
    { seq: 2, day: '2026-10-14', kind: 'review', grade: 'right' },
    { seq: 3, day: TODAY, kind: 'review', grade: 'know' },
    { seq: 4, day: TODAY, kind: 'review', grade: 'unsure' },
    { seq: 5, day: TODAY, kind: 'review', grade: 'wrong' },
    { seq: 6, day: TODAY, kind: 'reask', grade: 'know' },
  ];
  assert.deepEqual(accuracy(events, TODAY), { answered: 4, right: 2, rate: 0.5 });
  assert.deepEqual(accuracy([], TODAY), { answered: 0, right: 0, rate: null });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/stats.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\stats.js'`.

- [ ] **Step 3: Write `docs/js/stats.js`**

```js
// Numbers for the Stats screen, the progress map and badges. All functions are pure:
// they take progress records, events and days and return plain objects.
import { CONFIG } from './config.js';
import { addDays, dayRange } from './dates.js';
import { PASS, isLearned, isMastered } from './srs.js';

// Events without the ones taken back by Undo. An undo event { kind: 'undo', target: 12 }
// removes event 12, and is itself left out.
export function liveEvents(events) {
  const undone = new Set(events.filter((e) => e.kind === 'undo').map((e) => e.target));
  return events.filter((e) => e.kind !== 'undo' && !undone.has(e.seq));
}

export function totals(progressList) {
  let learned = 0;
  let mastered = 0;
  for (const p of progressList) {
    if (isLearned(p)) learned += 1;
    if (isMastered(p)) mastered += 1;
  }
  return { learned, mastered };
}

function countGroup(words, progressById) {
  let learned = 0;
  let mastered = 0;
  for (const w of words) {
    const p = progressById.get(w.id);
    if (isLearned(p)) learned += 1;
    if (isMastered(p)) mastered += 1;
  }
  return { total: words.length, learned, mastered };
}

// [{ lv: 1, total, learned, mastered }, ...] for each HSK level in the word list.
export function levelProgress(words, progressById) {
  const levels = [...new Set(words.map((w) => w.lv))].sort((a, b) => a - b);
  return levels.map((lv) => ({ lv, ...countGroup(words.filter((w) => w.lv === lv), progressById) }));
}

export function levelsDone(words, progressById) {
  return levelProgress(words, progressById).filter((l) => l.learned === l.total).map((l) => l.lv);
}

// One tile per theme for the progress map. A theme is 'done' when every word is learned,
// the first theme that is not done is 'current', and the rest are 'locked'.
export function themeProgress(themes, words, progressById) {
  const byTheme = new Map(themes.map((t) => [t.id, []]));
  for (const w of words) byTheme.get(w.theme)?.push(w);
  let currentGiven = false;
  return themes.slice().sort((a, b) => a.order - b.order).map((t) => {
    const c = countGroup(byTheme.get(t.id), progressById);
    let status = 'locked';
    if (c.total > 0 && c.learned === c.total) status = 'done';
    else if (!currentGiven) { status = 'current'; currentGiven = true; }
    return {
      id: t.id, name: t.name, order: t.order, ...c,
      learnedShare: c.total ? c.learned / c.total : 0,
      masteredShare: c.total ? c.mastered / c.total : 0,
      status,
    };
  });
}

export function themesDone(themes, words, progressById) {
  return themeProgress(themes, words, progressById).filter((t) => t.status === 'done').map((t) => t.id);
}

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
export function forecast(progressList, today, days = CONFIG.statsDays.forecast) {
  const rows = dayRange(today, days).map((day) => ({ day, due: 0 }));
  const last = rows[rows.length - 1].day;
  for (const p of progressList) {
    if (!isLearned(p) || p.due > last) continue;
    const row = p.due <= today ? rows[0] : rows.find((r) => r.day === p.due);
    row.due += 1;
  }
  return rows;
}

// Share of scheduled reviews answered right (right or Know it) over the last `days` days.
// rate is null when there were no reviews.
export function accuracy(events, today, days = CONFIG.statsDays.accuracy) {
  const from = addDays(today, -(days - 1));
  const reviews = liveEvents(events).filter((e) => e.kind === 'review' && e.day >= from && e.day <= today);
  const right = reviews.filter((e) => PASS.has(e.grade)).length;
  return { answered: reviews.length, right, rate: reviews.length ? right / reviews.length : null };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/stats.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/stats.js tests/js/stats.test.mjs && git commit -F - <<'EOF'
feat(app): stats, level progress and progress map

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 14: Saved progress (`docs/js/store.js`)

The four stores match the design's "Saving progress" section. `MemoryStore` keeps everything in plain JavaScript maps and is what the tests use. `IdbStore` keeps the same data in IndexedDB on the phone. Node has no IndexedDB, so `IdbStore` is not run here, and Plan 4 must run the same checks in the browser. `askPersistentStorage` asks Chrome not to clear the data when space runs low, as the design asks after the first session.

**Files:**
- Create: `docs/js/store.js`
- Test: `tests/js/store.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IdbStore, MemoryStore, askPersistentStorage, openIdbStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';

const DAY = '2026-10-05';
const ev = (extra = {}) => ({ day: DAY, kind: 'review', id: 'w0001', grade: 'right', ...extra });

test('an answer writes the word\'s progress and its event together, with seq from 1', async () => {
  const store = new MemoryStore();
  const p = learnedProgress('w0001', DAY);
  assert.equal(await store.commit({ progress: [p], event: ev() }), 1);
  assert.equal(await store.commit({ event: ev({ kind: 'reask' }) }), 2);
  assert.deepEqual(await store.getProgress('w0001'), p);
  assert.deepEqual((await store.eventsSince(0)).map((e) => [e.seq, e.kind]), [[1, 'review'], [2, 'reask']]);
});

test('a bad commit writes nothing', async () => {
  const store = new MemoryStore();
  const good = learnedProgress('w0001', DAY);
  await assert.rejects(store.commit({ progress: [good], event: { day: DAY } }), /needs an event/);
  await assert.rejects(store.commit({ progress: [good, { id: 'w0002', step: 12 }], event: ev() }), /Bad progress/);
  await assert.rejects(store.commit({ progress: [good], event: ev({ seq: 9 }) }), /gives events their seq/);
  await assert.rejects(store.commit({ days: [{ day: '2026-13-01' }], event: ev() }), /Bad day/);
  assert.deepEqual(await store.allProgress(), []);
  assert.deepEqual(await store.eventsSince(0), []);
  assert.equal(await store.commit({ event: ev() }), 1);
});

test('remove deletes a progress record (used by Undo of a first lesson)', async () => {
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  await store.commit({ remove: ['w0001'], event: ev({ kind: 'undo', target: 1 }) });
  assert.equal(await store.getProgress('w0001'), undefined);
});

test('events by seq and by study day', async () => {
  const store = new MemoryStore();
  await store.commit({ event: ev({ day: '2026-10-03' }) });
  await store.commit({ event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-05' }) });
  assert.deepEqual((await store.eventsSince(1)).map((e) => e.seq), [2, 3]);
  assert.deepEqual((await store.eventsFrom('2026-10-04')).map((e) => e.day), ['2026-10-04', '2026-10-05']);
});

test('days and meta', async () => {
  const store = new MemoryStore();
  await store.commit({ days: [{ day: '2026-10-06', reviews: 3 }, { day: '2026-10-05', reviews: 5 }],
    meta: { settings: { newPerDay: 8 } }, event: ev({ kind: 'checkin' }) });
  assert.deepEqual((await store.allDays()).map((d) => d.day), ['2026-10-05', '2026-10-06']);
  assert.deepEqual(await store.getMeta('settings'), { newPerDay: 8 });
  assert.equal(await store.getMeta('missing'), undefined);
});

test('reads return copies, so callers cannot change saved data by accident', async () => {
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  const p = await store.getProgress('w0001');
  p.step = 9;
  assert.equal((await store.getProgress('w0001')).step, 1);
});

test('dump and restore round-trip, and seq keeps going up', async () => {
  const a = new MemoryStore();
  await a.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { badges: { 'streak-7': DAY } }, event: ev() });
  await a.commit({ event: ev() });
  const backup = await a.dump();
  const b = new MemoryStore();
  await b.restore(backup);
  assert.deepEqual(await b.dump(), backup);
  assert.equal(await b.commit({ event: ev() }), 3);
  await assert.rejects(b.restore({ progress: [], events: [{ seq: 2 }, { seq: 1 }], days: [], meta: {} }), /increasing/);
});

test('the IndexedDB store exists for the browser (it is not run here)', () => {
  assert.equal(typeof openIdbStore, 'function');
  assert.equal(typeof IdbStore.prototype.commit, 'function');
});

test('asking the browser to protect saved data', async () => {
  assert.equal(await askPersistentStorage(undefined), false);
  assert.equal(await askPersistentStorage({ storage: {} }), false);
  assert.equal(await askPersistentStorage({ storage: { persisted: async () => true, persist: async () => false } }), true);
  assert.equal(await askPersistentStorage({ storage: { persisted: async () => false, persist: async () => true } }), true);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/store.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\store.js'`.

- [ ] **Step 3: Write `docs/js/store.js`**

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
//   commit({ progress, remove, days, meta, event }) writes everything in one go and
//     returns the event's seq. Every change goes with exactly one event, so the log
//     always explains the saved state.
//   eventsSince(seq)  events with a larger seq, oldest first (for the Sheet backup, Plan 5)
//   eventsFrom(day)   events of that study day and later, oldest first (for stats)
//   allDays(), getMeta(key), dump(), restore(dump)
// seq numbers start at 1 and only ever go up, also after a restore.
import { isDay } from './dates.js';

export const STORE_NAMES = Object.freeze(['progress', 'events', 'days', 'meta']);

const copy = (value) => (value === undefined ? undefined : structuredClone(value));

// Checks a commit before anything is written, so a bad commit changes nothing.
export function checkCommit({ progress = [], remove = [], days = [], meta = {}, event } = {}) {
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
  return { progress, remove, days, meta, event };
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
    for (const p of c.progress) this.progress.set(p.id, copy(p));
    for (const id of c.remove) this.progress.delete(id);
    for (const d of c.days) this.days.set(d.day, copy(d));
    for (const [key, value] of Object.entries(c.meta)) this.meta.set(key, copy(value));
    this.events.push({ ...copy(c.event), seq });
    this.nextSeq = seq + 1;
    return seq;
  }

  async eventsSince(seq) { return this.events.filter((e) => e.seq > seq).map(copy); }

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
    this.events = dump.events.map(copy);
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

  async commit(input) {
    const c = checkCommit(input);
    const tx = this.db.transaction(STORE_NAMES, 'readwrite');
    const done = finished(tx);
    for (const p of c.progress) tx.objectStore('progress').put(p);
    for (const id of c.remove) tx.objectStore('progress').delete(id);
    for (const d of c.days) tx.objectStore('days').put(d);
    for (const [key, value] of Object.entries(c.meta)) tx.objectStore('meta').put({ key, value });
    const [seq] = await Promise.all([request(tx.objectStore('events').add({ ...c.event })), done]);
    return seq;
  }

  async eventsSince(seq) { return this.getAll('events', IDBKeyRange.lowerBound(seq, true)); }

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

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/store.test.mjs`
Expected: `ℹ tests 9`, `ℹ pass 9`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/store.js tests/js/store.test.mjs && git commit -F - <<'EOF'
feat(app): progress store with memory and IndexedDB versions

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 15: The controller the screens call (`docs/js/study.js`)

Worked example of Undo. On 6 October the first review is answered wrong. The word drops to step 1 with `lastGrade: 'wrong'`, a re-ask is queued and event 13 is saved. The learner taps Undo. The word's saved record goes back to what it was (step 1, `lastGrade: null`), the re-ask disappears, the same card is shown again, and an event `{ kind: 'undo', target: 13 }` is saved so the Sheet log (Plan 5) can see that answer 13 was taken back. If the learner now answers right, the word goes to step 2 with `lastGrade: 'right'`, so its next review is a pinyin card, not a recall card.

**Files:**
- Create: `docs/js/study.js`
- Test: `tests/js/study.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Study, previewDay } from '../../docs/js/study.js';
import { MemoryStore } from '../../docs/js/store.js';
import { quizForReview } from '../../docs/js/srs.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
const right = (card) => (card.quiz === 'recall' ? 'know' : 'right');

// Plays a whole session, answering with grade(card). Returns the finish() result.
async function playDay(store, day, grade = right, hour = 9) {
  const study = await Study.start({ store, data, now: localDate(day, hour) });
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(grade(study.card), localDate(day, hour));
  }
  return study.finish(localDate(day, hour));
}

test('on day 1, 12 new words in 3 groups are all learned and the day is checked in', async () => {
  const store = new MemoryStore();
  const preview = await previewDay({ store, data, now: localDate('2026-10-05') });
  assert.equal(preview.reviews.length, 0);
  assert.equal(preview.newWords.length, 12);
  const result = await playDay(store, '2026-10-05');
  assert.equal(result.checkedIn, true);
  assert.equal(result.justCheckedIn, true);
  assert.equal(result.streak, 1);
  assert.equal(result.summary.learned, 12);
  const progress = await store.allProgress();
  assert.equal(progress.length, 12);
  assert.ok(progress.every((p) => p.step === 1 && p.due === '2026-10-06'));
  assert.deepEqual((await store.allDays()).map((d) => [d.day, d.newWords]), [['2026-10-05', 12]]);
});

test('on day 2, yesterday\'s 12 words come back as listening reviews before 12 new words', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  assert.equal(study.plan.reviews.length, 12);
  assert.equal(study.plan.newWords.length, 12);
  assert.ok(study.state.cards.slice(0, 12).every((c) => c.type === 'review' && c.quiz === 'listen'));
  assert.equal(study.state.cards[12].type, 'learn');
});

test('a session at 02:00 counts for the day before', async () => {
  const store = new MemoryStore();
  const study = await Study.start({ store, data, now: localDate('2026-10-06', 2) });
  assert.equal(study.day, '2026-10-05');
});

test('the learner\'s new-word setting is used', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 8 } }, event: { day: '2026-10-05', kind: 'settings' } });
  assert.equal((await previewDay({ store, data, now: localDate('2026-10-05') })).newWords.length, 8);
});

test('leaving early does not check in, and the streak still shows yesterday', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  await study.answer('right', localDate('2026-10-06'));
  const result = await study.finish(localDate('2026-10-06'));
  assert.equal(result.checkedIn, false);
  assert.equal(result.streak, 1);
  assert.equal(result.left.reviews.length, 11);
});

test('Undo of a review puts the word back and logs an undo event', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  const id = study.card.id;
  const before = await store.getProgress(id);
  const { seq } = await study.answer('wrong', localDate('2026-10-06'));
  assert.equal(study.state.cards.filter((c) => c.type === 'reask').length, 1);
  assert.ok(study.canUndo);
  await study.undo(localDate('2026-10-06'));
  assert.deepEqual(await store.getProgress(id), before);
  assert.equal(study.card.id, id);
  assert.equal(study.state.cards.filter((c) => c.type === 'reask').length, 0);
  const last = (await store.eventsSince(0)).at(-1);
  assert.deepEqual([last.kind, last.target, last.id], ['undo', seq, id]);
  assert.ok(!study.canUndo);
  await study.answer('right', localDate('2026-10-06'));
  assert.equal((await store.getProgress(id)).step, 2);
});

test('a review answered wrong comes back next time as a recall card, unless Undo takes it back', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  // On 6 October the first review is answered wrong, and every other card right.
  const study = await Study.start({ store, data, now: localDate('2026-10-06') });
  const id = study.card.id;
  await study.answer('wrong', localDate('2026-10-06'));
  while (!study.finished) {
    if (study.card.type === 'learn') study.next();
    else await study.answer(right(study.card), localDate('2026-10-06'));
  }
  await study.finish(localDate('2026-10-06'));
  const p = await store.getProgress(id);
  assert.deepEqual([p.step, p.due, p.reps, p.lastGrade], [1, '2026-10-07', 1, 'wrong']);
  // On 7 October only that word is due, and it is asked as a recall card.
  const day3 = await Study.start({ store, data, now: localDate('2026-10-07') });
  assert.deepEqual([day3.card.type, day3.card.id, day3.card.quiz], ['review', id, 'recall']);

  // With Undo, the wrong answer leaves no trace, so the next review is a pinyin card at step 2.
  const store2 = new MemoryStore();
  await playDay(store2, '2026-10-05');
  const study2 = await Study.start({ store: store2, data, now: localDate('2026-10-06') });
  await study2.answer('wrong', localDate('2026-10-06'));
  await study2.undo(localDate('2026-10-06'));
  await study2.answer('right', localDate('2026-10-06'));
  const p2 = await store2.getProgress(id);
  assert.deepEqual([p2.step, p2.lastGrade, quizForReview(p2)], [2, 'right', 'pinyin']);
});

test('Undo of the answer that taught a word removes its new record', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 4 } }, event: { day: '2026-10-05', kind: 'settings' } });
  const study = await Study.start({ store, data, now: localDate('2026-10-05') });
  while (!(study.card.type === 'final' && study.state.pos === study.state.cards.length - 1)) {
    if (study.card.type === 'learn') study.next();
    else await study.answer('right');
  }
  const id = study.card.id;
  await study.answer('right');
  assert.equal((await store.getProgress(id)).step, 1);
  await study.undo();
  assert.equal(await store.getProgress(id), undefined);
});

test('a finished theme earns its badge once', async () => {
  const store = new MemoryStore();
  const first = await playDay(store, '2026-10-05'); // words 1 to 12, all 12 of the Starter Kit
  assert.deepEqual(first.newBadges, ['theme-t01']);
  const second = await playDay(store, '2026-10-06'); // words 13 to 24, and Greetings ends at 22
  assert.deepEqual(second.newBadges, ['theme-t02']);
  assert.deepEqual(await store.getMeta('badges'), { 'theme-t01': '2026-10-05', 'theme-t02': '2026-10-06' });
});

test('30 reviews all right first time earn the perfect-session badge', async () => {
  const store = new MemoryStore();
  await store.commit({ meta: { settings: { newPerDay: 30 } }, event: { day: '2026-10-05', kind: 'settings' } });
  await playDay(store, '2026-10-05');
  const day2 = await playDay(store, '2026-10-06');
  assert.equal(day2.summary.reviews, 30);
  assert.ok(day2.newBadges.includes('perfect'));
});

test('a missed day resets the streak', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  assert.equal((await playDay(store, '2026-10-06')).streak, 2);
  assert.equal((await playDay(store, '2026-10-08')).streak, 1);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/study.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\study.js'`.

- [ ] **Step 3: Write `docs/js/study.js`**

```js
// Study is the one place the screens (Plan 4) talk to. It plans the day, runs a session,
// saves every answer, handles Undo, and checks in and awards badges at the end.
//
//   const study = await Study.start({ store, data });   // data = the words JSON
//   while (!study.finished) {
//     if (study.card.type === 'learn') study.next();
//     else await study.answer('right');                 // or 'wrong', 'know', 'unsure', 'dontknow'
//   }
//   const result = await study.finish();                 // { checkedIn, streak, newBadges, ... }
import { normalizeSettings } from './config.js';
import { studyDay } from './dates.js';
import { isDayDone, planDay } from './plan.js';
import {
  advance, answerCard, canUndo, createSession, currentCard, isFinished, sessionSummary, undoAnswer,
} from './session.js';
import { PASS } from './srs.js';
import { bestStreak, currentStreak } from './checkin.js';
import { levelsDone, themesDone, totals } from './stats.js';
import { newBadges } from './badges.js';

export async function loadSettings(store) {
  return normalizeSettings(await store.getMeta('settings'));
}

// What today holds, for the Today screen, without starting a session.
export async function previewDay({ store, data, now = new Date() }) {
  const settings = await loadSettings(store);
  return planDay({ words: data.words, progress: await store.allProgress(), today: studyDay(now), settings });
}

export class Study {
  static async start({ store, data, now = new Date() }) {
    const settings = await loadSettings(store);
    const day = studyDay(now);
    const progress = await store.allProgress();
    const plan = planDay({ words: data.words, progress, today: day, settings });
    const byId = new Map(progress.map((p) => [p.id, p]));
    return new Study({ store, data, settings, day, plan, byId, state: createSession(plan, byId) });
  }

  constructor({ store, data, settings, day, plan, byId, state }) {
    Object.assign(this, { store, data, settings, day, plan, byId, state });
    this.last = null; // { seq, event } of the last saved answer, for Undo
  }

  get card() { return currentCard(this.state); }

  get finished() { return isFinished(this.state); }

  get canUndo() { return this.last !== null && canUndo(this.state); }

  // Leave a learning card.
  next() {
    this.state = advance(this.state);
  }

  // Save one answer. Returns { pass, seq }.
  async answer(grade, now = new Date()) {
    const out = answerCard(this.state, grade, this.byId);
    const before = this.byId.get(out.event.id) ?? null;
    const event = { ...out.event, ts: now.toISOString(), before, after: out.progress };
    const seq = await this.store.commit({ progress: out.progress ? [out.progress] : [], event });
    if (out.progress) this.byId.set(out.progress.id, out.progress);
    this.state = out.state;
    this.last = { seq, event };
    return { pass: PASS.has(grade), seq };
  }

  // Undo takes back the last answer. The word's record goes back to what it was, and an
  // undo event names the answer it cancels.
  async undo(now = new Date()) {
    if (!this.canUndo) throw new Error('Nothing to undo');
    const { seq, event } = this.last;
    const changed = event.after !== null;
    await this.store.commit({
      progress: changed && event.before ? [event.before] : [],
      remove: changed && !event.before ? [event.id] : [],
      event: { day: this.day, kind: 'undo', target: seq, id: event.id, ts: now.toISOString() },
    });
    if (changed && event.before) this.byId.set(event.id, event.before);
    if (changed && !event.before) this.byId.delete(event.id);
    this.state = undoAnswer(this.state);
    this.last = null;
  }

  // End the session (finished or not). Checks in when nothing is left for today, and
  // awards any new badges.
  async finish(now = new Date()) {
    const { store, data, day } = this;
    const progress = await store.allProgress();
    const byId = new Map(progress.map((p) => [p.id, p]));
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
    const facts = {
      bestStreak: bestStreak(checked),
      checkIns: checked.length,
      ...totals(progress),
      totalWords: data.words.length,
      themesDone: themesDone(data.themes, data.words, byId),
      levelsDone: levelsDone(data.words, byId),
      perfectSession: summary.perfect,
    };
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

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/study.test.mjs`
Expected: `ℹ tests 11`, `ℹ pass 11`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/study.js tests/js/study.test.mjs && git commit -F - <<'EOF'
feat(app): study controller with answers, Undo, check-in and badges

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 16: The 450-day simulation (`tests/js/simulation.test.mjs`)

This test adds no app code. It runs the finished logic for 450 study days, so it passes on its first run if Tasks 1 to 15 are right. It would fail if any day asked more than the cap of 100 reviews, or if a learner who finishes every session missed a check-in. It uses 5,400 plain made-up words (12 new words a day for 450 days), because it only needs IDs and order.

**Files:**
- Test: `tests/js/simulation.test.mjs`

- [ ] **Step 1: Write the test**

```js
// A made-up learner studies every day for 450 study days with the default settings
// (100 reviews at most, 12 new words). The chance of a right answer rises with the
// word's step, from 0.85 at steps 1 and 2 through 0.88, 0.91 and 0.93 to 0.95 from step 6.
// The test checks that no day asks more than 100 reviews and prints the daily load.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../../docs/js/config.js';
import { addDays } from '../../docs/js/dates.js';
import { mulberry32 } from '../../docs/js/rng.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { localDate, syntheticWords } from './helpers.mjs';

const DAYS = 450;
const FIRST_DAY = '2026-10-05';
const RIGHT_BY_STEP = [0.85, 0.85, 0.85, 0.88, 0.91, 0.93, 0.95, 0.95, 0.95, 0.95]; // index = step

function makeData() {
  const words = syntheticWords(DAYS * CONFIG.newPerDay);
  const themes = [...new Set(words.map((w) => w.theme))].map((id, i) => ({ id, order: i + 1, name: `Theme ${i + 1}` }));
  return { words, themes };
}

function minutes(cards) {
  const seconds = cards.reduce((sum, c) => sum + CONFIG.secondsPerCard[c.type], 0);
  return seconds / 60;
}

test('450 simulated days never go over the review cap', { timeout: 120000 }, async () => {
  const data = makeData();
  const store = new MemoryStore();
  const rand = mulberry32(20261005);
  const rows = [];
  for (let d = 0; d < DAYS; d++) {
    const day = addDays(FIRST_DAY, d);
    const now = localDate(day, 20);
    const study = await Study.start({ store, data, now });
    while (!study.finished) {
      const card = study.card;
      if (card.type === 'learn') { study.next(); continue; }
      const step = study.byId.get(card.id)?.step ?? 0;
      const right = rand() < RIGHT_BY_STEP[step];
      const grade = card.quiz === 'recall' ? (right ? 'know' : 'dontknow') : (right ? 'right' : 'wrong');
      await study.answer(grade, now);
    }
    const result = await study.finish(now);
    const cards = study.state.cards;
    rows.push({
      day,
      reviews: study.plan.reviews.length,
      backlog: study.plan.backlog,
      newWords: study.plan.newWords.length,
      reasks: cards.filter((c) => c.type === 'reask').length,
      minutes: minutes(cards),
      checkedIn: result.checkedIn,
    });
  }

  const over = rows.filter((r) => r.reviews > CONFIG.reviewCap);
  assert.deepEqual(over, [], 'no day asks more reviews than the cap');
  assert.ok(rows.every((r) => r.checkedIn), 'a learner who finishes every session checks in every day');

  const avg = (list, key) => (list.reduce((s, r) => s + r[key], 0) / list.length).toFixed(1);
  console.log('\nDaily load of the simulated learner (averages per block of days)');
  console.log('days      reviews  backlog  new  re-asks  minutes  (max reviews)');
  for (let from = 0; from < DAYS; from += 30) {
    const block = rows.slice(from, from + 30);
    const max = Math.max(...block.map((r) => r.reviews));
    console.log(`${String(from + 1).padStart(3)}-${String(from + block.length).padEnd(3)}   ${avg(block, 'reviews').padStart(6)}   ${avg(block, 'backlog').padStart(6)}  ${avg(block, 'newWords').padStart(4)}  ${avg(block, 'reasks').padStart(6)}   ${avg(block, 'minutes').padStart(6)}   ${max}`);
  }
  const steady = rows.slice(300);
  console.log(`Days 301-450: ${avg(steady, 'reviews')} reviews, ${avg(steady, 'newWords')} new words and about ${avg(steady, 'minutes')} minutes a day.`);
  const progress = await store.allProgress();
  console.log(`After ${DAYS} days: ${progress.filter((p) => p.step >= 1).length} words learned, ${progress.filter((p) => p.step >= CONFIG.masteredStep).length} mastered.`);
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/js/simulation.test.mjs`
Expected: `ℹ pass 1`, `ℹ fail 0`, in about 10 seconds. It prints a table like this one, which is the output measured on 2026-09-28 (the same as in the first version of this plan):

```
Daily load of the simulated learner (averages per block of days)
days      reviews  backlog  new  re-asks  minutes  (max reviews)
  1-30      47.1     47.1  12.0     8.4     14.9   68
 31-60      76.6     76.6  12.0     9.6     18.8   90
 61-90      88.8     88.9  11.8    10.1     20.5   100
 91-120     90.3     90.8  11.6    10.5     20.6   100
121-150     94.7     95.7  10.2    11.3     20.3   100
151-180     92.6     94.8  10.6     9.7     20.2   100
181-210     95.9     97.9  10.2    11.5     20.6   100
211-240     96.2     99.1   9.8    12.5     20.4   100
241-270     97.2    101.9   8.8    11.4     19.7   100
271-300     97.4    101.2   9.2    10.7     20.0   100
301-330     96.4     99.4   9.4    10.6     20.1   100
331-360     95.8    103.1   8.8    10.5     19.6   100
361-390     96.2    101.0   9.4    10.2     19.9   100
391-420     96.4     99.9   9.0    10.7     19.8   100
421-450     95.8     97.7   9.6    10.6     20.1   100
Days 301-450: 96.1 reviews, 9.2 new words and about 19.9 minutes a day.
After 450 days: 4571 words learned, 3931 mastered.
```

The table shows that after about 3 months the reviews sit just under the cap. Busy days then halve the new words, so the average falls from 12 to about 9 a day. The minutes are estimates from the guessed seconds per card in `config.js` (Choice 11).

- [ ] **Step 3: Commit**

```bash
git add tests/js/simulation.test.mjs && git commit -F - <<'EOF'
test(app): 450-day learner simulation checks the review cap

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 17: Full check and project notes

**Files:**
- Modify: `.claude/CLAUDE.md` (git-ignored, so it is not committed)

- [ ] **Step 1: Run every JavaScript test**

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 138`, `ℹ pass 137`, `ℹ fail 0`, `ℹ skipped 1`.

- [ ] **Step 2: Run the Python tests, which must be unchanged**

Run: `python -m pytest tests -q`
Expected: `69 passed`.

- [ ] **Step 3: Check that nothing private went into the public folder**

Run: `ls -R docs`
Expected: only `docs/js/` with the 14 files `badges.js checkin.js config.js curriculum.js dates.js distractors.js pinyin.js plan.js rng.js session.js srs.js stats.js store.js study.js`.

- [ ] **Step 4: Add the JavaScript test command to `.claude/CLAUDE.md`**

Replace the line

```
- Tests: `python -m pytest tests -q`.
```

with

```
- Tests: `python -m pytest tests -q` (Python) and `node --test "tests/js/*.test.mjs"` (app logic). Keep the quotes around the pattern.
- App logic lives in docs/js/ as plain ES modules with no DOM and no npm packages. The screens call docs/js/study.js.
```

- [ ] **Step 5: Report to the user**

Report the test counts from Step 1 and the simulation table from Task 16. Say that the worked-example test passes with every column of the design's 苹果 table, the quiz column included, through to the next review on 11 February 2027. Name the pinyin style sheet's nine fixed choices (the section near the top of this plan), and say that the fixture follows them and that the pinyin quiz prefers real choices in the answer's look, with at least two choices ending in "r" for an answer with the 儿 ending. There is no open question left from this plan.

---

## Self-review

### Design requirements covered by this plan

| Requirement (from the design or the Plan 2 brief) | Task |
|---|---|
| Plain JavaScript ES modules, no framework, no build step, no npm packages | 1, all |
| All tunable numbers in one place | 1 |
| Study day starts at 04:00 local time, safe across daylight saving | 3 |
| Ladder 1, 2, 4, 7, 15, 30, 60, 120, 240 days | 1, 4 |
| Right or Know it moves up one step | 4 |
| Unsure keeps the step, half the gap, at least 1 day | 4 |
| Wrong or Don't know drops two steps, never below 1, due tomorrow | 4 |
| Mastered at step 7 | 4, 13 |
| Only the first answer of the day changes the schedule | 4 |
| The 苹果 worked example as corrected on 2026-09-28 (dates, quiz, answers, steps, next reviews, to 11 February 2027) | 4 |
| Reviews first, capped at 100 by default, cap changeable in Settings | 1, 7, 15 |
| Most overdue first by days overdue divided by the gap, then lower step | 7 |
| New words 12 by default (4 to 30), halved up to twice the cap, paused above | 1, 7 |
| New words in `ord` order, skipping learned ones | 6 |
| Unfinished new words resume first and count toward the day's quota | 6, 7 |
| Groups of 4, each with learning cards and then a listen-to-meaning check of the group | 8 |
| Missed group checks asked again at the group end | 8 |
| Final meaning-to-pinyin check of all new words | 8 |
| Passing both checks makes a word learned, step 1, due tomorrow | 4, 8 |
| Missed reviews come back 4 cards later as recall cards, at most 3 re-asks, until right | 8 |
| Re-asks do not count as scheduled reviews (no change to `reps` or `lastGrade`) | 4, 8 |
| Undo of the last answer | 8, 15 |
| Quiz type per review: recall after a wrong answer, otherwise listen at step 1, pinyin at step 2, then recall, listen, pinyin by the count of earlier reviews | 4, 8, 15 |
| Undo also takes back the effect of a wrong answer on the next quiz type | 15 |
| Check-in when reviews and new words are both done | 7, 15 |
| Streak of consecutive check-ins, reset by a missed day, no freeze | 9, 15 |
| Home screen week strip and check-in month calendar | 9 |
| 3 wrong choices, seeded by word ID and study day | 2, 11 |
| No same characters, no `noDistract`, no shared meaning key with the answer or another choice | 11 |
| Listening quiz never offers exact homophones, English length half to double | 11 |
| Pinyin quiz uses the same syllable count and different toneless pinyin, with one tone variant from step 2 | 10, 11 |
| Card pinyin with textbook word spacing (spaces between words, hyphen in four-character idioms, apostrophes, the 儿 ending), handled when finding syllables, counting them and making tone variants | 5, 10, 11 |
| A tone variant keeps the answer's spacing and differs only in tone | 10, 11 |
| Choices drawn from tiers (same theme, part of speech and level first, then wider) | 11 |
| Pinyin choices stay plausible, because a capital letter never gives the answer away (names first for a name, every choice in the answer's capitals) | 5, 11 |
| Pinyin choices never give the answer away by their spacing, because every choice is shown in the answer's word spacing (the same syllables per word and the same separators), checked for multi-word answers and all three forms of four-syllable words | 5 (`brokenRules`), 10 (`spacingOf`, `inShape`), 11 (`inAnswerForm`) |
| Real wrong choices that already share the answer's spacing, capitals and 儿 ending come first, and a choice is reshaped only when too few such words exist in the tiers | 11 (`lookOf`, the passes of `pickDistractors`, the test with 市场经济 and 足球比赛), Choice 13 |
| An answer with the 儿 ending gets at least two wrong choices that end in it, where the list has them | 5 (`brokenRules`), 11 (`lookOf`, the test with 一会儿, 一块儿 and 好玩儿), Choice 14 |
| The fixture's example pinyin follows the pinyin style sheet and its reference order (a single entry of the public list is one word, "chīfàn"), checked on a few lines | 5 (`words_fixture.json`, the style-sheet fixture test) |
| Quiz choices checked for every real word | 11 (runs once Plan 3's data file exists) |
| Badges for streaks, check-ins, learned, mastered, themes, levels, perfect session | 12, 15 |
| Stats for learned and mastered words, per level progress, 30-day activity, 7-day forecast and 7-day accuracy | 13 |
| Progress map tiles marked done, current or locked, with learned and mastered shares | 13 |
| Four stores (progress, events, days, meta), answer and event written together | 14, 15 |
| Events carry an increasing `seq` for the Sheet backup | 14 |
| In-memory store for tests, IndexedDB store for the browser | 14 |
| Ask Chrome to protect the saved data | 14 |
| Backup and restore of all saved data (dump and restore) | 14 |
| Test fixture of real HSK 1-2 words following the data contract | 5 |
| Simulated learner over 450 days, reviews never over the cap, daily load printed | 16 |

### Left to other plans on purpose

- **Plan 3** builds the real `docs/data/words_vNNN.json`. When it exists, `tests/js/distractors-real.test.mjs` stops skipping and must pass. Plan 3 should also make `noDistract` list same-meaning pairs in both directions, although this plan checks both directions anyway. Plan 3 writes `py` with textbook word spacing. This plan reads spaces, hyphens, straight and curly apostrophes and the bare "r" of the 儿 ending, and it needs every `py` to line up with its `pyNum` item by item. A word whose `py` does not line up still gets 3 wrong choices, but never a made-up tone variant.
- **Plan 4** builds every screen (Today, Session, Check-in, Progress map, Stats, Badges, Settings), the Start button that unlocks sound, audio playback twice, the learning card shown after each answer, stroke order with Hanzi Writer, the service worker and offline files, the update message, the "Download backup file" button (using `store.dump()`), and a browser test page that runs the store checks of Task 14 against `IdbStore`, because Node cannot run IndexedDB.
- **Plan 5** builds the Google Sheet sync (sending `store.eventsSince(lastSeq)` and restoring with `store.restore()`), and deployment to GitHub Pages.
- **The design's "20 to 25 minutes a day".** The simulation prints an estimate (about 20 minutes once steady) from guessed seconds per card. It does not assert the range, because the seconds per card are not measured yet. Timing real sessions on the phone in Plan 4 can replace the guesses in `config.js`.
