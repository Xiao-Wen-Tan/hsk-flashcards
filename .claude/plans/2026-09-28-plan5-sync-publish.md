# HSK Flashcards Plan 5: Google Sheet Backup, Publishing on GitHub Pages, and the Phone Test Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Copy the learner's progress from the phone to a Google Sheet the user owns (with restore to a new phone), publish the site from the public GitHub repository through GitHub Pages, and hand the user a release checklist and the final test on the Android phone.

**Architecture:** The backup is a plugin that joins the app through Plan 4's hooks (`docs/js/hooks.js`, `docs/js/plugins.js`). Its logic lives in `docs/js/sheet.js`, which needs no page, so Node tests it. The other end is a Google Apps Script (`tools/apps_script/Code.gs`), a small program that runs inside the user's Sheet and is published by the user as a "web app" address. The phone sends JSON to that address. The tests run the real `Code.gs` in Node against a stand-in for Google's spreadsheet services, so the whole round trip (back up, send twice, refuse a wrong code, restore into an empty phone) is tested without Google. The web app address and the secret code are typed on the phone and kept only in the phone's browser. The site is published by pushing `main` to `github.com/Xiao-Wen-Tan/hsk-flashcards` and turning on GitHub Pages for the `docs/` folder.

**Tech Stack:** Node v24.16.0 (`node:test`, `node:vm`, `node:http`, built-in `fetch`), plain JavaScript ES modules, Google Apps Script (its V8 runtime), Python 3.10 with pytest, Git for Windows with Git Credential Manager 2.7.3, headless Google Chrome for the browser checks, GitHub Pages.

**Spec:** `.claude/specs/2026-09-27-hsk-flashcards-design.md` (the design), sections "Saving progress", "Hosting on GitHub" and "Verification". This plan plugs into Plan 4's Task 10 ("The hook for Plan 5") and runs Plan 4's phone checklist (Plan 4 Task 18 Step 7).

**Where this plan sits:**
- Plan 1 (done) decoded the PDFs.
- Plan 2 (done, merged into `main` as commit 2264316) built the app logic in `docs/js/`.
- Plan 3 (3a and 3b) builds the word list, sentences, audio and `docs/data/words_v001.json`.
- Plan 4 builds the screens, sound, stroke order, offline use, and the hooks this plan uses.
- Plan 5 (this plan) adds the Google Sheet backup, publishes the site, and runs the phone test.

**Before you start.** Plans 3 and 4 must be finished and merged into `main`. Then `node --test "tests/js/*.test.mjs"` gives Plan 4's totals (`ℹ tests 192`, `ℹ pass 190`, `ℹ skipped 2` before Plan 3's words file exists; with it, fewer tests are skipped), and `python -m pytest tests -q` passes. Tasks 1 to 8 need no internet except the browser checks' smoke site (Plan 4 Task 17). Tasks 9 to 12 need the user.

**Who does what.** Steps marked **USER** are done by the user, because they need the user's own Google or GitHub sign-in or the phone. Each USER step says what Claude checks afterwards. Claude never asks for the user's passwords, and never needs the secret code or the web app address.

---

## Facts verified before writing this plan (2026-09-28)

Each fact below was checked on 2026-09-28 by running a command or reading a file. All code ran in the scratch folder `scratchpad/work/plan5/` of this planning session. Nothing was written into the project tree except this plan file.

