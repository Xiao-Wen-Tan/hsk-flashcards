# HSK Flashcards: plan

## Context

You want a daily flashcard app for one English-speaking teen or adult who is starting Chinese and will study on an Android phone. The mechanics follow Shanbay (扇贝):
- about 12 new words a day, grouped by daily-life theme,
- reviews timed by the forgetting curve and asked as quizzes, with the answer revealed after,
- a daily check-in (打卡) with streaks and badges,
- progress that is saved and never lost.

The forgetting curve is Hermann Ebbinghaus's finding that memory fades over days, so each review is spaced further apart than the last.

The project folder is empty today. Your vocabulary PDFs are in `../HSK 词汇 6本/`.

## Decisions you confirmed

| Topic | Decision |
|---|---|
| Learner | One English-speaking teen or adult on an Android phone. Interface in English. |
| Hosting | GitHub Pages under your account (a free host for fixed files). The app installs to the phone's home screen and works offline. |
| Progress | Saved on the phone and copied automatically to a Google Sheet you own, as a backup and so you can watch progress. |
| Words | All HSK 2.0 words (about 5,000, levels 1 to 6), with repeats removed, grouped into daily-life themes. |
| Order | Level first, then theme (the user's decision of 2026-09-29). HSK 1 and 2 together come first, going through every theme in theme order, then HSK 3 through every theme, then HSK 4, 5 and 6. Inside one theme of one level group, the easiest words come first. |
| Word source | A complete, openly licensed public HSK 2.0 list fills the gaps: your HSK 5 PDF stops at "guǒ shí", and your PDFs' characters are scrambled. Your PDFs supply the example sentences after unscrambling. |
| Card content | Characters, pinyin, English meaning, part of speech, example sentence (with its own audio, pinyin and English), stroke-order animation. The word's sound plays twice automatically and replays on tap. |
| Audio | Pre-made MP3 files for every word and sentence, made once with Microsoft's neural Chinese voice through the free `edge-tts` tool. |
| Quizzes | Three types, testing sound, pinyin and meaning. Characters are always shown but never tested. The full learning card appears after every answer. |
| Rewards | Daily check-in with streak and calendar, milestone badges, progress map and stats. No points or levels. |
| Sentences | Taken from your PDFs, which means the public site republishes text from m.sayninhao.com. New sentences are written only where a PDF has none or its sentence is unusable. |

## How a study day works

The session opens with a big **Start** button. Tapping it also lets the phone play sound automatically, because Android Chrome blocks automatic sound until the user taps once.

**1. Reviews come first.** The app quizzes every word that is due today, up to 100 a day (you can change this cap in Settings).

**2. Then new words.** Twelve new words by default (changeable in Settings, 4 to 30), taught in groups of 4:
- Show each word's learning card, with the sound played twice.
- Quiz the group once (listen, then pick the meaning). A missed word is shown again and asked again at the end of the group.
- After all groups, quiz all 12 once more (see the meaning, then pick the pinyin).
- A word that passes both quizzes counts as "learned" and is due again tomorrow.

**3. Check-in.** The day is checked in when the reviews and the new words are both done. The streak counts days in a row with a check-in and resets after a missed day.

### The review schedule (forgetting curve)

Each word sits on a step of this ladder. The step decides how many days pass before its next review.

| Step | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|
| Days until next review | 1 | 2 | 4 | 7 | 15 | 30 | 60 | 120 | 240 |

- **Right answer, or "Know it".** The word moves up one step.
- **"Unsure".** The word stays on its step and comes back after half the usual gap (at least 1 day).
- **Wrong answer, or "Don't know".**
  - The word drops two steps (never below step 1) and is due tomorrow.
  - It also comes back 4 cards later in today's session, until it is answered right once. These repeats do not move it further.
  - An **Undo** button fixes a mis-tap.
- **Mastered.** A word counts as mastered once it reaches step 7, meaning it was remembered after a 30-day gap.
- **Day boundary.** A new study day starts at 4 a.m. local time, so a late-night session counts for the day before.
- **Missed days.** If more than 100 reviews pile up, the most overdue words come first. New words are halved when the backlog is up to 200, and paused when it is bigger, until the learner catches up.
- **Daily time.** Once steady, this should be about 20 to 25 minutes a day. A simulation test checks this.

**Worked example: 苹果 (píngguǒ, apple), first learned Monday 5 October**

This example was corrected on 2026-09-28. The earlier version showed quiz types that broke the quiz rule below, and the user chose the rule that a recall card always follows a wrong answer.

| Date | Quiz | Answer | Step after | Next review |
|---|---|---|---|---|
| Oct 5 | learned, passed both checks | | 1 | Oct 6 |
| Oct 6 | listen, pick meaning (step 1) | right | 2 | Oct 8 |
| Oct 8 | meaning, pick pinyin (step 2) | wrong (shown again today) | 1 | Oct 9 |
| Oct 9 | recall and self-rate (always after a wrong answer) | Know it | 2 | Oct 11 |
| Oct 11 | meaning, pick pinyin (step 2) | right | 3 | Oct 15 |
| Oct 15 | listen, pick meaning (turn 2 of 3, after 4 earlier reviews) | right | 4 | Oct 22 |
| Oct 22 | meaning, pick pinyin (turn 3) | right | 5 | Nov 6 |
| Nov 6 | recall and self-rate (turn 1) | Unsure | 5 | Nov 13 (half of 15 days, rounded down) |
| Nov 13 | listen, pick meaning (turn 2) | right | 6 | Dec 13 |
| Dec 13 | meaning, pick pinyin (turn 3) | right | 7 (mastered) | Feb 11, 2027 |

## Cards and quizzes

**Learning card.** This same card is used on the first day and after every quiz answer. It shows:
- large characters, pinyin, part of speech, English meaning, and a replay button (the sound plays twice automatically). Pinyin uses textbook word spacing (the 汉语拼音正词法 rules). The syllables of one word are joined, words are separated by spaces, and a four-character idiom is written as two joined pairs with a hyphen, for example "bú kèqi" for 不客气 and "bámiáo-zhùzhǎng" for 拔苗助长. Where the PDFs print textbook pinyin, it is used. Otherwise the build splits the words automatically. Example-sentence pinyin follows the same rules. It starts as an automatic draft, and then Claude corrects each sentence against a written style sheet (in `.claude/plans/words-json-schema.md`), with a strict checker that each character still matches a valid reading of it;
- a "Stroke order" button that animates each character when tapped, using Hanzi Writer, a free stroke-animation library;
- the example sentence with the word highlighted, plus its pinyin, its English and its own play button.

**The three quiz types.** A word gets a different type depending on how far along it is.

| Quiz | Question screen | Answer | Used at |
|---|---|---|---|
| Listen, pick meaning | Sound plays | Pick the English meaning out of 4 | Step 1, and in rotation later |
| Meaning, pick pinyin | English meaning shown | Pick the pinyin out of 4 | Step 2, and in rotation later |
| Recall and self-rate | Character, pinyin and sound | Tap Reveal, then rate: Know it, Unsure or Don't know | Step 3 and later, in rotation, and always the first review after a wrong answer |

**Which quiz a review uses (decided 2026-09-28).**
1. If the word's previous scheduled review was answered wrong, this review is a recall card.
2. Otherwise, a word at step 1 gets "listen, pick meaning", and a word at step 2 gets "meaning, pick pinyin".
3. From step 3 on, the three types take turns in the order recall, listen, pinyin. The turn is set by how many scheduled reviews the word has had before: 0, 3, 6... give recall; 1, 4, 7... give listen; 2, 5, 8... give pinyin.

Re-asks within the same session are always recall cards and do not count as scheduled reviews.

**How the wrong choices are picked.** They come from the same theme and a similar HSK level, so they are plausible but not tricky:
- No choice has the same meaning as the correct answer (for example 高兴 and 快乐 both mean happy).
- The listening quiz never offers words that sound exactly alike (他, 她 and 它 are all "tā").
- From step 2 on, one pinyin choice may differ only in tone, to practise hearing tones.

## Rewards

- **Check-in and streak.** The home screen shows the streak count and this week's check-ins, and the check-in screen shows a month calendar.
- **Badges.**
  - Streaks of 7, 30, 100 and 365 days, and 10, 50 and 200 total check-ins.
  - 50 to all words learned, and 100 to 2,500 words mastered.
  - One badge per finished theme, and one per finished level group (HSK 1-2, 3, 4, 5, 6).
  - A perfect session (30 or more reviews, all right first time).
- **Progress map.** One section per level group (HSK 1-2, 3, 4, 5, 6). Each section has a tile for each theme that has words in that group, marked done, current or locked, with the share of that group's words of the theme that are learned. Tapping a tile lists those words, and tapping a word opens its card (the user's decision of 2026-09-29).
- **Stats.** Words learned and mastered, progress per HSK level, a 30-day activity chart, how many reviews are due in the next 7 days, and accuracy over the last 7 days.

