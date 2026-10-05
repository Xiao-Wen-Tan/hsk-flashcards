# HSK Flashcards Plan 4: Screens, Sound, Stroke Order and Offline Use Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build every screen of the design (Today, Session with learning cards and the three quiz types, Check-in, Progress map, Stats, Badges, Settings), the sound playback, the stroke-order animation and the offline support, so the app installs to the Android home screen and runs a whole study day without internet.

**Architecture:** The screens are plain HTML, CSS and JavaScript ES modules in `docs/`, with no framework, no build step and no npm packages. Each screen has two halves. A "view" module in `docs/js/view/` turns saved data into plain objects (what to show), and Node tests it with the 61-word fixture of Plan 2. A "ui" module in `docs/js/ui/` draws those objects on the page and sends taps to Plan 2's controller `docs/js/study.js`, which saves every answer through `docs/js/store.js`. A service worker (`docs/sw.js`, a script the browser keeps next to the app) answers requests from the phone's storage, so the app opens offline. Stroke order uses Hanzi Writer, copied into `docs/vendor/` with its licence, and its per-character data, copied into `docs/strokes/`.

**Tech Stack:** Node v24.16.0 (`node:test`, `node:vm`, built-in `fetch` and `WebSocket`), plain JavaScript ES modules, Python 3.10 with pytest and Pillow for three small tools, Hanzi Writer 3.7.3 and hanzi-writer-data 2.0.1 (pinned, checksum-checked), headless Google Chrome for the browser checks, Git Bash on Windows.

**Spec:** `.claude/specs/2026-09-27-hsk-flashcards-design.md` (the design). The word data contract is `.claude/plans/words-json-schema.md`. The app logic is `.claude/plans/2026-09-27-plan2-app-logic.md` (Plan 2).

**Where this plan sits:**
- Plan 1 (done) decoded the PDFs.
- Plan 2 builds the app logic in `docs/js/`. This plan calls it and never changes it.
- Plan 3 (3a and 3b) builds the word list, the sentences, the audio (`docs/audio/w/*.mp3`, `docs/audio/s/*.mp3`) and the words file `docs/data/words_vNNN.json`.
- Plan 4 (this plan) builds the screens, sound, stroke order and offline use.
- Plan 5 adds the Google Sheet backup and deploys the site. This plan leaves it a hook (Task 10) and nothing else.

**Before you start.** Plan 2 must be finished, so `node --test "tests/js/*.test.mjs"` gives `ℹ tests 138`, `ℹ pass 137`, `ℹ skipped 1`. This plan can be carried out before Plan 3 finishes. Its tests use Plan 2's fixture `tests/js/fixtures/words_fixture.json`, and its browser checks use a local copy of the site with that fixture and silent stand-in sound files (Task 17).

---

## Facts verified before writing this plan (2026-09-28)

Each fact below was checked by running a command or reading a file on 2026-09-28.

- **Plan 2 runs as written.** Every code block of Plan 2 was extracted into a scratch folder with a small script, and `node --test "tests/js/*.test.mjs"` there gave `ℹ tests 138`, `ℹ pass 137`, `ℹ skipped 1`, the numbers Plan 2's Task 17 expects. All code of this plan was then written and run against those modules in the same scratch folder. Nothing was written into the project tree except this plan file.
- **Plan 2's interface, as this plan calls it.** `Study.start({ store, data, now })`, `study.card`, `study.finished`, `study.canUndo`, `study.next()`, `study.answer(grade, now)`, `study.undo(now)`, `study.finish(now)` (which returns `{ day, checkedIn, justCheckedIn, streak, summary, newBadges, left }`), `study.plan`, `study.state`, `study.byId`, `study.day`, `study.settings`, `previewDay({ store, data, now })` and `loadSettings(store)` from `study.js`. `openIdbStore()`, `askPersistentStorage()`, `MemoryStore` and the store methods `allProgress`, `getProgress`, `commit`, `eventsSince`, `eventsFrom`, `allDays`, `getMeta`, `dump` and `restore` from `store.js`. `makePool(words)` and `buildChoices(pool, word, quiz, { day, step })` from `distractors.js`. `currentStreak`, `bestStreak`, `weekStrip` and `monthCalendar` from `checkin.js`. `totals`, `levelProgress`, `themeProgress`, `activity`, `forecast` and `accuracy` from `stats.js`. `badgeTitle` from `badges.js`. `nextNewWords` from `curriculum.js`. `learnedProgress`, `isLearned` and `isMastered` from `srs.js`. `studyDay`, `addDays` and `weekdayIndex` from `dates.js`. `CONFIG` and `normalizeSettings` from `config.js`.
- **Test totals.** With this plan's code, `node --test "tests/js/*.test.mjs"` gave `ℹ tests 193`, `ℹ pass 191`, `ℹ fail 0`, `ℹ skipped 2`. The 55 new tests are strokes 3, view-card 6, view-quiz 7, view-today 4, view-progress 6, view-misc 6, audio 5, offline 2, hooks 4, flow 2, sw 7 and release 3. The two skipped tests are Plan 2's real-data test and this plan's words-file test, and both wait for Plan 3's `docs/data/words_vNNN.json`. `python -m pytest tests/test_strokedata.py -q` gave `7 passed`.
- **Each new test file fails first.** With its module moved away, every new Node test file failed with `ERR_MODULE_NOT_FOUND` and `ℹ fail 1`, except `sw.test.mjs`, which failed with `ENOENT` for `docs\sw.js` and `ℹ fail 7`.
- **The user's decisions of 2026-09-28 were applied test-first** (see "Decisions the user made on 2026-09-28" below). The changed code was re-run against Plan 2's modules as committed in the project (`docs/js/`, `tests/js/`). With the new tests and the code as it was before those decisions, `view-card.test.mjs` failed its new test on the number of plays (`actual: undefined`, `expected: 2`), `view-quiz.test.mjs` failed its listening test (`actual: '苹果'`, `expected: null`), and both tests of `flow.test.mjs` failed on the characters of a listening question. With the new code, they gave 6, 7 and 2 passing tests. In Chrome, the `day` check of Task 17 against the screen code from before the decisions failed "the listening question hides the characters" (12 of 12 showed them) and "the card after an answer plays its sound once" (it played twice), and with the new code all 18 lines passed.
- **The release test catches a stale words file.** With no `docs/data/words_v*.json` it skips its words-file test. With the fixture copied to `docs/data/words_v001.json` and stroke data present, all 3 tests passed. With a second copy as `words_v002.json`, the words-file test failed, because `WORDS_FILE` still named v001.
- **Hanzi Writer.** The npm registry lists hanzi-writer 3.7.3 as latest (MIT licence) and hanzi-writer-data 2.0.1 as latest ("SEE LICENSE IN ARPHICPL.TXT"). Their tarballs downloaded and matched the registry's sha512 checksums, which `tools/strokedata.py` pins. The hanzi-writer package has `dist/index.esm.js`, an ES module whose last line is `export default HanziWriter` and which imports nothing. The data package has 9,580 files, one `<character>.json` per character (爱.json is 3,087 bytes), plus `ARPHICPL.TXT`.
- **Stroke data size.** The 4,991 words of the public old-HSK list (`data/public/hsk2_old_exclusive_v001.json`) use 2,632 distinct characters. All 2,632 have a data file, and together they are 7.2 MB.
- **The tools ran.** `python tools/12_vendor_strokes.py` with no words file copied the library and its licence (2 files). With `--words tests/js/fixtures/words_fixture.json` it wrote 80 more files (79 characters and the licence) and a second run found all 82 already present and wrote nothing. `python tools/13_make_icons.py` wrote the three icons (192×192, 512×512 and a 512×512 maskable one), and a second run refused to replace them and exited with 1. `python tools/14_smoke_site.py` built `.claude/scratch/smoke_v001/` with 61 word sounds and 80 stroke files.
- **`node --check` catches a syntax error** in a page-only module (it printed `SyntaxError: Unexpected token ';'` and exited with 1), so Tasks 13 to 15 use it for the files Node cannot import.
- **Browser checks in headless Chrome (Chrome for Windows, started with `--headless=new --remote-debugging-port=9333`).** The Claude in Chrome extension was not connected during planning, so the checks ran through `tests/browser/check.mjs` (Task 17), which drives Chrome over its debugging protocol.
  - The `store` check passed all 7 IndexedDB store checks in Chrome, including a restore and reopening the database.
  - In the `day` check, on a fresh profile, Today showed 12 new words, and one whole session went through 12 learning cards, 12 listening checks and 12 pinyin checks. Stroke order drew an SVG drawing, the check-in screen said "Checked in! | 1 day streak | 12 new words learned" with the badge "Finished Starter Kit", the service worker controlled the page, 81 sound and stroke files for today and tomorrow were saved, no listening question showed characters, a new word's card played its sound twice and the card after an answer played it once, a word card left alone played its sound exactly twice, every other screen drew, Chrome reported no installability errors (`Page.getInstallabilityErrors` gave `[]`), and the page threw no uncaught error.
  - In the `offline` check, with the local server stopped, the app opened from the service worker, a word card opened, its saved sound played to the end, and its stroke order drew. A word whose stroke file was never saved showed "Stroke order for 苹 is not on this phone yet. Connect to the internet once to get it."
  - In the `update` check, after `RELEASE` was raised to r002 in the smoke copy, the page showed "Update available, tap to reload". The tap reloaded it, only `app-r002` and `media-v1` were left, and the streak was kept.
  - Cache Storage failed with "Unexpected internal error" when Chrome's profile folder was inside the long scratch path, and worked with the profile at `%TEMP%\hskchk`. Task 17 therefore uses that short path.
  - On Windows, `process.exit()` right after closing the WebSocket crashed Node with a libuv assertion (exit code 127), so `check.mjs` sets `process.exitCode` instead.
- **Screenshots.** At phone size (412×915), the learning card of 苹果 showed characters, pinyin, "noun", "apple", the two buttons, the stroke animation of 苹 in progress and the sentence with 苹果 highlighted, above the bottom navigation bar. The progress map showed five tiles with Starter Kit marked "Now".
- **Not checked.** Nothing ran on the Android phone, because the site is not deployed yet (Plan 5). The "Tap to continue" screen was not triggered, because the headless Chrome was started with the flag that allows sound without a tap. Both are in the phone checklist of Task 18.

## Choices this plan makes where the design is silent

Each choice is set in one place, named in brackets, so it is easy to change.