- **Plan 2 in `main`.** `git log` shows `2264316 merge: Plan 2 app logic`. Every file of `docs/js/` and `tests/js/` in the project is byte-identical (`cmp`) to the copy the scratch run used.
- **Plan 4's code.** Plan 4 is not carried out yet, so its code blocks were extracted from `.claude/plans/2026-09-28-plan4-screens-offline.md` with a small script. With Plan 2's files, `node --test "tests/js/*.test.mjs"` gave `ℹ tests 190`, `ℹ pass 188`, `ℹ skipped 2`. Plan 4's Task 11 test file (`flow.test.mjs`, 2 tests) was not extracted, which is why this is 2 below Plan 4's 192.
- **This plan's tests.** With this plan's code added, the same command gave `ℹ tests 231`, `ℹ pass 229`, `ℹ fail 0`, `ℹ skipped 2`. The 41 new tests are apps-script 14, sheet 19 and sync 8. Plan 4's hooks test keeps 4 tests (one is replaced). So in the project, after Plan 4, expect `ℹ tests 233`, `ℹ pass 231`, `ℹ skipped 2` when Plan 3's words file is absent. `python -m pytest tests/test_publishcheck.py -q` gave `5 passed`.
- **Each new test file fails first.** Without `Code.gs`, `apps-script.test.mjs` failed with `ENOENT` in all 14 tests. Without `docs/js/sheet.js` and `docs/js/sync.js`, their test files failed with `Error [ERR_MODULE_NOT_FOUND]` and `ℹ fail 1`. With `sheet.js` in `docs/js/` but not in `APP_FILES`, Plan 4's release test failed and listed `'js/sheet.js'`, and the same for `'.nojekyll'`.
- **The tests catch real mistakes.** Each change below was made to a copy, one at a time, and made at least one test fail: skipping the check that the event at the cursor is still on the phone, allowing an empty phone to replace the Sheet, sending keepalive for large requests, not retrying when the Sheet is behind, counting only "right" and not "Know it" as right, leaving out the number formats in `Code.gs` (5 tests failed, because the stand-in sheet turns '2026-10-05' into a date as Google Sheets does), accepting Log rows the Sheet already has, skipping the other-device check, and skipping the secret-code check (4 tests failed).
- **Browser checks in headless Chrome 154** (`tests/browser/check.mjs` of Plan 4 with this plan's new `sheet` mode, a fresh profile at `%TEMP%\hskchk7`).
  - `day` gave 15 `PASS` lines with the backup plugin loaded, including "no uncaught errors on the page" and "Chrome finds the app installable".
  - `sheet`, against `tests/browser/fake-sheet-server.mjs`, gave 10 `PASS` lines: the Settings section appears, a secret code is made, the address and code are saved, "Test connection" answers `Connected. The Sheet has saved answers up to number 0.`, "Back up now" sends the first day (`Backed up. 26 changes sent.`, with 26 Log rows, 12 Progress rows and 1 Daily row), a wrong code is refused, "Restore from Google Sheet" gives the same counts (`12 26 1 / 12 26 1`) and "1 day streak", hiding the page sends a new change (26 then 27), an unreachable address says `Could not reach the Sheet (Failed to fetch).`, and no uncaught errors.
  - `offline` gave its 4 `PASS` lines with `js/sheet.js` and `js/sync.js` in the app cache (run before the last small change to the Settings section, which `day` and `sheet` then re-checked).
  - The stand-in server answers a POST with a redirect (302) to a second address that returns the JSON, as Google does, so `fetch` with `redirect: 'follow'` and a `text/plain` body was checked across a redirect.
- **The live-site checker.** `node tools/16_check_live.mjs http://localhost:8123/` against the smoke site gave 5 `PASS` lines (release r002, all 47 app files, the words file, 40 sounds, the "noindex" line). With the smoke copy's release changed to r009 it printed `FAIL the site serves release r002 (RELEASE = 'r009')`, and without the final `/` it printed its usage line and exited with 1.
- **The publish check on the real project.** `python tools/15_publish_check.py`, run read-only from the project root with the module on `PYTHONPATH`, printed `133 tracked files, docs/ 0.1 MB` and `OK, nothing private or oversized found`. Every commit so far uses `143559791+Xiao-Wen-Tan@users.noreply.github.com`, and no tracked file contains `C:/Users` or the Windows user name.
- **Tools on this machine.** `gh` (GitHub's command-line tool) is not installed. `git credential-manager --version` prints `2.7.3`, so the first `git push` over HTTPS opens a browser sign-in. The repository has no remote yet (`git remote -v` prints nothing), and its only branch is `main`.
- **Not checked, because it needs the user's accounts or the phone.** Nothing ran against real Google Apps Script or real GitHub. In particular these are unverified until Tasks 9 to 12: that Google's web app answers a `text/plain` POST from the site with a readable JSON answer (the widely used pattern, and the one the stand-in copies), that `setNumberFormats`, `insertRowsAfter` and the chart builder's `setNumHeaders` behave as the stand-in assumes, the Pages build, and everything on the phone.

## Choices this plan makes where the design is silent

Each choice is set in one place, named in brackets.

1. **How "only new changes" works.** Every saved event has a `seq` number that only goes up (Plan 2). The phone keeps a cursor, the last `seq` the Sheet confirmed, and sends the events above it, 500 per request. The script adds only Log rows above its own last `seq` (kept in Script Properties, the script's small settings store), so a request sent twice adds nothing. Each request also carries the Progress rows of the words its events touched, the Daily rows of their days, the settings and badges, and a summary. (`backUp` in `sheet.js`, `handle_` in `Code.gs`)
2. **The phone builds the readable rows.** The script only stores rows, so the logic stays in tested JavaScript. The last column of each Progress, Log and Daily row holds the saved record as JSON, which Restore reads back exactly. (`progressRow`, `logRow`, `dailyRow`)
3. **A fifth tab, Meta.** The design lists Progress, Log, Daily and Dashboard. Restore also needs the settings and badges, so they go in a tab called Meta. (`TABS` in `Code.gs`)
4. **Daily rows for every study day,** not only checked-in days, with reviews, the share right first time (Know it counts as right, Unsure does not, as in Plan 2's accuracy), new words learned, and minutes studied. Minutes add the gaps between answers, each gap counted as at most 5 minutes, so the Sheet can show whether a day takes the design's 20 to 25 minutes. Answers taken back by Undo are left out of the counts but stay in the Log with an "undo" row. (`dailyRow`, `minutesOf`)
5. **The Dashboard** shows the phone's summary (last backup, streak, best streak, check-ins, learned, mastered, words in the course) and a 30-day table built with formulas from the Daily tab, with a column chart of reviews and new words. (`dashboard_`, `summary_`)
6. **The secret code** is 24 letters and digits in groups of 4, made by the phone the first time Settings is opened, with Copy and Share buttons so it can be sent to the Sheet owner. It is also editable, so a new phone can take the existing code. It is stored on the phone and in the user's own copy of the script, never in the repository, the Sheet, or the backup file. (`makeCode`, `checkCode`, `drawSettings`)
7. **Where the address and code are kept.** In one `localStorage` entry (`hsk-sheet-backup`), not in the IndexedDB store, so they never go into "Download backup file" or into the Sheet. (`STATE_KEY`)
8. **Deployment settings.** "Execute as: Me" and "Who has access: Anyone", because the phone does not sign in to Google. The secret code guards both reading (Restore) and writing. A plain visit to the address only says the backup is running. (`doGet`, SETUP.md)
9. **One phone backs up to a Sheet at a time.** The first backup claims the Sheet for that browser's random device ID. Another browser is refused with "other-device" until it restores from the Sheet (which claims it) or replaces the Sheet. (`handle_`, `restoreFromSheet`)
10. **Conflicts are never settled silently.** When the phone's log no longer contains the event at its cursor (after "Restore from a backup file" of Plan 4), or another phone owns the Sheet, the backup stops, and Settings offers "Restore from Google Sheet" and "Replace the Sheet with this phone's progress". A phone with no progress can never replace the Sheet. (`backUp`, `drawSettings`)
11. **Failures never block studying.** The hooks start a backup and return at once. A failure only changes the status line in Settings, and the changes wait. They are sent at the next session end, when the app is closed, when the phone comes back online, and when the app opens after a failed try. (`install`, `isDue`)
12. **Closing the app** sends pages of at most 40 events with `keepalive`, which the browser finishes after the page is gone, but only when the request is under 60,000 bytes (browsers refuse larger keepalive requests). Anything left is sent next time. (`KEEPALIVE_PAGE_SIZE`, `postJson`)
13. **A Sheet that lost rows** (for example rows deleted by hand) answers "behind" with its last `seq`, and the phone sends again from there, once. (`backUp`)
14. **Restore checks before it replaces.** It reads the Log in pages of 2,000 rows, checks that the numbers of words, answers and check-in days match what the Sheet reported, and only then replaces the phone's progress. (`restoreFromSheet`, `restore_`)
15. **`http://localhost` addresses are accepted** in Settings, for the local browser check. (`checkWebAppUrl`)
16. **`docs/.nojekyll`.** GitHub Pages runs a site builder called Jekyll by default, which skips some folders and slows the build. This empty file turns it off, so `docs/` is published exactly as it is. (Task 4)
17. **Release r002.** Adding `js/sheet.js` and `js/sync.js` changes `docs/`, so `RELEASE` becomes r002, as Plan 4's release rule requires. (Task 4)
18. **A publish check before every push.** `tools/15_publish_check.py` refuses personal Windows paths, the Windows user name, Google Sheet or web app addresses, e-mail addresses other than GitHub's noreply one and Claude's co-author line, a real code in `Code.gs`, non-web files in `docs/`, files over 50 MB and a site over 900 MB. (Task 7)
19. **A live check after every deployment.** `tools/16_check_live.mjs` fetches every app file, the words file and 40 sounds from the published site and compares the release number. (Task 8)
20. **Only `main` is pushed.** Plan branches and worktrees stay on this computer. (Task 9)
21. **No `robots.txt`.** Search engines read it only at the top of a domain (`xiao-wen-tan.github.io/robots.txt`), which this project does not control. The page's `noindex` line from Plan 4 already asks them not to list the app. (Task 8)

## Open decisions for the user

1. **Which Google account owns the Sheet.**
   - (a) A personal Gmail account.
   - (b) A university or work Google account.
   - **Recommendation: (a).** Many school and work accounts block web apps that "Anyone" may reach, which the phone needs. The steps in SETUP.md are the same for both.
2. **When to publish.**
   - (a) After Plans 3 and 4 are finished, so the first public version is the whole app.
   - (b) Earlier, with the site saying "Word list missing" until Plan 3's words file arrives.
   - **Recommendation: (a).** The phone test and the Sheet test need the words file, and each early release would need its own release number.
3. **Whether the learner may see the Sheet.**
   - (a) Keep it private to the user.
   - (b) Share it with the learner as a viewer (in Google Sheets, **Share**, their address, **Viewer**).
   - **Recommendation: (a)** to start. It changes nothing in the app, so it can be changed at any time.
4. **How the code and address travel between the phone and the computer.**
   - (a) As the design has it, the app makes the code and the user sends it to the computer (Share button), then sends the address back to the phone.
   - (b) The user sits with the phone and the computer together and copies both by hand.
   - **Recommendation: (b)** for the first setup, because it takes one sitting. (a) works when the two are apart.

---

## Words used in this plan

- **Google Apps Script.** Google's built-in way to write a small program that works on a Google Sheet. The program (here `Code.gs`) is pasted into the Sheet's script editor.
- **Web app address.** The link Google gives an Apps Script when it is "deployed as a web app", such as `https://script.google.com/macros/s/AKfycb.../exec`. The phone sends its progress there.
- **Secret code.** A random code such as `k7mq-2xrt-9pwd-hc4n-fz6b-y3ja`. The script accepts only requests that carry it.
- **Event and seq.** One line of the answer log, and its number (Plan 2). For example seq 14 is "review of 苹果, listening quiz, right".
- **Cursor.** The `seq` of the last event the Sheet confirmed. After the first day's backup it is 26, so the next backup sends events 27 and up.
- **Device ID.** A random 16-character name of one browser, such as `a1b2c3d4e5f60718`, so the Sheet knows which phone backs up to it.
- **Stand-in Sheet.** `tests/js/fake-apps-script.mjs`, which runs the real `Code.gs` in Node with small copies of Google's spreadsheet services.
- **keepalive.** A setting of `fetch` that lets a request finish after the page is closed.
- **GitHub Pages.** GitHub's free hosting of fixed files from a repository folder, here `docs/` of `main`, at `https://xiao-wen-tan.github.io/hsk-flashcards/`.

## File map

| File | Responsibility |
|---|---|
| `tools/apps_script/Code.gs` | The script in the user's Sheet, with its tabs, setup, the web app (ping, push, restore, claim) and the Dashboard |
| `tools/apps_script/SETUP.md` | The user's click-by-click setup, in the repository and on GitHub |
| `tests/js/fake-apps-script.mjs` | Runs `Code.gs` in Node with stand-ins for Google's services |
| `tests/js/apps-script.test.mjs` | Tests of `Code.gs` |
| `docs/js/sheet.js` | The phone's half without a page, with the code and address checks, the rows, backup, restore and the status text |
| `tests/js/sheet.test.mjs` | Tests of `sheet.js`, with real study days sent to `Code.gs` and restored |
| `docs/js/sync.js` | The plugin, with its hooks, one backup at a time and the Settings section |
| `tests/js/sync.test.mjs` | Tests of `sync.js` without a page |
| `docs/js/plugins.js`, `tests/js/hooks.test.mjs` | Modified so the plugin list names `./sync.js` |
| `docs/sw.js`, `docs/js/release.js`, `tests/js/release.test.mjs`, `docs/.nojekyll` | Modified or created for the new files in `APP_FILES`, release r002 and Pages without Jekyll |
| `docs/css/app.css` | Modified with three lines for the Settings section |
| `tests/browser/fake-sheet-server.mjs`, `tests/browser/check.mjs` | A local stand-in web app, and the new `sheet` browser check |
| `tools/publishcheck.py`, `tools/15_publish_check.py`, `tests/test_publishcheck.py` | Step 15: what a push would publish |
| `tools/16_check_live.mjs` | Step 16: the published site from outside |

`docs/` is public. This plan adds only app code to it. The secret code and the web app address never go into any file.

---

### Task 1: The script in the Sheet (`tools/apps_script/Code.gs`)

The script keeps five tabs: Progress (one row per word), Log (one row per event), Daily (one row per study day), Meta (settings and badges) and Dashboard. Worked example of one request. The phone sends
`{ "action": "push", "code": "k7mq-...", "device": "a1b2c3d4e5f60718", "from": 0, "log": [[1, "2026-10-05", ...], [2, ...], [3, ...]], "progress": [...], ... }`.
The script checks the code, adds Log rows 1 to 3, stores `LAST_SEQ = 3`, claims the Sheet for that device, and answers `{ "ok": true, "lastSeq": 3 }`. The same request again adds nothing and gives the same answer.

The test runs the real script in Node. The stand-in sheet copies two habits of Google Sheets, turning '2026-10-05' into a date and '=...' into a formula unless the cell is formatted as plain text, so a missing format fails a test.

**Files:**
- Create: `tools/apps_script/Code.gs`, `tests/js/fake-apps-script.mjs`
- Test: `tests/js/apps-script.test.mjs`

- [ ] **Step 1: Write `tests/js/fake-apps-script.mjs`**

```js
// Runs tools/apps_script/Code.gs in Node with small stand-ins for Google's SpreadsheetApp,
// PropertiesService, LockService and ContentService, so the tests can use the real script.
// The stand-in sheet copies two habits of Google Sheets that matter here: a text such as
// '2026-10-05' written into a cell that is not formatted as plain text ('@') becomes a date,
// and a text that starts with '=' becomes a formula. So a missing format makes a test fail.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const CODE_GS = new URL('../../tools/apps_script/Code.gs', import.meta.url);

class FakeSheet {
  constructor(name) {
    this.name = name;
    this.rows = []; // rows[r][c], 0-based
    this.formats = new Map(); // 'r,c' (1-based) -> format
    this.maxRows = 1000;
    this.frozen = 0;
    this.charts = [];
  }

  getName() { return this.name; }

  getMaxRows() { return this.maxRows; }

  insertRowsAfter(after, n) { this.maxRows += n; }

  setFrozenRows(n) { this.frozen = n; }

  getLastRow() {
    for (let r = this.rows.length; r >= 1; r -= 1) {
      if ((this.rows[r - 1] ?? []).some((v) => v !== '' && v !== undefined)) return r;
    }
    return 0;
  }

  getLastColumn() {
    return Math.max(0, ...this.rows.map((row) => {
      for (let c = row.length; c >= 1; c -= 1) if (row[c - 1] !== '' && row[c - 1] !== undefined) return c;
      return 0;
    }));
  }

  cell(r, c) { return this.rows[r - 1]?.[c - 1] ?? ''; }

  put(r, c, v) {
    while (this.rows.length < r) this.rows.push([]);
    const fmt = this.formats.get(`${r},${c}`);
    let value = v;
    if (typeof v === 'string' && fmt !== '@') {
      if (/^\d{4}-\d{2}-\d{2}/.test(v)) value = new Date(v);
      else if (v.startsWith('=')) value = { formula: v };
    }
    this.rows[r - 1][c - 1] = value;
  }

  getRange(row, col, numRows = 1, numCols = 1) {
    if (row < 1 || col < 1 || row + numRows - 1 > this.maxRows) {
      throw new Error(`The coordinates of the range are outside the dimensions of the sheet ${this.name}.`);
    }
    const sheet = this;
    const each = (fn) => {
      for (let i = 0; i < numRows; i += 1) for (let j = 0; j < numCols; j += 1) fn(row + i, col + j, i, j);
    };
    const checkShape = (values) => {
      if (values.length !== numRows || values.some((r) => r.length !== numCols)) {
        throw new Error(`The data has ${values.length} rows but the range has ${numRows}.`);
      }
    };
    return {
      getValues() {
        return Array.from({ length: numRows }, (_, i) => Array.from({ length: numCols }, (__, j) => sheet.cell(row + i, col + j)));
      },
      setValues(values) { checkShape(values); each((r, c, i, j) => sheet.put(r, c, values[i][j])); return this; },
      setValue(v) { sheet.put(row, col, v); return this; },
      setFormulas(values) { checkShape(values); each((r, c, i, j) => { sheet.rows[r - 1] ??= []; sheet.put(r, c, values[i][j]); }); return this; },
      setNumberFormats(values) { checkShape(values); each((r, c, i, j) => sheet.formats.set(`${r},${c}`, values[i][j])); return this; },
      setNumberFormat(f) { each((r, c) => sheet.formats.set(`${r},${c}`, f)); return this; },
      clearContent() { each((r, c) => { if (sheet.rows[r - 1]) sheet.rows[r - 1][c - 1] = ''; }); return this; },
    };
  }

  // Charts: a builder that accepts any call and records the options.
  newChart() {
    const spec = { calls: [] };
    const builder = new Proxy({}, {
      get: (_, name) => (name === 'build' ? () => spec : (...args) => { spec.calls.push([name, ...args]); return builder; }),
    });
    return builder;
  }

  insertChart(chart) { this.charts.push(chart); }

  getCharts() { return [...this.charts]; }

  removeChart(chart) { this.charts = this.charts.filter((c) => c !== chart); }
}

class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet('Sheet1')]; }

  getId() { return 'sheet-id-1'; }

  getSheetByName(name) { return this.sheets.find((s) => s.name === name) ?? null; }

  insertSheet(name, index) {
    const sheet = new FakeSheet(name);
    if (index === undefined) this.sheets.push(sheet);
    else this.sheets.splice(index, 0, sheet);
    return sheet;
  }

  // The rows of a tab below its heading, as plain values.
  rowsOf(name) {
    const s = this.getSheetByName(name);
    return s ? s.rows.slice(1, s.getLastRow()).map((r) => r.slice()) : [];
  }
}

// Loads Code.gs. With `code`, SECRET_CODE is set as if the user had pasted it.
export function loadAppsScript({ code = null } = {}) {
  const ss = new FakeSpreadsheet();
  const props = new Map();
  const logs = [];
  const context = {
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      openById: (id) => { if (id !== ss.getId()) throw new Error(`No spreadsheet ${id}`); return ss; },
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => { props.set(k, String(v)); },
      }),
    },
    LockService: { getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'application/json' },
      createTextOutput: (text) => ({ mime: null, setMimeType(m) { this.mime = m; return this; }, getContent: () => text }),
    },
    Charts: { ChartType: { COLUMN: 'COLUMN' } },
    Logger: { log: (msg) => logs.push(msg) },
    JSON,
  };
  vm.runInNewContext(readFileSync(CODE_GS, 'utf8'), context);
  if (code) context.SECRET_CODE = code;
  // Sends one request the way Google's web app would receive it, and returns the parsed answer.
  const post = async (body) => JSON.parse(context.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
  return { gs: context, ss, props, logs, post };
}
```

- [ ] **Step 2: Write the failing test `tests/js/apps-script.test.mjs`**

```js
// Tests of tools/apps_script/Code.gs, run in Node through fake-apps-script.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAppsScript } from './fake-apps-script.mjs';

const CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';
const PHONE = 'a1b2c3d4e5f60718';
const OTHER = 'ffeeddccbbaa9988';

function ready() {
  const s = loadAppsScript({ code: CODE });
  s.gs.setup();
  return s;
}

// A Log row as the phone builds it (docs/js/sheet.js logRow), for seq n.
const logRow = (n, day = '2026-10-05') => [n, day, `${day}T19:00:0${n % 10}.000Z`, 'review', 'w0026', '苹果', 'recall', 'Know it', '',
  JSON.stringify({ seq: n, day, kind: 'review', id: 'w0026', grade: 'know' })];
const progressRow = (id, step, due) => [id, '苹果', 'píngguǒ', 'apple', 'Food & Drink', 1, step, due, 'Learned', 0, 0, '2026-10-05',
  JSON.stringify({ id, step, due })];
const push = (extra = {}) => ({ action: 'push', code: CODE, device: PHONE, from: 0, log: [], progress: [], removed: [], daily: [], meta: [], ...extra });

test('setup refuses to run until the secret code is pasted', () => {
  const { gs } = loadAppsScript();
  assert.throws(() => gs.setup(), /Replace PASTE-THE-CODE-FROM-THE-APP/);
});

test('setup makes the five tabs with the Dashboard first and its chart', () => {
  const { ss, props, logs } = ready();
  assert.deepEqual(ss.sheets.map((s) => s.name), ['Dashboard', 'Sheet1', 'Progress', 'Log', 'Daily', 'Meta']);
  assert.deepEqual(ss.rowsOf('Log'), []);
  assert.equal(ss.getSheetByName('Log').cell(1, 1), 'Seq');
  assert.equal(ss.getSheetByName('Dashboard').charts.length, 1);
  assert.equal(props.get('SHEET_ID'), 'sheet-id-1');
  assert.equal(props.get('LAST_SEQ'), '0');
  assert.match(logs[0], /Setup done/);
});

test('running setup again keeps the data and makes one chart', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1)] }));
  s.gs.setup();
  assert.equal(s.ss.rowsOf('Log').length, 1);
  assert.equal(s.ss.getSheetByName('Dashboard').charts.length, 1);
});

test('a visit in a browser says the backup is running', () => {
  const { gs } = loadAppsScript();
  assert.match(gs.doGet().getContent(), /"app":"hsk-flashcards-backup"/);
});

test('a wrong secret code is refused and writes nothing', async () => {
  const s = ready();
  assert.deepEqual(await s.post(push({ code: 'wrong', log: [logRow(1)] })), { ok: false, error: 'code', message: 'Wrong secret code.' });
  assert.deepEqual(s.ss.rowsOf('Log'), []);
});

test('before setup every request is refused with not-set-up', async () => {
  const s = loadAppsScript({ code: CODE });
  assert.equal((await s.post(push())).error, 'not-set-up');
});

test('a push adds its Log rows once, even when it is sent twice', async () => {
  const s = ready();
  const body = push({ log: [logRow(1), logRow(2), logRow(3)] });
  assert.deepEqual(await s.post(body), { ok: true, lastSeq: 3 });
  assert.deepEqual(await s.post(body), { ok: true, lastSeq: 3 });
  assert.deepEqual(s.ss.rowsOf('Log').map((r) => r[0]), [1, 2, 3]);
  assert.equal(s.ss.rowsOf('Log')[0][1], '2026-10-05'); // still text, not a date
  assert.equal(s.props.get('DEVICE'), PHONE); // the first push claims the Sheet
  assert.deepEqual(await s.post(push({ from: 3, log: [logRow(3), logRow(4)] })), { ok: true, lastSeq: 4 });
  assert.deepEqual(s.ss.rowsOf('Log').map((r) => r[0]), [1, 2, 3, 4]);
});

test('Progress, Daily and Meta rows are replaced by key, and removed words disappear', async () => {
  const s = ready();
  await s.post(push({ progress: [progressRow('w0026', 1, '2026-10-06'), progressRow('w0027', 1, '2026-10-06')],
    daily: [['2026-10-05', 'yes', 0, '', 12, 20.5, '{"day":"2026-10-05"}']], meta: [['settings', '{"newPerDay":12}']] }));
  await s.post(push({ progress: [progressRow('w0026', 2, '2026-10-08')], removed: ['w0027'],
    daily: [['2026-10-05', 'yes', 3, 1, 12, 25, '{"day":"2026-10-05"}']], meta: [['settings', '{"newPerDay":8}']] }));
  const rows = s.ss.rowsOf('Progress');
  assert.deepEqual(rows.map((r) => [r[0], r[6], r[7]]), [['w0026', 2, '2026-10-08']]);
  assert.deepEqual(s.ss.rowsOf('Daily').map((r) => [r[0], r[2]]), [['2026-10-05', 3]]);
  assert.deepEqual(s.ss.rowsOf('Meta'), [['settings', '{"newPerDay":8}']]);
});

test('a text that looks like a formula stays text', async () => {
  const s = ready();
  const row = progressRow('w0026', 1, '2026-10-06');
  row[3] = '=to be (stand-in meaning)';
  await s.post(push({ progress: [row] }));
  assert.equal(s.ss.rowsOf('Progress')[0][3], '=to be (stand-in meaning)');
});

test('the summary fills the Dashboard', async () => {
  const s = ready();
  await s.post(push({ summary: { updated: '2026-10-05T19:30:00.000Z', today: '2026-10-05', streak: 1, bestStreak: 1, checkIns: 1, learned: 12, mastered: 0, words: 61 } }));
  const dash = s.ss.getSheetByName('Dashboard');
  assert.deepEqual(dash.getRange(3, 1, 8, 2).getValues(), [
    ['Last backup (UTC)', '2026-10-05T19:30:00.000Z'], ['Study day of the last backup', '2026-10-05'],
    ['Current streak (days)', 1], ['Best streak (days)', 1], ['Check-ins', 1], ['Words learned', 12],
    ['Words mastered', 0], ['Words in the course', 61]]);
});

test('another phone is refused until it claims the Sheet', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1)] }));
  assert.equal((await s.post(push({ device: OTHER, from: 1, log: [logRow(2)] }))).error, 'other-device');
  assert.deepEqual(await s.post({ action: 'ping', code: CODE, device: OTHER }), { ok: true, lastSeq: 1, device: 'other' });
  assert.deepEqual(await s.post({ action: 'claim', code: CODE, device: OTHER }), { ok: true, lastSeq: 1 });
  assert.equal((await s.post(push({ from: 1, log: [logRow(2)] }))).error, 'other-device');
});

test('a phone that expects more than the Sheet has is told how far the Sheet got', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1)] }));
  assert.deepEqual(await s.post(push({ from: 5, log: [logRow(6)] })),
    { ok: false, error: 'behind', lastSeq: 1, message: 'The Sheet has fewer answers than the phone expected.' });
});

test('a reset empties the tabs and starts again from this phone', async () => {
  const s = ready();
  await s.post(push({ log: [logRow(1), logRow(2)], progress: [progressRow('w0026', 1, '2026-10-06')] }));
  assert.deepEqual(await s.post(push({ device: OTHER, reset: true, log: [logRow(1)] })), { ok: true, lastSeq: 1 });
  assert.deepEqual(s.ss.rowsOf('Log').map((r) => r[0]), [1]);
  assert.deepEqual(s.ss.rowsOf('Progress'), []);
  assert.equal(s.props.get('DEVICE'), OTHER);
});

test('restore sends everything back, the Log in pages', async () => {
  const s = ready();
  s.gs.RESTORE_PAGE = 3;
  await s.post(push({ log: [1, 2, 3, 4, 5, 6, 7].map((n) => logRow(n)), progress: [progressRow('w0026', 1, '2026-10-06')],
    daily: [['2026-10-05', 'yes', 0, '', 12, 20, '{"day":"2026-10-05","reviews":0}'], ['2026-10-04', 'no', 1, 0, 0, 1, '']],
    meta: [['badges', '{"learned-50":"2026-10-05"}']] }));
  const first = await s.post({ action: 'restore', code: CODE, page: 0 });
  assert.equal(first.pages, 3);
  assert.deepEqual(first.counts, { progress: 1, events: 7, days: 1 });
  assert.deepEqual(first.events.map((e) => e.seq), [1, 2, 3]);
  assert.deepEqual(first.days, [{ day: '2026-10-05', reviews: 0 }]);
  assert.deepEqual(first.meta, { badges: { 'learned-50': '2026-10-05' } });
  assert.deepEqual((await s.post({ action: 'restore', code: CODE, page: 2 })).events.map((e) => e.seq), [7]);
  assert.equal((await s.post({ action: 'restore', code: 'wrong', page: 0 })).error, 'code');
});
```

- [ ] **Step 3: Run it and see it fail**

Run: `node --test tests/js/apps-script.test.mjs`
Expected: FAIL with `Error: ENOENT: no such file or directory, open '...tools\apps_script\Code.gs'` in each test, and `ℹ tests 14`, `ℹ fail 14`.

- [ ] **Step 4: Write `tools/apps_script/Code.gs`**

Apps Script runs modern JavaScript, but this file avoids `?.` and `??` to stay safe on every runtime setting. `SECRET_CODE` stays the placeholder in the repository. The user replaces it only in their own copy.

```js
/**
 * HSK Flashcards backup: the Google Apps Script that receives the learner's progress.
 *
 * Paste this whole file into the script editor of your Google Sheet (Extensions, then
 * Apps Script), replace PASTE-THE-CODE-FROM-THE-APP below with the secret code that the
 * app shows in Settings, save, run setup once, and deploy it as a web app.
 * tools/apps_script/SETUP.md in the project gives every click.
 *
 * The phone sends JSON requests with an "action":
 *   ping     checks the secret code and says how many answers the Sheet holds
 *   push     adds new Log rows (only seq numbers above the last one saved, so a request
 *            sent twice does no harm) and updates Progress, Daily, Meta and the Dashboard
 *   restore  sends everything back, the Log in pages of 2,000 rows
 *   claim    makes this phone the one that backs up to this Sheet
 * Only one phone or browser backs up to the Sheet at a time. A push from another one is
 * refused with "other-device" until that one restores from the Sheet or replaces it.
 */
var SECRET_CODE = 'PASTE-THE-CODE-FROM-THE-APP';

var PLACEHOLDER = 'PASTE-THE-CODE-FROM-THE-APP';
var RESTORE_PAGE = 2000;

// The tabs, their headings and the number format of each column ('@' is plain text, so
// Sheets never turns '2026-10-05' into a date or '=...' into a formula). docs/js/sheet.js
// repeats the headings, and tests/js/apps-script.test.mjs checks that they agree.
var TABS = {
  Progress: {
    headers: ['Word ID', 'Characters', 'Pinyin', 'English', 'Theme', 'HSK level', 'Step', 'Next review',
      'Status', 'Reviews', 'Wrong answers', 'Learned on', 'Data'],
    formats: ['@', '@', '@', '@', '@', '0', '0', '@', '@', '0', '0', '@', '@'],
  },
  Log: {
    headers: ['Seq', 'Study day', 'Time (UTC)', 'What', 'Word ID', 'Characters', 'Quiz', 'Answer', 'Result', 'Data'],
    formats: ['0', '@', '@', '@', '@', '@', '@', '@', '@', '@'],
  },
  Daily: {
    headers: ['Study day', 'Checked in', 'Reviews', 'Right first time', 'New words learned', 'Minutes', 'Data'],
    formats: ['@', '@', '0', '0%', '0', '0.0', '@'],
  },
  Meta: {
    headers: ['Name', 'Data'],
    formats: ['@', '@'],
  },
};

// Dashboard cells that each push fills from the phone's summary.
var SUMMARY_ROWS = [
  ['Last backup (UTC)', 'updated'],
  ['Study day of the last backup', 'today'],
  ['Current streak (days)', 'streak'],
  ['Best streak (days)', 'bestStreak'],
  ['Check-ins', 'checkIns'],
  ['Words learned', 'learned'],
  ['Words mastered', 'mastered'],
  ['Words in the course', 'words'],
];

// ---- Run once from the editor ----

function setup() {
  if (SECRET_CODE === PLACEHOLDER || String(SECRET_CODE).length < 20) {
    throw new Error('Replace PASTE-THE-CODE-FROM-THE-APP at the top with the secret code from the app, save, and run setup again.');
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', ss.getId());
  if (!props.getProperty('LAST_SEQ')) props.setProperty('LAST_SEQ', '0');
  Object.keys(TABS).forEach(function (name) { tab_(ss, name); });
  dashboard_(ss);
  Logger.log('Setup done. The tabs Dashboard, Progress, Log, Daily and Meta are ready. Now deploy the web app.');
}

// ---- The web app ----

function doGet() {
  return json_({ ok: true, app: 'hsk-flashcards-backup', message: 'The HSK Flashcards backup is running.' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'bad-request', message: 'The request was not JSON.' });
  }
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(30000);
  } catch (err) {
    return json_({ ok: false, error: 'busy', message: 'Another backup is running.' });
  }
  try {
    return json_(handle_(body));
  } catch (err) {
    return json_({ ok: false, error: 'server', message: String(err && err.message ? err.message : err) });
  } finally {
    lock.releaseLock();
  }
}

function handle_(body) {
  var props = PropertiesService.getScriptProperties();
  if (SECRET_CODE === PLACEHOLDER || !props.getProperty('SHEET_ID')) {
    return { ok: false, error: 'not-set-up', message: 'Run setup in the script editor first.' };
  }
  if (!body || body.code !== SECRET_CODE) return { ok: false, error: 'code', message: 'Wrong secret code.' };
  var ss = SpreadsheetApp.openById(props.getProperty('SHEET_ID'));
  var lastSeq = Number(props.getProperty('LAST_SEQ') || 0);
  var owner = props.getProperty('DEVICE') || '';
  if (body.action === 'ping') {
    return { ok: true, lastSeq: lastSeq, device: owner === '' ? 'none' : (owner === body.device ? 'this' : 'other') };
  }
  if (body.action === 'restore') return restore_(ss, lastSeq, Number(body.page || 0));
  if (typeof body.device !== 'string' || body.device.length < 8) {
    return { ok: false, error: 'bad-request', message: 'The request has no device ID.' };
  }
  if (body.action === 'claim') {
    props.setProperty('DEVICE', body.device);
    return { ok: true, lastSeq: lastSeq };
  }
  if (body.action !== 'push') return { ok: false, error: 'bad-request', message: 'Unknown action.' };
  if (body.reset === true) {
    ['Progress', 'Log', 'Daily', 'Meta'].forEach(function (name) { clearRows_(tab_(ss, name)); });
    lastSeq = 0;
    owner = body.device;
    props.setProperty('DEVICE', owner);
    props.setProperty('LAST_SEQ', '0');
  }
  if (owner !== '' && owner !== body.device) {
    return { ok: false, error: 'other-device', message: 'Another phone or browser backs up to this Sheet.' };
  }
  if (lastSeq < Number(body.from || 0)) {
    return { ok: false, error: 'behind', lastSeq: lastSeq, message: 'The Sheet has fewer answers than the phone expected.' };
  }
  var log = (body.log || []).filter(function (row) { return Number(row[0]) > lastSeq; });
  for (var i = 1; i < log.length; i += 1) {
    if (!(Number(log[i][0]) > Number(log[i - 1][0]))) return { ok: false, error: 'bad-request', message: 'Log rows are out of order.' };
  }
  if (log.length) {
    var logTab = tab_(ss, 'Log');
    write_(logTab, logTab.getLastRow() + 1, log, 'Log');
    lastSeq = Number(log[log.length - 1][0]);
  }
  upsert_(tab_(ss, 'Progress'), 'Progress', body.progress || [], body.removed || []);
  upsert_(tab_(ss, 'Daily'), 'Daily', body.daily || [], []);
  upsert_(tab_(ss, 'Meta'), 'Meta', body.meta || [], []);
  if (body.summary) summary_(ss, body.summary);
  props.setProperty('LAST_SEQ', String(lastSeq));
  if (owner === '') props.setProperty('DEVICE', body.device);
  return { ok: true, lastSeq: lastSeq };
}

// ---- Reading everything back ----

function dataColumn_(sheet, name, firstRow, count) {
  if (count <= 0) return [];
  var col = TABS[name].headers.length;
  return sheet.getRange(firstRow, col, count, 1).getValues()
    .map(function (r) { return r[0]; })
    .filter(function (v) { return v !== '' && v !== null; })
    .map(function (v) { return JSON.parse(v); });
}

function restore_(ss, lastSeq, page) {
  var logTab = tab_(ss, 'Log');
  var logCount = Math.max(0, logTab.getLastRow() - 1);
  var pages = Math.max(1, Math.ceil(logCount / RESTORE_PAGE));
  var events = dataColumn_(logTab, 'Log', 2 + page * RESTORE_PAGE, Math.min(RESTORE_PAGE, logCount - page * RESTORE_PAGE));
  if (page > 0) return { ok: true, page: page, events: events };
  var progressTab = tab_(ss, 'Progress');
  var dailyTab = tab_(ss, 'Daily');
  var metaTab = tab_(ss, 'Meta');
  var progress = dataColumn_(progressTab, 'Progress', 2, progressTab.getLastRow() - 1);
  var days = dataColumn_(dailyTab, 'Daily', 2, dailyTab.getLastRow() - 1);
  var meta = {};
  if (metaTab.getLastRow() > 1) {
    metaTab.getRange(2, 1, metaTab.getLastRow() - 1, 2).getValues().forEach(function (r) {
      if (r[0] !== '') meta[r[0]] = JSON.parse(r[1]);
    });
  }
  days.sort(function (a, b) { return a.day < b.day ? -1 : (a.day > b.day ? 1 : 0); });
  return {
    ok: true, page: 0, pages: pages, lastSeq: lastSeq, events: events, progress: progress, days: days, meta: meta,
    counts: { progress: progress.length, events: logCount, days: days.length },
  };
}

// ---- Writing ----

// Writes rows from `row` down, after giving each column its number format.
function write_(sheet, row, rows, name) {
  if (!rows.length) return;
  var width = TABS[name].headers.length;
  rows.forEach(function (r) {
    if (r.length !== width) throw new Error(name + ' rows need ' + width + ' cells, got ' + r.length);
  });
  var need = row + rows.length - 1;
  if (need > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), need - sheet.getMaxRows());
  var range = sheet.getRange(row, 1, rows.length, width);
  range.setNumberFormats(rows.map(function () { return TABS[name].formats; }));
  range.setValues(rows);
}

// Replaces rows whose first cell matches, adds the others at the end, and removes the keys in
// `removed`. The whole tab is read once and written once, which is fast in Apps Script.
function upsert_(sheet, name, rows, removed) {
  if (!rows.length && !removed.length) return;
  var width = TABS[name].headers.length;
  var count = Math.max(0, sheet.getLastRow() - 1);
  var current = count ? sheet.getRange(2, 1, count, width).getValues() : [];
  var at = {};
  current.forEach(function (r, i) { at[String(r[0])] = i; });
  rows.forEach(function (r) {
    var key = String(r[0]);
    if (Object.prototype.hasOwnProperty.call(at, key)) current[at[key]] = r;
    else { at[key] = current.length; current.push(r); }
  });
  var gone = {};
  removed.forEach(function (k) { gone[String(k)] = true; });
  var kept = current.filter(function (r) { return !gone[String(r[0])]; });
  write_(sheet, 2, kept, name);
  if (kept.length < count) sheet.getRange(2 + kept.length, 1, count - kept.length, width).clearContent();
}

function clearRows_(sheet) {
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
}

function summary_(ss, summary) {
  var sheet = ss.getSheetByName('Dashboard') || dashboard_(ss);
  var values = SUMMARY_ROWS.map(function (r) { return [summary[r[1]] === undefined ? '' : summary[r[1]]]; });
  var range = sheet.getRange(3, 2, values.length, 1);
  range.setNumberFormats(values.map(function () { return ['@']; }));
  range.setValues(values);
}

// ---- Tabs and the Dashboard ----

function tab_(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  var headers = TABS[name].headers;
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  return sheet;
}

function dashboard_(ss) {
  var sheet = ss.getSheetByName('Dashboard');
  if (!sheet) sheet = ss.insertSheet('Dashboard', 0);
  sheet.getCharts().forEach(function (c) { sheet.removeChart(c); });
  sheet.getRange(1, 1).setValue('HSK Flashcards progress');
  sheet.getRange(3, 1, SUMMARY_ROWS.length, 1).setValues(SUMMARY_ROWS.map(function (r) { return [r[0]]; }));
  sheet.getRange(12, 1).setValue('Last 30 days');
  sheet.getRange(13, 1, 1, 4).setValues([['Study day', 'Reviews', 'New words learned', 'Minutes']]);
  var formulas = [];
  for (var i = 0; i < 30; i += 1) {
    var r = 14 + i;
    formulas.push([
      '=TEXT(TODAY()-' + (29 - i) + ',"yyyy-mm-dd")',
      '=IFERROR(VLOOKUP($A' + r + ',Daily!$A:$G,3,FALSE),0)',
      '=IFERROR(VLOOKUP($A' + r + ',Daily!$A:$G,5,FALSE),0)',
      '=IFERROR(VLOOKUP($A' + r + ',Daily!$A:$G,6,FALSE),0)',
    ]);
  }
  sheet.getRange(14, 1, 30, 4).setFormulas(formulas);
  var chart = sheet.newChart()
    .setChartType(Charts.ChartType.COLUMN)
    .addRange(sheet.getRange(13, 1, 31, 3))
    .setNumHeaders(1)
    .setPosition(3, 6, 0, 0)
    .setOption('title', 'Reviews and new words, last 30 days')
    .build();
  sheet.insertChart(chart);
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 5: Run it and see it pass**

Run: `node --test tests/js/apps-script.test.mjs`
Expected: `ℹ tests 14`, `ℹ pass 14`, `ℹ fail 0`.

- [ ] **Step 6: Commit**

```bash
git add tools/apps_script/Code.gs tests/js/fake-apps-script.mjs tests/js/apps-script.test.mjs && git commit -F - <<'EOF'
feat(sheet): Apps Script for the Google Sheet backup, tested against a stand-in Sheet

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 2: The phone's half of the backup (`docs/js/sheet.js`)

Worked example with the fixture. After a first study day on 5 October the phone's store holds 26 events (12 group checks, 12 final checks, the check-in and the badges). `backUp` sends them in one request with 12 Progress rows, one Daily row `['2026-10-05', 'yes', 0, '', 12, ...]`, the badges in Meta and the summary (streak 1). The script answers `lastSeq: 26`, and the cursor becomes 26. A second backup finds nothing above 26 and sends nothing. After day 2, only the new events go, starting `from: 26`.

Restore asks for page 0 (Progress, Daily, Meta and the first 2,000 Log rows), then the other Log pages, checks the counts, calls Plan 2's `store.restore()`, and claims the Sheet. The test restores into an empty `MemoryStore` and compares its `dump()` with the first phone's. The two are identical.

**Files:**
- Create: `docs/js/sheet.js`
- Modify: `docs/sw.js` (add `'js/sheet.js'` to `APP_FILES`)
- Test: `tests/js/sheet.test.mjs`

- [ ] **Step 1: Write the failing test `tests/js/sheet.test.mjs`**

```js
// Tests of docs/js/sheet.js, the phone's half of the Google Sheet backup. The Sheet's half is
// the real tools/apps_script/Code.gs, run through fake-apps-script.mjs, so these tests send
// real study days from a MemoryStore to the script and restore them into a fresh store.
process.env.TZ = 'UTC';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HEADERS, backUp, checkCode, checkWebAppUrl, dailyRow, isDue, loadState, logRow, makeCode, makeDeviceId, minutesOf, postJson,
  progressRow, restoreFromSheet, saveState, statusText, STATE_KEY, withSettings,
} from '../../docs/js/sheet.js';
import { MemoryStore } from '../../docs/js/store.js';
import { Study } from '../../docs/js/study.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadAppsScript } from './fake-apps-script.mjs';
import { loadFixture, word } from './helpers.mjs';

const data = loadFixture();
const CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';
const URL_OK = 'https://script.google.com/macros/s/AKfycbx1234567890abcdefghijklmnop/exec';

// Plays one study day with Study (Plan 2): every answer right, except `wrongFirst` wrong
// answers on the first reviews. Answers are 10 seconds apart from 19:00 UTC.
async function playDay(store, day, { wrongFirst = 0 } = {}) {
  let t = Date.parse(`${day}T19:00:00Z`);
  const study = await Study.start({ store, data, now: new Date(t) });
  let wrong = wrongFirst;
  while (!study.finished) {
    const card = study.card;
    if (card.type === 'learn') { study.next(); continue; }
    t += 10000;
    let grade = card.quiz === 'recall' ? 'know' : 'right';
    if (card.type === 'review' && wrong > 0) { grade = card.quiz === 'recall' ? 'dontknow' : 'wrong'; wrong -= 1; }
    await study.answer(grade, new Date(t));
  }
  return study.finish(new Date(t));
}

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); }, m };
}

const phone = (device = 'a1b2c3d4e5f60718') => ({ url: URL_OK, code: CODE, device, cursor: 0, lastOk: null, problem: null, detail: '' });

function sheetWithScript() {
  const s = loadAppsScript({ code: CODE });
  s.gs.setup();
  return s;
}

const run = (store, state, post, extra = {}) => backUp({ store, words: data.words, themes: data.themes, state, post, ...extra });

test('the script and the app use the same column headings', () => {
  const { gs } = loadAppsScript();
  for (const [name, headers] of Object.entries(HEADERS)) {
    assert.deepEqual([...gs.TABS[name].headers], headers, name);
    assert.equal(gs.TABS[name].formats.length, headers.length, `${name} formats`);
  }
});

test('a secret code is 24 easy-to-read letters and digits in groups of 4', () => {
  const code = makeCode((n) => Uint8Array.from({ length: n }, (_, i) => i * 7));
  assert.equal(code, 'ahry-7env-4bjs-z8fp-w5ck-t29g');
  assert.match(makeCode(), /^[a-hjkmnp-z2-9]{4}(-[a-hjkmnp-z2-9]{4}){5}$/);
  assert.notEqual(makeCode(), makeCode());
  assert.match(makeDeviceId(), /^[0-9a-f]{16}$/);
});

test('only a web app address is accepted', () => {
  assert.equal(checkWebAppUrl(` ${URL_OK} `), URL_OK);
  assert.equal(checkWebAppUrl('https://script.google.com/a/macros/example.edu/s/AKfycbx1234567890abcdefghij/exec'),
    'https://script.google.com/a/macros/example.edu/s/AKfycbx1234567890abcdefghij/exec');
  assert.equal(checkWebAppUrl('http://localhost:8125/exec'), 'http://localhost:8125/exec');
  assert.throws(() => checkWebAppUrl('https://docs.google.com/spreadsheets/d/abc/edit'), /not a web app address/);
  assert.throws(() => checkWebAppUrl('https://script.google.com/macros/s/AKfycbx1234567890abcdefghij/dev'), /ends with \/exec/);
});

test('a code typed on a new phone is checked', () => {
  assert.equal(checkCode(' k7mq-2xrt-9pwd-hc4n-fz6b-y3ja '), 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja');
  assert.throws(() => checkCode('k7mq 2xrt'), /8 to 64 letters, digits and dashes/);
  assert.throws(() => checkCode('short'), /8 to 64/);
});

test('the state lives in one localStorage entry, and a new address starts the Sheet again', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadState(storage), { url: '', code: '', device: '', cursor: 0, lastOk: null, problem: null, detail: '' });
  storage.setItem(STATE_KEY, 'not json');
  assert.equal(loadState(storage).cursor, 0);
  const s = { ...phone(), cursor: 40, lastOk: '2026-10-05T19:00:00.000Z' };
  saveState(storage, s);
  assert.deepEqual(loadState(storage), s);
  assert.equal(withSettings(s, { url: URL_OK, code: 'new-code' }).cursor, 40);
  assert.equal(withSettings(s, { url: 'http://localhost:8125/exec', code: CODE }).cursor, 0);
});

test('opening the app backs up after 12 hours, or when the last try failed', () => {
  const s = { ...phone(), lastOk: '2026-10-05T19:00:00.000Z' };
  assert.equal(isDue(s, new Date('2026-10-06T06:59:00Z')), false);
  assert.equal(isDue(s, new Date('2026-10-06T07:00:00Z')), true);
  assert.equal(isDue({ ...s, problem: 'offline' }, new Date('2026-10-05T19:01:00Z')), true);
  assert.equal(isDue({ ...s, url: '' }, new Date('2026-10-09T00:00:00Z')), false);
});

test('rows are readable, with the saved record as JSON in the last column', () => {
  const apple = word(data, '苹果');
  const p = learnedProgress(apple.id, '2026-10-05');
  const row = progressRow(p, apple, 'Food & Drink');
  assert.deepEqual(row.slice(0, 12), [apple.id, '苹果', 'píngguǒ', apple.enShort, 'Food & Drink', 1, 1, '2026-10-06', 'Learned', 0, 0, '2026-10-05']);
  assert.deepEqual(JSON.parse(row[12]), p);
  assert.deepEqual(logRow({ seq: 9, day: '2026-10-06', kind: 'undo', target: 8, id: apple.id, ts: 'T' }, apple).slice(0, 9),
    [9, '2026-10-06', 'T', 'undo', apple.id, '苹果', '', '', 'took back answer 8']);
});

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

test('a first day goes to the Sheet, and a second backup sends nothing new', async () => {
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const events = await store.eventsSince(0);
  const sheet = sheetWithScript();
  const storage = memoryStorage();
  const { state, sent } = await run(store, phone(), sheet.post, { save: (s) => saveState(storage, s), now: new Date('2026-10-05T19:30:00Z') });
  assert.equal(sent, events.length);
  assert.equal(state.cursor, events.at(-1).seq);
  assert.equal(state.problem, null);
  assert.deepEqual(loadState(storage), state);
  assert.equal(sheet.ss.rowsOf('Log').length, events.length);
  assert.equal(sheet.ss.rowsOf('Progress').length, 12);
  assert.deepEqual(sheet.ss.rowsOf('Daily').map((r) => r.slice(0, 5)), [['2026-10-05', 'yes', 0, '', 12]]);
  assert.deepEqual(sheet.ss.rowsOf('Meta').map((r) => r[0]), ['badges']);
  assert.equal(sheet.ss.getSheetByName('Dashboard').getRange(5, 2).getValues()[0][0], 1); // streak
  const again = await run(store, state, sheet.post);
  assert.equal(again.sent, 0);
  assert.equal(sheet.ss.rowsOf('Log').length, events.length);
});

test('the next day sends only its own events, in pages', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  let { state } = await run(store, phone(), sheet.post);
  const before = state.cursor;
  await playDay(store, '2026-10-06', { wrongFirst: 1 });
  const bodies = [];
  const post = (body) => { bodies.push(body); return sheet.post(body); };
  ({ state } = await run(store, state, post, { pageSize: 10 }));
  const newEvents = await store.eventsSince(before);
  assert.equal(bodies.length, Math.ceil(newEvents.length / 10));
  assert.equal(bodies[0].from, before);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), (await store.eventsSince(0)).map((e) => e.seq));
  const day2 = sheet.ss.rowsOf('Daily').find((r) => r[0] === '2026-10-06');
  assert.equal(day2[1], 'yes');
  assert.equal(day2[2], 12); // 12 reviews
});

test('offline, changes wait, and they arrive after reconnecting', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const offline = async () => { throw Object.assign(new Error('Could not reach the Sheet (Failed to fetch).'), { problem: 'offline' }); };
  let { state, sent } = await run(store, phone(), offline);
  assert.equal(sent, 0);
  assert.equal(state.problem, 'offline');
  assert.equal(state.cursor, 0);
  assert.match(statusText(state, 61), /61 changes waiting to be sent\. Could not reach the Sheet/);
  ({ state } = await run(store, state, sheet.post));
  assert.equal(state.problem, null);
  assert.equal(sheet.ss.rowsOf('Log').length, (await store.eventsSince(0)).length);
});

test('a wrong secret code is refused, and Settings says so', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const { state } = await run(store, { ...phone(), code: 'wrong-code' }, sheet.post);
  assert.equal(state.problem, 'code');
  assert.match(statusText(state, 61), /refused the secret code/);
  assert.deepEqual(sheet.ss.rowsOf('Log'), []);
});

test('restore into a fresh phone gives the same progress, and the new phone takes over', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  sheet.gs.RESTORE_PAGE = 25; // several pages
  await playDay(store, '2026-10-05');
  await playDay(store, '2026-10-06', { wrongFirst: 2 });
  let { state: oldPhone } = await run(store, phone(), sheet.post);
  const fresh = new MemoryStore();
  const { state: newPhone, counts } = await restoreFromSheet({ store: fresh, state: phone('0011223344556677'), post: sheet.post });
  assert.deepEqual(await fresh.dump(), await store.dump());
  assert.equal(counts.events, (await store.eventsSince(0)).length);
  assert.equal(newPhone.cursor, oldPhone.cursor);
  // The next answer on the new phone gets the next seq, so its backup continues the Sheet's log.
  await playDay(fresh, '2026-10-07');
  const { state: after } = await run(fresh, newPhone, sheet.post);
  assert.equal(after.problem, null);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), (await fresh.eventsSince(0)).map((e) => e.seq));
  // The old phone is now refused.
  await playDay(store, '2026-10-07');
  ({ state: oldPhone } = await run(store, oldPhone, sheet.post));
  assert.equal(oldPhone.problem, 'other-device');
});

test('restore refuses an empty Sheet and a wrong code, and leaves the phone as it was', async () => {
  const sheet = sheetWithScript();
  const store = new MemoryStore();
  await playDay(store, '2026-10-05');
  const dump = await store.dump();
  await assert.rejects(restoreFromSheet({ store, state: phone(), post: sheet.post }), /no saved progress yet/);
  await assert.rejects(restoreFromSheet({ store, state: { ...phone(), code: 'nope' }, post: sheet.post }), /refused the secret code/);
  assert.deepEqual(await store.dump(), dump);
});

test('after a backup file replaces the phone\'s log, the backup stops until the user chooses', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const oldDump = await store.dump();
  await playDay(store, '2026-10-06');
  let { state } = await run(store, phone(), sheet.post);
  await store.restore(oldDump); // "Restore from a backup file" of Plan 4
  ({ state } = await run(store, state, sheet.post));
  assert.equal(state.problem, 'mismatch');
  ({ state } = await run(store, state, sheet.post, { reset: true })); // "Replace the Sheet with this phone's progress"
  assert.equal(state.problem, null);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), oldDump.events.map((e) => e.seq));
});

test('the Sheet is never replaced by a phone with no progress', async () => {
  const sheet = sheetWithScript();
  const { state } = await run(new MemoryStore(), phone(), sheet.post, { reset: true });
  assert.equal(state.problem, 'empty');
});

test('when the Sheet lost rows, the phone sends again from what the Sheet has', async () => {
  const store = new MemoryStore();
  const sheet = sheetWithScript();
  await playDay(store, '2026-10-05');
  const cursor = (await store.eventsSince(0)).at(-1).seq;
  await playDay(store, '2026-10-06');
  // The phone believes the whole first day was sent, but the Sheet is empty.
  const { state } = await run(store, { ...phone(), cursor }, sheet.post);
  assert.equal(state.problem, null);
  assert.deepEqual(sheet.ss.rowsOf('Log').map((r) => r[0]), (await store.eventsSince(0)).map((e) => e.seq));
});

test('requests are plain text, and keepalive is used only for small ones', async () => {
  const calls = [];
  const fetchFn = async (url, init) => { calls.push([url, init]); return { ok: true, json: async () => ({ ok: true }) }; };
  assert.deepEqual(await postJson(URL_OK, { a: 1 }, { fetchFn, keepalive: true }), { ok: true });
  assert.equal(calls[0][1].headers['Content-Type'], 'text/plain;charset=utf-8');
  assert.equal(calls[0][1].keepalive, true);
  await postJson(URL_OK, { a: '苹'.repeat(30000) }, { fetchFn, keepalive: true }); // 90,000 bytes
  assert.equal(calls[1][1].keepalive, false);
  await assert.rejects(postJson(URL_OK, {}, { fetchFn: async () => { throw new TypeError('Failed to fetch'); } }),
    (err) => err.problem === 'offline');
  await assert.rejects(postJson(URL_OK, {}, { fetchFn: async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } }) }),
    (err) => err.problem === 'answer');
});

test('the status line says what happened in plain words', () => {
  assert.match(statusText({ url: '' }, 0), /^Not set up yet/);
  assert.equal(statusText({ ...phone(), lastOk: '2026-10-05T19:30:00.000Z' }, 0), 'Last backup: 2026-10-05 19:30. Nothing waiting to be sent.');
  assert.equal(statusText({ ...phone() }, 1), 'No backup yet. 1 change waiting to be sent.');
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/sheet.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\sheet.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/sheet.js`**

```js
// The Google Sheet backup, the parts that need no page, so Node can test them.
// docs/js/sync.js joins them to the app, and tools/apps_script/Code.gs is the other end.
//
// How a backup works, with the numbers of a first study day:
//   The phone keeps a cursor, the seq of the last event the Sheet has confirmed (0 at first).
//   A backup sends every event with a larger seq (say seq 1 to 61) in pages of at most 500.
//   Each page also carries the Progress rows of the words its events touched, the Daily rows
//   of their study days, the settings and badges, and a short summary for the Dashboard.
//   The script adds only Log rows with a seq above the last one it has, so a page sent twice
//   does no harm. It answers { ok: true, lastSeq: 61 }, and the phone moves its cursor to 61.
// The web app address and the secret code are kept only in this browser (localStorage).
// They never go into the backup file, the Sheet or the repository.
import { isLearned, isMastered } from './srs.js';
import { liveEvents } from './stats.js';
import { bestStreak, currentStreak } from './checkin.js';
import { studyDay } from './dates.js';

export const STATE_KEY = 'hsk-sheet-backup';
export const PAGE_SIZE = 500; // events per request
export const KEEPALIVE_PAGE_SIZE = 40; // events per request when the app is being closed
export const KEEPALIVE_LIMIT = 60000; // bytes; browsers refuse keepalive bodies over 64 KB
export const RESYNC_HOURS = 12; // the design's "when it opens after 12 or more hours"
export const META_KEYS = Object.freeze(['settings', 'badges']);

// Column headings of the Sheet's tabs. Code.gs repeats them, and a test checks they agree.
export const HEADERS = Object.freeze({
  Progress: ['Word ID', 'Characters', 'Pinyin', 'English', 'Theme', 'HSK level', 'Step', 'Next review',
    'Status', 'Reviews', 'Wrong answers', 'Learned on', 'Data'],
  Log: ['Seq', 'Study day', 'Time (UTC)', 'What', 'Word ID', 'Characters', 'Quiz', 'Answer', 'Result', 'Data'],
  Daily: ['Study day', 'Checked in', 'Reviews', 'Right first time', 'New words learned', 'Minutes', 'Data'],
  Meta: ['Name', 'Data'],
});

const KIND_TEXT = {
  review: 'review', reask: 'asked again', learn: 'learning card', check: 'group check',
  final: 'final check', undo: 'undo', checkin: 'check-in', badges: 'badges', settings: 'settings',
};
const GRADE_TEXT = { right: 'right', wrong: 'wrong', know: 'Know it', unsure: 'Unsure', dontknow: "Don't know" };
const QUIZ_TEXT = { listen: 'listen, pick meaning', pinyin: 'meaning, pick pinyin', recall: 'recall' };

// ---- Settings values ----

// A new secret code: 24 letters and digits in groups of 4, such as 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja'.
// The alphabet leaves out 0, 1, i, l and o, which are easy to mix up when typed.
const CODE_LETTERS = 'abcdefghjkmnpqrstuvwxyz23456789';
export function makeCode(randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  const bytes = randomBytes(24);
  const chars = [...bytes].map((b) => CODE_LETTERS[b % CODE_LETTERS.length]);
  return [0, 4, 8, 12, 16, 20].map((i) => chars.slice(i, i + 4).join('')).join('-');
}

export function makeDeviceId(randomBytes = (n) => globalThis.crypto.getRandomValues(new Uint8Array(n))) {
  return [...randomBytes(8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Checks the web app address the learner pasted. A Google Apps Script web app address looks
// like https://script.google.com/macros/s/AKfycb.../exec (or .../a/macros/<domain>/s/.../exec
// for a school or work account). http://localhost addresses are allowed for local tests.
export function checkWebAppUrl(text) {
  const url = String(text ?? '').trim();
  if (/^https:\/\/script\.google\.com\/(a\/macros\/[^/\s]+|macros)\/s\/[A-Za-z0-9_-]{20,}\/exec$/.test(url)) return url;
  if (/^http:\/\/(localhost|127\.0\.0\.1):\d+\/[^\s]*$/.test(url)) return url;
  throw new Error('That is not a web app address. It starts with https://script.google.com/macros/s/ and ends with /exec.');
}

// Checks a secret code typed or pasted on a new phone: 8 to 64 letters, digits and dashes.
export function checkCode(text) {
  const code = String(text ?? '').trim();
  if (/^[A-Za-z0-9-]{8,64}$/.test(code)) return code;
  throw new Error('A secret code has 8 to 64 letters, digits and dashes, with no spaces.');
}

// The saved state, from localStorage (or a stand-in with getItem and setItem).
//   url     the web app address          code    the secret code
//   device  a random ID of this browser  cursor  seq of the last event the Sheet confirmed
//   lastOk  time of the last backup      problem null or a word from PROBLEM_TEXT
export function loadState(storage) {
  let saved = {};
  try {
    saved = JSON.parse(storage.getItem(STATE_KEY) ?? '{}') ?? {};
  } catch {
    saved = {};
  }
  return { url: '', code: '', device: '', cursor: 0, lastOk: null, problem: null, detail: '', ...saved };
}

export function saveState(storage, state) {
  storage.setItem(STATE_KEY, JSON.stringify(state));
}

export const isReady = (state) => Boolean(state.url && state.code && state.device);

// Saving a new address or code. A new address is another Sheet, so everything is sent again.
export function withSettings(state, { url, code }) {
  const next = { ...state, url, code };
  if (url !== state.url) Object.assign(next, { cursor: 0, lastOk: null, problem: null, detail: '' });
  if (code !== state.code) Object.assign(next, { problem: null, detail: '' });
  return next;
}

// The 'open' hook backs up when the last backup is 12 or more hours old, or the last try failed.
export function isDue(state, now = new Date()) {
  if (!isReady(state)) return false;
  if (!state.lastOk || state.problem === 'offline') return true;
  return now - new Date(state.lastOk) >= RESYNC_HOURS * 3600 * 1000;
}

// ---- Rows for the Sheet ----

function statusOf(p) {
  if (isMastered(p)) return 'Mastered';
  if (isLearned(p)) return 'Learned';
  return 'Not learned yet';
}

// One readable row per word, with the saved record as JSON in the last column, which Restore reads.
// For 苹果 after its lesson on 5 October:
// ['w0026', '苹果', 'píngguǒ', 'apple', 'Food & Drink', 1, 1, '2026-10-06', 'Learned', 0, 0, '2026-10-05', '{"id":"w0026",...}']
export function progressRow(p, word, themeName = '') {
  return [p.id, word?.hz ?? '', word?.py ?? '', word?.enShort ?? '', themeName, word?.lv ?? '', p.step, p.due ?? '',
    statusOf(p), p.reps ?? 0, p.lapses ?? 0, p.learned ?? '', JSON.stringify(p)];
}

// One row per event. For a right listening review of 苹果:
// [14, '2026-10-06', '2026-10-06T19:02:11.000Z', 'review', 'w0026', '苹果', 'listen, pick meaning', 'right', '', '{...}']
export function logRow(e, word) {
  let result = e.outcome ?? '';
  if (e.kind === 'undo') result = `took back answer ${e.target}`;
  if (e.kind === 'badges') result = (e.badges ?? []).join(', ');
  return [e.seq, e.day, e.ts ?? '', KIND_TEXT[e.kind] ?? e.kind, e.id ?? '', word?.hz ?? '', QUIZ_TEXT[e.quiz] ?? '',
    GRADE_TEXT[e.grade] ?? '', result, JSON.stringify(e)];
}

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

// The numbers the Dashboard shows at the top.
export function summaryOf({ progress, days, words, now = new Date() }) {
  const checked = days.map((d) => d.day);
  const today = studyDay(now);
  return {
    updated: now.toISOString(),
    today,
    streak: currentStreak(checked, today),
    bestStreak: bestStreak(checked),
    checkIns: checked.length,
    learned: progress.filter(isLearned).length,
    mastered: progress.filter(isMastered).length,
    words: words.length,
  };
}

// ---- Talking to the web app ----

// Sends one request. The body is sent as text/plain, which a browser sends without asking the
// server first (a CORS preflight, which Apps Script cannot answer). Google answers from
// script.googleusercontent.com after a redirect, and fetch follows it.
export async function postJson(url, body, { fetchFn = globalThis.fetch, keepalive = false } = {}) {
  const text = JSON.stringify(body);
  const small = new TextEncoder().encode(text).length < KEEPALIVE_LIMIT;
  let res;
  try {
    res = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: text,
      redirect: 'follow',
      keepalive: keepalive && small,
    });
  } catch (err) {
    throw Object.assign(new Error(`Could not reach the Sheet (${err.message}).`), { problem: 'offline' });
  }
  if (!res.ok) throw Object.assign(new Error(`The Sheet's web app answered with error ${res.status}.`), { problem: 'answer' });
  try {
    return await res.json();
  } catch {
    throw Object.assign(new Error('The web app sent an answer this app cannot read.'), { problem: 'answer' });
  }
}

export const PROBLEM_TEXT = {
  offline: 'Could not reach the Sheet. The phone may be offline, or the web app address is wrong or not open to "Anyone". Changes wait and are sent later.',
  answer: 'The web app gave an unexpected answer. Check the web app address.',
  code: 'The Sheet refused the secret code. The code in the script must be the code shown here.',
  'other-device': 'Another phone or browser backs up to this Sheet. Restore from the Sheet here, or replace the Sheet with this phone\'s progress.',
  mismatch: 'The progress on this phone no longer matches the Sheet, for example after restoring a backup file. Restore from the Sheet, or replace the Sheet with this phone\'s progress.',
  empty: 'This phone has no progress yet, so there is nothing to put in the Sheet.',
  'not-set-up': 'The script in the Sheet is not set up. Run setup in the script editor.',
  busy: 'The Sheet was busy. The backup will be tried again later.',
  server: 'The Sheet reported a problem.',
};

function failed(state, problem, detail = '') {
  return { ...state, problem, detail };
}

// Sends everything the Sheet does not have yet. Never throws: the result says what happened.
//   post(body)   sends one request and returns the parsed answer (postJson bound to the address)
//   save(state)  stores the state, called after every confirmed page
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
    // The event at the cursor must still be on the phone. When it is gone, the phone's log was
    // replaced (a backup file was restored), and sending more would mix two histories.
    if (cursor > 0) {
      const around = await store.eventsSince(cursor - 1);
      if (around[0]?.seq !== cursor) {
        current = failed(current, 'mismatch');
        save(current);
        return { state: current, sent };
      }
    }
    let pending = await store.eventsSince(cursor);
    if (reset && pending.length === 0) {
      current = failed(current, 'empty');
      save(current);
      return { state: current, sent };
    }
    if (pending.length === 0) {
      if (current.problem === 'offline' || current.problem === 'busy') current = { ...current, problem: null, detail: '' };
      save(current);
      return { state: current, sent };
    }
    const wordsById = new Map(words.map((w) => [w.id, w]));
    const themeNames = new Map(themes.map((t) => [t.id, t.name]));
    const progressById = new Map((await store.allProgress()).map((p) => [p.id, p]));
    const days = await store.allDays();
    const daysByDay = new Map(days.map((d) => [d.day, d]));
    const meta = [];
    for (const key of META_KEYS) {
      const value = await store.getMeta(key);
      if (value !== undefined) meta.push([key, JSON.stringify(value)]);
    }
    const summary = summaryOf({ progress: [...progressById.values()], days, words, now });
    let dayEvents = await store.eventsFrom(pending.reduce((m, e) => (e.day < m ? e.day : m), pending[0].day));
    let retried = false;
    for (let i = 0; i < pending.length; i += pageSize) {
      const page = pending.slice(i, i + pageSize);
      const ids = [...new Set(page.map((e) => e.id).filter(Boolean))];
      const pageDays = [...new Set(page.map((e) => e.day))];
      const answer = await post({
        action: 'push',
        code: current.code,
        device: current.device,
        from: cursor,
        reset: reset && i === 0,
        log: page.map((e) => logRow(e, wordsById.get(e.id))),
        progress: ids.filter((id) => progressById.has(id)).map((id) => {
          const w = wordsById.get(id);
          return progressRow(progressById.get(id), w, themeNames.get(w?.theme) ?? '');
        }),
        removed: ids.filter((id) => !progressById.has(id)),
        daily: pageDays.map((d) => dailyRow(d, dayEvents, daysByDay.get(d))),
        meta,
        summary,
      });
      if (!answer?.ok && answer?.error === 'behind' && !retried && answer.lastSeq < cursor) {
        // The Sheet has fewer events than the phone thought (for example rows were deleted by
        // hand). Send again from what the Sheet has, once.
        retried = true;
        cursor = answer.lastSeq;
        pending = await store.eventsSince(cursor);
        dayEvents = await store.eventsFrom(pending.reduce((m, e) => (e.day < m ? e.day : m), pending[0].day));
        i = -pageSize;
        continue;
      }
      if (!answer?.ok) {
        current = failed(current, PROBLEM_TEXT[answer?.error] ? answer.error : 'server', answer?.message ?? '');
        save(current);
        return { state: current, sent };
      }
      cursor = page[page.length - 1].seq;
      sent += page.length;
      current = { ...current, cursor, lastOk: now.toISOString(), problem: null, detail: '' };
      save(current);
    }
    return { state: current, sent };
  } catch (err) {
    current = failed(current, err.problem ?? 'offline', err.message);
    save(current);
    return { state: current, sent };
  }
}

// Pulls everything back from the Sheet into this phone (the design's "New phone" restore).
// It replaces all progress on the phone, so the screen asks first. Throws an Error with a
// plain message when something is wrong, and then the phone's progress is left as it was.
export async function restoreFromSheet({ store, state, post, save = () => {}, now = new Date() }) {
  if (!isReady(state)) throw new Error('Enter the web app address first.');
  const ask = async (body) => {
    const answer = await post({ code: state.code, device: state.device, ...body });
    if (!answer?.ok) throw new Error(PROBLEM_TEXT[answer?.error] ?? answer?.message ?? 'The Sheet reported a problem.');
    return answer;
  };
  const first = await ask({ action: 'restore', page: 0 });
  if (!first.lastSeq) throw new Error('The Sheet has no saved progress yet.');
  const events = [...first.events];
  for (let page = 1; page < first.pages; page += 1) events.push(...(await ask({ action: 'restore', page })).events);
  const dump = { progress: first.progress, events, days: first.days, meta: first.meta };
  const counts = { progress: dump.progress.length, events: events.length, days: dump.days.length };
  if (JSON.stringify(counts) !== JSON.stringify(first.counts)) {
    throw new Error(`The Sheet's rows did not all arrive (${JSON.stringify(counts)}). Nothing was changed. Try again.`);
  }
  await store.restore(dump);
  await ask({ action: 'claim', lastSeq: first.lastSeq });
  const next = { ...state, cursor: first.lastSeq, lastOk: now.toISOString(), problem: null, detail: '' };
  save(next);
  return { state: next, counts };
}

// ---- What Settings shows ----

function localTime(iso) {
  const d = new Date(iso);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

// The status line of the Settings section. pending is the number of events not yet sent.
export function statusText(state, pending) {
  if (!state.url) return 'Not set up yet. Paste the web app address from the Sheet owner below.';
  const lines = [];
  lines.push(state.lastOk ? `Last backup: ${localTime(state.lastOk)}.` : 'No backup yet.');
  lines.push(pending ? `${pending} change${pending === 1 ? '' : 's'} waiting to be sent.` : 'Nothing waiting to be sent.');
  if (state.problem) lines.push(PROBLEM_TEXT[state.problem] ?? PROBLEM_TEXT.server);
  if (state.detail && state.problem !== 'offline') lines.push(`(${state.detail})`);
  return lines.join(' ');
}
```

- [ ] **Step 4: Run it and see it pass**

Run: `node --test tests/js/sheet.test.mjs`
Expected: `ℹ tests 19`, `ℹ pass 19`, `ℹ fail 0`.

- [ ] **Step 5: Add the file to the app files of the service worker**

Plan 4's release test now fails, because `docs/js/sheet.js` is a site file that is not saved for offline use. Run `node --test tests/js/release.test.mjs` and see the failure list `'js/sheet.js'`. In `docs/sw.js`, in `APP_FILES`, add the line `'js/sheet.js',` between `'js/session.js',` and `'js/srs.js',`:

```js
  'js/session.js',
  'js/sheet.js',
  'js/srs.js',
```

Run: `node --test tests/js/release.test.mjs`
Expected: no failures (`ℹ fail 0`).

- [ ] **Step 6: Commit**

```bash
git add docs/js/sheet.js docs/sw.js tests/js/sheet.test.mjs && git commit -F - <<'EOF'
feat(sheet): back up only new changes to the Sheet, restore, conflicts and status text

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 3: The plugin and the Settings section (`docs/js/sync.js`)

`install({ on, store, data })` is what Plan 4's `loadPlugins` calls. It registers the four hooks of Plan 4's `hooks.js`:

| Hook (Plan 4) | What the backup does |
|---|---|
| `'sessionEnd'` | start a backup and return at once |
| `'hidden'` | start a backup with small keepalive requests |
| `'open'` | start a backup when the last one is 12 or more hours old, or the last try failed |
| `'settings'` | draw the "Google Sheet backup" section into Plan 4's `pluginArea` |

It also backs up when the browser says the phone is online again. The Settings section shows the status line, the web app address, the secret code (Copy, Share, Make a new code), "Save address and code", "Test connection", "Back up now", "Restore from Google Sheet", and, only after a conflict, "Replace the Sheet with this phone's progress".

**Files:**
- Create: `docs/js/sync.js`
- Modify: `docs/js/plugins.js`, `tests/js/hooks.test.mjs`, `docs/sw.js`, `docs/css/app.css`
- Test: `tests/js/sync.test.mjs`

- [ ] **Step 1: Write the failing test `tests/js/sync.test.mjs`**

```js
// Tests of docs/js/sync.js without a page: the hooks it registers, one backup at a time, and
// the Settings actions, against the real Code.gs through fake-apps-script.mjs.
process.env.TZ = 'UTC';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHooks } from '../../docs/js/hooks.js';
import { PLUGINS } from '../../docs/js/plugins.js';
import { loadState, saveState } from '../../docs/js/sheet.js';
import { install } from '../../docs/js/sync.js';
import { MemoryStore } from '../../docs/js/store.js';
import { learnedProgress } from '../../docs/js/srs.js';
import { loadAppsScript } from './fake-apps-script.mjs';
import { loadFixture } from './helpers.mjs';

const data = loadFixture();
const CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';
const URL_OK = 'https://script.google.com/macros/s/AKfycbx1234567890abcdefghijklmnop/exec';

function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, String(v)); } };
}

// A fetch that hands each request to the script, and counts the requests.
function fetchToSheet(sheet) {
  const bodies = [];
  const fetchFn = async (url, init) => {
    bodies.push({ url, ...JSON.parse(init.body), keepalive: init.keepalive });
    return { ok: true, json: async () => sheet.post(JSON.parse(init.body)) };
  };
  return { fetchFn, bodies };
}

async function setUp() {
  const sheet = loadAppsScript({ code: CODE });
  sheet.gs.setup();
  const store = new MemoryStore();
  await store.commit({ progress: [learnedProgress('w0026', '2026-10-05')], event: { day: '2026-10-05', kind: 'final', id: 'w0026', grade: 'right', outcome: 'learned', ts: '2026-10-05T19:00:00Z' } });
  const storage = memoryStorage();
  const hooks = createHooks();
  const net = fetchToSheet(sheet);
  const sync = install({ on: hooks.on, store, data, storage, fetchFn: net.fetchFn });
  return { sheet, store, storage, hooks, net, sync };
}

test('the Sheet backup is the one plugin', () => {
  assert.deepEqual(PLUGINS, ['./sync.js']);
});

test('the first use makes a device ID and a secret code, once', async () => {
  const { sync, storage } = await setUp();
  const s = sync.state();
  assert.match(s.device, /^[0-9a-f]{16}$/);
  assert.match(s.code, /^[a-z2-9]{4}(-[a-z2-9]{4}){5}$/);
  assert.deepEqual(sync.state(), s);
  assert.deepEqual(loadState(storage), s);
});

test('nothing is sent before the web app address is saved', async () => {
  const { hooks, net } = await setUp();
  await hooks.emit('sessionEnd', {});
  await hooks.emit('open', {});
  await new Promise((r) => { setTimeout(r, 10); });
  assert.equal(net.bodies.length, 0);
});

test('session end and closing the app back up, closing with keepalive', async () => {
  const { sync, hooks, net, sheet, store } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  await hooks.emit('sessionEnd', {});
  await sync.run(); // waits for the backup the hook started
  assert.equal(sheet.ss.rowsOf('Log').length, 1);
  await store.commit({ event: { day: '2026-10-05', kind: 'checkin', ts: '2026-10-05T19:01:00Z' } });
  await hooks.emit('hidden', {});
  await sync.run();
  assert.equal(sheet.ss.rowsOf('Log').length, 2);
  assert.equal(net.bodies.find((b) => b.log?.[0]?.[0] === 2).keepalive, true);
});

test('a hook never waits for the network', async () => {
  const { sync, hooks } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  const hooks2 = createHooks();
  const never = () => new Promise(() => {});
  install({ on: hooks2.on, store: new MemoryStore(), data, storage: memoryStorage(), fetchFn: never });
  const started = Date.now();
  await hooks2.emit('sessionEnd', {});
  await hooks.emit('hidden', {});
  assert.ok(Date.now() - started < 200);
});

test('opening the app backs up only when the last backup is 12 hours old', async () => {
  const { sync, hooks, net, storage, store } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  await sync.run();
  await store.commit({ event: { day: '2026-10-05', kind: 'checkin', ts: '2026-10-05T19:01:00Z' } });
  const count = net.bodies.length;
  await hooks.emit('open', {});
  await new Promise((r) => { setTimeout(r, 10); });
  assert.equal(net.bodies.length, count); // backed up minutes ago, so the change waits
  saveState(storage, { ...loadState(storage), lastOk: '2020-01-01T00:00:00.000Z' });
  await hooks.emit('open', {});
  await sync.run();
  assert.equal(net.bodies.length, count + 1);
});

test('a second request during a backup runs once more afterwards', async () => {
  const { sync, store, sheet } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  const first = sync.run();
  await store.commit({ event: { day: '2026-10-05', kind: 'checkin', ts: '2026-10-05T19:01:00Z' } });
  const second = sync.run();
  assert.equal(first, second); // the same running backup
  await second;
  assert.equal(sheet.ss.rowsOf('Log').length, 2);
});

test('Test connection, a new code and restore work through the Settings actions', async () => {
  const { sync, sheet } = await setUp();
  sync.saveSettings({ url: URL_OK, code: CODE });
  assert.equal(await sync.ping(), 'Connected. The Sheet has saved answers up to number 0.');
  await sync.run();
  assert.equal(await sync.pending(), 0);
  const fresh = new MemoryStore();
  const other = install({ on: createHooks().on, store: fresh, data, storage: memoryStorage(), fetchFn: fetchToSheet(sheet).fetchFn });
  other.saveSettings({ url: URL_OK, code: CODE });
  assert.equal(await other.ping(), 'Connected, but another phone or browser backs up to this Sheet.');
  const { counts } = await other.restore();
  assert.deepEqual(counts, { progress: 1, events: 1, days: 0 });
  assert.equal((await fresh.getProgress('w0026')).step, 1);
  const old = sync.state().code;
  assert.notEqual(sync.newCode(), old);
  await assert.rejects(sync.ping(), /refused the secret code/);
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `node --test tests/js/sync.test.mjs`
Expected: FAIL with `Error [ERR_MODULE_NOT_FOUND]: Cannot find module '...docs\js\sync.js'` and `ℹ fail 1`.

- [ ] **Step 3: Write `docs/js/sync.js`**

```js
// The Google Sheet backup joins the app here. hooks.js (Plan 4) calls install() at start-up,
// because plugins.js lists './sync.js'. The backup runs:
//   at the end of each session ('sessionEnd'),
//   when the app is closed or sent to the background ('hidden', with small keepalive requests
//     that the browser finishes even after the page is gone),
//   when the app opens and the last backup is 12 or more hours old, or the last try failed ('open'),
//   when the phone comes back online, and when "Back up now" is tapped in Settings.
// A backup never makes a screen wait, and a failed one only changes the status line in Settings.
import {
  KEEPALIVE_PAGE_SIZE, PAGE_SIZE, PROBLEM_TEXT, backUp, checkCode, checkWebAppUrl, isDue, loadState, makeCode, makeDeviceId,
  postJson, restoreFromSheet, saveState, statusText, withSettings,
} from './sheet.js';
import { h } from './ui/dom.js';

// The backup without any page: Node tests call this directly.
export function createSync({ store, data, storage, fetchFn }) {
  let running = null;
  let again = null;

  // The saved state. The first call makes this browser's device ID and a secret code.
  function state() {
    const s = loadState(storage);
    if (!s.device || !s.code) {
      if (!s.device) s.device = makeDeviceId();
      if (!s.code) s.code = makeCode();
      saveState(storage, s);
    }
    return s;
  }

  const postFor = (s, keepalive = false) => (body) => postJson(s.url, body, { fetchFn, keepalive });
  const save = (s) => saveState(storage, s);

  function once({ keepalive = false, reset = false } = {}) {
    const s = state();
    return backUp({
      store, words: data.words, themes: data.themes, state: s, post: postFor(s, keepalive), save, reset,
      pageSize: keepalive ? KEEPALIVE_PAGE_SIZE : PAGE_SIZE,
    });
  }

  // One backup at a time. A call during a backup makes one more run after it, so changes
  // saved in the meantime are not left waiting.
  function run(options = {}) {
    if (running) {
      again = { ...(again ?? {}), ...options };
      return running;
    }
    running = (async () => {
      let result = await once(options);
      while (again) {
        const next = again;
        again = null;
        result = await once(next);
      }
      return result;
    })().finally(() => { running = null; });
    return running;
  }

  return {
    state,
    run,
    async pending() {
      return (await store.eventsSince(state().cursor)).length;
    },
    saveSettings({ url, code }) {
      save(withSettings(state(), { url, code }));
    },
    newCode() {
      save(withSettings(state(), { url: state().url, code: makeCode() }));
      return state().code;
    },
    async ping() {
      const s = state();
      const answer = await postFor(s)({ action: 'ping', code: s.code, device: s.device });
      if (!answer?.ok) throw new Error(PROBLEM_TEXT[answer?.error] ?? answer?.message ?? PROBLEM_TEXT.server);
      if (answer.device === 'other') return 'Connected, but another phone or browser backs up to this Sheet.';
      return `Connected. The Sheet has saved answers up to number ${answer.lastSeq}.`;
    },
    async restore() {
      if (running) await running;
      const s = state();
      return restoreFromSheet({ store, state: s, post: postFor(s), save });
    },
  };
}

export function install({ on, store, data, storage = globalThis.localStorage, fetchFn = (...args) => globalThis.fetch(...args) }) {
  const sync = createSync({ store, data, storage, fetchFn });
  const quietly = (options) => { sync.run(options).catch((err) => console.warn('Backup failed:', err)); };
  on('sessionEnd', () => { quietly(); });
  on('hidden', () => { quietly({ keepalive: true }); });
  on('open', () => { if (isDue(sync.state())) quietly(); });
  if (typeof globalThis.addEventListener === 'function') globalThis.addEventListener('online', () => quietly());
  on('settings', ({ container }) => drawSettings(container, sync));
  return sync;
}

// The "Google Sheet backup" section of Settings.
async function drawSettings(container, sync) {
  const s = sync.state();
  const status = h('p', { class: 'muted' });
  const message = h('p', { class: 'sheet-message', role: 'status' });
  const urlInput = h('input', {
    type: 'url', name: 'sheetUrl', class: 'wide', value: s.url, autocomplete: 'off',
    placeholder: 'https://script.google.com/macros/s/.../exec',
  });
  const codeBox = h('input', { type: 'text', name: 'sheetCode', class: 'wide code', value: s.code, autocomplete: 'off', spellcheck: 'false' });
  const replaceButton = h('button', { class: 'small' }, 'Replace the Sheet with this phone\'s progress');

  async function refresh() {
    const now = sync.state();
    status.textContent = statusText(now, await sync.pending());
    codeBox.value = now.code;
    replaceButton.hidden = !['other-device', 'mismatch'].includes(now.problem);
  }

  // A button that runs `work`, shows its answer (or its error) and then refreshes the status.
  function action(button, work) {
    button.addEventListener('click', async () => {
      button.disabled = true;
      message.textContent = 'Working...';
      try {
        message.textContent = (await work()) ?? '';
      } catch (err) {
        message.textContent = err.message;
      } finally {
        button.disabled = false;
        await refresh();
      }
    });
    return button;
  }
  const button = (label, work) => action(h('button', { class: 'small' }, label), work);
  const backupResult = (r) => (r.state.problem ? 'Not backed up. See the note above.' : `Backed up. ${r.sent} change${r.sent === 1 ? '' : 's'} sent.`);

  action(replaceButton, async () => {
    if (!window.confirm('Replace everything in the Google Sheet with the progress on this phone?')) return 'Nothing changed.';
    return backupResult(await sync.run({ reset: true }));
  });

  container.append(
    h('h2', {}, 'Google Sheet backup'),
    status,
    h('label', { class: 'field' }, 'Web app address (from the Sheet owner)', urlInput),
    h('label', { class: 'field' }, 'Secret code (the Sheet owner pastes it into the script)', codeBox),
    button('Save address and code', async () => {
      sync.saveSettings({ url: checkWebAppUrl(urlInput.value), code: checkCode(codeBox.value) });
      return 'Saved. Tap "Test connection" to check it.';
    }),
    h('div', { class: 'row' },
      button('Copy code', async () => {
        await navigator.clipboard.writeText(sync.state().code);
        return 'Code copied.';
      }),
      typeof navigator.share === 'function' ? button('Share code', async () => {
        await navigator.share({ title: 'HSK Flashcards secret code', text: sync.state().code });
        return 'Code shared.';
      }) : null,
      button('Make a new code', async () => {
        if (!window.confirm('A new code stops the backup until the new code is pasted into the script in the Sheet. Make a new code?')) return 'Nothing changed.';
        sync.newCode();
        return 'New code made. Send it to the Sheet owner.';
      })),
    h('div', { class: 'row' },
      button('Test connection', () => sync.ping()),
      button('Back up now', async () => backupResult(await sync.run())),
      button('Restore from Google Sheet', async () => {
        if (!window.confirm('Replace all progress on this phone with the progress saved in the Google Sheet?')) return 'Nothing changed.';
        const { counts } = await sync.restore();
        const text = `Restored ${counts.progress} words, ${counts.days} check-in days and ${counts.events} answers.`;
        window.alert(text);
        window.location.hash = '#/today';
        return text;
      })),
    replaceButton,
    message);
  await refresh();
}
```

- [ ] **Step 4: Write `docs/js/plugins.js`**

This replaces Plan 4's empty list.

```js
// Modules that join the app through hooks.js, as paths relative to docs/js/.
// './sync.js' is the Google Sheet backup (Plan 5). It is also listed in APP_FILES in sw.js.
export const PLUGINS = Object.freeze(['./sync.js']);
```

- [ ] **Step 5: Update Plan 4's hooks test**

Plan 4's test "Plan 4 ships with no plugins" now fails, as intended. In `tests/js/hooks.test.mjs`, add `import { existsSync } from 'node:fs';` above the line `import { PLUGINS } from '../../docs/js/plugins.js';`, and replace

```js
test('Plan 4 ships with no plugins', () => {
  assert.deepEqual(PLUGINS, []);
});
```

with

```js
test('the plugin list names only modules that exist in docs/js/', () => {
  for (const path of PLUGINS) assert.ok(existsSync(new URL(`../../docs/js/${path}`, import.meta.url)), path);
});
```

- [ ] **Step 6: Add `sync.js` to the app files and style the section**

In `docs/sw.js`, in `APP_FILES`, add `'js/sync.js',` after `'js/study.js',`:

```js
  'js/study.js',
  'js/sync.js',
```

At the end of `docs/css/app.css`, add:

```css
/* Google Sheet backup section of Settings (Plan 5) */
.field input.wide { display: block; width: 100%; font: inherit; padding: 0.5rem; margin-top: 0.25rem; }
.field input.code { font-family: ui-monospace, Consolas, monospace; letter-spacing: 0.05em; }
.sheet-message { min-height: 1.4em; }
```

- [ ] **Step 7: Run the tests and check the syntax**

Run: `node --test tests/js/sync.test.mjs tests/js/hooks.test.mjs tests/js/release.test.mjs && node --check docs/js/sync.js && echo ok`
Expected: no failures (`ℹ fail 0`, with `ℹ tests 15` and `ℹ skipped 1` while Plan 3's words file is absent), then `ok`.

- [ ] **Step 8: Commit**

```bash
git add docs/js/sync.js docs/js/plugins.js docs/sw.js docs/css/app.css tests/js/sync.test.mjs tests/js/hooks.test.mjs && git commit -F - <<'EOF'
feat(sheet): backup plugin with the hooks of Plan 4 and a Settings section

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 4: Release r002 and GitHub Pages without Jekyll (`docs/.nojekyll`, `docs/sw.js`, `docs/js/release.js`)

**Files:**
- Create: `docs/.nojekyll` (empty)
- Modify: `docs/sw.js`, `docs/js/release.js`, `tests/js/release.test.mjs`

- [ ] **Step 1: Create the empty file and see the release test fail**

Run: `touch docs/.nojekyll && node --test tests/js/release.test.mjs`
Expected: FAIL in "every app file is saved for offline use", with `'.nojekyll'` in the list of files on disk.

- [ ] **Step 2: Let the release test know the marker file**

In `tests/js/release.test.mjs`, replace

```js
// Files that are not saved at install: the worker itself, licence texts, the words files
// (the current one is saved separately), and audio and stroke files (saved as they are used).
const NOT_PRECACHED = (path) => path === 'sw.js' || path.endsWith('.txt') || path.startsWith('data/')
```

with

```js
// Files that are not saved at install: the worker itself, GitHub Pages' .nojekyll marker,
// licence texts, the words files (the current one is saved separately), and audio and stroke
// files (saved as they are used).
const NOT_PRECACHED = (path) => path === 'sw.js' || path === '.nojekyll' || path.endsWith('.txt') || path.startsWith('data/')
```

(the next line of that statement, `|| path.startsWith('audio/') || path.startsWith('strokes/');`, stays).

- [ ] **Step 3: Raise the release**

In `docs/js/release.js` change `export const RELEASE = 'r001';` to `export const RELEASE = 'r002';`, and in `docs/sw.js` change `const RELEASE = 'r001';` to `const RELEASE = 'r002';`. If Plan 3 or 4 already raised it, raise it by one from its current value in both files instead.

- [ ] **Step 4: Run every JavaScript test**

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ fail 0`, and 41 more tests than before this plan (`ℹ tests 233`, `ℹ pass 231`, `ℹ skipped 2` when Plan 3's words file is absent).

- [ ] **Step 5: Commit**

```bash
git add docs/.nojekyll docs/sw.js docs/js/release.js tests/js/release.test.mjs && git commit -F - <<'EOF'
chore(release): r002 with the Sheet backup, and publish docs/ without Jekyll

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 5: The backup in a real browser (`tests/browser/fake-sheet-server.mjs`, `tests/browser/check.mjs`)

Node cannot draw the Settings section or send a real `fetch` from a page, so this task checks both in headless Chrome, with a local stand-in for Google's web app. The stand-in runs the real `Code.gs` and answers like Google: a POST gets a redirect (302), and the second address returns the JSON, both with `Access-Control-Allow-Origin: *`.

**Files:**
- Create: `tests/browser/fake-sheet-server.mjs`
- Modify: `tests/browser/check.mjs`

- [ ] **Step 1: Write `tests/browser/fake-sheet-server.mjs`**

```js
// A local stand-in for the Google Apps Script web app, for the browser check
// (node tests/browser/check.mjs sheet). It runs the real tools/apps_script/Code.gs through
// tests/js/fake-apps-script.mjs and answers the way Google does: a POST to /exec is run and
// answered with a redirect (302) to a second address, where a GET returns the JSON. Both
// answers carry Access-Control-Allow-Origin: *, as Google's do.
//
//   node tests/browser/fake-sheet-server.mjs      listens on http://localhost:8125/
//   GET /admin/setup?code=...   pastes a code into the script and runs setup (a new, empty Sheet)
//   GET /admin/code?code=...    changes the script's code only
//   GET /admin/rows             { log, progress, daily } row counts
import http from 'node:http';
import { loadAppsScript } from '../js/fake-apps-script.mjs';

const PORT = 8125;
let sheet = loadAppsScript();
const answers = new Map();
let next = 1;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json', ...headers });
  res.end(body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'POST' && url.pathname === '/exec') {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => { body += chunk; });
    req.on('end', () => {
      const token = String(next++);
      answers.set(token, sheet.gs.doPost({ postData: { contents: body } }).getContent());
      send(res, 302, '', { Location: `/echo?token=${token}` });
    });
    return;
  }
  if (req.method === 'GET' && url.pathname === '/echo') {
    const text = answers.get(url.searchParams.get('token'));
    answers.delete(url.searchParams.get('token'));
    send(res, text ? 200 : 404, text ?? '{}');
    return;
  }
  if (url.pathname === '/admin/setup') {
    sheet = loadAppsScript({ code: url.searchParams.get('code') });
    sheet.gs.setup();
    send(res, 200, '{"ok":true}');
    return;
  }
  if (url.pathname === '/admin/code') {
    sheet.gs.SECRET_CODE = url.searchParams.get('code');
    send(res, 200, '{"ok":true}');
    return;
  }
  if (url.pathname === '/admin/rows') {
    send(res, 200, JSON.stringify({
      log: sheet.ss.rowsOf('Log').length, progress: sheet.ss.rowsOf('Progress').length, daily: sheet.ss.rowsOf('Daily').length,
    }));
    return;
  }
  send(res, 404, '{}');
}).listen(PORT, () => console.log(`Fake Sheet web app on http://localhost:${PORT}/exec`));
```

- [ ] **Step 2: Add the `sheet` mode to `tests/browser/check.mjs`**

Three edits:
1. In the comment at the top, after the line for `update`, add
   `//   node tests/browser/check.mjs sheet     the Google Sheet backup, against fake-sheet-server.mjs (after day)`.
2. Insert this block just above the line `const mode = process.argv[2];`:

```js
// The Google Sheet backup section of Settings (Plan 5), against the stand-in web app of
// tests/browser/fake-sheet-server.mjs on port 8125. Run it after 'day', in the same Chrome
// profile, so the phone already has a first study day to back up.
const FAKE_SHEET = 'http://localhost:8125';
const COUNTS = `(async () => { const m = await import(location.origin + '/js/store.js'); const s = await m.openIdbStore();
  const d = await s.dump(); s.db.close(); return [d.progress.length, d.events.length, d.days.length].join(' '); })()`;

async function sheet() {
  const page = await openPage(`${SITE}#/today`);
  await page.until("!!document.querySelector('.streak')", 20000);
  // Start as a phone that was never set up, so the check can run again in the same profile.
  await page.eval("localStorage.removeItem('hsk-sheet-backup'); location.hash = '#/settings'; true");
  await page.until("[...document.querySelectorAll('h2')].some((x) => x.textContent === 'Google Sheet backup')");
  check('Settings shows the Google Sheet backup section', true);
  await page.eval('window.confirm = () => true; window.alert = () => {}; true');
  const code = await page.eval("document.querySelector('input.code').value");
  check('Settings made a secret code', /^[a-z2-9]{4}(-[a-z2-9]{4}){5}$/.test(code), code);
  await fetch(`${FAKE_SHEET}/admin/setup?code=${code}`); // as if the owner pasted it and ran setup
  const tap = async (label) => {
    await page.eval(`document.querySelector('.sheet-message').textContent = ''; ${CLICK(label)}; true`);
    await page.until("!['', 'Working...'].includes(document.querySelector('.sheet-message').textContent)");
    return page.eval("document.querySelector('.sheet-message').textContent");
  };
  const setUrl = (url) => page.eval(`document.querySelector('input[name=sheetUrl]').value = '${url}'; true`);
  await setUrl(`${FAKE_SHEET}/exec`);
  check('the address is saved', (await tap('Save address and code')) === 'Saved. Tap "Test connection" to check it.');
  let said = await tap('Test connection');
  check('Test connection reaches the web app', said === 'Connected. The Sheet has saved answers up to number 0.', said);
  said = await tap('Back up now');
  const rows = await (await fetch(`${FAKE_SHEET}/admin/rows`)).json();
  const sent = Number((said.match(/^Backed up\. (\d+) changes sent\.$/) ?? [])[1]);
  check('Back up now sends the first day', sent > 0 && rows.log === sent && rows.progress === 12 && rows.daily === 1, `${said} ${JSON.stringify(rows)}`);
  await fetch(`${FAKE_SHEET}/admin/code?code=wrong-code`);
  said = await tap('Test connection');
  check('a wrong secret code is refused', /refused the secret code/.test(said), said);
  await fetch(`${FAKE_SHEET}/admin/code?code=${code}`);
  const before = await page.eval(COUNTS);
  await page.eval(`${CLICK('Restore from Google Sheet')}; true`);
  await page.until("location.hash === '#/today' && /day streak/.test(document.getElementById('main').innerText)");
  const after = await page.eval(COUNTS);
  check('Restore from Google Sheet gives the same counts and streak', before === after && /1 day streak/.test(await page.text()), `${before} / ${after}`);
  await page.eval("location.hash = '#/settings'; true");
  await page.until("!!document.querySelector('input[name=sheetUrl]')");
  // Saving the daily amounts logs a change. Hiding the page (as when the app is closed) sends it
  // with a keepalive request, which the browser finishes even if the page goes away.
  const logged = (await (await fetch(`${FAKE_SHEET}/admin/rows`)).json()).log;
  await page.eval(`${CLICK('Save')}; true`);
  await page.sleep(500);
  await page.eval(`Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange')); true`);
  await page.sleep(2000);
  await page.eval("delete document.visibilityState; true");
  const loggedNow = (await (await fetch(`${FAKE_SHEET}/admin/rows`)).json()).log;
  check('closing the app sends the new change', loggedNow === logged + 1, `${logged} then ${loggedNow}`);
  await setUrl('http://localhost:8126/exec'); // nothing listens there, as when the phone is offline
  await tap('Save address and code');
  said = await tap('Test connection');
  check('an unreachable Sheet gives a plain message', /^Could not reach the Sheet/.test(said), said);
  await setUrl(`${FAKE_SHEET}/exec`);
  await tap('Save address and code');
  check('no uncaught errors on the page', page.errors.length === 0, page.errors.join('; '));
  await page.close();
}
```

3. Change `const modes = { store, day, offline, update };` to `const modes = { store, day, offline, update, sheet };`, and in the usage message change `store|day|offline|update` to `store|day|offline|update|sheet`.

Run: `node --check tests/browser/check.mjs && echo ok`
Expected: `ok`.

- [ ] **Step 3: Build the smoke site and start the servers and Chrome**

As in Plan 4 Task 17 Steps 5 and 6, each in its own background shell:
```bash
PYTHONIOENCODING=utf-8 python tools/14_smoke_site.py
```
```bash
cd .claude/scratch/smoke_vNNN && python -m http.server 8123
```
```bash
node tests/browser/fake-sheet-server.mjs
```
```bash
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless=new --remote-debugging-port=9333 --user-data-dir="$TEMP\\hskchk" --no-first-run --autoplay-policy=no-user-gesture-required about:blank
```
Use the `smoke_vNNN` folder the first command printed. The stand-in prints `Fake Sheet web app on http://localhost:8125/exec`. If Chrome's output says `bind() returned an error` for port 9333, an earlier Chrome still holds the port. End it, and start again with a new profile folder name.

- [ ] **Step 4: Run a first day, then the backup check**

Run: `node tests/browser/check.mjs day`
Expected: 15 `PASS` lines, as in Plan 4, now with the plugin loaded.

Run: `node tests/browser/check.mjs sheet`
Expected: 10 `PASS` lines and exit code 0:
```
PASS Settings shows the Google Sheet backup section
PASS Settings made a secret code (....-....-....-....-....-....)
PASS the address is saved
PASS Test connection reaches the web app (Connected. The Sheet has saved answers up to number 0.)
PASS Back up now sends the first day (Backed up. 26 changes sent. {"log":26,"progress":12,"daily":1})
PASS a wrong secret code is refused (The Sheet refused the secret code. The code in the script must be the code shown here.)
PASS Restore from Google Sheet gives the same counts and streak (12 26 1 / 12 26 1)
PASS closing the app sends the new change (26 then 27)
PASS an unreachable Sheet gives a plain message (Could not reach the Sheet (Failed to fetch).)
PASS no uncaught errors on the page
```

- [ ] **Step 5: Run the offline check**

End the server on port 8123, then run `node tests/browser/check.mjs offline`.
Expected: Plan 4's 4 `PASS` lines. This shows that the new files are in the app cache.

- [ ] **Step 6: Clean up**

End the servers and Chrome, then delete the Chrome profile and the smoke site, which have served their purpose:
```bash
rm -rf "$TEMP/hskchk" .claude/scratch/smoke_vNNN
```

- [ ] **Step 7: Commit**

```bash
git add tests/browser/fake-sheet-server.mjs tests/browser/check.mjs && git commit -F - <<'EOF'
test(sheet): browser check of the Settings section against a stand-in web app

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 6: The user's setup instructions (`tools/apps_script/SETUP.md`)

The design names this file. It is in `tools/`, not in `docs/`, so it is in the public repository but not on the site. It contains no code or address, only where to paste them.

**Files:**
- Create: `tools/apps_script/SETUP.md`

- [ ] **Step 1: Write `tools/apps_script/SETUP.md`**

````markdown
# Setting up the Google Sheet backup

This takes about 10 minutes. You need a computer signed in to your Google account, and the
learner's phone with the app open at Settings. Nothing you create here goes into the public
GitHub repository.

## What the two values are

- **The secret code.** A random code of 24 letters and digits, such as
  `k7mq-2xrt-9pwd-hc4n-fz6b-y3ja`, that the app makes. The script in your Sheet only accepts
  requests that carry this code, so a stranger who finds the web app address still cannot read
  or change your Sheet. It lives in two places only: the phone's browser and your copy of the
  script.
- **The web app address.** The link Google gives your script when you deploy it, such as
  `https://script.google.com/macros/s/AKfycb.../exec`. The phone sends its progress to this
  address. It lives only in the phone's browser.

## 1. Get the secret code from the phone

1. On the phone, open the app, tap **Settings**, and scroll to **Google Sheet backup**.
2. The box **Secret code** shows the code. Tap **Share code** (or **Copy code**) and send it to
   yourself, for example by e-mail or a message. You paste it in step 3.

## 2. Make the Sheet

1. On the computer, open https://sheets.google.com and sign in.
2. Click **Blank spreadsheet** (the large plus).
3. Click the title "Untitled spreadsheet" at the top left and type `HSK Flashcards progress`.

## 3. Add the script

1. In the Sheet's menu, click **Extensions**, then **Apps Script**. A new tab opens with the
   script editor and a file called `Code.gs`.
2. Click the title "Untitled project" at the top and type `HSK Flashcards backup`, then **Rename**.
3. Open `tools/apps_script/Code.gs` from the project (Claude can give you its text, or open it on
   GitHub and click **Copy raw file**).
4. In the editor, select everything in `Code.gs` (Ctrl+A), delete it, and paste the project's text.
5. Near the top, find this line:
   `var SECRET_CODE = 'PASTE-THE-CODE-FROM-THE-APP';`
   Replace `PASTE-THE-CODE-FROM-THE-APP` with the code from step 1, keeping the quote marks.
   It then looks like `var SECRET_CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';` with your code.
6. Click the disk icon (**Save project**), or press Ctrl+S.

## 4. Run setup once

1. In the toolbar above the code, the box next to **Debug** shows a function name. Choose `setup`.
2. Click **Run**.
3. Google asks for permission the first time:
   - Click **Review permissions** and choose your Google account.
   - A page says "Google hasn't verified this app". This is expected for a script you wrote
     yourself. Click **Advanced**, then **Go to HSK Flashcards backup (unsafe)**.
   - Click **Allow**. The script may then read and change your spreadsheets. It only opens
     this one Sheet.
4. The **Execution log** at the bottom shows
   `Setup done. The tabs Dashboard, Progress, Log, Daily and Meta are ready. Now deploy the web app.`
   If it says to replace PASTE-THE-CODE-FROM-THE-APP, step 3.5 was missed.
5. Switch back to the Sheet's tab. It now has the tabs Dashboard, Progress, Log, Daily and Meta.

## 5. Deploy it as a web app

1. In the script editor, click the blue **Deploy** button (top right), then **New deployment**.
2. Next to "Select type", click the gear icon and choose **Web app**.
3. Fill in:
   - **Description:** `HSK backup`
   - **Execute as:** `Me (your address)`
   - **Who has access:** `Anyone`
   "Anyone" is needed because the phone does not sign in to Google. The secret code is what
   keeps strangers out.
4. Click **Deploy**. If Google asks for permission again, allow it as in step 4.3.
5. Copy the **Web app URL** (it ends with `/exec`) and click **Done**.
6. Optional check: open that address in a new browser tab. It shows
   `{"ok":true,"app":"hsk-flashcards-backup","message":"The HSK Flashcards backup is running."}`.

## 6. Connect the phone

1. Send the web app address to the phone (for example by e-mail or a message) and copy it there.
2. In the app, go to **Settings**, **Google Sheet backup**, paste the address into
   **Web app address**, and tap **Save address and code**.
3. Tap **Test connection**. It says `Connected. The Sheet has saved answers up to number 0.`
4. Tap **Back up now**. It says `Backed up. N changes sent.` (or 0 before the first session),
   and the Sheet's tabs fill with rows.

## Later changes

- **A new version of the script.** Paste the new text (keeping your code on the SECRET_CODE
  line), save, then **Deploy**, **Manage deployments**, the pencil icon, **Version: New version**,
  **Deploy**. The web app address stays the same.
- **A new secret code.** After **Make a new code** on the phone, paste the new code into the
  script, save, and deploy a new version as above. Until then the phone's backups are refused.
- **A new phone.** Install the app and open **Settings**, **Google Sheet backup**. Paste the
  web app address. Replace the code in **Secret code** with the code on the SECRET_CODE line of
  your script, tap **Save address and code**, then **Restore from Google Sheet**.
- **Two phones or browsers.** Only one of them backs up to the Sheet. The other one is told
  "Another phone or browser backs up to this Sheet" and offers two buttons: **Restore from
  Google Sheet** (take the Sheet's progress) or **Replace the Sheet with this phone's
  progress**.

## If something goes wrong

| The app says | What to do |
|---|---|
| Could not reach the Sheet... | Check that the phone is online and that the address ends with `/exec`. In **Manage deployments**, "Who has access" must be **Anyone**. |
| The Sheet refused the secret code | The code on the SECRET_CODE line must be exactly the code shown in Settings. Fix it, save, and deploy a new version. |
| The script in the Sheet is not set up | Run `setup` once (step 4). |
| The progress on this phone no longer matches the Sheet | Happens after "Restore from a backup file". Choose one of the two buttons shown. |
````

- [ ] **Step 2: Check that the button names in SETUP.md match the app**

Run: `for b in "Share code" "Copy code" "Save address and code" "Test connection" "Back up now" "Restore from Google Sheet" "Make a new code" "Replace the Sheet with this phone"; do grep -q "$b" docs/js/sync.js && echo "ok $b" || echo "MISSING $b"; done`
Expected: eight `ok` lines.

- [ ] **Step 3: Commit**

```bash
git add tools/apps_script/SETUP.md && git commit -F - <<'EOF'
docs(sheet): click-by-click setup of the Google Sheet backup

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 7: The publish check (`tools/publishcheck.py`, `tools/15_publish_check.py`)

The repository is public, so every push shows everything git tracks, and every commit's name and e-mail address, to anyone. This check runs before every push. For example, a tracked script with `open("C:/Users/me/Box/...")` gives `PROBLEM tools/x.py:3: a personal Windows path (C:/Users/)` and exit code 1.

**Files:**
- Create: `tools/publishcheck.py`, `tools/15_publish_check.py`
- Test: `tests/test_publishcheck.py`

- [ ] **Step 1: Write the failing test `tests/test_publishcheck.py`**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

import publishcheck as pc  # noqa: E402


def test_personal_paths_user_name_and_google_addresses_are_found():
    lines = [
        'data = "./process data/a.csv"',
        'url = "https://script.google.com/macros/s/AKfycbx1234567890abcdefghij/exec"',
        'open("C:/Users/mexx/b.txt")',
    ]
    text = chr(10).join(lines)
    assert pc.scan_text("tools/x.py", text, "mexx") == [
        "tools/x.py:2: a Google Apps Script web app address",
        "tools/x.py:3: a personal Windows path (C:/Users/)",
        "tools/x.py:3: the Windows user name 'mexx'",
    ]
    assert pc.scan_text("tools/x.py", "me and mexico", "me") == []  # names under 4 letters are not searched


def test_only_noreply_emails_are_allowed():
    assert pc.scan_text("a.md", "Co-Authored-By: Claude <noreply@anthropic.com>", "") == []
    assert pc.scan_text("a.md", "by 143559791+Xiao-Wen-Tan@users.noreply.github.com", "") == []
    assert pc.scan_text("a.md", "write to someone@gmail.com", "") == ["a.md:1: an e-mail address (someone@gmail.com)"]
    assert pc.check_identities(["1+x@users.noreply.github.com", "me@school.edu"]) == ["a commit uses the e-mail address me@school.edu"]


def test_docs_holds_only_web_files():
    paths = ["docs/index.html", "docs/.nojekyll", "docs/audio/w/w0001_ab.mp3", "docs/notes.md", "docs/data/x.csv", "tools/a.py"]
    assert pc.check_docs_names(paths) == [
        "docs/notes.md: this kind of file does not belong in the public web root",
        "docs/data/x.csv: this kind of file does not belong in the public web root",
    ]


def test_sizes():
    assert pc.check_sizes({"docs/a.mp3": 60_000_000, "docs/b.mp3": 1}) == ["docs/a.mp3: 60.0 MB, over 50 MB"]
    assert pc.check_sizes({f"docs/{i}.mp3": 40_000_000 for i in range(23)}) == ["docs/: 920 MB, over 900 MB"]


def test_code_gs_keeps_the_placeholder():
    assert pc.check_code_gs("/** x */\nvar SECRET_CODE = 'PASTE-THE-CODE-FROM-THE-APP';\n") == []
    assert pc.check_code_gs("var SECRET_CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';\n") != []
```

- [ ] **Step 2: Run it and see it fail**

Run: `python -m pytest tests/test_publishcheck.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'publishcheck'`.

- [ ] **Step 3: Write `tools/publishcheck.py`**

```python
"""Checks that make a push to the PUBLIC GitHub repository safe (used by 15_publish_check.py).

Each check takes plain values and returns a list of problems (empty when all is well), so
pytest can test it without git. For example, scan_text('tools/x.py', 'open("C:/Users/me/a")', 'me')
returns ['tools/x.py:1: a personal Windows path (C:/Users/)', "tools/x.py:1: the Windows user name 'me'"].
"""
import re

# Commit identities that may appear in public history: GitHub's private noreply address of
# the user and Claude's co-author line.
ALLOWED_EMAIL_ENDINGS = ("@users.noreply.github.com", "noreply@anthropic.com")

# File types that may be published in docs/ (the web root). Anything else, such as a .md note,
# a .csv or a .py file, must stay out of it.
DOCS_TYPES = {".html", ".css", ".js", ".json", ".webmanifest", ".png", ".mp3", ".txt"}
DOCS_NAMES = {".nojekyll"}

BINARY_TYPES = {".mp3", ".png", ".pdf", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".zip"}

MAX_FILE_MB = 50  # GitHub warns above 50 MB and refuses files above 100 MB
MAX_SITE_MB = 900  # GitHub Pages sites may be at most 1 GB

PLACEHOLDER_LINE = "var SECRET_CODE = 'PASTE-THE-CODE-FROM-THE-APP';"

_PATTERNS = [
    (re.compile(r"[A-Za-z]:[\\/]+Users[\\/]", re.I), "a personal Windows path (C:/Users/)"),
    (re.compile(r"script\.google\.com/(?:a/macros/[^/\s]+|macros)/s/[A-Za-z0-9_-]{20,}"), "a Google Apps Script web app address"),
    (re.compile(r"docs\.google\.com/spreadsheets/d/[A-Za-z0-9_-]{20,}"), "a Google Sheet address"),
]
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")


def is_binary(path):
    return any(path.lower().endswith(ext) for ext in BINARY_TYPES)


def scan_text(path, text, username=""):
    """Personal paths, the Windows user name, Google addresses and e-mail addresses in one file."""
    problems = []
    for n, line in enumerate(text.splitlines(), 1):
        for pattern, what in _PATTERNS:
            if pattern.search(line):
                problems.append(f"{path}:{n}: {what}")
        if len(username) >= 4 and username.lower() in line.lower():
            problems.append(f"{path}:{n}: the Windows user name '{username}'")
        for email in _EMAIL.findall(line):
            if not email.lower().endswith(ALLOWED_EMAIL_ENDINGS):
                problems.append(f"{path}:{n}: an e-mail address ({email})")
    return problems


def check_docs_names(paths):
    """Only web files in docs/, the public web root."""
    problems = []
    for p in paths:
        if not p.startswith("docs/"):
            continue
        name = p.rsplit("/", 1)[-1]
        ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name[1:] else ""
        if name not in DOCS_NAMES and ext not in DOCS_TYPES:
            problems.append(f"{p}: this kind of file does not belong in the public web root")
    return problems


def check_sizes(sizes):
    """sizes is {path: bytes}. No file over 50 MB, and docs/ under 900 MB."""
    problems = [f"{p}: {b / 1e6:.1f} MB, over {MAX_FILE_MB} MB" for p, b in sorted(sizes.items()) if b > MAX_FILE_MB * 1e6]
    site = sum(b for p, b in sizes.items() if p.startswith("docs/"))
    if site > MAX_SITE_MB * 1e6:
        problems.append(f"docs/: {site / 1e6:.0f} MB, over {MAX_SITE_MB} MB")
    return problems


def check_identities(emails):
    """Author and committer e-mail addresses of every commit that would be pushed."""
    return [f"a commit uses the e-mail address {e}" for e in sorted(set(emails)) if not e.lower().endswith(ALLOWED_EMAIL_ENDINGS)]


def check_code_gs(text):
    """The published script must hold the placeholder, never a real secret code."""
    lines = [line.strip() for line in text.splitlines() if line.strip().startswith("var SECRET_CODE")]
    if lines != [PLACEHOLDER_LINE]:
        return ["tools/apps_script/Code.gs: SECRET_CODE must be the placeholder PASTE-THE-CODE-FROM-THE-APP"]
    return []
```

- [ ] **Step 4: Write `tools/15_publish_check.py`**

```python
"""Step 15. Check what a push would publish, before every push to the PUBLIC repository.

Reads the files git tracks and the commit identities, and prints one line per problem:
personal Windows paths or the Windows user name, Google Sheet or web app addresses, e-mail
addresses, a real secret code in Code.gs, files that do not belong in docs/, and files that
are too big. Exits with 1 when there is a problem. It writes nothing.
Run from the project root:  python tools/15_publish_check.py
"""
import os
import subprocess
import sys
from pathlib import Path

import publishcheck as pc


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


def main():
    files = [p for p in git("ls-files", "-z").split("\0") if p]
    username = os.environ.get("USERNAME", "")
    problems = []
    sizes = {}
    for path in files:
        full = Path(path)
        if not full.is_file():
            continue
        sizes[path] = full.stat().st_size
        if not pc.is_binary(path):
            text = full.read_text(encoding="utf-8", errors="replace")
            problems += pc.scan_text(path, text, username)
            if path == "tools/apps_script/Code.gs":
                problems += pc.check_code_gs(text)
    problems += pc.check_docs_names(files)
    problems += pc.check_sizes(sizes)
    problems += pc.check_identities(git("log", "--format=%ae%n%ce").split())
    site = sum(b for p, b in sizes.items() if p.startswith("docs/"))
    print(f"{len(files)} tracked files, docs/ {site / 1e6:.1f} MB")
    for p in problems:
        print(f"PROBLEM {p}")
    print("OK, nothing private or oversized found" if not problems else f"{len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 5: Run the tests and the check**

Run: `python -m pytest tests/test_publishcheck.py -q`
Expected: `5 passed`.

Run: `PYTHONIOENCODING=utf-8 python tools/15_publish_check.py`
Expected: a first line `N tracked files, docs/ M MB` (with Plan 3's audio, M is about 160), then `OK, nothing private or oversized found`, and exit code 0. If it prints a `PROBLEM` line, fix that file (or, for an e-mail address inside a licence text of a vendored library, show it to the user and add it to `ALLOWED_EMAIL_ENDINGS` only after the user agrees), and run it again.

- [ ] **Step 6: Commit**

```bash
git add tools/publishcheck.py tools/15_publish_check.py tests/test_publishcheck.py && git commit -F - <<'EOF'
feat(publish): check what a push to the public repository would show

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 8: The live-site check and the full check (`tools/16_check_live.mjs`)

**Files:**
- Create: `tools/16_check_live.mjs`
- Modify: `.claude/CLAUDE.md` (git-ignored, so it is not committed)

- [ ] **Step 1: Write `tools/16_check_live.mjs`**

```js
// Step 16. Checks a deployed copy of the site from outside, after GitHub Pages has published it.
//   node tools/16_check_live.mjs https://xiao-wen-tan.github.io/hsk-flashcards/
// It reads RELEASE, WORDS_FILE and APP_FILES from the local docs/sw.js, then asks the site for
// every app file, the words file and the sounds of the first 20 words, and checks that the
// site serves the same release as the local files. Prints PASS or FAIL lines, exit code 1 on FAIL.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const base = process.argv[2];
const results = [];
const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`);

async function status(url) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    await res.arrayBuffer();
    return res.status;
  } catch (err) {
    return `error ${err.message}`;
  }
}