## Building the word list

This is a series of Python scripts in `tools/`, run from the project folder with relative paths. Every output gets a new `_v001`, `_v002`... name, and the scripts can never overwrite an existing file.

The planning helper inspected the PDFs and reported the details below. The extraction script re-checks them before anything is built on them.
- **Why the characters are scrambled.** The PDFs store each Chinese character as a font code (for example 都 is code 7095) without a table that turns codes back into characters.
- **The codes are the same in every file,** and the standard text extractor loses some of them.
- **The fix.** Read the codes straight from the page contents. Then work out which code is which character by lining up each scrambled headword with the public list, matching on pinyin and length. For example, if the entry "bàba" has two codes and the public list's only "bàba" is 爸爸, both codes must be 爸.
- **Leftover codes.** About 2,666 distinct codes appear, close to the 2,663 characters in HSK 2.0. Codes that appear only in sentences are drawn as pictures from the font inside the PDF, and I identify them by eye. The sheets include already-known characters as a blind check.

| Step | Script | What it does |
|---|---|---|
| 1 | `01_fetch_public_list.py` | Download the public HSK 2.0 list (drkameleon/complete-hsk-vocabulary on GitHub, MIT licence, meanings from the CC-CEDICT dictionary) and check the licence and word counts. |
| 2 | `02_extract_pdfs.py` | Read all six PDFs. The counts must be exactly 150, 300, 600, 1,200, 437 and 2,623 entries. |
| 3 | `03_decode_glyphs.py`, `04_render_glyphs.py` | Unscramble the characters as described above, and write a coverage report. |
| 4 | `05_build_wordlist.py` | Remove repeats (HSK 1 to 4 lists repeat lower levels), merge multiple meanings of one word, and give each word a permanent ID. One card per word and pronunciation, so 长 cháng (long) and 长 zhǎng (grow) are separate cards. |
| 5 | `06_themes_prepare.py`, `06b_themes_merge.py` | I sort every word into one of 30 themes and flag the ones I'm unsure of. **You review the spreadsheet.** |
| 6 | `07_sentences.py` | Pick one PDF sentence per word, preferring short sentences with easy words. I write one where there is none, and translate all sentences into English. |
| 7 | `08_pinyin.py` | Add pinyin to sentences with the `pypinyin` library, with the headword forced to its card pinyin. Sentences with characters that have several readings go to a spot-check list. |
| 8 | `09_generate_audio.py` | Make the MP3s: about 10,000 files, about 150 MB, about 1.5 hours. The script can resume if interrupted. For single characters with several readings, a same-sound stand-in character forces the right pronunciation (for example 杭 for 行 háng). |
| 9 | `10_build_words_json.py` | Write the app's data file, `docs/data/words_v001.json`. |
| 10 | `11_validate.py` | Final checks (listed under Verification). |