1. **How the app finds the words file.** A static site cannot list a folder, so `docs/js/release.js` names the file (`WORDS_FILE = 'data/words_v001.json'`), and `docs/sw.js` repeats it. `tests/js/release.test.mjs` fails when a newer `docs/data/words_vNNN.json` exists than the one named, or when a character of it has no stroke file. (`release.js`, `sw.js`, Task 16)
2. **Release numbers.** Every release that changes a file in `docs/` raises `RELEASE` (r001, r002, ...) in both files. The new number makes a new app cache, and phones then show "Update available, tap to reload". The new version waits for that tap and never takes over by itself. (`release.js`, `sw.js`)
3. **Stroke data is copied into the site, not loaded from a CDN** (a CDN is a third-party file server). The design names Hanzi Writer but not where its data comes from. By default Hanzi Writer fetches data from cdn.jsdelivr.net, which fails offline. So `tools/12_vendor_strokes.py` copies the pinned library and only the data of the headword characters (about 2,600 files, 7.2 MB), each checked against the registry's checksum, with both licence texts. (Task 1)
4. **Which files are kept for today and tomorrow.** At the start of a session the app saves the word sound, sentence sound and stroke data of today's words, every word due by tomorrow, and the next day's new words as if today's were learned (`soonWords`, Task 7). The design's "about 4 MB" was not measured. "Download all audio (about 150 MB)" in Settings also saves every stroke file, which adds about 7 MB. (`view/files.js`)
5. **Sound details.** The two plays of a word are 700 ms apart (`gapMs` in `audio.js`). A sentence plays once, and only when its button is tapped. The pinyin question plays no sound, because the sound would give the answer away. The listening question and the recall card play the word twice, and so does a new word's learning card and a word opened from the map. The learning card after a quiz answer plays it once (the user's decision of 2026-09-28), and its "Play again" button also plays it once. (`PLAYS_NEW` and `PLAYS_AFTER_ANSWER` in `view/card.js`)
6. **Auto-play off.** When the learner turns auto-play off in Settings, nothing plays until a play button is tapped, the listening question included. (`autoplayOn` in `ui/session.js`)
7. **The recall card.** It shows characters, pinyin and sound with a Reveal button. Reveal shows the full learning card with the three ratings (Know it, Unsure, Don't know) under it, and a rating goes straight to the next card. So the full card revealed before the rating counts as the card shown after the answer. (`ui/session.js`)
8. **Undo.** The Undo button sits in the session's top bar and works while Plan 2's `study.canUndo` is true, which is from an answer until the next answer (Plan 2 Choice 7). So it still works on the next card after a mis-tap. (`ui/session.js`)
9. **Leaving a session.** The Stop button (after a confirmation), the bottom navigation and the phone's Back button all end the session through `study.finish()`. Every answer is already saved, so nothing is lost. The next Start plans again from what is left today. Re-asks that were waiting in the stopped session are dropped. (`endSession` in `ui/session.js`, `render` in `app.js`)
10. **"Tap to continue".** It appears when the phone refuses to play a sound, and whenever the app comes back to the screen during a session, as the design describes for a phone that paused the app. (`app.needTap`, `playSound`)
11. **Navigation.** A bottom bar holds Today, Map, Stats, Badges and Settings. The session hides it. The check-in screen opens after every session and when the streak on Today is tapped. Screens are chosen by the part of the address after `#` ("#/map"), so the app is one page that works offline. (`view/route.js`)
12. **The Badges screen** lists the earned badges with their dates, then the next milestone of each counted kind (streak, check-ins, learned, mastered) with the learner's count so far. (`badgesView`)
13. **Part of speech** is spelled out for a beginner ("noun", "measure word"). (`posText`)
14. **Restore from a backup file.** The design's Settings list says "backup and restore" and names a "Download backup file" button. Restoring from the Google Sheet is Plan 5's. This plan adds "Restore from a backup file", which replaces all progress on the phone after a confirmation, and the user chose on 2026-09-28 to keep it. (`parseBackup`, `ui/settings.js`)
15. **Asking Chrome to protect the saved data.** The app asks after every session (the design says after the first, and asking again changes nothing once it is granted), and Settings shows whether the data is protected, with a button to ask again. (`endSession`, `ui/settings.js`)
16. **Icons** are a red square with "HSK" in white, drawn by Pillow with its built-in font, plus a maskable version whose text stays in the safe middle area. (`tools/13_make_icons.py`)
17. **Credits** are on their own page, `docs/credits.html`, linked from Settings. Plan 3b left showing credits inside the app to this plan. (`credits.html`)
18. **Plan 5's hook.** `docs/js/plugins.js` lists modules to load (empty now), and `docs/js/hooks.js` calls them at four moments: 'open', 'hidden', 'sessionEnd' and 'settings'. A failing plugin is logged and skipped, so a backup problem never stops a study session. (Task 10)
19. **The Settings form** keeps values inside their ranges (new words 4 to 30, reviews 20 to 300, from Plan 2's `config.js`) and says what was saved.
20. **Every tile of the progress map can be tapped**, locked ones included, because the design says tapping a tile lists its words.

## Decisions the user made on 2026-09-28

1. **The listening question hides the characters.** The design says characters are "always shown but never tested", but a learner who reads 苹果 could pick "apple" without listening. So the question "listen and pick the meaning" shows no characters while it is on screen, and they appear on the full learning card after the answer. The pinyin question and the recall card still show them. (`questionView` in Task 4, `renderSession` in Task 14)
2. **The learning card after an answer plays the word once.** The listening question plays the word twice, and before this decision the card after the answer played it twice more. A new word's learning card still plays it twice, and the recall card is unchanged. (`learningCard` in Task 3, `cardElement` in Task 13, `renderSession` in Task 14)
3. **"Restore from a backup file" stays in Settings**, as Choice 14 describes. (Tasks 7 and 15)

---

## Words used in this plan

- **View module.** A file in `docs/js/view/` that turns saved data into a plain object that says what a screen shows. For example `todayView` turns Plan 2's day plan into `{ streak: 2, reviews: 20, newWords: 12, status: '20 reviews and 12 new words today.', startLabel: 'Start', ... }`. It never touches the page, so Node can test it.
- **UI module.** A file in `docs/js/ui/` that draws a view object on the page and handles taps. Node cannot run these, so the browser checks of Task 17 do.
- **Service worker.** A script (`docs/sw.js`) that the browser keeps next to the app and asks before every request. It answers from the phone's Cache Storage (the browser's store of saved files) when it can.
- **App cache and media cache.** `app-r001` holds the app's own files and the words file of release r001. `media-v1` holds sound and stroke files. A file name there changes when its content changes, so it never needs clearing.
- **Smoke site.** A local copy of `docs/` with the fixture as the words file and silent stand-in sounds, built by `tools/14_smoke_site.py` in `.claude/scratch/` for the browser checks.
- **Vendoring.** Copying a third-party library's files into this site, so it never depends on another server.

## File map

| File | Responsibility |
|---|---|
| `tools/strokedata.py` | Download the pinned Hanzi Writer packages, check their checksums, and copy the library and the headword characters' stroke data into `docs/` without replacing any file |
| `tools/12_vendor_strokes.py` | Step 12: run that copy for the latest words file and write a report |
| `tools/13_make_icons.py` | Step 13: draw the three app icons |
| `tools/14_smoke_site.py` | Step 14 (checking only): build the smoke site in `.claude/scratch/smoke_vNNN/` |
| `docs/vendor/hanzi-writer-3.7.3.esm.js`, `docs/vendor/hanzi-writer-LICENSE.txt` | Hanzi Writer and its MIT licence (copied by step 12) |
| `docs/strokes/<code point>.json`, `docs/strokes/ARPHICPL.TXT` | Stroke data per character and its licence (copied by step 12 once Plan 3's words file exists) |
| `docs/icons/*.png`, `docs/manifest.webmanifest` | Home-screen icons and the web app manifest (the file that makes the site installable) |
| `docs/index.html`, `docs/credits.html`, `docs/css/app.css` | The one page, the credits page and the styles |
| `docs/sw.js` | The service worker |
| `docs/js/release.js` | `RELEASE` and `WORDS_FILE` |
| `docs/js/plugins.js`, `docs/js/hooks.js` | The hook for Plan 5 |
| `docs/js/audio.js` | Play a sound once or twice, stop it |
| `docs/js/offline.js` | Save sound and stroke files in Cache Storage |
| `docs/js/strokes.js` | Stroke file names, stroke data loading, the animation |
| `docs/js/view/format.js` | Small text helpers |
| `docs/js/view/card.js` | What the learning card shows |
| `docs/js/view/quiz.js` | What a question shows, and how a tap is graded |
| `docs/js/view/today.js` | The Today screen |
| `docs/js/view/progress.js` | Progress map, theme list, Stats, Badges, Check-in |
| `docs/js/view/route.js` | Screen addresses |
| `docs/js/view/settings.js` | Settings form and the backup file |
| `docs/js/view/files.js` | Which files to keep on the phone |
| `docs/js/ui/dom.js`, `ui/card.js`, `ui/update.js`, `ui/session.js`, `ui/screens.js`, `ui/settings.js` | Drawing the screens and handling taps |
| `docs/js/app.js` | Start-up and choosing the screen |
| `tests/js/*.test.mjs` | Node tests of the modules above, with the fixture of Plan 2 |
| `tests/test_strokedata.py` | pytest for `tools/strokedata.py` |
| `tests/browser/store-idb.html`, `tests/browser/store-idb.js` | Plan 2's store checks against IndexedDB in Chrome |
| `tests/browser/check.mjs` | Headless Chrome checks of the store page and the smoke site |

`docs/` is the public web root. Only app files, vendored libraries with their licences, and the credits page go there. Tests, the fixture and the smoke site stay outside it.

---

### Task 1: Copy Hanzi Writer and the stroke data into the site (`tools/strokedata.py`, `tools/12_vendor_strokes.py`)

Hanzi Writer draws a character stroke by stroke from a small data file per character. For 爱 (code point U+7231) the data is `docs/strokes/7231.json`. This task writes the tool that copies the library and those data files from the npm registry, where each package is a `.tgz` archive with a published sha512 checksum. The tool never replaces a file, so running it again after a new words file only adds new characters.

**Files:**
- Create: `tools/strokedata.py`, `tools/12_vendor_strokes.py`
- Test: `tests/test_strokedata.py`
- Output: `docs/vendor/hanzi-writer-3.7.3.esm.js`, `docs/vendor/hanzi-writer-LICENSE.txt`, `data/reports/strokes_vNNN.txt`, and, once a words file exists, `docs/strokes/*.json` and `docs/strokes/ARPHICPL.TXT`

- [ ] **Step 1: Write the failing test `tests/test_strokedata.py`**

```python
import base64
import hashlib
import io
import tarfile

import pytest

from strokedata import (HANZI_WRITER, check_integrity, han_chars, read_members, stroke_name,
                        tarball_url, vendor, write_same_or_new)


def make_tgz(files):
    """A small .tgz in memory with {name: bytes}."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def test_names_and_urls():
    assert stroke_name("爱") == "7231.json"
    assert stroke_name("苹") == "82f9.json"
    assert tarball_url(HANZI_WRITER) == "https://registry.npmjs.org/hanzi-writer/-/hanzi-writer-3.7.3.tgz"


def test_han_chars_skips_pattern_marks_and_letters():
    words = [{"hz": "虽然…但是…"}, {"hz": "卡拉OK"}, {"hz": "但是"}]
    assert han_chars(words) == sorted(["虽", "然", "但", "是", "卡", "拉"])


def test_check_integrity():
    data = b"hello"
    good = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
    check_integrity(data, good)
    with pytest.raises(ValueError, match="checksum mismatch"):
        check_integrity(b"other", good)


def test_read_members_keeps_only_wanted_files():
    tgz = make_tgz({"package/爱.json": b"{}", "package/README.md": b"x"})
    assert read_members(tgz, ["package/爱.json", "package/我.json"]) == {"package/爱.json": b"{}"}


def test_write_same_or_new_never_overwrites(tmp_path):
    p = tmp_path / "a" / "7231.json"
    assert write_same_or_new(p, b"1") == "new"
    assert write_same_or_new(p, b"1") == "same"
    with pytest.raises(FileExistsError):
        write_same_or_new(p, b"2")
    assert p.read_bytes() == b"1"


def test_vendor_writes_library_licences_and_strokes(tmp_path):
    writer = make_tgz({"package/dist/index.esm.js": b"export default 1;", "package/LICENSE": b"MIT"})
    data = make_tgz({"package/爱.json": b'{"strokes":[]}', "package/ARPHICPL.TXT": b"APL"})
    tally = vendor(tmp_path, [{"hz": "爱"}, {"hz": "嗯"}], writer, data)
    assert tally == {"new": 4, "same": 0, "missing": ["嗯"]}
    assert (tmp_path / "vendor" / "hanzi-writer-3.7.3.esm.js").read_bytes() == b"export default 1;"
    assert (tmp_path / "vendor" / "hanzi-writer-LICENSE.txt").read_bytes() == b"MIT"
    assert (tmp_path / "strokes" / "ARPHICPL.TXT").read_bytes() == b"APL"
    assert (tmp_path / "strokes" / "7231.json").read_bytes() == b'{"strokes":[]}'
    again = vendor(tmp_path, [{"hz": "爱"}], writer, data)
    assert again == {"new": 0, "same": 4, "missing": []}


def test_vendor_without_words_writes_only_the_library(tmp_path):
    writer = make_tgz({"package/dist/index.esm.js": b"x", "package/LICENSE": b"MIT"})
    assert vendor(tmp_path, [], writer, b"") == {"new": 2, "same": 0, "missing": []}
    assert not (tmp_path / "strokes").exists()
```

- [ ] **Step 2: Run it and see it fail**

Run: `python -m pytest tests/test_strokedata.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'strokedata'`.

- [ ] **Step 3: Write `tools/strokedata.py`**

```python
"""Vendoring Hanzi Writer and its stroke data into docs/ (copying them into the site).

Hanzi Writer (MIT licence) animates stroke order, and hanzi-writer-data (Arphic Public
License) holds one small JSON file of strokes per character. Both are fetched once from the
npm registry as pinned versions, checked against the registry's published checksum, and
unpacked. The app then loads them from its own site, so stroke order works offline.

A stroke file is named by the character's code point in hexadecimal: 爱 (U+7231) is
"7231.json". docs/js/strokes.js uses the same names.
"""
import base64
import hashlib
import io
import tarfile
import urllib.request
from pathlib import Path

HANZI_WRITER = {
    "name": "hanzi-writer",
    "version": "3.7.3",
    "integrity": "sha512-fdOFrb1cXWL/pV/oplJkcdziCvjJzhhf+qoIBm5IpVGxPBZEu4eLB6ZG5RJDbKXyNbNlyx8oIpa3XrcUBcSXpg==",
}
HANZI_WRITER_DATA = {
    "name": "hanzi-writer-data",
    "version": "2.0.1",
    "integrity": "sha512-nbQwM+MaryGoq7pBMIZLCd3lFq03nXuJuwku1+6UbjL58uU+9OULVcMkoNvNuJSoIV7f1bbPRfD4D/LQa5S7qg==",
}
# What the app needs from the Hanzi Writer package: {path inside the package: path under docs/}.
WRITER_FILES = {
    "package/dist/index.esm.js": "vendor/hanzi-writer-3.7.3.esm.js",
    "package/LICENSE": "vendor/hanzi-writer-LICENSE.txt",
}
DATA_LICENSE = ("package/ARPHICPL.TXT", "strokes/ARPHICPL.TXT")

# Unicode blocks of the Han script, the same set as /\p{Script=Han}/ in strokes.js for
# every character the word list can hold.
_HAN = [(0x2E80, 0x2FDF), (0x3005, 0x3005), (0x3007, 0x3007), (0x3021, 0x3029), (0x3038, 0x303B),
        (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0x20000, 0x3FFFF)]


def tarball_url(pkg):
    """tarball_url(HANZI_WRITER) gives https://registry.npmjs.org/hanzi-writer/-/hanzi-writer-3.7.3.tgz."""
    return f"https://registry.npmjs.org/{pkg['name']}/-/{pkg['name']}-{pkg['version']}.tgz"


def check_integrity(data, integrity):
    """Raise ValueError unless data matches an npm integrity string such as "sha512-<base64>"."""
    algo, expected = integrity.split("-", 1)
    got = base64.b64encode(hashlib.new(algo, data).digest()).decode("ascii")
    if got != expected:
        raise ValueError(f"checksum mismatch: expected {algo}-{expected}, got {algo}-{got}")


def download(pkg):
    """The package's .tgz bytes, checked against its pinned checksum."""
    with urllib.request.urlopen(tarball_url(pkg), timeout=120) as res:
        data = res.read()
    check_integrity(data, pkg["integrity"])
    return data


def read_members(tgz, names):
    """{name: bytes} for the wanted names that the .tgz holds. Missing names are left out."""
    wanted = set(names)
    out = {}
    with tarfile.open(fileobj=io.BytesIO(tgz), mode="r:gz") as tar:
        for member in tar:
            if member.isfile() and member.name in wanted:
                out[member.name] = tar.extractfile(member).read()
    return out


def is_han(ch):
    return any(lo <= ord(ch) <= hi for lo, hi in _HAN)


def han_chars(words):
    """The distinct Chinese characters of the headwords, sorted. A pattern word's "…" is skipped."""
    return sorted({ch for w in words for ch in w["hz"] if is_han(ch)})


def stroke_name(ch):
    """stroke_name("爱") gives "7231.json"."""
    return f"{ord(ch):x}.json"


def write_same_or_new(path, data):
    """Write bytes to a new file. An existing file with the same bytes is kept ("same").
    An existing file with other bytes is never replaced: that raises FileExistsError."""
    path = Path(path)
    if path.exists():
        if path.read_bytes() == data:
            return "same"
        raise FileExistsError(f"{path} exists with other content. It is never overwritten.")
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "xb") as f:
        f.write(data)
    return "new"


def vendor(docs, words, writer_tgz, data_tgz):
    """Write the library, its licence, and the stroke data of every character of `words`
    (with the data licence) under the docs folder. Returns {"new": n, "same": n, "missing": [chars]}."""
    docs = Path(docs)
    tally = {"new": 0, "same": 0, "missing": []}
    got = read_members(writer_tgz, WRITER_FILES)
    for inside, target in WRITER_FILES.items():
        tally[write_same_or_new(docs / target, got[inside])] += 1
    chars = han_chars(words)
    if not chars:
        return tally
    names = {f"package/{ch}.json": ch for ch in chars}
    got = read_members(data_tgz, [*names, DATA_LICENSE[0]])
    tally[write_same_or_new(docs / DATA_LICENSE[1], got[DATA_LICENSE[0]])] += 1
    for inside, ch in names.items():
        if inside not in got:
            tally["missing"].append(ch)
            continue
        tally[write_same_or_new(docs / "strokes" / stroke_name(ch), got[inside])] += 1
    return tally
```

- [ ] **Step 4: Run it and see it pass**

Run: `python -m pytest tests/test_strokedata.py -q`
Expected: `7 passed`.

- [ ] **Step 5: Write `tools/12_vendor_strokes.py`**

```python
"""Step 12. Copy Hanzi Writer and the stroke data of every headword character into docs/.

Inputs:  the pinned npm packages hanzi-writer 3.7.3 and hanzi-writer-data 2.0.1 (downloaded,
         checksum-checked), and the latest docs/data/words_vNNN.json (or --words PATH)
Outputs: docs/vendor/hanzi-writer-3.7.3.esm.js, docs/vendor/hanzi-writer-LICENSE.txt,
         docs/strokes/<code point>.json for each character, docs/strokes/ARPHICPL.TXT,
         data/reports/strokes_vNNN.txt
Before Plan 3 writes the words file, only the library is copied. Run it again after each new
words file: files already there are kept, and only new characters are added.
"""
import argparse
import sys
from pathlib import Path

from common import all_version_paths, next_version_path, read_json, write_new_text
from strokedata import HANZI_WRITER, HANZI_WRITER_DATA, download, han_chars, vendor


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--words", help="words file (default: the latest docs/data/words_vNNN.json)")
    args = parser.parse_args()
    if args.words:
        words_path = Path(args.words)
    else:
        found = all_version_paths("docs/data/words", ".json")
        words_path = found[-1][1] if found else None
    words = read_json(words_path)["words"] if words_path else []
    print(f"Words file: {words_path or 'none yet, so only the library is copied'}")
    writer_tgz = download(HANZI_WRITER)
    data_tgz = download(HANZI_WRITER_DATA) if words else b""
    tally = vendor("docs", words, writer_tgz, data_tgz)
    lines = [
        f"words file: {words_path or 'none'}",
        f"characters: {len(han_chars(words))}",
        f"files written: {tally['new']}, already present: {tally['same']}",
        f"characters without stroke data: {len(tally['missing'])} {''.join(tally['missing'])}",
    ]
    report = next_version_path("data/reports/strokes", ".txt")
    write_new_text(report, "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Report: {report}")
    return 1 if tally["missing"] else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 6: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/12_vendor_strokes.py`
Expected, before Plan 3 has written a words file:
```
Words file: none yet, so only the library is copied
words file: none
characters: 0
files written: 2, already present: 0
characters without stroke data: 0
Report: data\reports\strokes_v001.txt
```
Once `docs/data/words_vNNN.json` exists, the same command copies about 2,600 stroke files (7.2 MB for the 2,632 characters of the public old-HSK list). It exits with 1 and names the characters when any has no stroke data.

- [ ] **Step 7: Check the library file**

Run: `tail -c 120 docs/vendor/hanzi-writer-3.7.3.esm.js`
Expected: the output ends with `export default HanziWriter;` and a `//# sourceMappingURL=index.esm.js.map` line.

- [ ] **Step 8: Commit**

```bash
git add tools/strokedata.py tools/12_vendor_strokes.py tests/test_strokedata.py docs/vendor && git commit -F - <<'EOF'
feat(app): vendor Hanzi Writer and stroke data with pinned checksums

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

`data/reports/` is git-ignored, so the report is not committed. If Plan 3's words file already exists, Step 6 also wrote `docs/strokes/`, so add it to the same commit with `git add docs/strokes`.

---

### Task 2: Stroke file names and stroke data loading (`docs/js/strokes.js`)

For example, `charsOf('虽然…但是…')` gives the four characters without the pattern marks, and `strokeUrl('苹')` gives `'strokes/82f9.json'`. `animateWord` loads the library only when the learner taps "Stroke order", so the start-up stays small.

**Files:**
- Create: `docs/js/strokes.js`
- Test: `tests/js/strokes.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { charsOf, loadStrokeData, strokeUrl } from '../../docs/js/strokes.js';

test('only Chinese characters get a stroke animation', () => {
  assert.deepEqual(charsOf('苹果'), ['苹', '果']);
  assert.deepEqual(charsOf('虽然…但是…'), ['虽', '然', '但', '是']);
  assert.deepEqual(charsOf('卡拉OK'), ['卡', '拉']);
});

test('stroke files are named by code point', () => {
  assert.equal(strokeUrl('爱'), 'strokes/7231.json');
  assert.equal(strokeUrl('苹'), 'strokes/82f9.json');
});

test('stroke data loads per character, and a missing file gives a plain message', async () => {
  const files = { 'strokes/82f9.json': { strokes: ['a'] }, 'strokes/679c.json': { strokes: ['b'] } };
  const fetchFn = async (url) => (files[url]
    ? { ok: true, json: async () => files[url] }
    : { ok: false, status: 404 });
  const data = await loadStrokeData(['苹', '果'], fetchFn);
  assert.deepEqual([...data.keys()], ['苹', '果']);
  assert.deepEqual(data.get('果'), { strokes: ['b'] });
  await assert.rejects(loadStrokeData(['爱'], fetchFn), /Stroke order for 爱 is not on this phone yet/);
  const offline = async () => { throw new TypeError('Failed to fetch'); };
  await assert.rejects(loadStrokeData(['苹'], offline), /not on this phone yet/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/strokes.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\strokes.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/strokes.js`**

```js
// Stroke-order animation with Hanzi Writer (MIT licence), a stroke-animation library kept
// in docs/vendor/, and its character data (Arphic Public License) kept in docs/strokes/.
// Each character's data file is named by its Unicode code point in hexadecimal, so 爱
// (U+7231) is strokes/7231.json. The functions above animateWord never touch the page.

export const HANZI_WRITER = '../vendor/hanzi-writer-3.7.3.esm.js'; // relative to this file
export const STROKES_BASE = 'strokes/'; // relative to index.html

// The characters that get a stroke animation. A pattern word's '…' is left out.
// charsOf('虽然…但是…') gives ['虽', '然', '但', '是'].
export function charsOf(hz) {
  return [...hz].filter((ch) => /\p{Script=Han}/u.test(ch));
}

// strokeUrl('爱') gives 'strokes/7231.json'.
export function strokeUrl(ch, base = STROKES_BASE) {
  return `${base}${ch.codePointAt(0).toString(16)}.json`;
}

// Loads the stroke data of every character, or fails with a plain message when one file
// cannot be fetched (for example offline, before the file was saved on the phone).
export async function loadStrokeData(chars, fetchFn = globalThis.fetch) {
  const data = new Map();
  for (const ch of chars) {
    let res;
    try {
      res = await fetchFn(strokeUrl(ch));
    } catch {
      res = null;
    }
    if (!res || !res.ok) throw new Error(`Stroke order for ${ch} is not on this phone yet. Connect to the internet once to get it.`);
    data.set(ch, await res.json());
  }
  return data;
}

// Draws each character of hz in `container` and animates them one after another.
// Browser only. For example animateWord(box, '苹果') animates 苹, then 果.
export async function animateWord(container, hz, { size = 120, importer = () => import(HANZI_WRITER) } = {}) {
  const chars = charsOf(hz);
  const [data, mod] = await Promise.all([loadStrokeData(chars), importer()]);
  const HanziWriter = mod.default;
  container.replaceChildren();
  const writers = chars.map((ch) => {
    const box = document.createElement('div');
    box.className = 'stroke-box';
    container.append(box);
    return HanziWriter.create(box, ch, {
      width: size, height: size, padding: 6, showOutline: true, showCharacter: false,
      strokeAnimationSpeed: 1, delayBetweenStrokes: 250, strokeColor: '#b3261e',
      charDataLoader: (c) => data.get(c),
    });
  });
  for (const writer of writers) {
    await new Promise((resolve) => { writer.animateCharacter({ onComplete: resolve }); });
  }
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/strokes.test.mjs`
Expected: `ℹ tests 3`, `ℹ pass 3`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/strokes.js tests/js/strokes.test.mjs && git commit -F - <<'EOF'
feat(app): stroke file names, stroke data loading and animation

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 3: Text helpers and the learning card (`docs/js/view/format.js`, `docs/js/view/card.js`)

The learning card is the same on the first day and after every answer. For 苹果 it shows 苹果, "píngguǒ", "noun", "apple", the sound `audio/w/w0026_6ce06b7e.mp3`, and the sentence 我想吃苹果。 cut into "我想吃", a highlighted "苹果" and "。". Only the number of plays differs. A new word's card plays the word twice (`plays: 2`), and the card shown after a quiz answer plays it once (`plays: 1`), because the question has just played it (the user's decision of 2026-09-28).

**Files:**
- Create: `docs/js/view/format.js`, `docs/js/view/card.js`
- Test: `tests/js/view-card.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { highlightParts, learningCard } from '../../docs/js/view/card.js';
import { monthTitle, percent, plural, posText, shortDate } from '../../docs/js/view/format.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();

test('the headword is highlighted wherever the sentence has it', () => {
  assert.deepEqual(highlightParts('我爱我的家。', '爱'), [
    { text: '我', hl: false }, { text: '爱', hl: true }, { text: '我的家。', hl: false },
  ]);
  assert.deepEqual(highlightParts('谢谢，谢谢！', '谢谢'), [
    { text: '谢谢', hl: true }, { text: '，', hl: false }, { text: '谢谢', hl: true }, { text: '！', hl: false },
  ]);
});

test('a pattern word is highlighted half by half', () => {
  assert.deepEqual(highlightParts('虽然下雨，但是他来了。', '虽然…但是…'), [
    { text: '虽然', hl: true }, { text: '下雨，', hl: false }, { text: '但是', hl: true }, { text: '他来了。', hl: false },
  ]);
});

test('the learning card of 苹果 has every part the design names', () => {
  const c = learningCard(word(data, '苹果'));
  assert.equal(c.hz, '苹果');
  assert.equal(c.py, 'píngguǒ');
  assert.equal(c.pos, 'noun');
  assert.equal(c.en, 'apple');
  assert.equal(c.wordAudio, 'audio/w/w0026_6ce06b7e.mp3');
  assert.deepEqual(c.chars, ['苹', '果']);
  assert.equal(c.sentence.map((p) => p.text).join(''), '我想吃苹果。');
  assert.deepEqual(c.sentence.filter((p) => p.hl).map((p) => p.text), ['苹果']);
  assert.equal(c.sentencePy, 'Wǒ xiǎng chī píngguǒ.');
  assert.equal(c.sentenceEn, 'I want to eat an apple.');
  assert.equal(c.sentenceAudio, 'audio/s/w0026_814ba0af.mp3');
});

test('a new word\'s card plays the word twice, the card after an answer plays it once', () => {
  assert.equal(learningCard(word(data, '苹果')).plays, 2);
  assert.equal(learningCard(word(data, '苹果'), { afterAnswer: true }).plays, 1);
});

test('every fixture word gets a card whose sentence highlights its headword', () => {
  for (const w of data.words) {
    const c = learningCard(w);
    assert.ok(c.sentence.some((p) => p.hl), w.hz);
    assert.equal(c.sentence.map((p) => p.text).join(''), w.ex.hz);
  }
});

test('text helpers', () => {
  assert.equal(posText(['v.', 'n.']), 'verb, noun');
  assert.equal(posText([]), '');
  assert.equal(percent(0.254), '25%');
  assert.equal(plural(1, 'review'), '1 review');
  assert.equal(plural(3, 'review'), '3 reviews');
  assert.equal(shortDate('2026-10-05'), 'Mon 5 Oct');
  assert.equal(monthTitle('2026-10'), 'October 2026');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/view-card.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\view\card.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/view/format.js`**

```js
// Small text helpers shared by the screens. They never touch the page.
import { weekdayIndex } from '../dates.js';

// Part-of-speech labels of the words file, spelled out for a beginner.
const POS_NAMES = Object.freeze({
  'n.': 'noun', 'v.': 'verb', 'adj.': 'adjective', 'adv.': 'adverb', 'm.': 'measure word',
  'pron.': 'pronoun', 'prep.': 'preposition', 'conj.': 'conjunction', 'part.': 'particle',
  'num.': 'number', 'int.': 'interjection',
});

// posText(['v.', 'n.']) gives 'verb, noun'. An empty list gives ''.
export function posText(pos) {
  return pos.map((p) => POS_NAMES[p] ?? p).join(', ');
}

// percent(0.254) gives '25%'.
export function percent(share) {
  return `${Math.round(share * 100)}%`;
}

// plural(1, 'review') gives '1 review', plural(3, 'review') gives '3 reviews'.
export function plural(n, one, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August',
  'September', 'October', 'November', 'December'];

// shortDate('2026-10-05') gives 'Mon 5 Oct'.
export function shortDate(day) {
  const [, m, d] = day.split('-').map(Number);
  return `${WEEKDAYS[weekdayIndex(day)]} ${d} ${MONTHS[m - 1].slice(0, 3)}`;
}

// monthTitle('2026-10') gives 'October 2026'.
export function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

export const WEEKDAY_LETTERS = Object.freeze(['M', 'T', 'W', 'T', 'F', 'S', 'S']);
export const WEEKDAY_SHORT = Object.freeze(WEEKDAYS);
```

- [ ] **Step 4: Write `docs/js/view/card.js`**

```js
// What the learning card shows. The same card is used for a new word and after every
// quiz answer. It never touches the page, so Node can test it.
import { charsOf } from '../strokes.js';
import { posText } from './format.js';

export const AUDIO_BASE = 'audio/';

// The example sentence cut into plain and highlighted parts. A pattern word such as
// 虽然…但是… is highlighted half by half, because the sentence writes its halves apart.
// highlightParts('我爱我的家。', '爱') gives
//   [{ text: '我', hl: false }, { text: '爱', hl: true }, { text: '我的家。', hl: false }].
export function highlightParts(sentence, hz) {
  const heads = hz.split('…').filter(Boolean).sort((a, b) => b.length - a.length);
  const parts = [];
  let plain = '';
  let i = 0;
  while (i < sentence.length) {
    const head = heads.find((h) => sentence.startsWith(h, i));
    if (head) {
      if (plain) parts.push({ text: plain, hl: false });
      plain = '';
      parts.push({ text: head, hl: true });
      i += head.length;
    } else {
      plain += sentence[i];
      i += 1;
    }
  }
  if (plain) parts.push({ text: plain, hl: false });
  return parts;
}

// How many times the word plays when the card opens. A new word's card (and a word opened
// from the map) plays it twice. The card after a quiz answer plays it once, because the
// question has just played it (the user's decision of 2026-09-28).
export const PLAYS_NEW = 2;
export const PLAYS_AFTER_ANSWER = 1;

// Everything the learning card shows for one word of the words file.
// learningCard(apple).plays is 2, learningCard(apple, { afterAnswer: true }).plays is 1.
export function learningCard(word, { afterAnswer = false } = {}) {
  return {
    id: word.id,
    hz: word.hz,
    py: word.py,
    pos: posText(word.pos),
    en: word.en,
    wordAudio: AUDIO_BASE + word.au,
    chars: charsOf(word.hz),
    sentence: highlightParts(word.ex.hz, word.hz),
    sentencePy: word.ex.py,
    sentenceEn: word.ex.en,
    sentenceAudio: AUDIO_BASE + word.ex.au,
    plays: afterAnswer ? PLAYS_AFTER_ANSWER : PLAYS_NEW,
  };
}
```

- [ ] **Step 5: Run it and see it pass**

Run: `node --test tests/js/view-card.test.mjs`
Expected: `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/view/format.js docs/js/view/card.js tests/js/view-card.test.mjs && git commit -F - <<'EOF'
feat(app): learning card view with the highlighted example sentence

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 4: What a question shows, and how a tap is graded (`docs/js/view/quiz.js`)

Each session card comes from Plan 2's `session.js` as `{ type, id, quiz }`. The three quiz types of the design become three kinds of question:

| Card quiz | Question screen | Answer |
|---|---|---|
| `'listen'` | no characters, the sound plays twice | tap one of 4 English meanings |
| `'pinyin'` | characters and the English meaning, no sound | tap one of 4 pinyin |
| `'recall'` | characters, pinyin, the sound plays twice | Reveal, then Know it, Unsure or Don't know |

The listening question hides the characters (`hz: null`), so the learner has to listen rather than read, and the characters appear on the full learning card after the answer (the user's decision of 2026-09-28). The pinyin question and the recall card still show them.

The 4 choices come from Plan 2's `buildChoices`, which is seeded by the word and the day, so the same card shows the same choices in the same order all day. `step` is the word's ladder step before the answer, because a tone-variant choice appears only from step 2.

**Files:**
- Create: `docs/js/view/quiz.js`
- Test: `tests/js/view-quiz.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makePool } from '../../docs/js/distractors.js';
import { feedbackFor, gradeFor, progressLabel, questionView } from '../../docs/js/view/quiz.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const pool = makePool(data.words);
const DAY = '2026-10-06';
const apple = word(data, '苹果');

test('a listening review hides the characters, plays the sound and offers 4 English meanings', () => {
  const v = questionView({ card: { type: 'review', id: apple.id, quiz: 'listen' }, word: apple, pool, day: DAY, step: 1 });
  assert.equal(v.kind, 'listen');
  assert.equal(v.heading, 'Review');
  assert.equal(v.hz, null); // a learner who reads 苹果 could answer without listening
  assert.equal(v.sound, 'audio/w/w0026_6ce06b7e.mp3');
  assert.equal(v.choices.length, 4);
  assert.equal(v.choices[v.answerIndex], 'apple');
  assert.equal(new Set(v.choices).size, 4);
});

test('a pinyin question shows the meaning and offers 4 pinyin, with no sound', () => {
  const v = questionView({ card: { type: 'final', id: apple.id, quiz: 'pinyin', retry: 0 }, word: apple, pool, day: DAY, step: 0 });
  assert.equal(v.kind, 'pinyin');
  assert.equal(v.heading, 'Final check');
  assert.equal(v.hz, '苹果'); // characters are shown here but never tested
  assert.equal(v.en, 'apple');
  assert.equal(v.sound, null); // the sound would give the answer away
  assert.equal(v.choices.length, 4);
  assert.equal(v.choices[v.answerIndex], 'píngguǒ');
});

test('the same card on the same day shows the same choices in the same order', () => {
  const card = { type: 'review', id: apple.id, quiz: 'pinyin' };
  const a = questionView({ card, word: apple, pool, day: DAY, step: 2 });
  const b = questionView({ card, word: apple, pool, day: DAY, step: 2 });
  assert.deepEqual(a, b);
});

test('a recall card shows characters, pinyin and sound, and the three ratings', () => {
  const v = questionView({ card: { type: 'reask', id: apple.id, quiz: 'recall', retry: 1 }, word: apple, pool, day: DAY, step: 1 });
  assert.equal(v.kind, 'recall');
  assert.equal(v.heading, 'Once more');
  assert.deepEqual([v.hz, v.py, v.sound], ['苹果', 'píngguǒ', 'audio/w/w0026_6ce06b7e.mp3']);
  assert.deepEqual(v.grades.map((g) => g.grade), ['know', 'unsure', 'dontknow']);
  assert.deepEqual(v.grades.map((g) => g.label), ['Know it', 'Unsure', "Don't know"]);
});

test('a learning card has no question', () => {
  assert.deepEqual(questionView({ card: { type: 'learn', id: apple.id, group: 0 }, word: apple, pool, day: DAY, step: 0 }),
    { kind: 'learn', heading: 'New word' });
});

test('a tap is graded right or wrong, and the banner names the answer', () => {
  const v = questionView({ card: { type: 'check', id: apple.id, quiz: 'listen', group: 0, retry: 0 }, word: apple, pool, day: DAY, step: 0 });
  const wrongIndex = (v.answerIndex + 1) % 4;
  assert.equal(gradeFor(v, v.answerIndex), 'right');
  assert.equal(gradeFor(v, wrongIndex), 'wrong');
  assert.deepEqual(feedbackFor(v, v.answerIndex), { right: true, picked: v.answerIndex, answerIndex: v.answerIndex, message: 'Right!' });
  assert.equal(feedbackFor(v, wrongIndex).message, 'Not quite. The answer is "apple".');
});

test('the session header counts cards, and never past the last one', () => {
  assert.equal(progressLabel({ cards: [1, 2, 3], pos: 0 }), '1 / 3');
  assert.equal(progressLabel({ cards: [1, 2, 3], pos: 3 }), '3 / 3');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/view-quiz.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\view\quiz.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/view/quiz.js`**

```js
// What a session card shows before it is answered, and how a tap is graded.
// It never touches the page, so Node can test it.
import { buildChoices } from '../distractors.js';
import { AUDIO_BASE } from './card.js';

export const HEADINGS = Object.freeze({
  review: 'Review', reask: 'Once more', learn: 'New word', check: 'Quick check', final: 'Final check',
});

export const RECALL_GRADES = Object.freeze([
  { grade: 'know', label: 'Know it' },
  { grade: 'unsure', label: 'Unsure' },
  { grade: 'dontknow', label: "Don't know" },
]);

// The question for one card of the session (a card from Plan 2's session.js).
// step is the word's ladder step before this answer (0 for a new word), which
// buildChoices needs, because a tone-variant choice appears only from step 2.
// For example, the review card { type: 'review', id: 'w0026', quiz: 'listen' } of 苹果 gives
//   { kind: 'listen', heading: 'Review', hz: null, sound: 'audio/w/w0026_6ce06b7e.mp3',
//     prompt: 'Listen, then pick the meaning', choices: [4 English meanings], answerIndex }.
// The listening question hides the characters (hz: null), so the learner has to listen.
// They appear on the learning card after the answer (the user's decision of 2026-09-28).
export function questionView({ card, word, pool, day, step }) {
  const heading = HEADINGS[card.type];
  const sound = AUDIO_BASE + word.au;
  if (card.type === 'learn') return { kind: 'learn', heading };
  if (card.quiz === 'recall') {
    return { kind: 'recall', heading, hz: word.hz, py: word.py, sound, prompt: 'Do you know this word?', grades: RECALL_GRADES };
  }
  const { choices, answerIndex } = buildChoices(pool, word, card.quiz, { day, step });
  const texts = choices.map((c) => c.text);
  if (card.quiz === 'listen') {
    return { kind: 'listen', heading, hz: null, sound, prompt: 'Listen, then pick the meaning', choices: texts, answerIndex };
  }
  return { kind: 'pinyin', heading, hz: word.hz, en: word.en, sound: null, prompt: 'Pick the pinyin', choices: texts, answerIndex };
}

// The grade Plan 2's Study.answer expects for a tap on choice `index`.
export function gradeFor(view, index) {
  return index === view.answerIndex ? 'right' : 'wrong';
}

// The banner above the learning card after a multiple-choice answer.
export function feedbackFor(view, index) {
  const right = index === view.answerIndex;
  return {
    right,
    picked: index,
    answerIndex: view.answerIndex,
    message: right ? 'Right!' : `Not quite. The answer is "${view.choices[view.answerIndex]}".`,
  };
}

// '3 / 17' for the session header. Re-asks and retries make the total grow.
export function progressLabel(state) {
  const total = state.cards.length;
  return `${Math.min(state.pos + 1, total)} / ${total}`;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/view-quiz.test.mjs`
Expected: `ℹ tests 7`, `ℹ pass 7`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/view/quiz.js tests/js/view-quiz.test.mjs && git commit -F - <<'EOF'
feat(app): question views for the three quiz types and grading of taps

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 5: The Today screen (`docs/js/view/today.js`)

Worked example on Wednesday 7 October, with check-ins on Monday and Tuesday, 20 reviews due and 12 new words. The screen shows a 2-day streak, the week strip M T W T F S S with Monday and Tuesday filled, "20 reviews and 12 new words today." and a Start button. With 150 reviews waiting, Plan 2 halves the new words, and the note says "New words are halved today because 150 reviews are waiting."

**Files:**
- Create: `docs/js/view/today.js`
- Test: `tests/js/view-today.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { todayView } from '../../docs/js/view/today.js';

const TODAY = '2026-10-07'; // a Wednesday
const SETTINGS = { reviewCap: 100, newPerDay: 12 };
const plan = (extra) => ({ day: TODAY, reviews: [], newWords: [], backlog: 0, quota: 12, reviewsDone: 0, newDone: 0, ...extra });
const ids = (n) => Array.from({ length: n }, (_, i) => `w${i}`);

test('a normal day shows the counts, the streak and this week', () => {
  const v = todayView({ plan: plan({ reviews: ids(20), newWords: ids(12), backlog: 20 }), checkedDays: ['2026-10-05', '2026-10-06'], today: TODAY, settings: SETTINGS });
  assert.equal(v.streak, 2);
  assert.deepEqual(v.week.map((d) => d.letter), ['M', 'T', 'W', 'T', 'F', 'S', 'S']);
  assert.deepEqual(v.week.map((d) => d.checkedIn), [true, true, false, false, false, false, false]);
  assert.equal(v.week[2].isToday, true);
  assert.deepEqual([v.reviews, v.newWords], [20, 12]);
  assert.equal(v.status, '20 reviews and 12 new words today.');
  assert.equal(v.note, null);
  assert.deepEqual([v.canStart, v.startLabel], [true, 'Start']);
});

test('after a first session today the button says Continue', () => {
  const v = todayView({ plan: plan({ reviews: ids(3), reviewsDone: 5 }), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(v.startLabel, 'Continue');
});

test('a backlog halves or pauses new words, and the note says why', () => {
  const half = todayView({ plan: plan({ reviews: ids(100), newWords: ids(6), backlog: 150, quota: 6 }), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(half.note, 'New words are halved today because 150 reviews are waiting.');
  const paused = todayView({ plan: plan({ reviews: ids(100), backlog: 250, quota: 0 }), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(paused.note, 'New words are paused until the waiting reviews (250) are down to 200.');
});

test('with nothing due the learner can still tap Start to check in, once', () => {
  const open = todayView({ plan: plan({}), checkedDays: [], today: TODAY, settings: SETTINGS });
  assert.equal(open.canStart, true);
  assert.equal(open.status, 'Nothing is due. Tap Start to check in.');
  const done = todayView({ plan: plan({}), checkedDays: [TODAY], today: TODAY, settings: SETTINGS });
  assert.equal(done.canStart, false);
  assert.equal(done.status, 'Done for today. See you tomorrow!');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/view-today.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\view\today.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/view/today.js`**

```js
// The Today screen: streak, this week's check-ins, what is due and the Start button.
import { currentStreak, weekStrip } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { WEEKDAY_LETTERS, plural } from './format.js';

// plan is Plan 2's planDay result (from previewDay), checkedDays the checked-in study days.
// With 150 reviews waiting and the default settings, the note says that new words are halved.
export function todayView({ plan, checkedDays, today, settings }) {
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
    startLabel: plan.reviewsDone + plan.newDone > 0 ? 'Continue' : 'Start',
  };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/view-today.test.mjs`
Expected: `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/view/today.js tests/js/view-today.test.mjs && git commit -F - <<'EOF'
feat(app): Today view with streak, week strip, counts and backlog note

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 6: Progress map, theme list, Stats, Badges and Check-in (`docs/js/view/progress.js`)

These views read Plan 2's `stats.js`, `checkin.js` and `badges.js`. For example, with every Starter Kit word mastered and 2 of the 10 Greetings words learned, the map's tiles say Done, Now, Locked, Locked, Locked, and the Greetings tile says "2 of 10 learned, 0 mastered" with a 20% bar. The check-in calendar starts on Monday, so October 2026, which starts on a Thursday, begins with three blank cells.

**Files:**
- Create: `docs/js/view/progress.js`
- Test: `tests/js/view-progress.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  badgesView, calendarWeeks, checkinView, mapView, statsView, themeWordsView, wordStatus,
} from '../../docs/js/view/progress.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const TODAY = '2026-10-20';
const at = (id, step, due = '2026-10-25') => ({ ...learnedProgress(id, '2026-10-01'), step, due });
const mapOf = (list) => new Map(list.map((p) => [p.id, p]));
const t01 = data.words.filter((w) => w.theme === 't01');
const t02 = data.words.filter((w) => w.theme === 't02');

test('the map has a tile per theme, done, current or locked, with shares', () => {
  const tiles = mapView(data, mapOf([...t01.map((w) => at(w.id, 7)), at(t02[0].id, 1), at(t02[1].id, 2)]));
  assert.deepEqual(tiles.map((t) => [t.name, t.statusLabel]), [
    ['Starter Kit', 'Done'], ['Greetings & Courtesy', 'Now'], ['Numbers & Measure Words', 'Locked'],
    ['Family & People', 'Locked'], ['Food & Drink', 'Locked'],
  ]);
  assert.deepEqual([tiles[0].learnedPct, tiles[0].masteredPct], ['100%', '100%']);
  assert.deepEqual([tiles[1].learnedPct, tiles[1].masteredPct, tiles[1].counts], ['20%', '0%', '2 of 10 learned, 0 mastered']);
});

test('a theme lists its words in teaching order with their place', () => {
  const v = themeWordsView(data, 't05', mapOf([at(data.words.find((w) => w.hz === '苹果').id, 3), at(data.words.find((w) => w.hz === '茶').id, 8)]));
  assert.equal(v.name, 'Food & Drink');
  assert.deepEqual(v.words.slice(0, 3).map((w) => [w.hz, w.status]), [['苹果', 'Step 3'], ['米饭', 'New'], ['茶', 'Mastered']]);
  assert.equal(themeWordsView(data, 't99', new Map()), null);
  assert.equal(wordStatus({ step: 0 }), 'New');
});

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

test('the calendar starts on Monday and pads the month with blanks', () => {
  const weeks = calendarWeeks(['2026-10-05'], '2026-10', '2026-10-07');
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0].map((c) => c && c.date), [null, null, null, 1, 2, 3, 4]); // 1 October 2026 is a Thursday
  assert.deepEqual([weeks[1][0].date, weeks[1][0].checkedIn, weeks[1][2].isToday], [5, true, true]);
  assert.deepEqual(weeks[4].map((c) => c && c.date), [26, 27, 28, 29, 30, 31, null]);
});

test('the check-in screen explains the session result', () => {
  const result = {
    day: TODAY, checkedIn: true, justCheckedIn: true, streak: 3, newBadges: ['theme-t01'],
    summary: { reviews: 12, firstRight: 11, learned: 12, failed: 0, perfect: false }, left: { reviews: [], newWords: [] },
  };
  const v = checkinView({ result, checkedDays: [TODAY], today: TODAY, themes: data.themes });
  assert.equal(v.title, 'Checked in!');
  assert.equal(v.streak, 3);
  assert.deepEqual(v.lines, ['12 reviews, 11 right first time.', '12 new words learned.']);
  assert.deepEqual(v.badges, ['Finished Starter Kit']);
  assert.equal(v.monthTitle, 'October 2026');
  const early = checkinView({ result: { ...result, checkedIn: false, justCheckedIn: false, newBadges: [], left: { reviews: ['a'], newWords: ['b', 'c'] } }, checkedDays: [], today: TODAY, themes: data.themes });
  assert.equal(early.title, 'Not checked in yet');
  assert.equal(early.lines.at(-1), 'Still left today: 1 review and 2 new words.');
  const plain = checkinView({ result: null, checkedDays: [], today: TODAY, themes: data.themes });
  assert.deepEqual([plain.title, plain.streak, plain.lines], ['Check-in', null, []]);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/view-progress.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\view\progress.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/view/progress.js`**

```js
// The progress map, a theme's word list, Stats, Badges and the check-in screen.
// All functions take saved data and return plain objects, so Node can test them.
import { CONFIG } from '../config.js';
import { bestStreak, monthCalendar } from '../checkin.js';
import { weekdayIndex } from '../dates.js';
import { accuracy, activity, forecast, levelProgress, themeProgress, totals } from '../stats.js';
import { badgeTitle } from '../badges.js';
import { isLearned, isMastered } from '../srs.js';
import { WEEKDAY_SHORT, monthTitle, percent, plural } from './format.js';

const STATUS_LABEL = Object.freeze({ done: 'Done', current: 'Now', locked: 'Locked' });

// One tile per theme, in theme order.
export function mapView(data, progressById) {
  return themeProgress(data.themes, data.words, progressById).map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    statusLabel: STATUS_LABEL[t.status],
    learnedPct: percent(t.learnedShare),
    masteredPct: percent(t.masteredShare),
    counts: `${t.learned} of ${t.total} learned, ${t.mastered} mastered`,
  }));
}

// A word's place for the theme list: 'New', 'Step 3' or 'Mastered'.
export function wordStatus(p) {
  if (isMastered(p)) return 'Mastered';
  if (isLearned(p)) return `Step ${p.step}`;
  return 'New';
}

// The words of one theme in teaching order, or null when the theme does not exist.
export function themeWordsView(data, themeId, progressById) {
  const theme = data.themes.find((t) => t.id === themeId);
  if (!theme) return null;
  const words = data.words.filter((w) => w.theme === themeId).sort((a, b) => a.ord - b.ord)
    .map((w) => ({ id: w.id, hz: w.hz, py: w.py, enShort: w.enShort, status: wordStatus(progressById.get(w.id)) }));
  return { id: theme.id, name: theme.name, words };
}

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

// A month as weeks of 7 cells from Monday, with null before the 1st and after the last day.
export function calendarWeeks(checkedDays, month, today) {
  const days = monthCalendar(checkedDays, month)
    .map((d) => ({ ...d, isToday: d.day === today, date: Number(d.day.slice(8)) }));
  const cells = [...Array(weekdayIndex(days[0].day)).fill(null), ...days];
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

// The check-in screen. result is Study.finish()'s result, or null when the screen is
// opened from the streak on the Today screen.
export function checkinView({ result, checkedDays, today, themes }) {
  const month = today.slice(0, 7);
  const view = {
    title: 'Check-in',
    lines: [],
    badges: [],
    streak: result ? result.streak : null,
    monthTitle: monthTitle(month),
    weeks: calendarWeeks(checkedDays, month, today),
  };
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
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/view-progress.test.mjs`
Expected: `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/view/progress.js tests/js/view-progress.test.mjs && git commit -F - <<'EOF'
feat(app): views for the progress map, stats, badges and check-in

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 7: Addresses, the Settings form, the backup file and the files to keep (`docs/js/view/route.js`, `docs/js/view/settings.js`, `docs/js/view/files.js`)

Three small pure modules, tested together.
- `route.js` reads the address after `#`. For example `'#/theme/t05'` gives `{ name: 'theme', id: 't05' }`, and anything unknown gives Today.
- `settings.js` fills the form, keeps values in range, and writes and reads the backup file. A backup file is the store's `dump()` with a header `{ app: 'hsk-flashcards', format: 1, release, exported }`.
- `files.js` lists the files to keep on the phone. For 苹果 they are its two sounds and `strokes/82f9.json` and `strokes/679c.json`.

**Files:**
- Create: `docs/js/view/route.js`, `docs/js/view/settings.js`, `docs/js/view/files.js`
- Test: `tests/js/view-misc.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hrefOf, parseRoute } from '../../docs/js/view/route.js';
import {
  backupFileName, backupText, parseBackup, settingsFromForm, settingsView,
} from '../../docs/js/view/settings.js';
import { filesForWords, soonWords } from '../../docs/js/view/files.js';
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();

test('addresses name the screens', () => {
  assert.deepEqual(parseRoute(''), { name: 'today' });
  assert.deepEqual(parseRoute('#/session'), { name: 'session' });
  assert.deepEqual(parseRoute('#/theme/t05'), { name: 'theme', id: 't05' });
  assert.deepEqual(parseRoute('#/word/w0026'), { name: 'word', id: 'w0026' });
  assert.deepEqual(parseRoute('#/nonsense'), { name: 'today' });
  assert.deepEqual(parseRoute('#/theme'), { name: 'today' });
  assert.equal(hrefOf({ name: 'word', id: 'w0026' }), '#/word/w0026');
  assert.equal(hrefOf({ name: 'stats' }), '#/stats');
});

test('settings have defaults, ranges and auto-play on', () => {
  assert.deepEqual(settingsView(undefined), { newPerDay: 12, reviewCap: 100, autoplay: true, newRange: [4, 30], capRange: [20, 300] });
  assert.equal(settingsView({ autoplay: false }).autoplay, false);
  assert.deepEqual(settingsFromForm({ newPerDay: '50', reviewCap: '80', autoplay: false }, { other: 1 }),
    { other: 1, newPerDay: 30, reviewCap: 80, autoplay: false });
});

test('a backup file round-trips through the store', async () => {
  const a = new MemoryStore();
  await a.commit({ progress: [learnedProgress('w0026', '2026-10-05')], days: [{ day: '2026-10-05' }], event: { day: '2026-10-05', kind: 'checkin' } });
  const text = backupText(await a.dump(), { release: 'r001', now: new Date('2026-10-05T12:00:00Z') });
  assert.equal(backupFileName('2026-10-05'), 'hsk-flashcards-backup-2026-10-05.json');
  const { dump, exported } = parseBackup(text);
  assert.equal(exported, '2026-10-05T12:00:00.000Z');
  const b = new MemoryStore();
  await b.restore(dump);
  assert.deepEqual(await b.dump(), await a.dump());
});

test('a file that is not a backup is refused with a plain message', () => {
  assert.throws(() => parseBackup('hello'), /not a backup file/);
  assert.throws(() => parseBackup('{"app":"other"}'), /not a backup of this app/);
  assert.throws(() => parseBackup('{"app":"hsk-flashcards","format":1,"progress":[]}'), /damaged/);
});

test('a word brings its two sounds and the stroke data of each character', () => {
  assert.deepEqual(filesForWords([word(data, '苹果')]),
    ['audio/w/w0026_6ce06b7e.mp3', 'audio/s/w0026_814ba0af.mp3', 'strokes/82f9.json', 'strokes/679c.json']);
  assert.equal(filesForWords([word(data, '谢谢')]).filter((f) => f.startsWith('strokes/')).length, 1); // 谢 once
  const all = filesForWords(data.words);
  assert.equal(new Set(all).size, all.length);
});

test('today\'s and tomorrow\'s words are kept ready', () => {
  const byOrd = data.words.slice().sort((a, b) => a.ord - b.ord);
  const learned = byOrd.slice(0, 4).map((w) => learnedProgress(w.id, '2026-10-05')); // due 6 October
  const later = { ...learnedProgress(byOrd[4].id, '2026-10-01'), step: 3, due: '2026-10-07' }; // due tomorrow
  const farther = { ...learnedProgress(byOrd[5].id, '2026-10-01'), step: 5, due: '2026-10-20' };
  const plan = { day: '2026-10-06', reviews: learned.map((p) => p.id), newWords: byOrd.slice(6, 10).map((w) => w.id) };
  const soon = soonWords({ words: data.words, progress: [...learned, later, farther], plan, settings: { newPerDay: 4 } });
  const expected = [...byOrd.slice(0, 5), ...byOrd.slice(6, 14)].map((w) => w.id).sort();
  assert.deepEqual(soon.map((w) => w.id).sort(), expected);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/view-misc.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\view\route.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/view/route.js`**

```js
// Screens are chosen by the part of the address after '#', so the app is one page that
// works offline. For example '#/theme/t05' opens the word list of theme t05.
export const NAV = Object.freeze([
  { name: 'today', label: 'Today' },
  { name: 'map', label: 'Map' },
  { name: 'stats', label: 'Stats' },
  { name: 'badges', label: 'Badges' },
  { name: 'settings', label: 'Settings' },
]);

const SIMPLE = new Set(['today', 'session', 'checkin', 'map', 'stats', 'badges', 'settings']);

// parseRoute('#/word/w0026') gives { name: 'word', id: 'w0026' }. Anything unknown is Today.
export function parseRoute(hash) {
  const [name, id] = String(hash ?? '').replace(/^#\/?/, '').split('/');
  if ((name === 'theme' || name === 'word') && id) return { name, id: decodeURIComponent(id) };
  if (SIMPLE.has(name)) return { name };
  return { name: 'today' };
}

export function hrefOf(route) {
  return route.id ? `#/${route.name}/${encodeURIComponent(route.id)}` : `#/${route.name}`;
}
```

- [ ] **Step 4: Write `docs/js/view/settings.js`**

```js
// The Settings form and the backup file. No page access, so Node can test it.
import { CONFIG, normalizeSettings } from '../config.js';

// Values for the form. Auto-play is on unless the learner turned it off.
export function settingsView(saved) {
  const s = normalizeSettings(saved);
  return {
    newPerDay: s.newPerDay,
    reviewCap: s.reviewCap,
    autoplay: s.autoplay !== false,
    newRange: [CONFIG.newPerDayMin, CONFIG.newPerDayMax],
    capRange: [CONFIG.reviewCapMin, CONFIG.reviewCapMax],
  };
}

// The settings to save from the form's values, kept inside their ranges.
// settingsFromForm({ newPerDay: '50', reviewCap: '80', autoplay: false }, saved) gives
// newPerDay 30, reviewCap 80 and autoplay false, and keeps any other saved key.
export function settingsFromForm(form, saved = {}) {
  return normalizeSettings({
    ...saved, newPerDay: form.newPerDay, reviewCap: form.reviewCap, autoplay: Boolean(form.autoplay),
  });
}

export const BACKUP_APP = 'hsk-flashcards';

export function backupFileName(day) {
  return `hsk-flashcards-backup-${day}.json`;
}

// The text of a backup file, which is the store's dump plus a header that says what it is.
export function backupText(dump, { release, now = new Date() }) {
  return JSON.stringify({ app: BACKUP_APP, format: 1, release, exported: now.toISOString(), ...dump });
}

// Reads a backup file's text back into a dump for store.restore(). A file that is not a
// backup of this app gives an error with a plain message. store.restore checks the rest.
export function parseBackup(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('This file is not a backup file.');
  }
  if (obj?.app !== BACKUP_APP || obj.format !== 1) throw new Error('This file is not a backup of this app.');
  const { progress, events, days, meta } = obj;
  if (![progress, events, days].every(Array.isArray) || typeof meta !== 'object' || meta === null) {
    throw new Error('This backup file is damaged.');
  }
  return { dump: { progress, events, days, meta }, exported: obj.exported };
}
```

- [ ] **Step 5: Write `docs/js/view/files.js`**

```js
// Which audio and stroke files to keep on the phone. The design asks for today's and
// tomorrow's words at the start of a session, and for every file from Settings.
import { addDays } from '../dates.js';
import { nextNewWords } from '../curriculum.js';
import { learnedProgress } from '../srs.js';
import { charsOf, strokeUrl } from '../strokes.js';
import { AUDIO_BASE } from './card.js';

// The files of some words, each file once: word and sentence audio, then stroke data.
// For 苹果 in the fixture that is audio/w/w0026_6ce06b7e.mp3, audio/s/w0026_814ba0af.mp3,
// strokes/82f9.json and strokes/679c.json.
export function filesForWords(words) {
  const out = new Set();
  for (const w of words) {
    out.add(AUDIO_BASE + w.au);
    out.add(AUDIO_BASE + w.ex.au);
  }
  for (const w of words) for (const ch of charsOf(w.hz)) out.add(strokeUrl(ch));
  return [...out];
}

// Today's words and tomorrow's likely words: the words of today's plan, every word due by
// tomorrow, and the next new words after today's, as if today's new words were learned.
export function soonWords({ words, progress, plan, settings }) {
  const tomorrow = addDays(plan.day, 1);
  const ids = new Set([...plan.reviews, ...plan.newWords]);
  for (const p of progress) if (p.step >= 1 && p.due <= tomorrow) ids.add(p.id);
  const byId = new Map(progress.map((p) => [p.id, p]));
  for (const id of plan.newWords) byId.set(id, learnedProgress(id, plan.day));
  for (const id of nextNewWords(words, byId, settings.newPerDay, tomorrow)) ids.add(id);
  return words.filter((w) => ids.has(w.id));
}
```

- [ ] **Step 6: Run it and see it pass**

Run: `node --test tests/js/view-misc.test.mjs`
Expected: `ℹ tests 6`, `ℹ pass 6`, `ℹ fail 0`.

- [ ] **Step 7: Commit**

```bash
git add docs/js/view/route.js docs/js/view/settings.js docs/js/view/files.js tests/js/view-misc.test.mjs && git commit -F - <<'EOF'
feat(app): screen addresses, settings form, backup file and files to keep

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 8: Playing a sound once or twice (`docs/js/audio.js`)

The design plays a word twice with a short pause, and a tap on Next stops it. For example `player.play('audio/w/w0026_6ce06b7e.mp3', 2)` plays the file, waits 700 ms, plays it again and returns 'done'. The caller says how many times. The learning card after a quiz answer and the example sentence ask for one play (`play(url, 1)`), and the third test below covers that. When Next calls `player.stop()` in the middle, the same call returns 'stopped' at once. When Chrome refuses to play before a tap, the call fails with an error named `NotAllowedError`, and the screen then shows "Tap to continue". The audio element and the pause are passed in, so the test uses a stand-in element.

**Files:**
- Create: `docs/js/audio.js`
- Test: `tests/js/audio.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlayer } from '../../docs/js/audio.js';

// A stand-in for the browser's audio element. play() starts a sound, and the test ends it
// with finish(), as the real element does when the sound is over.
function fakeAudio({ refuse = null } = {}) {
  const el = {
    src: '', plays: [], paused: 0,
    play() {
      el.plays.push(el.src);
      if (refuse) return Promise.reject(Object.assign(new Error('refused'), { name: refuse }));
      return Promise.resolve();
    },
    pause() { el.paused += 1; },
    finish() { el.onended?.(); },
    fail() { el.onerror?.(); },
  };
  return el;
}

const tick = () => new Promise((resolve) => { setImmediate(resolve); });

test('a word plays twice with a pause between', async () => {
  const el = fakeAudio();
  const waits = [];
  const player = createPlayer({ makeAudio: () => el, wait: async (ms) => { waits.push(ms); } });
  const done = player.play('audio/w/w0026.mp3', 2);
  await tick();
  el.finish();
  await tick();
  el.finish();
  assert.equal(await done, 'done');
  assert.deepEqual(el.plays, ['audio/w/w0026.mp3', 'audio/w/w0026.mp3']);
  assert.deepEqual(waits, [700]);
});

test('stop (a tap on Next) ends the sound at once', async () => {
  const el = fakeAudio();
  const player = createPlayer({ makeAudio: () => el, wait: async () => {} });
  const done = player.play('a.mp3', 2);
  await tick();
  player.stop();
  assert.equal(await done, 'stopped');
  assert.equal(el.plays.length, 1);
  assert.ok(el.paused >= 1);
});

test('a new sound stops the one before', async () => {
  const el = fakeAudio();
  const player = createPlayer({ makeAudio: () => el, wait: async () => {} });
  const first = player.play('a.mp3', 2);
  await tick();
  const second = player.play('b.mp3', 1);
  assert.equal(await first, 'stopped');
  await tick();
  el.finish();
  assert.equal(await second, 'done');
  assert.deepEqual(el.plays, ['a.mp3', 'b.mp3']);
});

test('a refusal to play reaches the caller, so the screen can ask for a tap', async () => {
  const player = createPlayer({ makeAudio: () => fakeAudio({ refuse: 'NotAllowedError' }), wait: async () => {} });
  await assert.rejects(player.play('a.mp3', 2), { name: 'NotAllowedError' });
});

test('a file that cannot load is an error too', async () => {
  const el = fakeAudio();
  const player = createPlayer({ makeAudio: () => el, wait: async () => {} });
  const done = player.play('missing.mp3', 2);
  await tick();
  el.fail();
  await assert.rejects(done, /Could not play missing.mp3/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/audio.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\audio.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/audio.js`**

```js
// Sound playback. A word plays twice with a short pause, and a new sound or a tap on Next
// stops the one before. The audio element and the pause are passed in, so Node can test
// this with a stand-in element.
//
//   const player = createPlayer();
//   await player.play('audio/w/w0026_6ce06b7e.mp3', 2);   // 'done', or 'stopped' after stop()
//
// play() rejects when the phone refuses to play. Chrome says 'NotAllowedError' when sound
// needs a tap first (for example after the app was in the background), and the session
// screen then shows "Tap to continue".
export function createPlayer({
  makeAudio = () => new Audio(),
  wait = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
  gapMs = 700,
} = {}) {
  const el = makeAudio();
  let token = 0;
  let pending = null; // resolves the sound that is playing now, when stop() cuts it short

  function once(url) {
    return new Promise((resolve, reject) => {
      pending = resolve;
      el.onended = () => { pending = null; resolve('ended'); };
      el.onerror = () => { pending = null; reject(new Error(`Could not play ${url}`)); };
      el.src = url;
      const started = el.play();
      if (started && started.catch) started.catch((err) => { pending = null; reject(err); });
    });
  }

  async function play(url, times = 2) {
    stop();
    const mine = token;
    for (let i = 0; i < times; i += 1) {
      const how = await once(url);
      if (mine !== token || how === 'stopped') return 'stopped';
      if (i < times - 1) {
        await wait(gapMs);
        if (mine !== token) return 'stopped';
      }
    }
    return 'done';
  }

  function stop() {
    token += 1;
    el.onended = null;
    el.onerror = null;
    if (typeof el.pause === 'function') el.pause();
    if (pending) {
      const cut = pending;
      pending = null;
      cut('stopped');
    }
  }

  return { play, stop };
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/audio.test.mjs`
Expected: `ℹ tests 5`, `ℹ pass 5`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/audio.js tests/js/audio.test.mjs && git commit -F - <<'EOF'
feat(app): sound player that plays twice and stops on Next

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 9: Saving sound and stroke files on the phone (`docs/js/offline.js`)

`cacheFiles` saves files in the cache 'media-v1', which the service worker (Task 16) reads. It fetches only files that are not saved yet, 4 at a time, and a failed file is counted, not fatal. Settings uses `shouldStop` to stop "Download all audio" part-way, and a later tap goes on where it stopped.

**Files:**
- Create: `docs/js/offline.js`
- Test: `tests/js/offline.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MEDIA_CACHE, cacheFiles, countCached } from '../../docs/js/offline.js';

// A stand-in for the browser's Cache Storage with one cache per name.
function fakeCaches(saved = []) {
  const caches = new Map();
  return {
    names: () => [...caches.keys()],
    async open(name) {
      if (!caches.has(name)) {
        const files = new Map(saved.map((url) => [url, 'old']));
        caches.set(name, {
          files,
          async match(url) { return files.get(url); },
          async put(url, res) { files.set(url, res); },
        });
      }
      return caches.get(name);
    },
    get: (name) => caches.get(name),
  };
}

test('only missing files are fetched, and one bad file does not stop the rest', async () => {
  const cachesApi = fakeCaches(['audio/w/a.mp3']);
  const fetched = [];
  const fetchFn = async (url) => {
    fetched.push(url);
    return url.includes('bad') ? { ok: false, status: 404 } : { ok: true, url };
  };
  const seen = [];
  const tally = await cacheFiles(['audio/w/a.mp3', 'audio/w/b.mp3', 'audio/w/bad.mp3', 'strokes/7231.json'],
    { cachesApi, fetchFn, onProgress: (p) => seen.push(p) });
  assert.deepEqual(tally, { total: 4, done: 3, failed: 1 });
  assert.deepEqual(fetched.sort(), ['audio/w/b.mp3', 'audio/w/bad.mp3', 'strokes/7231.json']);
  assert.deepEqual(cachesApi.names(), [MEDIA_CACHE]);
  assert.equal(seen.length, 4);
  assert.equal(await countCached(['audio/w/a.mp3', 'audio/w/b.mp3', 'audio/w/bad.mp3'], { cachesApi }), 2);
});

test('a long download can be stopped', async () => {
  const cachesApi = fakeCaches();
  let calls = 0;
  const urls = Array.from({ length: 50 }, (_, i) => `audio/w/${i}.mp3`);
  const tally = await cacheFiles(urls, {
    cachesApi, concurrency: 1, fetchFn: async () => { calls += 1; return { ok: true }; }, shouldStop: () => calls >= 5,
  });
  assert.equal(calls, 5);
  assert.equal(tally.done, 5);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/offline.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\offline.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/offline.js`**

```js
// Keeps audio and stroke files on the phone in the browser's Cache Storage. The service
// worker (sw.js) reads the same cache, so a saved file plays without internet.
// The cache API and fetch are passed in, so Node can test this with stand-ins.
export const MEDIA_CACHE = 'media-v1'; // sw.js uses the same name

// Saves every file of `urls` that is not saved yet, 4 at a time. It never throws for one
// bad file. It counts it in `failed` and goes on. onProgress gets { total, done, failed }.
// shouldStop() lets the Settings screen stop a long download.
export async function cacheFiles(urls, {
  cachesApi = globalThis.caches, fetchFn = globalThis.fetch, concurrency = 4,
  onProgress = () => {}, shouldStop = () => false,
} = {}) {
  const cache = await cachesApi.open(MEDIA_CACHE);
  const tally = { total: urls.length, done: 0, failed: 0 };
  let next = 0;
  async function worker() {
    while (next < urls.length && !shouldStop()) {
      const url = urls[next];
      next += 1;
      try {
        if (!(await cache.match(url))) {
          const res = await fetchFn(url);
          if (!res.ok) throw new Error(`${res.status}`);
          await cache.put(url, res);
        }
        tally.done += 1;
      } catch {
        tally.failed += 1;
      }
      onProgress({ ...tally });
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return tally;
}

// How many of `urls` are saved already.
export async function countCached(urls, { cachesApi = globalThis.caches } = {}) {
  const cache = await cachesApi.open(MEDIA_CACHE);
  let n = 0;
  for (const url of urls) if (await cache.match(url)) n += 1;
  return n;
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/offline.test.mjs`
Expected: `ℹ tests 2`, `ℹ pass 2`, `ℹ fail 0`.

- [ ] **Step 5: Commit**

```bash
git add docs/js/offline.js tests/js/offline.test.mjs && git commit -F - <<'EOF'
feat(app): save sound and stroke files in Cache Storage

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 10: The hook for Plan 5 (`docs/js/hooks.js`, `docs/js/plugins.js`)

The design syncs the Google Sheet at the end of each session, when the app is closed, when it opens after 12 or more hours, and when "Back up now" is tapped. Plan 5 builds that. This task gives it a clean place to join. Plan 5 will add `'./sync.js'` to `PLUGINS`, and `sync.js` will export `install({ on, store, data })`, which registers handlers:

```js
// docs/js/sync.js (Plan 5), in outline
export function install({ on, store }) {
  on('sessionEnd', async ({ result }) => { /* send store.eventsSince(lastSeq) */ });
  on('open', async () => { /* back up when the last backup is 12 or more hours old */ });
  on('hidden', async () => { /* back up when the app is closed */ });
  on('settings', ({ container }) => { /* draw the Sheet link, the secret code, Back up now, Restore */ });
}
```

**Files:**
- Create: `docs/js/hooks.js`, `docs/js/plugins.js`
- Test: `tests/js/hooks.test.mjs`

- [ ] **Step 1: Write the failing test**

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOOK_NAMES, createHooks, loadPlugins } from '../../docs/js/hooks.js';
import { PLUGINS } from '../../docs/js/plugins.js';

test('handlers run in order, and a failing one is logged and skipped', async () => {
  const logged = [];
  const hooks = createHooks({ log: (...args) => logged.push(args[0]) });
  const calls = [];
  hooks.on('sessionEnd', (arg) => { calls.push(['a', arg.result]); });
  hooks.on('sessionEnd', () => { throw new Error('offline'); });
  hooks.on('sessionEnd', async (arg) => { calls.push(['c', arg.result]); });
  await hooks.emit('sessionEnd', { result: 1 });
  assert.deepEqual(calls, [['a', 1], ['c', 1]]);
  assert.deepEqual(logged, ['Hook sessionEnd failed:']);
  await hooks.emit('open', {}); // no handlers is fine
});

test('only the known hooks exist', () => {
  assert.deepEqual(HOOK_NAMES, ['open', 'hidden', 'sessionEnd', 'settings']);
  assert.throws(() => createHooks().on('sometimes', () => {}), /Unknown hook/);
});

test('plugins are installed with the app context, and a broken one is skipped', async () => {
  const hooks = createHooks();
  const installed = [];
  const modules = {
    './good.js': { install: ({ on, store }) => { installed.push(store); on('open', () => {}); } },
    './broken.js': { install: () => { throw new Error('bad'); } },
  };
  const logged = [];
  await loadPlugins(['./broken.js', './good.js', './missing.js'], { on: hooks.on, store: 'S' }, {
    importer: async (p) => { if (!modules[p]) throw new Error('404'); return modules[p]; },
    log: (msg) => logged.push(msg),
  });
  assert.deepEqual(installed, ['S']);
  assert.deepEqual(logged, ['Plugin ./broken.js failed:', 'Plugin ./missing.js failed:']);
});

test('Plan 4 ships with no plugins', () => {
  assert.deepEqual(PLUGINS, []);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/hooks.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\hooks.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/hooks.js`**

```js
// A small hook system, so a later module can join the app without changing the screens.
// Plan 5's Google Sheet backup is such a module. It is listed in plugins.js and gets
// install({ on, store, data }) at start-up. The app then calls these hooks:
//   'open'        ({ store, data })          when the app starts and when it comes back to the screen
//   'hidden'      ({ store })                when the app goes to the background or is closed
//   'sessionEnd'  ({ store, result })        after a session ends (result is Study.finish()'s result)
//   'settings'    ({ container, store })     when Settings is drawn, to add a section to container
// A failing handler is logged and skipped, so a backup problem never stops a study session.
export const HOOK_NAMES = Object.freeze(['open', 'hidden', 'sessionEnd', 'settings']);

export function createHooks({ log = (...args) => console.warn(...args) } = {}) {
  const handlers = new Map(HOOK_NAMES.map((name) => [name, []]));
  function on(name, fn) {
    if (!handlers.has(name)) throw new Error(`Unknown hook ${name}`);
    handlers.get(name).push(fn);
  }
  async function emit(name, arg) {
    for (const fn of handlers.get(name) ?? []) {
      try {
        await fn(arg);
      } catch (err) {
        log(`Hook ${name} failed:`, err);
      }
    }
  }
  return { on, emit };
}

// Imports each module of `paths` and calls its install(context). A module that fails to
// load or install is logged and skipped.
export async function loadPlugins(paths, context, {
  importer = (path) => import(path), log = (...args) => console.warn(...args),
} = {}) {
  for (const path of paths) {
    try {
      const mod = await importer(path);
      await mod.install(context);
    } catch (err) {
      log(`Plugin ${path} failed:`, err);
    }
  }
}
```

- [ ] **Step 4: Write `docs/js/plugins.js`**

```js
// Modules that join the app through hooks.js, as paths relative to docs/js/.
// Plan 5 adds './sync.js' (the Google Sheet backup) here and to APP_FILES in sw.js.
export const PLUGINS = Object.freeze([]);
```

- [ ] **Step 5: Run it and see it pass**

Run: `node --test tests/js/hooks.test.mjs`
Expected: `ℹ tests 4`, `ℹ pass 4`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add docs/js/hooks.js docs/js/plugins.js tests/js/hooks.test.mjs && git commit -F - <<'EOF'
feat(app): hooks and an empty plugin list for the Sheet backup of Plan 5

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 11: Whole study days through the screen logic (`tests/js/flow.test.mjs`)

This test adds no app code. It plays study days the way the Session screen of Task 14 does. Each card goes through `questionView`, a tap is graded with `gradeFor`, and the grade goes to Plan 2's `Study`. So it checks that every card of a real session can be shown and answered. It passes on its first run if Tasks 3 to 7 and Plan 2 are right. It would fail if any question had fewer than 4 choices, if a listening question showed the characters or a pinyin question hid them, if the re-ask after a wrong tap were not a recall card, or if the next day's review of a missed word were not a recall card.

**Files:**
- Test: `tests/js/flow.test.mjs`

- [ ] **Step 1: Write the test**

```js
// Plays whole study days the way the Session screen does. Each card goes through
// questionView, a tap is graded with gradeFor, and the grade goes to Plan 2's Study.
// No page is involved, so this checks the screen logic against the real controller.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Study } from '../../docs/js/study.js';
import { MemoryStore } from '../../docs/js/store.js';
import { makePool } from '../../docs/js/distractors.js';
import { gradeFor, questionView } from '../../docs/js/view/quiz.js';
import { checkinView } from '../../docs/js/view/progress.js';
import { loadFixture, localDate } from './helpers.mjs';

const data = loadFixture();
const pool = makePool(data.words);
const byId = new Map(data.words.map((w) => [w.id, w]));

// tap(view) returns the index of the choice to tap, or the recall grade.
async function playDay(store, day, tap) {
  const now = localDate(day);
  const study = await Study.start({ store, data, now });
  const kinds = [];
  while (!study.finished) {
    const card = study.card;
    const view = questionView({ card, word: byId.get(card.id), pool, day: study.day, step: study.byId.get(card.id)?.step ?? 0 });
    kinds.push(view.kind);
    if (view.kind === 'learn') { study.next(); continue; }
    if (view.kind === 'recall') { await study.answer(tap(view, card), now); continue; }
    assert.equal(view.choices.length, 4, `${card.type} ${card.id}`);
    assert.equal(view.hz, view.kind === 'listen' ? null : byId.get(card.id).hz, `${view.kind} ${card.id}`);
    await study.answer(gradeFor(view, tap(view, card)), now);
  }
  return { result: await study.finish(now), kinds };
}

const rightTap = (view) => (view.kind === 'recall' ? 'know' : view.answerIndex);

test('day 1 teaches 12 words through the screens and checks in', async () => {
  const store = new MemoryStore();
  const { result, kinds } = await playDay(store, '2026-10-05', rightTap);
  assert.deepEqual(kinds.filter((k) => k === 'learn').length, 12);
  assert.deepEqual(kinds.filter((k) => k === 'listen').length, 12); // one group check per word
  assert.deepEqual(kinds.filter((k) => k === 'pinyin').length, 12); // one final check per word
  const v = checkinView({ result, checkedDays: (await store.allDays()).map((d) => d.day), today: result.day, themes: data.themes });
  assert.equal(v.title, 'Checked in!');
  assert.deepEqual(v.lines, ['12 new words learned.']);
  assert.deepEqual(v.badges, ['Finished Starter Kit']);
});

test('day 2 starts with 12 listening reviews, and a wrong tap brings a recall card 4 cards later', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05', rightTap);
  let missed = null;
  const tapWrongOnce = (view, card) => {
    if (!missed && card.type === 'review') { missed = card.id; return (view.answerIndex + 1) % 4; }
    return rightTap(view);
  };
  const { kinds, result } = await playDay(store, '2026-10-06', tapWrongOnce);
  assert.deepEqual(kinds.slice(0, 4), ['listen', 'listen', 'listen', 'listen']);
  assert.equal(kinds[4], 'recall'); // the re-ask of the missed word
  assert.equal(result.checkedIn, true);
  assert.equal((await store.getProgress(missed)).lastGrade, 'wrong');
  // Next day the missed word's review is a recall card, as the design's quiz rule says.
  const study = await Study.start({ store, data, now: localDate('2026-10-07') });
  const card = study.state.cards.find((c) => c.id === missed);
  assert.equal(questionView({ card, word: byId.get(missed), pool, day: study.day, step: study.byId.get(missed).step }).kind, 'recall');
});
```

- [ ] **Step 2: Run it**

Run: `node --test tests/js/flow.test.mjs`
Expected: `ℹ tests 2`, `ℹ pass 2`, `ℹ fail 0`.

- [ ] **Step 3: Commit**

```bash
git add tests/js/flow.test.mjs && git commit -F - <<'EOF'
test(app): whole study days through the question views and Study

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 12: Icons and the web app manifest (`tools/13_make_icons.py`, `docs/manifest.webmanifest`)

Chrome on Android offers "Install app" when the site has a manifest with a 192-pixel and a 512-pixel icon, a start address and a service worker (Task 16). The maskable icon is the one Android crops into a circle or a rounded square, so its text stays in the middle half.

**Files:**
- Create: `tools/13_make_icons.py`, `docs/manifest.webmanifest`
- Modify: `tools/requirements.txt` (add one line)
- Output: `docs/icons/icon-192.png`, `docs/icons/icon-512.png`, `docs/icons/icon-maskable-512.png`

- [ ] **Step 1: Add Pillow to `tools/requirements.txt`**

Add this line at the end of `tools/requirements.txt`:

```
pillow>=10.1
```

Pillow is already installed as part of matplotlib (`python -c "import PIL; print(PIL.__version__)"` printed `12.3.0` on 2026-09-28). Version 10.1 is the first whose built-in font takes a size.

- [ ] **Step 2: Write `tools/13_make_icons.py`**

```python
"""Step 13. Draw the home-screen icons that the web app manifest names.

Outputs: docs/icons/icon-192.png, docs/icons/icon-512.png (rounded red square with "HSK"),
         docs/icons/icon-maskable-512.png (full red square, text inside the central safe area)
Uses Pillow's built-in font, so no font file is needed. Existing icons are never replaced:
the script stops and names them. To change the icons, delete them yourself first.
"""
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RED, WHITE = (179, 38, 30, 255), (255, 255, 255, 255)
OUT = Path("docs/icons")


def draw(size, maskable):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill=RED)
        text_width = size * 0.5  # Android may crop the outer 10% on each side
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=RED)
        text_width = size * 0.7
    font_size = size // 2
    font = ImageFont.load_default(size=font_size)
    while d.textlength("HSK", font=font) > text_width:
        font_size -= 2
        font = ImageFont.load_default(size=font_size)
    d.text((size / 2, size / 2), "HSK", font=font, fill=WHITE, anchor="mm")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main():
    plan = {"icon-192.png": (192, False), "icon-512.png": (512, False), "icon-maskable-512.png": (512, True)}
    present = [name for name in plan if (OUT / name).exists()]
    if present:
        print(f"Icons already exist and are never replaced: {', '.join(present)}")
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (size, maskable) in plan.items():
        with open(OUT / name, "xb") as f:
            f.write(draw(size, maskable))
        print(f"Wrote {OUT / name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 3: Run it**

Run: `python tools/13_make_icons.py`
Expected:
```
Wrote docs\icons\icon-192.png
Wrote docs\icons\icon-512.png
Wrote docs\icons\icon-maskable-512.png
```
Then run it again: `python tools/13_make_icons.py`
Expected: `Icons already exist and are never replaced: icon-192.png, icon-512.png, icon-maskable-512.png`, and the exit code is 1.

- [ ] **Step 4: Look at the icon**

Open `docs/icons/icon-512.png`. It is a red rounded square with "HSK" in white across the middle.

- [ ] **Step 5: Write `docs/manifest.webmanifest`**

```json
{
  "id": "./",
  "name": "HSK Flashcards",
  "short_name": "HSK Cards",
  "description": "Daily Chinese flashcards for the HSK word list.",
  "lang": "en",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#fffaf5",
  "theme_color": "#b3261e",
  "icons": [
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 6: Check that the manifest is valid JSON**

Run: `node -e "const m = JSON.parse(require('fs').readFileSync('docs/manifest.webmanifest', 'utf8')); console.log(m.icons.length, m.display)"`
Expected: `3 standalone`.

- [ ] **Step 7: Commit**

```bash
git add tools/13_make_icons.py tools/requirements.txt docs/icons docs/manifest.webmanifest && git commit -F - <<'EOF'
feat(app): home-screen icons and the web app manifest

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 13: The page, the styles, the credits and the learning card on the page (`docs/index.html`, `docs/css/app.css`, `docs/credits.html`, `docs/js/ui/dom.js`, `docs/js/ui/card.js`, `docs/js/ui/update.js`)

From here on the files draw on the page, which Node cannot run. Each task checks their syntax with `node --check`, and Task 17 runs them in Chrome. `index.html` also asks search engines not to list the site (`<meta name="robots" content="noindex, nofollow">`), as the design's hosting section says.

`ui/card.js` draws the learning card from `learningCard` (Task 3) and plays the word as many times as the card's `plays` says. Its "Stroke order" button calls `animateWord` (Task 2). `playSound` turns a refusal to play into the "Tap to continue" screen. `ui/update.js` registers the service worker and shows "Update available, tap to reload" when a new release is waiting.

**Files:**
- Create: `docs/index.html`, `docs/css/app.css`, `docs/credits.html`, `docs/js/ui/dom.js`, `docs/js/ui/card.js`, `docs/js/ui/update.js`

- [ ] **Step 1: Write `docs/index.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#b3261e">
  <title>HSK Flashcards</title>
  <link rel="manifest" href="manifest.webmanifest">
  <link rel="icon" href="icons/icon-192.png">
  <link rel="stylesheet" href="css/app.css">
  <script type="module" src="js/app.js"></script>
</head>
<body>
  <div id="update" class="update" role="button" hidden></div>
  <main id="main"><p class="muted">Loading...</p></main>
  <nav id="nav"></nav>
  <div id="overlay" class="overlay" hidden></div>
</body>
</html>
```

- [ ] **Step 2: Write `docs/css/app.css`**

```css
/* HSK Flashcards. Phone first: one column, large tap targets, light and dark themes. */
:root {
  --bg: #fffaf5; --fg: #1d1b1a; --muted: #6b6560; --card: #ffffff; --line: #e6ded6;
  --accent: #b3261e; --right: #1e7b34; --wrong: #b3261e; --learned: #e8a33d; --mastered: #1e7b34;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans SC", sans-serif;
  color-scheme: light dark;
}
@media (prefers-color-scheme: dark) {
  :root { --bg: #1b1918; --fg: #f3eeea; --muted: #a89f98; --card: #262322; --line: #3a3532; --accent: #f08a80; }
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font-size: 18px; line-height: 1.4; }
main { max-width: 34rem; margin: 0 auto; padding: 1rem 1rem 5.5rem; }
h1 { font-size: 1.5rem; margin: 0.5rem 0 1rem; }
h2 { font-size: 1.1rem; margin: 1.5rem 0 0.5rem; }
a { color: var(--accent); }
.muted { color: var(--muted); }
button, .button {
  font: inherit; border: 1px solid var(--line); background: var(--card); color: var(--fg);
  border-radius: 0.75rem; padding: 0.6rem 1rem; min-height: 3rem; cursor: pointer; text-decoration: none;
  display: inline-block; text-align: center;
}
button:disabled { opacity: 0.4; }
button.big, .button.big { display: block; width: 100%; margin: 1rem 0; font-size: 1.2rem; background: var(--accent); color: #fff; border: none; }
button.small { min-height: 2.75rem; margin: 0.25rem 0.25rem 0.25rem 0; }
.row { display: flex; flex-wrap: wrap; gap: 0.25rem; }

/* Today */
.streak { display: block; font-size: 1.2rem; text-decoration: none; color: var(--fg); margin: 0.5rem 0; }
.streak-n { font-size: 2.5rem; font-weight: 700; color: var(--accent); margin-right: 0.25rem; }
.week { display: flex; gap: 0.4rem; margin: 0.5rem 0 1rem; }
.week .day { flex: 1; text-align: center; padding: 0.4rem 0; border-radius: 0.5rem; border: 1px solid var(--line); }
.week .day.done { background: var(--accent); color: #fff; border-color: var(--accent); }
.week .day.today { outline: 2px solid var(--accent); }
.week .day.future { opacity: 0.5; }
.counts { display: flex; gap: 1rem; margin: 1rem 0; }
.counts div { flex: 1; background: var(--card); border: 1px solid var(--line); border-radius: 0.75rem; padding: 0.75rem; text-align: center; }
.counts b { display: block; font-size: 2rem; }
.note { background: var(--card); border-left: 4px solid var(--learned); padding: 0.5rem 0.75rem; }

/* Session and learning card */
.session-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem; }
.heading { color: var(--muted); margin: 0.25rem 0; }
.card { background: var(--card); border: 1px solid var(--line); border-radius: 1rem; padding: 1rem; margin: 0.5rem 0; }
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
.grade-unsure { background: var(--learned) !important; }
.banner { padding: 0.75rem 1rem; border-radius: 0.75rem; color: #fff; font-weight: 600; }
.banner.right { background: var(--right); }
.banner.wrong { background: var(--wrong); }

/* Check-in calendar */
.calendar { width: 100%; border-collapse: collapse; text-align: center; }
.calendar td, .calendar th { padding: 0.4rem 0; }
.calendar td.done { background: var(--accent); color: #fff; border-radius: 0.4rem; }
.calendar td.today { outline: 2px solid var(--accent); }
.badge { background: var(--card); border: 1px solid var(--line); border-radius: 0.75rem; padding: 0.6rem 0.8rem; margin: 0.4rem 0; }
.badge.locked { opacity: 0.6; }

/* Progress map, word lists and stats */
.tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.tile { display: flex; flex-direction: column; gap: 0.25rem; background: var(--card); border: 1px solid var(--line); border-radius: 0.75rem; padding: 0.6rem; color: var(--fg); text-decoration: none; }
.tile.done { border-color: var(--mastered); }
.tile.current { border: 2px solid var(--accent); }
.tile.locked { opacity: 0.55; }
.tile-status, .tile-counts { font-size: 0.8rem; color: var(--muted); }
.tile-name { font-weight: 600; }
.bar { position: relative; display: block; height: 0.5rem; background: var(--line); border-radius: 0.25rem; overflow: hidden; }
.bar-learned, .bar-mastered { position: absolute; left: 0; top: 0; bottom: 0; }
.bar-learned { background: var(--learned); }
.bar-mastered { background: var(--mastered); }
.words { list-style: none; padding: 0; }
.words a { display: grid; grid-template-columns: 4.5rem 1fr; gap: 0 0.5rem; padding: 0.5rem 0; border-bottom: 1px solid var(--line); color: var(--fg); text-decoration: none; }
.w-hz { font-size: 1.5rem; grid-row: span 2; }
.w-status { font-size: 0.8rem; color: var(--muted); }
.level { margin: 0.5rem 0; }
.chart { display: flex; align-items: flex-end; gap: 2px; height: 6rem; border-bottom: 1px solid var(--line); }
.chart .col { flex: 1; background: var(--learned); min-height: 1px; }
.chart .col.done { background: var(--accent); }
.forecast { width: 100%; text-align: center; }
.field { display: block; margin: 0.75rem 0; }
.field input[type=number] { display: block; font: inherit; padding: 0.5rem; width: 8rem; margin-top: 0.25rem; }
.field.check input { width: 1.4rem; height: 1.4rem; vertical-align: middle; }

/* Bottom navigation, update banner, "Tap to continue" and short messages */
nav { position: fixed; left: 0; right: 0; bottom: 0; display: flex; background: var(--card); border-top: 1px solid var(--line); padding-bottom: env(safe-area-inset-bottom); }
nav a { flex: 1; text-align: center; padding: 0.9rem 0; text-decoration: none; color: var(--muted); font-size: 0.9rem; }
nav a.active { color: var(--accent); font-weight: 700; }
.update { position: sticky; top: 0; z-index: 5; background: var(--accent); color: #fff; text-align: center; padding: 0.75rem; cursor: pointer; }
.overlay { position: fixed; inset: 0; z-index: 10; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: 2rem; }
.overlay[hidden] { display: none; }
.overlay button.big { max-width: 20rem; }
.toast { position: fixed; left: 1rem; right: 1rem; bottom: 4.5rem; background: var(--fg); color: var(--bg); padding: 0.75rem; border-radius: 0.75rem; text-align: center; z-index: 20; }
```

- [ ] **Step 3: Write `docs/credits.html`**

The text follows `ATTRIBUTION.md` (Plan 3b Task 19). The links to the two licence texts work once Task 1 has run (the library licence) and once the stroke data is copied (the data licence).

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Credits - HSK Flashcards</title>
  <link rel="stylesheet" href="css/app.css">
</head>
<body>
<main>
  <p><a href="./#/settings">Back to Settings</a></p>
  <h1>Credits and licences</h1>
  <h2>Word list and meanings</h2>
  <p><a href="https://github.com/drkameleon/complete-hsk-vocabulary">complete-hsk-vocabulary</a> by drkameleon (Yanis Zafirópulos), MIT License. It supplies the HSK 2.0 word list, pinyin, levels and parts of speech.</p>
  <p>English meanings are adapted from <a href="https://cc-cedict.org/">CC-CEDICT</a>, licensed under <a href="https://creativecommons.org/licenses/by-sa/4.0/">CC BY-SA 4.0</a>. The adapted meanings are shared under the same licence.</p>
  <h2>Example sentences</h2>
  <p>Sentences marked as from the PDFs come from the HSK vocabulary PDFs published by m.sayninhao.com. Their rights stay with their owners. The other sentences and every English translation were written for this app by Claude (Anthropic).</p>
  <h2>Audio</h2>
  <p>The sound files were made with Microsoft's neural voice zh-CN-XiaoxiaoNeural through the open-source tool <a href="https://github.com/rany2/edge-tts">edge-tts</a>.</p>
  <h2>Stroke order</h2>
  <p><a href="https://github.com/chanind/hanzi-writer">Hanzi Writer</a> by David Chanin, MIT License (<a href="vendor/hanzi-writer-LICENSE.txt">licence text</a>).</p>
  <p>Stroke data from <a href="https://github.com/chanind/hanzi-writer-data">hanzi-writer-data</a>, derived by the Make Me a Hanzi project from fonts by Arphic Technology, under the Arphic Public License (<a href="strokes/ARPHICPL.TXT">licence text</a>).</p>
</main>
</body>
</html>
```

- [ ] **Step 4: Write `docs/js/ui/dom.js`**

```js
// A tiny way to build page elements. h('button', { class: 'big', onclick: go }, 'Start')
// makes <button class="big">Start</button> that calls go() when tapped.
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    if (key === 'class') el.className = value;
    else if (key === 'style') el.style.cssText = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else if (key in el && typeof value !== 'string') el[key] = value;
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : String(child));
  }
  return el;
}

// Replaces what `main` shows and scrolls to the top.
export function show(main, ...children) {
  main.replaceChildren(...children.flat(Infinity).filter(Boolean));
  window.scrollTo(0, 0);
}
```

- [ ] **Step 5: Write `docs/js/ui/card.js`**

```js
// Draws the learning card: characters, pinyin, part of speech, meaning, the replay button,
// the "Stroke order" button and the example sentence with its own play button.
import { learningCard } from '../view/card.js';
import { animateWord } from '../strokes.js';
import { h } from './dom.js';

// Plays a sound and turns a refusal into the "Tap to continue" screen (app.needTap).
export function playSound(app, url, times) {
  app.player.play(url, times).catch((err) => {
    if (err && err.name === 'NotAllowedError') app.needTap(() => playSound(app, url, times));
    else app.note('Sound is not on this phone yet. It plays when the phone is online.');
  });
}

// The card element for one word. With autoplay, the word's sound plays at once, twice on a
// new word's card and once on the card after a quiz answer (afterAnswer). "Play again"
// plays it the same number of times.
export function cardElement(app, word, { autoplay, afterAnswer = false }) {
  const c = learningCard(word, { afterAnswer });
  const strokes = h('div', { class: 'strokes', hidden: true });
  const strokeButton = h('button', {
    class: 'small',
    onclick: async () => {
      strokes.hidden = false;
      strokes.replaceChildren(h('p', { class: 'muted' }, 'Loading...'));
      try {
        await animateWord(strokes, c.hz);
      } catch (err) {
        strokes.replaceChildren(h('p', { class: 'muted' }, err.message));
      }
    },
  }, 'Stroke order');
  const el = h('section', { class: 'card' },
    h('div', { class: 'hz', lang: 'zh-CN' }, c.hz),
    h('div', { class: 'py' }, c.py),
    c.pos ? h('div', { class: 'pos' }, c.pos) : null,
    h('div', { class: 'en' }, c.en),
    h('div', { class: 'row' },
      h('button', { class: 'small', onclick: () => playSound(app, c.wordAudio, c.plays) }, 'Play again'),
      strokeButton),
    strokes,
    h('div', { class: 'example' },
      h('div', { class: 'ex-hz', lang: 'zh-CN' }, c.sentence.map((p) => (p.hl ? h('mark', {}, p.text) : p.text))),
      h('div', { class: 'ex-py' }, c.sentencePy),
      h('div', { class: 'ex-en' }, c.sentenceEn),
      h('button', { class: 'small', onclick: () => playSound(app, c.sentenceAudio, 1) }, 'Play sentence')));
  if (autoplay) playSound(app, c.wordAudio, c.plays);
  return el;
}
```

- [ ] **Step 6: Write `docs/js/ui/update.js`**

```js
// Registers the service worker and shows "Update available, tap to reload" when a new
// release has been saved on the phone and is waiting.
export function setupUpdates(banner, { container = navigator.serviceWorker } = {}) {
  if (!container) return;
  let reloading = false;
  function offer(worker) {
    banner.textContent = 'Update available, tap to reload';
    banner.hidden = false;
    banner.onclick = () => {
      reloading = true;
      worker.postMessage('skipWaiting');
    };
  }
  container.addEventListener('controllerchange', () => {
    if (reloading) window.location.reload();
  });
  container.register('sw.js').then((reg) => {
    if (reg.waiting && container.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const worker = reg.installing;
      worker.addEventListener('statechange', () => {
        if (worker.state === 'installed' && container.controller) offer(worker);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('Service worker not registered:', err));
}
```

- [ ] **Step 7: Check the syntax**

Run: `for f in docs/js/ui/dom.js docs/js/ui/card.js docs/js/ui/update.js; do node --check "$f" && echo "ok $f"; done`
Expected:
```
ok docs/js/ui/dom.js
ok docs/js/ui/card.js
ok docs/js/ui/update.js
```

- [ ] **Step 8: Commit**

```bash
git add docs/index.html docs/css/app.css docs/credits.html docs/js/ui/dom.js docs/js/ui/card.js docs/js/ui/update.js && git commit -F - <<'EOF'
feat(app): page shell, styles, credits, learning card and update banner

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 14: The Session screen (`docs/js/ui/session.js`)

Worked example of one listening review of 苹果. The top bar shows Stop, "1 / 24" and a greyed Undo. The screen hides the characters, plays the sound twice, and offers 4 meanings. The learner taps "apple". `answer` saves the grade 'right' through `study.answer`, and the screen shows a green "Right!" banner above the full learning card with 苹果, which plays the sound once, and a Next button. Undo is now active. Next shows the following card. After a wrong tap the banner is red and says `Not quite. The answer is "apple".`, and Plan 2 puts a recall card for 苹果 four cards later.

`startSession` also saves today's and tomorrow's files (Choice 4) without waiting for them. `endSession` calls `study.finish()`, runs the 'sessionEnd' hook for Plan 5, asks Chrome to protect the saved data, and opens the check-in screen.

**Files:**
- Create: `docs/js/ui/session.js`

- [ ] **Step 1: Write `docs/js/ui/session.js`**

```js
// The Session screen. It asks Plan 2's Study controller for each card and sends it every
// answer. The screen itself only remembers the feedback of the last multiple-choice answer
// (app.feedback), so the full learning card can be shown before the learner taps Next.
import { Study } from '../study.js';
import { askPersistentStorage } from '../store.js';
import { cacheFiles } from '../offline.js';
import { filesForWords, soonWords } from '../view/files.js';
import { feedbackFor, gradeFor, progressLabel, questionView } from '../view/quiz.js';
import { cardElement, playSound } from './card.js';
import { h, show } from './dom.js';

const autoplayOn = (app) => app.study.settings.autoplay !== false;

// Start (or continue) today's session. The tap on Start also lets Chrome play sound.
export async function startSession(app) {
  app.player.stop();
  app.study = await Study.start({ store: app.store, data: app.data });
  app.feedback = null;
  app.revealed = false;
  const progress = await app.store.allProgress();
  const soon = soonWords({ words: app.data.words, progress, plan: app.study.plan, settings: app.study.settings });
  cacheFiles(filesForWords(soon)).catch((err) => console.warn('Saving files failed:', err));
  window.location.hash = '#/session';
}

// End the session, finished or not, and show the check-in screen unless `quiet`.
export async function endSession(app, { quiet = false } = {}) {
  const study = app.study;
  if (!study) return;
  app.study = null;
  app.player.stop();
  const result = await study.finish();
  app.lastResult = result;
  await app.hooks.emit('sessionEnd', { store: app.store, result });
  askPersistentStorage().catch(() => {});
  if (!quiet) window.location.hash = '#/checkin';
}

function header(app) {
  const study = app.study;
  return h('div', { class: 'session-top' },
    h('button', {
      class: 'small',
      onclick: () => { if (window.confirm('Stop for now? Your answers so far are saved.')) endSession(app); },
    }, 'Stop'),
    h('span', { class: 'muted' }, progressLabel(study.state)),
    h('button', {
      class: 'small',
      disabled: !study.canUndo,
      onclick: async () => {
        app.player.stop();
        app.feedback = null;
        app.revealed = false;
        await study.undo();
        renderSession(app);
      },
    }, 'Undo'));
}

// Saves one answer. app.busy ignores a second tap while the first is being saved.
async function answer(app, grade, feedback) {
  if (app.busy) return;
  app.busy = true;
  try {
    app.player.stop();
    await app.study.answer(grade);
    app.feedback = feedback;
    app.revealed = false;
  } finally {
    app.busy = false;
  }
  renderSession(app);
}

function next(app) {
  app.player.stop();
  app.feedback = null;
  renderSession(app);
}

export function renderSession(app) {
  const study = app.study;
  if (!study) {
    window.location.hash = '#/today';
    return;
  }
  if (study.finished && !app.feedback) {
    endSession(app);
    return;
  }
  const main = app.main;
  // After a multiple-choice answer the screen shows the result, the full learning card and Next.
  // That card plays the word once, because the question has just played it.
  if (app.feedback) {
    const { word, fb } = app.feedback;
    show(main, header(app),
      h('div', { class: fb.right ? 'banner right' : 'banner wrong' }, fb.message),
      cardElement(app, word, { autoplay: autoplayOn(app), afterAnswer: true }),
      h('button', { class: 'big', onclick: () => next(app) }, 'Next'));
    return;
  }
  const card = study.card;
  const word = app.wordsById.get(card.id);
  const step = study.byId.get(card.id)?.step ?? 0;
  const view = questionView({ card, word, pool: app.pool, day: study.day, step });
  if (view.kind === 'learn') {
    show(main, header(app), h('p', { class: 'heading' }, view.heading),
      cardElement(app, word, { autoplay: autoplayOn(app) }),
      h('button', { class: 'big', onclick: () => { app.player.stop(); study.next(); renderSession(app); } }, 'Next'));
    return;
  }
  if (view.kind === 'recall') {
    // A recall card shows characters, pinyin and sound. Reveal then shows the full card with the ratings.
    if (!app.revealed) {
      show(main, header(app), h('p', { class: 'heading' }, view.heading),
        h('div', { class: 'hz big-hz', lang: 'zh-CN' }, view.hz),
        h('div', { class: 'py' }, view.py),
        h('button', { class: 'small', onclick: () => playSound(app, view.sound, 2) }, 'Play sound'),
        h('p', { class: 'prompt' }, view.prompt),
        h('button', { class: 'big', onclick: () => { app.revealed = true; renderSession(app); } }, 'Reveal'));
      if (autoplayOn(app)) playSound(app, view.sound, 2);
      return;
    }
    show(main, header(app), h('p', { class: 'heading' }, view.heading),
      cardElement(app, word, { autoplay: false }),
      h('div', { class: 'grades' }, view.grades.map((g) => h('button', {
        class: `big grade-${g.grade}`,
        onclick: () => answer(app, g.grade, null),
      }, g.label))));
    return;
  }
  // A listening or pinyin question has four choices. The pinyin question shows the characters
  // but never tests them. The listening question hides them (view.hz is null).
  const choiceButtons = view.choices.map((text, i) => h('button', {
    class: 'choice',
    lang: view.kind === 'pinyin' ? 'zh-Latn-pinyin' : 'en',
    onclick: () => answer(app, gradeFor(view, i), { word, fb: feedbackFor(view, i) }),
  }, text));
  show(main, header(app), h('p', { class: 'heading' }, view.heading),
    view.hz ? h('div', { class: 'hz big-hz', lang: 'zh-CN' }, view.hz) : null,
    view.kind === 'pinyin' ? h('div', { class: 'en' }, view.en) : null,
    view.sound ? h('button', { class: 'small', onclick: () => playSound(app, view.sound, 2) }, 'Play sound') : null,
    h('p', { class: 'prompt' }, view.prompt),
    h('div', { class: 'choices' }, choiceButtons));
  if (view.sound && autoplayOn(app)) playSound(app, view.sound, 2);
}
```

- [ ] **Step 2: Check the syntax**

Run: `node --check docs/js/ui/session.js && echo ok`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add docs/js/ui/session.js && git commit -F - <<'EOF'
feat(app): session screen with questions, full card after each answer and Undo

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 15: The other screens, Settings and start-up (`docs/js/ui/screens.js`, `docs/js/ui/settings.js`, `docs/js/release.js`, `docs/js/app.js`)

`app.js` opens the IndexedDB store, loads `WORDS_FILE`, loads the plugins, and draws the screen that the address names. Before Plan 3 writes the words file, it shows "Word list missing" and names the file, which is expected until then.

**Files:**
- Create: `docs/js/ui/screens.js`, `docs/js/ui/settings.js`, `docs/js/release.js`, `docs/js/app.js`

- [ ] **Step 1: Write `docs/js/ui/screens.js`**

```js
// The Today, Check-in, Progress map, theme word list, word card, Stats and Badges screens.
// Each one reads saved data, asks a view module in ../view/ what to show, and draws it.
import { previewDay } from '../study.js';
import { studyDay, addDays } from '../dates.js';
import { todayView } from '../view/today.js';
import { badgesView, checkinView, mapView, statsView, themeWordsView } from '../view/progress.js';
import { shortDate } from '../view/format.js';
import { cardElement } from './card.js';
import { startSession } from './session.js';
import { h, show } from './dom.js';

async function checkedDays(app) {
  return (await app.store.allDays()).map((d) => d.day);
}

async function progressById(app) {
  return new Map((await app.store.allProgress()).map((p) => [p.id, p]));
}

export async function renderToday(app) {
  const today = studyDay();
  const plan = await previewDay({ store: app.store, data: app.data });
  const settings = { ...(await app.settings()) };
  const v = todayView({ plan, checkedDays: await checkedDays(app), today, settings });
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
}

export async function renderMap(app) {
  const tiles = mapView(app.data, await progressById(app));
  show(app.main, h('h1', {}, 'Progress map'),
    h('div', { class: 'tiles' }, tiles.map((t) => h('a', { class: `tile ${t.status}`, href: `#/theme/${t.id}` },
      h('span', { class: 'tile-status' }, t.statusLabel),
      h('span', { class: 'tile-name' }, t.name),
      h('span', { class: 'bar' },
        h('span', { class: 'bar-learned', style: `width:${t.learnedPct}` }),
        h('span', { class: 'bar-mastered', style: `width:${t.masteredPct}` })),
      h('span', { class: 'tile-counts' }, t.counts)))));
}

