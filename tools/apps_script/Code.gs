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