**The 30 themes, in order** (you can rename or reorder them in the review spreadsheet):
1. Starter Kit
2. Greetings & Courtesy
3. Numbers & Measure Words
4. Time & Dates
5. Family & People
6. Food & Drink
7. Shopping & Money
8. Home & Housework
9. Daily Routine
10. Body & Health
11. Clothes & Appearance
12. Transport & Travel
13. Places & Directions
14. Weather & Seasons
15. Nature & Animals
16. School & Study
17. Work & Office
18. Phone, Internet & Media
19. Hobbies & Sports
20. Feelings
21. Personality & Behavior
22. Friends & Social Life
23. Talking & Thinking
24. Describing Things
25. Business & Economy
26. Society, Law & Politics
27. Science & Technology
28. Culture, History & Arts
29. Linking & Abstract Words
30. Idioms & Formal Expressions

Starter Kit holds the HSK 1 and 2 basics that every sentence needs (我, 你, 是, 有, 的, 了, 吗, 不, 很...). On 2026-09-28 the user widened it to about 40 words by also adding 和, 太, 还, 就, 没有 and 一点儿. Without it, those words would fall into theme 29 and arrive about a year in. Themes are no longer split into parts or held to a minimum size, because the level-first order already breaks every theme into small pieces (the user's decision of 2026-09-29, which also approved Idioms & Formal Expressions at 36 words).

## App structure

The app is plain HTML, CSS and JavaScript with no framework and no build step. That keeps thousands of framework files out of the Box-synced folder, and GitHub Pages serves the files as they are.

```
flash card/
  README.md, ATTRIBUTION.md         credits for the word list, CC-CEDICT, Hanzi Writer, voice
  docs/                             the app (GitHub Pages serves this folder)
    index.html  manifest.webmanifest  sw.js  css/app.css  icons/
    js/  srs.js (review schedule)  session.js (builds each day's queue)  curriculum.js
         distractors.js (wrong choices)  badges.js  stats.js  db.js (phone storage)
         audio.js  strokes.js  sync.js (Google Sheet)  dates.js  config.js  ui/*.js
    data/words_v001.json
    audio/w/*.mp3  audio/s/*.mp3    word and sentence audio
  tools/                            Python build scripts (table above), apps_script/Code.gs + SETUP.md
  tests/                            JavaScript tests (node --test) and Python tests (pytest)
  data/                             script outputs, manual fix files, your theme review sheet
  .claude/                          project notes, this design, scratch files (not published)
```

**Screens.**
- Today (streak, week strip, reviews and new words due, Start)
- Session (quizzes and learning cards)
- Check-in summary
- Progress map
- Stats
- Badges
- Settings (daily amounts, auto-play on or off, Google Sheet link, backup and restore, download all audio)

## Saving progress

**On the phone.** Progress is kept in the browser's built-in database (IndexedDB), which holds four things:
- each word's step and next date,
- a log of every answer,
- a record of each day,
- settings and badges.

After the first session, the app asks Chrome to protect this data from being cleared automatically. Settings also has a "Download backup file" button.

**Google Sheet backup.**
- **How it connects.** A small Google Apps Script (Google's built-in scripting for Sheets), which I write, receives the progress. Only new changes are sent, and sending the same change twice does no harm. A secret code made in the app's Settings stops strangers from writing to your Sheet.
- **What you see.** The Sheet gets tabs for Progress (one readable row per word), Log, Daily and Dashboard (counts and a 30-day chart).
- **When it syncs.** At the end of each session, when the app is closed, when it opens after 12 or more hours, and when "Back up now" is tapped. If the phone is offline, changes wait and are sent later.
- **New phone.** Settings, then Restore, pulls everything back from the Sheet.
- **Your setup, about 10 minutes, with step-by-step instructions in `tools/apps_script/SETUP.md`:**
  1. Create the Sheet.
  2. Paste the script and the secret code.
  3. Run setup once.
  4. Deploy it as a web app and paste its link into the app.

## Offline use and audio

- **App files.** The app's files and word data are stored on the phone after the first visit, so it opens without internet.
- **Audio.** At the start of each session, audio for today's and tomorrow's words is downloaded (about 4 MB), and every played file is kept. "Download all audio (about 150 MB)" in Settings makes everything available offline.
- **Playback.** The sound plays twice with a short pause. Tapping Next stops it. If the phone paused the app in the background, a "Tap to continue" screen restores sound.
- **Updates.** A new release shows an "Update available, tap to reload" message.

## Hosting on GitHub

- **Git's own database is kept outside Box** (`git init --separate-git-dir=~/git/hsk-flashcards.git`), so Box syncs only a one-line pointer file and cannot corrupt it. Mark this Box folder "Make available offline".
- **You create an empty public repository** named `hsk-flashcards` on github.com. I push to it, and Git for Windows opens a browser sign-in the first time.
- **Turn on Pages.** Settings, then Pages, then Deploy from branch, `main`, `/docs`. The app address will be `https://<your-username>.github.io/hsk-flashcards/`.
- **Search engines.** The site asks search engines not to list it. Every sentence records where it came from.

## Order of work, with checkpoints for you

1. Save this design to `.claude/specs/2026-09-27-hsk-flashcards-design.md`, then turn it into a step-by-step build plan.
2. Set up the repository, then extract and unscramble the PDFs. **Checkpoint: I show you the coverage report** (share of headwords and sentences decoded).
3. Build the word list and themes. **Checkpoint: you review the theme spreadsheet** in Excel and save your edits under a new name.
4. Sentences, translations and pinyin. **Checkpoint: you spot-check 50 translations.**
5. Generate the audio and the data file, then run validation.
6. Build the app alongside steps 3 to 5, writing the tests first for the review schedule, daily queue and quiz choices, and using the 150 HSK 1 words as test data.
7. Write the Google Apps Script. You do the 10-minute setup.
8. Deploy, then we test on the Android phone together.

## Verification

- **JavaScript tests** (`node --test tests/`, Node 24 is installed) cover:
  - every step change on the ladder and the 4 a.m. day boundary;
  - the daily cap and backlog rules;
  - re-asking missed words, check-in and streak reset;
  - badges;
  - quiz choices for every real word (always 3 valid wrong choices, no same-meaning or same-sound clashes);
  - a simulated learner over 450 days, which checks that daily reviews never exceed the cap and prints the expected daily load.
- **Python tests** (pytest) cover:
  - the unscrambling logic on a small case with a known answer;
  - pinyin clean-up;
  - the "never overwrite" file naming.
- **The validation script** checks:
  - about 5,000 cards, all with unique IDs;
  - no empty fields and no leftover scrambled codes;
  - every sentence contains its word;
  - every audio file exists and is a valid MP3 of a sensible length;
  - theme sizes between 40 and 350;
  - HSK levels never go down within a theme;
  - the data file is under 4 MB.
- **On the Android phone:**
  - install to the home screen;
  - sound plays twice on every card after the Start tap;
  - airplane mode still runs today's session with sound and stroke order;
  - the update message appears after a new release;
  - Settings shows the storage is protected.
- **Google Sheet:**
  - after a backup, rows appear;
  - a restore into a fresh browser gives identical counts and streak;
  - a backup made offline arrives after reconnecting;
  - a wrong secret code is refused.

## Risks

- **Unscrambling mistakes.** Guarded by exact entry counts, a two-way consistency check, blind checks on the character pictures, and my read-through of 150 random sentences. Any sentence still in doubt is replaced with one I write.
- **Copyright.** The public site republishes sayninhao.com sentences, which you chose knowingly. If this ever becomes a problem, a rebuild with only newly written sentences is a single script option.
- **Wrong pronunciation of characters with several readings,** such as 行 and 长. Fixed with stand-in characters and a listening check.
- **edge-tts may be blocked on a university network.** The audio script resumes where it stopped, so it can be finished on a home network.
- **Theme-by-theme order brings hard HSK 5 and 6 words early.** For example, Food and Drink runs about 20 days and includes words like 佳肴 (fine dish). Starter Kit comes first and levels rise within each theme. We check how it feels after two weeks, and you can reorder themes.