export async function renderTheme(app, themeId) {
  const v = themeWordsView(app.data, themeId, await progressById(app));
  if (!v) { window.location.hash = '#/map'; return; }
  show(app.main, h('a', { href: '#/map' }, 'Back to the map'), h('h1', {}, v.name),
    h('ul', { class: 'words' }, v.words.map((w) => h('li', {},
      h('a', { href: `#/word/${w.id}` },
        h('span', { class: 'w-hz', lang: 'zh-CN' }, w.hz), h('span', { class: 'w-py' }, w.py),
        h('span', { class: 'w-en' }, w.enShort), h('span', { class: 'w-status' }, w.status))))));
}

export async function renderWord(app, wordId) {
  const word = app.wordsById.get(wordId);
  if (!word) { window.location.hash = '#/map'; return; }
  const settings = await app.settings();
  show(app.main, h('a', { href: `#/theme/${word.theme}` }, 'Back to the theme'),
    cardElement(app, word, { autoplay: settings.autoplay !== false }));
}

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
}

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

- [ ] **Step 2: Write `docs/js/ui/settings.js`**

```js
// The Settings screen: daily amounts, auto-play, backup file and restore, saved storage,
// "Download all audio", the Google Sheet section that Plan 5 adds through hooks, and credits.
import { RELEASE, WORDS_FILE } from '../release.js';
import { studyDay } from '../dates.js';
import { askPersistentStorage } from '../store.js';
import { cacheFiles, countCached } from '../offline.js';
import { filesForWords } from '../view/files.js';
import { backupFileName, backupText, parseBackup, settingsFromForm, settingsView } from '../view/settings.js';
import { h, show } from './dom.js';

function numberField(label, name, value, [min, max]) {
  return h('label', { class: 'field' }, `${label} (${min} to ${max})`,
    h('input', { type: 'number', name, min, max, value, inputmode: 'numeric' }));
}

function download(name, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function renderSettings(app) {
  const saved = await app.settings();
  const v = settingsView(saved);
  const status = h('p', { class: 'muted' });
  const form = h('form', {
    onsubmit: async (e) => {
      e.preventDefault();
      const f = new FormData(form);
      const next = settingsFromForm({ newPerDay: f.get('newPerDay'), reviewCap: f.get('reviewCap'), autoplay: f.get('autoplay') === 'on' }, saved);
      await app.store.commit({ meta: { settings: next }, event: { day: studyDay(), kind: 'settings', settings: next } });
      status.textContent = `Saved: ${next.newPerDay} new words and up to ${next.reviewCap} reviews a day.`;
      form.newPerDay.value = next.newPerDay;
      form.reviewCap.value = next.reviewCap;
    },
  },
  numberField('New words per day', 'newPerDay', v.newPerDay, v.newRange),
  numberField('Most reviews per day', 'reviewCap', v.reviewCap, v.capRange),
  h('label', { class: 'field check' }, h('input', { type: 'checkbox', name: 'autoplay', checked: v.autoplay }), ' Play sounds automatically'),
  h('button', { class: 'big', type: 'submit' }, 'Save'), status);

  const protectedText = h('p', {});
  const showProtection = async () => {
    const on = navigator.storage?.persisted ? await navigator.storage.persisted() : false;
    protectedText.textContent = on ? 'Saved progress is protected from automatic clearing.' : 'Saved progress is not protected yet.';
  };
  showProtection();

  const allFiles = filesForWords(app.data.words);
  const audioText = h('p', { class: 'muted' }, 'Checking saved files...');
  countCached(allFiles).then((n) => { audioText.textContent = `${n} of ${allFiles.length} sound and stroke files are on this phone.`; });
  let stop = false;
  const downloadButton = h('button', {
    class: 'big',
    onclick: async () => {
      stop = false;
      downloadButton.disabled = true;
      const t = await cacheFiles(allFiles, {
        onProgress: (p) => { audioText.textContent = `Saving: ${p.done} of ${p.total} files${p.failed ? `, ${p.failed} failed` : ''}.`; },
        shouldStop: () => stop,
      });
      audioText.textContent = `${t.done} of ${t.total} files saved${t.failed ? `, ${t.failed} failed (try again online)` : ''}.`;
      downloadButton.disabled = false;
    },
  }, 'Download all audio (about 150 MB)');

  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    onchange: async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const { dump, exported } = parseBackup(await file.text());
        const when = exported ? exported.slice(0, 10) : 'an unknown day';
        if (!window.confirm(`Replace all progress on this phone with the backup from ${when}?`)) return;
        await app.store.restore(dump);
        window.alert('Backup restored.');
        window.location.hash = '#/today';
      } catch (err) {
        window.alert(err.message);
      } finally {
        fileInput.value = '';
      }
    },
  });

  const pluginArea = h('div', {});
  show(app.main, h('h1', {}, 'Settings'),
    h('h2', {}, 'Daily amounts and sound'), form,
    h('h2', {}, 'Offline'), audioText, downloadButton,
    h('button', { class: 'small', onclick: () => { stop = true; } }, 'Stop downloading'),
    h('h2', {}, 'Your progress'), protectedText,
    h('button', { class: 'small', onclick: async () => { await askPersistentStorage(); showProtection(); } }, 'Protect saved progress'),
    h('button', {
      class: 'small',
      onclick: async () => download(backupFileName(studyDay()), backupText(await app.store.dump(), { release: RELEASE })),
    }, 'Download backup file'),
    h('label', { class: 'field' }, 'Restore from a backup file', fileInput),
    pluginArea,
    h('h2', {}, 'About'),
    h('p', { class: 'muted' }, `Release ${RELEASE}, word list ${WORDS_FILE.replace('data/', '')}.`),
    h('a', { href: 'credits.html' }, 'Credits and licences'));
  await app.hooks.emit('settings', { container: pluginArea, store: app.store });
}
```

