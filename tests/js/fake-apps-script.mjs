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