async function main() {
  if (!base || !/^https?:\/\/.+\/$/.test(base)) {
    check('usage: node tools/16_check_live.mjs https://<user>.github.io/hsk-flashcards/ (with the final /)', false);
    return;
  }
  const self = { addEventListener: () => {} };
  vm.runInNewContext(readFileSync('docs/sw.js', 'utf8'), { self, console });
  const { RELEASE, WORDS_FILE, APP_FILES } = self.swForTests;
  const live = await (await fetch(new URL('js/release.js', base))).text().catch(() => '');
  check(`the site serves release ${RELEASE}`, live.includes(`RELEASE = '${RELEASE}'`), (live.match(/RELEASE = '[^']*'/) ?? ['none'])[0]);
  const missing = [];
  for (const path of [...APP_FILES, 'sw.js']) {
    const s = await status(new URL(path, base));
    if (s !== 200) missing.push(`${path} ${s}`);
  }
  check(`all ${APP_FILES.length + 1} app files load`, missing.length === 0, missing.join(', '));
  const wordsRes = await fetch(new URL(WORDS_FILE, base)).catch(() => null);
  const data = wordsRes?.ok ? await wordsRes.json() : null;
  check(`the words file ${WORDS_FILE} loads`, Boolean(data), wordsRes ? String(wordsRes.status) : 'no answer');
  if (data) {
    const sounds = data.words.slice().sort((a, b) => a.ord - b.ord).slice(0, 20).flatMap((w) => [w.au, w.ex.au]);
    const bad = [];
    for (const au of sounds) {
      const s = await status(new URL(`audio/${au}`, base));
      if (s !== 200) bad.push(`${au} ${s}`);
    }
    check(`the ${sounds.length} sounds of the first 20 words load`, bad.length === 0, bad.join(', '));
  }
  const page = await (await fetch(base)).text().catch(() => '');
  check('the page asks search engines not to list it', page.includes('<meta name="robots" content="noindex, nofollow">'));
}

try {
  await main();
} catch (err) {
  check('the live check stopped', false, err.message);
}
console.log(results.join('\n'));
process.exitCode = results.some((r) => r.startsWith('FAIL')) ? 1 : 0;
```

- [ ] **Step 2: Try it on a local copy**

Build the smoke site (`PYTHONIOENCODING=utf-8 python tools/14_smoke_site.py`), serve it (`cd .claude/scratch/smoke_vNNN && python -m http.server 8123` in a background shell), then run from the project root:
`node tools/16_check_live.mjs http://localhost:8123/`
Expected: 5 `PASS` lines (release r002, all 47 app files, the words file, 40 sounds, the "noindex" line) and exit code 0. The number of app files is the length of `APP_FILES` plus `sw.js`, so it may differ if Plan 4 changed that list. End the server and delete `.claude/scratch/smoke_vNNN`.

- [ ] **Step 3: Run every test**

Run: `node --test "tests/js/*.test.mjs"`
Expected: `ℹ fail 0` and 41 more tests than after Plan 4.
Run: `python -m pytest tests -q`
Expected: 5 more tests pass than before this plan, and none fail.

- [ ] **Step 4: Add the release rules to `.claude/CLAUDE.md`**

Add these lines at the end of the list:

```
- The site is public at https://xiao-wen-tan.github.io/hsk-flashcards/ (GitHub Pages, main branch, /docs). Before every push run `python tools/15_publish_check.py`; after Pages has published, run `node tools/16_check_live.mjs https://xiao-wen-tan.github.io/hsk-flashcards/`. The release checklist is in .claude/plans/2026-09-28-plan5-sync-publish.md.
- The Google Sheet backup: docs/js/sheet.js and docs/js/sync.js on the phone, tools/apps_script/Code.gs in the user's Sheet (SETUP.md). The web app address and the secret code live only on the phone and in the user's copy of the script. Never commit them.
```

- [ ] **Step 5: Commit**

```bash
git add tools/16_check_live.mjs && git commit -F - <<'EOF'
feat(publish): check the published site from outside

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_011k7C3WJp6ppw7kPNzxjtVV
EOF
```

---

### Task 9: Put the repository on GitHub (USER and Claude)

- [ ] **Step 1: Claude checks that `main` is ready**

Run: `git status --short && git branch && git remote -v`
Expected: no changed tracked files (untracked scratch files inside `.claude/` do not show, because `.claude/` is ignored), the branch list shows `* main` (plus any plan branches, which stay local), and `git remote -v` prints nothing.
Run: `node --test "tests/js/*.test.mjs"` and `python -m pytest tests -q` (both with no failures) and `PYTHONIOENCODING=utf-8 python tools/15_publish_check.py` (`OK, nothing private or oversized found`).

- [ ] **Step 2: USER creates the empty repository**

1. Open https://github.com and sign in as **Xiao-Wen-Tan**.
2. Click **+** (top right), then **New repository**.
3. **Owner:** Xiao-Wen-Tan. **Repository name:** `hsk-flashcards`. **Public.**
4. Leave "Add a README file", ".gitignore" and "license" all unset, so the repository is empty.
5. Click **Create repository**, and tell Claude it is done.

- [ ] **Step 3: Claude adds the remote and pushes**

```bash
git remote add origin https://github.com/Xiao-Wen-Tan/hsk-flashcards.git && git push -u origin main
```

**USER:** the first push opens a Git Credential Manager window (or a browser tab) that asks to sign in to GitHub. Choose **Sign in with your browser**, sign in as Xiao-Wen-Tan, and click **Authorize git-ecosystem** if asked. Nothing is typed into Claude.

Expected at the end of the push: `branch 'main' set up to track 'origin/main'.` The first push carries the audio (about 150 MB) and may take several minutes. If it stops with `RPC failed` or `HTTP 500`, run `git config http.postBuffer 524288000` and push again.

- [ ] **Step 4: Claude checks the push**

Run: `git ls-remote origin main && git rev-parse main`
Expected: the two commit numbers are the same.

---

### Task 10: Turn on GitHub Pages (USER and Claude)

- [ ] **Step 1: USER turns on Pages**

1. On https://github.com/Xiao-Wen-Tan/hsk-flashcards, click **Settings** (the tab with the gear).
2. In the left menu, under "Code and automation", click **Pages**.
3. Under "Build and deployment", set **Source** to **Deploy from a branch**.
4. Under "Branch", choose **main** and the folder **/docs**, then click **Save**.
5. Wait 1 to 5 minutes. The **Actions** tab shows a run called "pages build and deployment" that ends with a green tick, and the Pages page then says "Your site is live at https://xiao-wen-tan.github.io/hsk-flashcards/". Tell Claude.

- [ ] **Step 2: Claude checks the published site**

Run: `node tools/16_check_live.mjs https://xiao-wen-tan.github.io/hsk-flashcards/`
Expected: 5 `PASS` lines and exit code 0. If the first line fails with the old release or the files give 404, Pages has not finished. Wait two minutes and run it again.

- [ ] **Step 3: Claude opens the site once in a desktop browser**

With Claude in Chrome (or the user's own Chrome), open https://xiao-wen-tan.github.io/hsk-flashcards/. Expected: the Today screen with a Start button, and in Settings the section "Google Sheet backup" with "Not set up yet." Nothing is saved on the phone yet.

---

### Task 11: Set up the Google Sheet and connect the phone (USER)

- [ ] **Step 1: USER installs the app on the phone**

On the Android phone, open https://xiao-wen-tan.github.io/hsk-flashcards/ in Chrome, tap the menu (three dots), then **Add to Home screen** (or **Install app**), then **Install**. Open the app from the home screen.

- [ ] **Step 2: USER follows `tools/apps_script/SETUP.md`**

It is also readable at https://github.com/Xiao-Wen-Tan/hsk-flashcards/blob/main/tools/apps_script/SETUP.md. It takes about 10 minutes. The user gets the secret code from the phone, makes the Sheet, pastes the script and the code, runs setup, deploys the web app, and pastes its address into the phone.

- [ ] **Step 3: USER tells Claude what the phone and the Sheet show**

Claude cannot see the Sheet or the phone, and does not need the address or the code. The user reports:
1. what "Test connection" says (expected `Connected. The Sheet has saved answers up to number 0.`),
2. what "Back up now" says after the first session (expected `Backed up. N changes sent.`),
3. the tab names of the Sheet (expected Dashboard, Sheet1, Progress, Log, Daily, Meta), and the number of rows in Log.

Claude then checks that N matches the number of Log rows, and that the Dashboard shows a streak of 1. If a message differs, Claude uses the table at the end of SETUP.md to find the step to repeat.

---

### Task 12: The final test on the Android phone (USER, with Claude reading the results)

These are the design's checks ("Verification", "On the Android phone" and "Google Sheet") and Plan 4's phone checklist (Plan 4 Task 18 Step 7). The user ticks each one and tells Claude the result. A failed item goes back to the task named in brackets.

- [ ] **Step 1: USER checks the app on the phone**

1. Chrome offers to install the app, and it opens from the home screen without the address bar. (Plan 4 Tasks 12 and 16)
2. After tapping Start, the sound plays twice on every learning card and on every question that has sound. (Plan 4 Tasks 8 and 14)
3. Stroke order draws when "Stroke order" is tapped. (Plan 4 Task 2)
4. With airplane mode on, today's session still runs, with sound and stroke order. (Plan 4 Tasks 9 and 16)
5. Settings says "Saved progress is protected from automatic clearing." after the first session. If it does not, tap "Protect saved progress". (Plan 4 Task 15)
6. Switching to another app during a session and back shows "Tap to continue", and the tap brings the sound back. (Plan 4 Task 15)
7. After Claude publishes a release with a raised `RELEASE` (the next release, see the checklist below), the app shows "Update available, tap to reload", and after the tap the streak is still there. (Plan 4 Task 16)

- [ ] **Step 2: USER checks the Google Sheet**

8. After a session, the Sheet's Log, Progress and Daily tabs have rows, and the Dashboard shows the streak and the chart. (Tasks 1 to 3)
9. A backup made offline arrives after reconnecting. Turn on airplane mode, study a few cards, tap Stop, close the app, turn airplane mode off, open the app, and tap "Back up now". The Log gets the new rows. (Task 2)
10. A wrong secret code is refused. In Settings change one letter of the code, tap "Save address and code", then "Test connection". It says "The Sheet refused the secret code...". Change the letter back and save again. (Tasks 1 and 3)
11. A restore into a fresh browser gives identical counts and streak. On a computer, open the site in a new Chrome profile (or a Chrome Guest window), open Settings, paste the web app address, replace the code with the script's code, tap "Save address and code", then "Restore from Google Sheet". Today, Stats and the check-in calendar show the same streak and the same numbers of learned and mastered words as the phone. (Task 2)
12. Then make the phone the backing-up device again. On the phone, tap "Back up now" in Settings. It says "Another phone or browser backs up to this Sheet." Tap "Restore from Google Sheet" there. The status line then says "Last backup:" with the current time. (Choice 9)

- [ ] **Step 3: USER records the daily time**

13. After about two weeks of steady use, the Dashboard's Minutes column shows how long a day takes. The design aims at 20 to 25 minutes. Tell Claude the typical number, so Plan 2's guessed seconds per card in `config.js` can be replaced by measured ones. (Choice 4)

- [ ] **Step 4: Claude reports**

Claude reports which items passed, which failed and why, and says plainly which ones the user has not done yet. Nothing is reported as passed without the user's answer.

---

## Release checklist (for every later release)

Run from the project root. Each line says what it proves.

1. `node --test "tests/js/*.test.mjs"` and `python -m pytest tests -q` give no failures. The app logic, the backup and the build scripts still work.
2. If anything in `docs/` changed since the last push (`git diff --stat origin/main -- docs` is not empty), `RELEASE` is raised by one in both `docs/js/release.js` and `docs/sw.js`, and `node --test tests/js/release.test.mjs` passes. Otherwise phones keep the old version.
3. If Plan 3 wrote a newer words file, `WORDS_FILE` names it in both files and `python tools/12_vendor_strokes.py` has added its stroke data (Plan 4 Task 18 Step 5).
4. If `tools/apps_script/Code.gs` changed, the user pastes it into the script editor (keeping their own SECRET_CODE line), saves, and deploys a new version (SETUP.md, "Later changes"). The web app address stays the same.
5. `PYTHONIOENCODING=utf-8 python tools/15_publish_check.py` prints `OK, nothing private or oversized found`.
6. Commit, then `git push`. (Only `main` is pushed.)
7. After 1 to 5 minutes, `node tools/16_check_live.mjs https://xiao-wen-tan.github.io/hsk-flashcards/` prints 5 `PASS` lines with the new release number.
8. On the phone, the app shows "Update available, tap to reload". After the tap, Settings, About shows the new release number.

---

## Self-review

### Design requirements covered by this plan

| Requirement (from the design, Plan 4's hook or the brief) | Task |
|---|---|
| A small Google Apps Script receives the progress | 1 |
| Only new changes are sent, and sending the same change twice does no harm | 1, 2 |
| A secret code made in the app's Settings stops strangers from writing to the Sheet (and reading it) | 1, 2, 3 |
| Tabs Progress (one readable row per word), Log, Daily and Dashboard (counts and a 30-day chart) | 1, 2 |
| Sync at the end of each session, when the app is closed, when it opens after 12 or more hours, and on "Back up now" | 3 |
| Offline changes wait and are sent later | 2, 3, 5 |
| On a new phone, Settings, Restore pulls everything back | 2, 3, 5 |
| The user's 10-minute setup in `tools/apps_script/SETUP.md`: create the Sheet, paste the script and the code, run setup, deploy, paste the link into the app | 6, 11 |
| Plug into Plan 4's hooks exactly: `install({ on, store, data })`, hooks 'open', 'hidden', 'sessionEnd', 'settings'; `./sync.js` in `PLUGINS` and in `APP_FILES`; `RELEASE` raised | 2, 3, 4 |
| A backup problem never stops a study session | 3 (hooks return at once), 5 |
| Nothing secret committed or placed in `docs/`; values entered on the phone and kept in the browser | 3 (localStorage), 7 (publish check) |
| Public repository `hsk-flashcards` under Xiao-Wen-Tan, pushed with a browser sign-in | 9 |
| Pages from `main` and `/docs`, at `https://xiao-wen-tan.github.io/hsk-flashcards/` | 4 (`.nojekyll`), 10 |
| The site asks search engines not to list it | 8 (checked live), Choice 21 |
| Release checklist | Release checklist, 7, 8 |
| Phone checks: install, sound twice, airplane mode, update message, storage protected, Tap to continue, daily time | 12 |
| Sheet checks: rows after a backup, identical restore in a fresh browser, offline backup arrives, wrong code refused | 5, 12 |
| USER steps marked, with what Claude verifies afterwards | 9, 10, 11, 12 |
| Outputs never overwritten, relative paths, tests first, commits per task | every task |

### Left to other plans on purpose

- Plan 3 writes the words file and the audio, and Plan 4 the screens. This plan needs both before Task 9.
- Replacing Plan 2's guessed seconds per card with the measured minutes (Task 12 Step 3) is a later change to `config.js`, once two weeks of data exist.