- [ ] **Step 3: Write `docs/js/release.js`**

```js
// The release number and the words file of this version of the app. sw.js repeats both
// values, and tests/js/release.test.mjs checks that they agree. Every release that changes
// any file in docs/ raises RELEASE (r001, r002, ...), which makes phones show
// "Update available, tap to reload". When Plan 3 writes a newer words file, WORDS_FILE
// names it, and the release test fails until it does.
export const RELEASE = 'r001';
export const WORDS_FILE = 'data/words_v001.json';
```

- [ ] **Step 4: Write `docs/js/app.js`**

```js
// At start-up the app opens the saved progress, loads the words file, registers the service
// worker, loads the plugins, and draws the screen that the address names ('#/today', '#/map', ...).
import { openIdbStore } from './store.js';
import { loadSettings } from './study.js';
import { makePool } from './distractors.js';
import { RELEASE, WORDS_FILE } from './release.js';
import { PLUGINS } from './plugins.js';
import { createHooks, loadPlugins } from './hooks.js';
import { createPlayer } from './audio.js';
import { NAV, parseRoute } from './view/route.js';
import { h, show } from './ui/dom.js';
import { setupUpdates } from './ui/update.js';
import { endSession, renderSession } from './ui/session.js';
import {
  renderBadges, renderCheckin, renderMap, renderStats, renderTheme, renderToday, renderWord,
} from './ui/screens.js';
import { renderSettings } from './ui/settings.js';

const app = {
  main: document.getElementById('main'),
  nav: document.getElementById('nav'),
  overlay: document.getElementById('overlay'),
  hooks: createHooks(),
  player: createPlayer(),
  study: null,
  lastResult: null,
  feedback: null,
  revealed: false,
  busy: false,
};

app.settings = () => loadSettings(app.store);

// "Tap to continue": shown when the phone refuses to play sound until the next tap.
app.needTap = (retry) => {
  app.overlay.replaceChildren(h('button', {
    class: 'big',
    onclick: () => { app.overlay.hidden = true; retry(); },
  }, 'Tap to continue'));
  app.overlay.hidden = false;
};

// A short message at the bottom of the screen that goes away after 4 seconds.
app.note = (text) => {
  const el = h('div', { class: 'toast' }, text);
  document.body.append(el);
  setTimeout(() => el.remove(), 4000);
};

function drawNav(route) {
  const hidden = route.name === 'session';
  app.nav.hidden = hidden;
  if (hidden) return;
  app.nav.replaceChildren(...NAV.map((item) => h('a', {
    href: `#/${item.name}`,
    class: item.name === route.name ? 'active' : '',
  }, item.label)));
}

async function render() {
  const route = parseRoute(window.location.hash);
  if (route.name !== 'session' && app.study) await endSession(app, { quiet: true });
  drawNav(route);
  try {
    switch (route.name) {
      case 'session': renderSession(app); break;
      case 'checkin': await renderCheckin(app); break;
      case 'map': await renderMap(app); break;
      case 'theme': await renderTheme(app, route.id); break;
      case 'word': await renderWord(app, route.id); break;
      case 'stats': await renderStats(app); break;
      case 'badges': await renderBadges(app); break;
      case 'settings': await renderSettings(app); break;
      default: await renderToday(app);
    }
  } catch (err) {
    console.error(err);
    show(app.main, h('h1', {}, 'Something went wrong'), h('p', {}, err.message));
  }
}

async function boot() {
  setupUpdates(document.getElementById('update'));
  try {
    app.store = await openIdbStore();
  } catch (err) {
    show(app.main, h('h1', {}, 'Cannot open saved progress'), h('p', {}, String(err)));
    return;
  }
  const res = await fetch(WORDS_FILE).catch(() => null);
  if (!res || !res.ok) {
    show(app.main, h('h1', {}, 'Word list missing'), h('p', {}, `The app could not load ${WORDS_FILE} (release ${RELEASE}).`));
    return;
  }
  app.data = await res.json();
  app.wordsById = new Map(app.data.words.map((w) => [w.id, w]));
  app.pool = makePool(app.data.words);
  await loadPlugins(PLUGINS, { on: app.hooks.on, store: app.store, data: app.data });
  window.addEventListener('hashchange', render);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      app.player.stop();
      app.hooks.emit('hidden', { store: app.store });
    } else {
      app.hooks.emit('open', { store: app.store, data: app.data });
      // Back from the background during a session, a tap restores sound (the design's "Tap to continue").
      if (app.study) app.needTap(() => renderSession(app));
    }
  });
  await render();
  app.hooks.emit('open', { store: app.store, data: app.data });
}

boot();
```

- [ ] **Step 5: Check the syntax**

Run: `for f in docs/js/ui/screens.js docs/js/ui/settings.js docs/js/release.js docs/js/app.js; do node --check "$f" && echo "ok $f"; done`
Expected: four `ok` lines.

- [ ] **Step 6: Commit**

```bash
git add docs/js/ui/screens.js docs/js/ui/settings.js docs/js/release.js docs/js/app.js && git commit -F - <<'EOF'
feat(app): Today, check-in, map, stats, badges and settings screens, and start-up

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 16: The service worker and the release check (`docs/sw.js`)

How the service worker answers, with the site at `https://<user>.github.io/hsk-flashcards/`:

| Request | Rule |
|---|---|
| the page, `js/study.js`, `css/app.css`, the icons, the words file | from the cache `app-r001`, saved when r001 installed |
| `audio/w/w0026_6ce06b7e.mp3`, `strokes/82f9.json` | from `media-v1` when saved, otherwise fetched and then saved |
| anything else (for example Plan 5's Google Apps Script address) | left to the browser |

`sw.test.mjs` runs `sw.js` in Node's `vm` module (which runs a script with made-up browser objects) with stand-ins for Cache Storage and `fetch`. `release.test.mjs` checks that `APP_FILES` lists every file of the site that must work offline, and nothing else. When a later plan adds a file to `docs/` (Plan 5's `js/sync.js`, for example), this test fails until the file is added to `APP_FILES` and `RELEASE` is raised.

**Files:**
- Create: `docs/sw.js`
- Test: `tests/js/sw.test.mjs`, `tests/js/release.test.mjs`

- [ ] **Step 1: Write the failing test `tests/js/sw.test.mjs`**

```js
// Runs docs/sw.js in Node with small stand-ins for the browser's service worker API, and
// checks which requests it answers from which cache.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SCOPE = 'https://learner.github.io/hsk-flashcards/';

function fakeCaches() {
  const stores = new Map();
  const keyOf = (req) => (typeof req === 'string' ? new URL(req, SCOPE).href : req.url).split('?')[0];
  const api = {
    stores,
    async open(name) {
      if (!stores.has(name)) {
        const files = new Map();
        stores.set(name, {
          files,
          async match(req) { return files.get(keyOf(req)); },
          async put(req, res) { files.set(keyOf(req), res); },
          async add(url) { throw new TypeError(`404 ${url}`); },
          async addAll(urls) { for (const u of urls) files.set(keyOf(u), new Response(`cached ${u}`)); },
        });
      }
      return stores.get(name);
    },
    async keys() { return [...stores.keys()]; },
    async delete(name) { return stores.delete(name); },
  };
  return api;
}

function loadSw({ fetchImpl } = {}) {
  const handlers = {};
  const caches = fakeCaches();
  const fetched = [];
  const self = {
    registration: { scope: SCOPE },
    clients: { claim: async () => {} },
    skipWaiting: () => { self.skipped = true; },
    addEventListener: (type, fn) => { handlers[type] = fn; },
  };
  const context = {
    self, caches, console: { warn: () => {} }, Response, URL,
    fetch: async (req) => {
      const url = typeof req === 'string' ? req : req.url;
      fetched.push(url);
      return fetchImpl ? fetchImpl(url) : new Response(`net ${url}`);
    },
  };
  vm.runInNewContext(readFileSync(new URL('../../docs/sw.js', import.meta.url), 'utf8'), context);
  return { sw: self.swForTests, handlers, caches, fetched, self };
}

// Sends one GET request through the fetch handler. Returns the response, or null when the
// worker leaves the request to the browser.
async function get(handlers, path, mode = 'no-cors') {
  let answer = null;
  handlers.fetch({ request: { url: SCOPE + path, method: 'GET', mode }, respondWith: (p) => { answer = p; } });
  return answer ? answer : null;
}

test('requests are sorted into app files, media files and the rest', () => {
  const { sw } = loadSw();
  assert.equal(sw.routeFor(`${SCOPE}`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}index.html?source=pwa`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}js/study.js`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}${sw.WORDS_FILE}`, SCOPE), 'app');
  assert.equal(sw.routeFor(`${SCOPE}audio/w/w0026_6ce06b7e.mp3`, SCOPE), 'media');
  assert.equal(sw.routeFor(`${SCOPE}strokes/82f9.json`, SCOPE), 'media');
  assert.equal(sw.routeFor(`${SCOPE}data/words_v000.json`, SCOPE), 'network');
  assert.equal(sw.routeFor('https://script.google.com/macros/s/x/exec', SCOPE), 'network');
});

test('install saves the app files, and a missing words file does not stop it', async () => {
  const { sw, caches } = loadSw();
  await sw.install();
  const cache = caches.stores.get(sw.APP_CACHE);
  assert.equal(cache.files.size, sw.APP_FILES.length); // the words file is not among them
  assert.ok(await cache.match('index.html'));
  assert.equal(await cache.match(sw.WORDS_FILE), undefined);
});

test('app files come from the cache, and the page itself works offline', async () => {
  const { sw, handlers, fetched } = loadSw({ fetchImpl: () => { throw new TypeError('offline'); } });
  await sw.install();
  const res = await get(handlers, 'js/study.js');
  assert.equal(await res.text(), 'cached js/study.js');
  const page = await get(handlers, '', 'navigate');
  assert.equal(await page.text(), 'cached ./');
  assert.deepEqual(fetched, []);
});

test('an audio file is fetched once, kept, and then played from the phone', async () => {
  const { sw, handlers, caches, fetched } = loadSw();
  const first = await get(handlers, 'audio/w/w0026_6ce06b7e.mp3');
  assert.equal(await first.text(), `net ${SCOPE}audio/w/w0026_6ce06b7e.mp3`);
  const second = await get(handlers, 'audio/w/w0026_6ce06b7e.mp3');
  assert.ok(second);
  assert.equal(fetched.length, 1);
  assert.ok(caches.stores.has(sw.MEDIA_CACHE));
});

test('other requests and non-GET requests are left to the browser', async () => {
  const { handlers } = loadSw();
  assert.equal(await get(handlers, 'data/other.json'), null);
  let answered = false;
  handlers.fetch({ request: { url: `${SCOPE}js/app.js`, method: 'POST' }, respondWith: () => { answered = true; } });
  assert.equal(answered, false);
});

test('a new release deletes the old app cache and keeps the media cache', async () => {
  const { sw, caches } = loadSw();
  await caches.open('app-r000');
  await caches.open(sw.MEDIA_CACHE);
  await caches.open(sw.APP_CACHE);
  await sw.activate();
  assert.deepEqual((await caches.keys()).sort(), [sw.APP_CACHE, sw.MEDIA_CACHE].sort());
});

test('the update banner\'s message lets the new version take over', () => {
  const { handlers, self } = loadSw();
  handlers.message({ data: 'skipWaiting' });
  assert.equal(self.skipped, true);
});
```

- [ ] **Step 2: Write the failing test `tests/js/release.test.mjs`**

```js
// Checks that a release is complete. sw.js and release.js must agree, every file of the site
// must be saved for offline use, and the app must load the newest words file, with stroke
// data for every character.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import vm from 'node:vm';
import { RELEASE, WORDS_FILE } from '../../docs/js/release.js';
import { MEDIA_CACHE } from '../../docs/js/offline.js';
import { charsOf, strokeUrl } from '../../docs/js/strokes.js';

const DOCS = new URL('../../docs/', import.meta.url);

function swValues() {
  const self = { addEventListener: () => {} };
  vm.runInNewContext(readFileSync(new URL('sw.js', DOCS), 'utf8'), { self, console });
  return self.swForTests;
}

// Every file under docs/, as paths such as 'js/app.js'.
function siteFiles(dir = DOCS, prefix = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = new URL(name, dir);
    if (statSync(full).isDirectory()) out.push(...siteFiles(new URL(`${name}/`, dir), `${prefix}${name}/`));
    else out.push(`${prefix}${name}`);
  }
  return out;
}

// Files that are not saved at install: the worker itself, licence texts, the words files
// (the current one is saved separately), and audio and stroke files (saved as they are used).
const NOT_PRECACHED = (path) => path === 'sw.js' || path.endsWith('.txt') || path.startsWith('data/')
  || path.startsWith('audio/') || path.startsWith('strokes/');

test('sw.js repeats the release, the words file and the media cache name', () => {
  const sw = swValues();
  assert.equal(sw.RELEASE, RELEASE);
  assert.equal(sw.WORDS_FILE, WORDS_FILE);
  assert.equal(sw.MEDIA_CACHE, MEDIA_CACHE);
  assert.match(RELEASE, /^r\d{3}$/);
});

test('every app file is saved for offline use, and every saved file exists', () => {
  const listed = [...swValues().APP_FILES]; // copied, because arrays made inside vm fail deepEqual
  const onDisk = siteFiles().filter((p) => !NOT_PRECACHED(p));
  assert.deepEqual(listed.filter((p) => p !== './').sort(), onDisk.sort());
});

test('the app loads the newest words file, and each of its characters has stroke data', (t) => {
  const dataDir = new URL('data/', DOCS);
  const files = existsSync(dataDir) ? readdirSync(dataDir).filter((n) => /^words_v\d{3}\.json$/.test(n)).sort() : [];
  if (!files.length) {
    t.skip('no docs/data/words_vNNN.json yet (Plan 3 writes it)');
    return;
  }
  assert.equal(WORDS_FILE, `data/${files.at(-1)}`);
  const data = JSON.parse(readFileSync(new URL(WORDS_FILE, DOCS), 'utf8'));
  const missing = [...new Set(data.words.flatMap((w) => charsOf(w.hz)))]
    .filter((ch) => !existsSync(new URL(strokeUrl(ch), DOCS)));
  assert.deepEqual(missing, [], 'run python tools/12_vendor_strokes.py');
});
```

- [ ] **Step 3: Run both and see them fail**

Run: `node --test tests/js/sw.test.mjs tests/js/release.test.mjs`
Expected: FAIL with `Error: ENOENT: no such file or directory, open '...docs\sw.js'`, and `ℹ tests 10`, `ℹ fail 9`, `ℹ skipped 1`. The release tests fail too, because two of them read `docs/sw.js`.

- [ ] **Step 4: Write `docs/sw.js`**

```js
// The service worker is a script the browser keeps next to the app. It answers the app's
// requests from the phone's storage, so the app opens and runs without internet.
//   App files and the words file are saved when this version installs and are answered
//     from the cache 'app-<RELEASE>'. A new RELEASE makes a new cache, and the old one is
//     deleted once the new version takes over.
//   Audio and stroke files are answered from the cache 'media-v1' when saved there, and
//     otherwise fetched and then saved, so every played file is kept. Their names change
//     when their content changes, so this cache never needs clearing.
// A new version waits until the learner taps "Update available, tap to reload", which
// sends the message 'skipWaiting'.
// RELEASE and WORDS_FILE repeat docs/js/release.js, and tests/js/release.test.mjs checks them.
const RELEASE = 'r001';
const WORDS_FILE = 'data/words_v001.json';
const MEDIA_CACHE = 'media-v1';
const APP_CACHE = `app-${RELEASE}`;
const APP_FILES = [
  './',
  'index.html',
  'credits.html',
  'manifest.webmanifest',
  'css/app.css',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'js/app.js',
  'js/audio.js',
  'js/badges.js',
  'js/checkin.js',
  'js/config.js',
  'js/curriculum.js',
  'js/dates.js',
  'js/distractors.js',
  'js/hooks.js',
  'js/offline.js',
  'js/pinyin.js',
  'js/plan.js',
  'js/plugins.js',
  'js/release.js',
  'js/rng.js',
  'js/session.js',
  'js/srs.js',
  'js/stats.js',
  'js/store.js',
  'js/strokes.js',
  'js/study.js',
  'js/ui/card.js',
  'js/ui/dom.js',
  'js/ui/screens.js',
  'js/ui/session.js',
  'js/ui/settings.js',
  'js/ui/update.js',
  'js/view/card.js',
  'js/view/files.js',
  'js/view/format.js',
  'js/view/progress.js',
  'js/view/quiz.js',
  'js/view/route.js',
  'js/view/settings.js',
  'js/view/today.js',
  'vendor/hanzi-writer-3.7.3.esm.js',
];

// Which rule answers a request. url and scope are full addresses, where scope is the
// folder of this file ('https://<user>.github.io/hsk-flashcards/').
// routeFor('https://x.io/app/audio/w/w0001_3fa2b1c9.mp3', 'https://x.io/app/') gives 'media'.
function routeFor(url, scope) {
  if (!url.startsWith(scope)) return 'network';
  const path = url.slice(scope.length).split(/[?#]/)[0];
  if (path.startsWith('audio/') || path.startsWith('strokes/')) return 'media';
  if (path === '' || path === WORDS_FILE || APP_FILES.includes(path)) return 'app';
  return 'network';
}

async function install() {
  const cache = await caches.open(APP_CACHE);
  await cache.addAll(APP_FILES);
  try {
    await cache.add(WORDS_FILE); // missing before Plan 3 ends, and the app says so
  } catch (err) {
    console.warn('Words file not saved:', err);
  }
}

async function activate() {
  for (const name of await caches.keys()) {
    if (name.startsWith('app-') && name !== APP_CACHE) await caches.delete(name);
  }
  await self.clients.claim();
}

async function fromApp(request) {
  const cache = await caches.open(APP_CACHE);
  const hit = await cache.match(request, { ignoreSearch: true });
  if (hit) return hit;
  try {
    const res = await fetch(request);
    if (res.ok && request.url.endsWith(WORDS_FILE)) await cache.put(request, res.clone());
    return res;
  } catch (err) {
    if (request.mode === 'navigate') {
      const shell = await cache.match('index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

async function fromMedia(request) {
  const cache = await caches.open(MEDIA_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) await cache.put(request, res.clone());
  return res;
}

function onFetch(event) {
  const { request } = event;
  if (request.method !== 'GET') return;
  const route = routeFor(request.url, self.registration.scope);
  if (route === 'app') event.respondWith(fromApp(request));
  else if (route === 'media') event.respondWith(fromMedia(request));
}

self.addEventListener('install', (event) => event.waitUntil(install()));
self.addEventListener('activate', (event) => event.waitUntil(activate()));
self.addEventListener('fetch', onFetch);
self.addEventListener('message', (event) => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

// Read by tests/js/sw.test.mjs, which runs this file in Node with stand-ins for the browser.
self.swForTests = { RELEASE, WORDS_FILE, MEDIA_CACHE, APP_CACHE, APP_FILES, routeFor, install, activate, onFetch };
```

- [ ] **Step 5: Run both and see them pass**

Run: `node --test tests/js/sw.test.mjs tests/js/release.test.mjs`
Expected: `ℹ tests 10`, `ℹ pass 9`, `ℹ fail 0`, `ℹ skipped 1`. The skipped test says `no docs/data/words_vNNN.json yet (Plan 3 writes it)`. If the "every app file" test fails, its message lists the files on disk and in `APP_FILES` side by side. Add the missing path to `APP_FILES`, or remove the stray file.

- [ ] **Step 6: Commit**

```bash
git add docs/sw.js tests/js/sw.test.mjs tests/js/release.test.mjs && git commit -F - <<'EOF'
feat(app): service worker for offline use and the release check

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 17: Browser checks (`tests/browser/*`, `tools/14_smoke_site.py`)

Node cannot run the page, IndexedDB or a service worker, so this task runs them in Google Chrome. `check.mjs` drives a headless Chrome (one without a window) through the Chrome DevTools Protocol, the interface that Chrome opens with `--remote-debugging-port`. The controller agent may do the same checks by hand with Claude in Chrome instead. The steps say what to look for either way.

The smoke site gives every fixture sound path a silent MP3 of about one second, so sounds "play" and end without real audio.

**Files:**
- Create: `tests/browser/store-idb.html`, `tests/browser/store-idb.js`, `tests/browser/check.mjs`, `tools/14_smoke_site.py`
- Output (git-ignored): `.claude/scratch/smoke_vNNN/`

- [ ] **Step 1: Write `tests/browser/store-idb.html`**

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>running</title>
  <script type="module" src="store-idb.js"></script>
</head>
<body>
  <h1>IndexedDB store checks</h1>
  <p>Serve the project folder (not docs/) with <code>python -m http.server 8124</code> and open
  <code>http://localhost:8124/tests/browser/store-idb.html</code>.</p>
  <pre id="out">running...</pre>
</body>
</html>
```

- [ ] **Step 2: Write `tests/browser/store-idb.js`**

These are Plan 2's store checks (Plan 2 Task 14), run against `IdbStore`, as Plan 2 asked of this plan.

```js
// Plan 2's store checks (tests/js/store.test.mjs), run against the IndexedDB store in a real
// browser, because Node has no IndexedDB. Each check uses a fresh database that is deleted
// afterwards. The page shows one line per check and sets its title to "PASS n" or "FAIL n".
import { openIdbStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';

const DAY = '2026-10-05';
const ev = (extra = {}) => ({ day: DAY, kind: 'review', id: 'w0001', grade: 'right', ...extra });
const out = document.getElementById('out');
const results = [];

function equal(a, b, what) {
  const x = JSON.stringify(a);
  const y = JSON.stringify(b);
  if (x !== y) throw new Error(`${what}: got ${x}, expected ${y}`);
}

async function rejects(promise, pattern, what) {
  try {
    await promise;
  } catch (err) {
    if (pattern.test(String(err.message))) return;
    throw new Error(`${what}: wrong error ${err.message}`);
  }
  throw new Error(`${what}: did not fail`);
}

async function check(name, body) {
  const dbName = `hsk-check-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const store = await openIdbStore(dbName);
  try {
    await body(store, dbName);
    results.push(`PASS ${name}`);
  } catch (err) {
    results.push(`FAIL ${name}: ${err.message}`);
  } finally {
    store.db.close();
    await new Promise((resolve) => { const r = indexedDB.deleteDatabase(dbName); r.onsuccess = resolve; r.onerror = resolve; r.onblocked = resolve; });
  }
}

await check('an answer writes progress and its event together, seq from 1', async (store) => {
  const p = learnedProgress('w0001', DAY);
  equal(await store.commit({ progress: [p], event: ev() }), 1, 'first seq');
  equal(await store.commit({ event: ev({ kind: 'reask' }) }), 2, 'second seq');
  equal(await store.getProgress('w0001'), p, 'progress');
  equal((await store.eventsSince(0)).map((e) => [e.seq, e.kind]), [[1, 'review'], [2, 'reask']], 'events');
});

await check('a bad commit writes nothing', async (store) => {
  const good = learnedProgress('w0001', DAY);
  await rejects(store.commit({ progress: [good], event: { day: DAY } }), /needs an event/, 'no kind');
  await rejects(store.commit({ progress: [good, { id: 'w0002', step: 12 }], event: ev() }), /Bad progress/, 'bad step');
  equal(await store.allProgress(), [], 'no progress');
  equal(await store.eventsSince(0), [], 'no events');
});

await check('remove deletes a progress record', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  await store.commit({ remove: ['w0001'], event: ev({ kind: 'undo', target: 1 }) });
  equal(await store.getProgress('w0001'), undefined, 'removed');
});

await check('events by seq and by study day', async (store) => {
  await store.commit({ event: ev({ day: '2026-10-03' }) });
  await store.commit({ event: ev({ day: '2026-10-04' }) });
  await store.commit({ event: ev({ day: '2026-10-05' }) });
  equal((await store.eventsSince(1)).map((e) => e.seq), [2, 3], 'since 1');
  equal((await store.eventsFrom('2026-10-04')).map((e) => e.day), ['2026-10-04', '2026-10-05'], 'from day');
});

await check('days and meta', async (store) => {
  await store.commit({ days: [{ day: '2026-10-06', reviews: 3 }, { day: '2026-10-05', reviews: 5 }],
    meta: { settings: { newPerDay: 8 } }, event: ev({ kind: 'checkin' }) });
  equal((await store.allDays()).map((d) => d.day), ['2026-10-05', '2026-10-06'], 'days');
  equal(await store.getMeta('settings'), { newPerDay: 8 }, 'meta');
  equal(await store.getMeta('missing'), undefined, 'missing meta');
});

await check('dump and restore round-trip, and seq keeps going up', async (store) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], days: [{ day: DAY }], meta: { badges: { 'streak-7': DAY } }, event: ev() });
  await store.commit({ event: ev() });
  const backup = await store.dump();
  const other = await openIdbStore(`hsk-check-restore-${Date.now()}`);
  try {
    await other.restore(backup);
    equal(await other.dump(), backup, 'round trip');
    equal(await other.commit({ event: ev() }), 3, 'next seq');
    await rejects(other.restore({ progress: [], events: [{ seq: 2 }, { seq: 1 }], days: [], meta: {} }), /increasing/, 'bad order');
  } finally {
    other.db.close();
    indexedDB.deleteDatabase(other.db.name);
  }
});

await check('data survives closing and opening the database again', async (store, dbName) => {
  await store.commit({ progress: [learnedProgress('w0001', DAY)], event: ev() });
  store.db.close();
  const again = await openIdbStore(dbName);
  equal((await again.getProgress('w0001')).step, 1, 'reopened');
  store.db = again.db; // so the check's clean-up closes the reopened connection
});

const failed = results.filter((r) => r.startsWith('FAIL')).length;
out.textContent = results.join('\n');
document.title = failed ? `FAIL ${failed}` : `PASS ${results.length}`;
```

- [ ] **Step 3: Write `tools/14_smoke_site.py`**

```python
"""Step 14 (for checking only). Build a local copy of the site that runs on the test words.

Output: .claude/scratch/smoke_vNNN/ (git-ignored), holding
  - a copy of docs/,
  - the 61-word test fixture (tests/js/fixtures/words_fixture.json) under the name that
    docs/js/release.js gives WORDS_FILE, unless docs/ already has that file,
  - a short silent MP3 for every word and sentence audio path of the fixture,
  - the stroke data of the fixture's characters (fetched as in step 12).
Serve it with:  cd .claude/scratch/smoke_vNNN && python -m http.server 8123
then open http://localhost:8123/ in Chrome. Nothing in docs/ is changed.
"""
import json
import re
import shutil
import sys
from pathlib import Path

from common import next_version_path, read_json
from strokedata import HANZI_WRITER, HANZI_WRITER_DATA, download, vendor

# One MPEG-1 Layer III frame (128 kbit/s, 44.1 kHz) whose audio data is all zeros, which
# players decode as silence. 38 frames last about one second.
_FRAME = bytes([0xFF, 0xFB, 0x90, 0x00]) + bytes(413)


def silent_mp3(frames=38):
    return _FRAME * frames


def words_file_name():
    text = Path("docs/js/release.js").read_text(encoding="utf-8")
    return re.search(r"WORDS_FILE = '([^']+)'", text).group(1)


def main():
    out = next_version_path(".claude/scratch/smoke", "")
    shutil.copytree("docs", out)
    fixture = read_json("tests/js/fixtures/words_fixture.json")
    words_path = out / words_file_name()
    if not words_path.exists():
        words_path.parent.mkdir(parents=True, exist_ok=True)
        with open(words_path, "x", encoding="utf-8") as f:
            json.dump(fixture, f, ensure_ascii=False)
    for w in fixture["words"]:
        for rel in (w["au"], w["ex"]["au"]):
            path = out / "audio" / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                with open(path, "xb") as f:
                    f.write(silent_mp3())
    tally = vendor(out, fixture["words"], download(HANZI_WRITER), download(HANZI_WRITER_DATA))
    print(f"Smoke site: {out}")
    print(f"Stroke files new {tally['new']}, already there {tally['same']}, missing {''.join(tally['missing']) or 'none'}")
    print(f"Serve it with:  cd {out.as_posix()} && python -m http.server 8123")
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Write `tests/browser/check.mjs`**

```js
// Browser checks in a headless Chrome, driven through the Chrome DevTools Protocol (the
// interface Chrome opens with --remote-debugging-port). No npm package is needed, because
// Node 24 has fetch and WebSocket built in.
//
//   node tests/browser/check.mjs store     the IndexedDB store page (project folder served on 8124)
//   node tests/browser/check.mjs day       a whole first day on the smoke site (served on 8123)
//   node tests/browser/check.mjs offline   the same site with its server stopped
//   node tests/browser/check.mjs update    after RELEASE was raised in the smoke copy
// Each prints PASS or FAIL lines and exits with 1 when anything failed.
const PORT = 9333;
const SITE = 'http://localhost:8123/';
const STORE_PAGE = 'http://localhost:8124/tests/browser/store-idb.html';

async function openPage(url) {
  const target = await (await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(url)}`, { method: 'PUT' })).json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const waiting = new Map();
  const errors = [];
  ws.addEventListener('message', (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(JSON.stringify(msg.error)));
      else resolve(msg.result);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    id += 1;
    waiting.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 412, height: 915, deviceScaleFactor: 2, mobile: true });
  const page = {
    send,
    errors,
    async eval(expression) {
      const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text);
      return r.result.value;
    },
    sleep: (ms) => new Promise((resolve) => { setTimeout(resolve, ms); }),
    async until(expression, ms = 10000) {
      const end = Date.now() + ms;
      while (Date.now() < end) {
        try { if (await page.eval(expression)) return; } catch { /* page still loading */ }
        await page.sleep(150);
      }
      throw new Error(`Timed out waiting for ${expression}`);
    },
    text: () => page.eval("document.getElementById('main').innerText.split(String.fromCharCode(10)).filter(Boolean).join(' | ')"),
    async close() {
      ws.close();
      await fetch(`http://127.0.0.1:${PORT}/json/close/${target.id}`);
    },
  };
  return page;
}

const results = [];
function check(name, ok, detail = '') {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);
}

// Counts every sound the page starts, so the check can see "plays twice".
const COUNT_PLAYS = `window.__plays = []; const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () { __plays.push(this.src.replace(location.origin, '')); return play.call(this); }; true`;
const CLICK = (label) => `[...document.querySelectorAll('button')].find((b) => b.textContent === '${label}').click()`;

async function store() {
  const page = await openPage(STORE_PAGE);
  await page.until("!!document.getElementById('out') && document.title !== 'running'", 20000);
  const lines = (await page.eval("document.getElementById('out').textContent")).split('\n');
  for (const line of lines) results.push(line);
  await page.close();
}

async function day() {
  const page = await openPage(SITE);
  await page.until("!!document.querySelector('.start')", 20000);
  check('Today shows the day\'s counts and Start', /12 \| new words/.test(await page.text()), await page.text());
  await page.eval(COUNT_PLAYS);
  await page.eval("document.querySelector('.start').click()");
  await page.until("location.hash === '#/session' && !!document.querySelector('.session-top')");
  const seen = {};
  let strokes = 0;
  let listenHz = 0; // listening questions that showed characters
  let learnPlays = null; // sounds started by the first new word's card
  let afterPlays = null; // sounds started by the first card after an answer
  for (let i = 0; i < 300 && (await page.eval('location.hash')) === '#/session'; i += 1) {
    const kind = await page.eval(`(() => { const m = document.getElementById('main');
      if (!m.querySelector('.session-top')) return 'wait';
      if (m.querySelector('.banner')) return 'feedback';
      if (m.querySelector('.choice')) return m.querySelector('.en') ? 'pinyin' : 'listen';
      if ([...m.querySelectorAll('button')].some((b) => b.textContent === 'Reveal')) return 'recall';
      if (m.querySelector('.grades')) return 'grades';
      return m.querySelector('.card') ? 'learn' : 'other'; })()`);
    seen[kind] = (seen[kind] ?? 0) + 1;
    if ((kind === 'learn' && !learnPlays) || (kind === 'feedback' && !afterPlays)) {
      // Let the card's sound run out. Two silent one-second plays and the pause take under 3 s.
      // __mark is where the sounds of this card start (set before the tap that opened it).
      await page.sleep(3500);
      const plays = await page.eval('__plays.slice(window.__mark ?? 0)');
      if (kind === 'learn') learnPlays = plays;
      else afterPlays = plays;
    }
    if (kind === 'listen') listenHz += await page.eval("document.querySelectorAll('#main .hz').length");
    if (kind === 'learn' && !strokes) {
      await page.eval(CLICK('Stroke order'));
      await page.until("document.querySelectorAll('.strokes svg').length > 0").catch(() => {});
      strokes = await page.eval("document.querySelectorAll('.strokes svg').length");
    }
    await page.eval('window.__mark = __plays.length; true');
    if (kind === 'listen' || kind === 'pinyin') {
      // Tap the right answer. The word is found in the words file by the characters a pinyin
      // question shows, or by the sound a listening question played, as it hides the characters.
      // The choice with that word's pinyin or short meaning is tapped.
      await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
        const data = await (await fetch(WORDS_FILE)).json();
        const shown = document.querySelector('.big-hz');
        const heard = __plays[__plays.length - 1];
        const w = shown ? data.words.find((x) => x.hz === shown.textContent) : data.words.find((x) => '/audio/' + x.au === heard);
        const want = document.querySelector('.en') ? w.py : w.enShort;
        const b = [...document.querySelectorAll('.choice')].find((c) => c.textContent === want) ?? document.querySelector('.choice');
        b.click(); })()`);
    } else if (kind === 'recall') await page.eval(CLICK('Reveal'));
    else if (kind === 'grades') await page.eval("document.querySelector('.grades button').click()");
    else if (kind === 'learn' || kind === 'feedback') await page.eval(CLICK('Next'));
    await page.sleep(100);
  }
  check('the session shows learning cards, listening checks and pinyin checks',
    seen.learn === 12 && seen.listen >= 12 && seen.pinyin >= 12, JSON.stringify(seen));
  check('stroke order draws the character', strokes > 0, `${strokes} drawings`);
  check('the listening question hides the characters', seen.listen > 0 && listenHz === 0, `${listenHz} of ${seen.listen} showed them`);
  check('a new word\'s card plays its sound twice', learnPlays?.length === 2 && learnPlays[0] === learnPlays[1], JSON.stringify(learnPlays));
  check('the card after an answer plays its sound once', afterPlays?.length === 1, JSON.stringify(afterPlays));
  await page.until("location.hash === '#/checkin' && !!document.querySelector('h1')");
  await page.sleep(300);
  const checkin = await page.text();
  check('the check-in screen says Checked in! with a 1-day streak', /Checked in! \| 1 day streak \| 12 new words learned/.test(checkin), checkin.slice(0, 120));
  check('the service worker controls the page', await page.eval('!!navigator.serviceWorker.controller'));
  const media = await page.eval("caches.open('media-v1').then((c) => c.keys()).then((k) => k.length)");
  check('today\'s and tomorrow\'s sound and stroke files were saved', media > 0, `${media} files`);
  await page.eval(`window.__plays = []; location.hash = '#/map'; true`);
  await page.sleep(500);
  const firstId = await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
    const data = await (await fetch(WORDS_FILE)).json(); return data.words.slice().sort((a, b) => a.ord - b.ord)[0].id; })()`);
  await page.eval(`location.hash = '#/word/${firstId}'; true`);
  await page.sleep(4000);
  const plays = await page.eval('__plays');
  check('a word card left alone plays its sound twice', plays.length === 2 && plays[0] === plays[1], JSON.stringify(plays));
  for (const hash of ['#/map', '#/stats', '#/badges', '#/settings', '#/today']) {
    await page.eval(`location.hash = '${hash}'; true`);
    await page.sleep(700);
    check(`${hash} draws`, (await page.text()).length > 20);
  }
  check('Today now says the day is done', /Done for today/.test(await page.text()));
  const installable = await page.send('Page.getInstallabilityErrors');
  check('Chrome finds the app installable', installable.installabilityErrors.length === 0, JSON.stringify(installable.installabilityErrors));
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}

async function offline() {
  const page = await openPage(`${SITE}#/today`);
  await page.sleep(3000);
  check('the app opens with the server stopped', /day streak/.test(await page.text()), (await page.text()).slice(0, 80));
  const firstId = await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
    const data = await (await fetch(WORDS_FILE)).json(); return data.words.slice().sort((a, b) => a.ord - b.ord)[0].id; })()`);
  await page.eval(`location.hash = '#/word/${firstId}'; true`);
  await page.sleep(1500);
  check('a word card opens offline', /Stroke order/.test(await page.text()));
  const played = await page.eval(`(async () => { const { WORDS_FILE } = await import(location.origin + '/js/release.js');
    const data = await (await fetch(WORDS_FILE)).json(); const w = data.words.find((x) => x.id === '${firstId}');
    return new Promise((resolve) => { const a = new Audio('audio/' + w.au); a.onended = () => resolve('ended');
      a.onerror = () => resolve('error'); a.play().catch((e) => resolve('refused ' + e.name)); }); })()`);
  check('its saved sound plays offline', played === 'ended', played);
  await page.eval(CLICK('Stroke order'));
  await page.sleep(2500);
  check('its stroke order draws offline', (await page.eval("document.querySelectorAll('.strokes svg').length")) > 0);
  await page.close();
}

async function update() {
  const page = await openPage(`${SITE}#/today`);
  await page.sleep(5000);
  const banner = await page.eval("(() => { const b = document.getElementById('update'); return b.hidden ? 'hidden' : b.textContent; })()");
  check('the update message appears', banner === 'Update available, tap to reload', banner);
  await page.eval("document.getElementById('update').click()");
  await page.sleep(4000);
  const names = await page.eval('caches.keys()');
  check('after the tap only the new app cache is left', names.filter((n) => n.startsWith('app-')).length === 1, JSON.stringify(names));
  check('progress is kept after the update', /1 day streak/.test(await page.text()), (await page.text()).slice(0, 60));
  await page.close();
}

const mode = process.argv[2];
const modes = { store, day, offline, update };
if (!modes[mode]) {
  results.push('FAIL usage: node tests/browser/check.mjs store|day|offline|update');
} else {
  try {
    await modes[mode]();
  } catch (err) {
    results.push(`FAIL ${mode} stopped: ${err.message}`);
  }
}
console.log(results.join('\n'));
// exitCode, not process.exit(), which can crash Node on Windows while a socket is closing.
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
```

- [ ] **Step 5: Build the smoke site**

Run: `PYTHONIOENCODING=utf-8 python tools/14_smoke_site.py`
Expected (the version number may be higher):
```
Smoke site: .claude\scratch\smoke_v001
Stroke files new 80, already there 2, missing none
Serve it with:  cd .claude/scratch/smoke_v001 && python -m http.server 8123
```

- [ ] **Step 6: Start the two local servers and a headless Chrome, each in its own background shell**

```bash
cd .claude/scratch/smoke_v001 && python -m http.server 8123
```
```bash
python -m http.server 8124
```
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir="$TEMP\\hskchk" --no-first-run --autoplay-policy=no-user-gesture-required about:blank
```
The second server serves the project folder, so the store page can import `docs/js/store.js`. The Chrome profile must be at a short path such as `%TEMP%\hskchk`, because Cache Storage failed with "Unexpected internal error" when the profile sat inside the long scratch path. The last flag lets sound play without a tap, which the headless checks need.

- [ ] **Step 7: Run the IndexedDB store checks**

Run: `node tests/browser/check.mjs store`
Expected: 7 lines that start with `PASS`, from `PASS an answer writes progress and its event together, seq from 1` to `PASS data survives closing and opening the database again`, and exit code 0.
With Claude in Chrome instead, open `http://localhost:8124/tests/browser/store-idb.html`, and the tab title reads `PASS 7`.

- [ ] **Step 8: Run a whole first day**

Run: `node tests/browser/check.mjs day`
Expected: 18 `PASS` lines and exit code 0, among them:
```
PASS the session shows learning cards, listening checks and pinyin checks ({"learn":12,"listen":12,"feedback":24,"pinyin":12})
PASS stroke order draws the character (1 drawings)
PASS the listening question hides the characters (0 of 12 showed them)
PASS a new word's card plays its sound twice (["/audio/w/w0039_a36ee9e4.mp3","/audio/w/w0039_a36ee9e4.mp3"])
PASS the card after an answer plays its sound once (["/audio/w/w0039_a36ee9e4.mp3"])
PASS the check-in screen says Checked in! with a 1-day streak (Checked in! | 1 day streak | 12 new words learned. | New badges | Finished Starter Kit | ...)
PASS today's and tomorrow's sound and stroke files were saved (81 files)
PASS a word card left alone plays its sound twice (["/audio/w/w0039_a36ee9e4.mp3","/audio/w/w0039_a36ee9e4.mp3"])
PASS Chrome finds the app installable ([])
PASS no uncaught errors on the page
```
With Claude in Chrome instead, open `http://localhost:8123/`, tap Start, go through the session tapping the right answers, tap "Stroke order" on one learning card, and confirm that a listening question shows no characters, that a new word's card plays its sound twice and the card after an answer once, and confirm the check-in screen, the five screens of the bottom bar, and that Today then says "Done for today. See you tomorrow!".

- [ ] **Step 9: Run the offline check**

Stop the server on port 8123 (end its background shell), then run: `node tests/browser/check.mjs offline`
Expected:
```
PASS the app opens with the server stopped (1 day streak | ...)
PASS a word card opens offline
PASS its saved sound plays offline (ended)
PASS its stroke order draws offline
```

- [ ] **Step 10: Run the update check**

In the smoke copy only (never in `docs/`), raise the release, then serve it again:
```bash
cd .claude/scratch/smoke_v001 && sed -i "s/RELEASE = 'r001'/RELEASE = 'r002'/" sw.js js/release.js && python -m http.server 8123
```
Then run: `node tests/browser/check.mjs update`
Expected:
```
PASS the update message appears (Update available, tap to reload)
PASS after the tap only the new app cache is left (["media-v1","app-r002"])
PASS progress is kept after the update (1 day streak | ...)
```

- [ ] **Step 11: Clean up**

End the two servers and Chrome, then delete the Chrome profile and the smoke site, which have served their purpose:
```bash
rm -rf "$TEMP/hskchk" .claude/scratch/smoke_v001
```

- [ ] **Step 12: Commit**

```bash
git add tests/browser tools/14_smoke_site.py && git commit -F - <<'EOF'
test(app): browser checks for the IndexedDB store, a whole day, offline use and updates

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 18: Full check, project notes and the phone checklist

**Files:**
- Modify: `.claude/CLAUDE.md` (git-ignored, so it is not committed)

- [ ] **Step 1: Run every JavaScript test**

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ tests 193`, `ℹ pass 191`, `ℹ fail 0`, `ℹ skipped 2`.

- [ ] **Step 2: Run the Python tests**

Run: `python -m pytest tests -q`
Expected: 7 more tests pass than before this plan, and none fail.

- [ ] **Step 3: Check that nothing private went into the public folder**

Run: `git ls-files docs | sed 's|/[^/]*$||' | sort | uniq -c`
Expected: only these folders: `docs` (index.html, credits.html, manifest.webmanifest, sw.js), `docs/css`, `docs/icons`, `docs/js`, `docs/js/ui`, `docs/js/view` and `docs/vendor`, plus `docs/strokes`, `docs/data` and `docs/audio/...` once Plan 3's files exist. No `.md` file, note or test file is in `docs/`.

- [ ] **Step 4: Add the release rule and the browser checks to `.claude/CLAUDE.md`**

Add these lines after the line about the JavaScript tests that Plan 2 added:

```
- Every release that changes docs/ raises RELEASE in docs/js/release.js and docs/sw.js (r001, r002, ...). A new words file is named in WORDS_FILE in both, then `python tools/12_vendor_strokes.py` adds its stroke data. tests/js/release.test.mjs checks all of this.
- Browser checks: `python tools/14_smoke_site.py`, then the servers and headless Chrome of Plan 4 Task 17, then `node tests/browser/check.mjs store|day|offline|update`.
```

- [ ] **Step 5: When Plan 3's words file exists**

Run these three, in order:
1. `PYTHONIOENCODING=utf-8 python tools/12_vendor_strokes.py`, which copies the stroke data of every character and should report about 2,600 files written and `characters without stroke data: 0`;
2. `node --test tests/js/release.test.mjs`, which must pass all 3 tests once `WORDS_FILE` names the newest file;
3. `git add docs/strokes` and commit it with the words file.

- [ ] **Step 6: Report to the user**

Report the test counts of Steps 1 and 2, and each `PASS` line of Task 17. Say plainly that nothing has run on the phone yet. List the choices of the section "Choices this plan makes where the design is silent", and say that the three decisions of the section "Decisions the user made on 2026-09-28" are built in.

- [ ] **Step 7: Hand the phone checklist to Plan 5**

These are the design's phone checks. They need the deployed site, so Plan 5 runs them after it deploys:
1. Chrome on the Android phone offers to install the app, and it opens from the home screen without the address bar.
2. After the Start tap, the sound plays twice on a new word's card, the listening question and the recall card, and once on the card after an answer. The listening question shows no characters.
3. With airplane mode on, today's session runs with sound and stroke order.
4. After a release with a raised `RELEASE`, the app shows "Update available, tap to reload".
5. Settings says "Saved progress is protected from automatic clearing."
6. Switching to another app during a session and back shows "Tap to continue", and the tap restores the sound.
7. A session takes about 20 to 25 minutes once steady. The times of the answers are in the log (`ts` in each event), so a later check can measure it and replace Plan 2's guessed seconds per card in `config.js`.

---

## Self-review

### Design requirements covered by this plan

| Requirement (from the design, Plan 2's hand-over or the brief) | Task |
|---|---|
| Plain HTML, CSS and JavaScript, no framework, no build step, no npm packages at run time | all |
| Screens: Today, Session, Check-in summary, Progress map, Stats, Badges, Settings | 5, 6, 13 to 15 |
| A big Start button whose tap lets Chrome play sound | 5, 15 |
| Reviews first, then new words in groups of 4 with learning cards, group checks and a final check (Plan 2's session) | 11, 14 |
| Learning card with characters, pinyin, part of speech, meaning, replay, "Stroke order", the example sentence with the word highlighted, its pinyin, its English and its own play button | 3, 13 |
| The word's sound plays twice automatically (once on the card after an answer, by the user's decision) and replays on tap, and Next stops it | 3, 8, 13, 14, 17 |
| The three quiz types: listen and pick the meaning, see the meaning and pick the pinyin, recall and self-rate with Reveal | 4, 14 |
| Characters shown and never tested, except that the listening question hides them until the answer (the user's decision) | 4, 11, 14, 17 |
| The full learning card after every answer | 14 |
| Undo fixes a mis-tap | 14 |
| Check-in when reviews and new words are done, with streak and a month calendar | 6, 14, 15 |
| Home screen shows the streak and this week's check-ins | 5, 15 |
| Badges screen | 6, 15 |
| Progress map with a tile per theme, done, current or locked, with learned and mastered shares; a tile lists its words; a word opens its card | 6, 15 |
| Stats: learned and mastered, per HSK level, 30-day activity chart, reviews due in 7 days, 7-day accuracy | 6, 15 |
| Settings: daily amounts, auto-play on or off, Google Sheet link (through Plan 5's hook), backup, download all audio | 7, 10, 15 |
| The review cap and new-word settings in their ranges | 7 |
| "Download backup file" (from `store.dump()`) | 7, 15 |
| Ask Chrome to protect the data after the first session, and show it in Settings | 14, 15 |
| Stroke order with Hanzi Writer, working offline | 1, 2, 13, 17 |
| App files and word data kept on the phone after the first visit | 16, 17 |
| Today's and tomorrow's audio saved at the start of a session, and every played file kept | 7, 9, 14, 16, 17 |
| "Download all audio (about 150 MB)" | 9, 15 |
| "Tap to continue" after the phone paused the app | 13, 15 |
| "Update available, tap to reload" | 13, 16, 17 |
| Installable to the home screen (manifest, icons, service worker) | 12, 16, 17 |
| The site asks search engines not to list it | 13 |
| Credits for the word list, CC-CEDICT, sentences, voice and Hanzi Writer inside the app (Plan 3b's hand-over) | 13 |
| How the app finds the newest words file (Plan 3b's hand-over) | 15, 16 |
| Plan 2's store checks run against IndexedDB in a browser (Plan 2's hand-over) | 17 |
| A clean hook for Plan 5's Google Sheet backup | 10 |
| View helpers tested with the fixture by `node --test "tests/js/*.test.mjs"`, and a browser check | 2 to 11, 16, 17 |
| Outputs never overwritten, relative paths, nothing private in `docs/` | 1, 12, 17, 18 |

### Left to other plans on purpose

- **Plan 3** writes `docs/data/words_vNNN.json` and the audio. Then Task 18 Step 5 of this plan copies the stroke data and sets `WORDS_FILE`.
- **Plan 5** adds `docs/js/sync.js` through `plugins.js` and `hooks.js` (the Sheet link, the secret code, "Back up now", Restore from the Sheet, and the sync at session end, on close and after 12 hours), adds it to `APP_FILES` and raises `RELEASE`. It deploys `docs/` to GitHub Pages and runs the phone checklist of Task 18 Step 7.
