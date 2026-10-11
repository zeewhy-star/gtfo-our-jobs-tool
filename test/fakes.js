// In-memory stand-ins for the Google services the code uses, so setup(),
// runCollector(), and sendDigest() can run end to end in tests.

class FakeRange {
  constructor(sheet, row, col, numRows, numCols) {
    Object.assign(this, { sheet, row, col, numRows, numCols });
  }
  getValues() {
    const out = [];
    for (let r = 0; r < this.numRows; r++) {
      const line = [];
      for (let c = 0; c < this.numCols; c++) line.push(this.sheet.get(this.row + r, this.col + c));
      out.push(line);
    }
    return out;
  }
  setValues(values) {
    if (values.length !== this.numRows || values.some((v) => v.length !== this.numCols)) {
      throw new Error(`setValues shape ${values.length}x${values[0] && values[0].length} does not match range ${this.numRows}x${this.numCols}`);
    }
    values.forEach((line, r) => line.forEach((v, c) => this.sheet.set(this.row + r, this.col + c, v)));
    return this;
  }
  setValue(v) { this.sheet.set(this.row, this.col, v); return this; }
  setFontWeight() { return this; }
  setDataValidation() { return this; }
  insertCheckboxes() {
    for (let r = 0; r < this.numRows; r++) {
      if (this.sheet.get(this.row + r, this.col) === '') this.sheet.set(this.row + r, this.col, false);
    }
    return this;
  }
}

class FakeSheet {
  constructor(name) { this.name = name; this.cells = []; this.writes = 0; }
  get(r, c) { const row = this.cells[r - 1]; return row && row[c - 1] !== undefined ? row[c - 1] : ''; }
  set(r, c, v) {
    this.writes++;
    while (this.cells.length < r) this.cells.push([]);
    this.cells[r - 1][c - 1] = v;
  }
  getName() { return this.name; }
  getLastRow() {
    for (let i = this.cells.length; i > 0; i--) {
      if ((this.cells[i - 1] || []).some((v) => v !== '' && v !== undefined)) return i;
    }
    return 0;
  }
  getLastColumn() { return this.cells.reduce((m, row) => Math.max(m, row.length), 0); }
  getRange(row, col, numRows, numCols) { return new FakeRange(this, row, col, numRows || 1, numCols || 1); }
  getDataRange() { return new FakeRange(this, 1, 1, Math.max(this.getLastRow(), 1), Math.max(this.getLastColumn(), 1)); }
  setFrozenRows() {}
}

class FakeSpreadsheet {
  constructor() { this.sheets = [new FakeSheet('Sheet1')]; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new FakeSheet(n); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
}

function makeServices(responses) {
  const ss = new FakeSpreadsheet();
  const props = {};
  const triggers = [];
  const sent = [];
  const fetched = [];
  const chain = () => new Proxy({}, { get: (_, k) => (k === 'build' ? () => ({}) : () => chain()) });

  const services = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ss, newDataValidation: chain },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (k in props ? props[k] : null),
        setProperty: (k, v) => { props[k] = String(v); },
      }),
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock() {} }) },
    MailApp: { sendEmail: (m) => sent.push(m) },
    ScriptApp: {
      getProjectTriggers: () => triggers.slice(),
      deleteTrigger: (t) => triggers.splice(triggers.indexOf(t), 1),
      newTrigger: (fn) => {
        const t = { fn };
        const b = {
          timeBased: () => b,
          everyMinutes: (m) => { t.everyMinutes = m; return b; },
          atHour: (h) => { t.atHour = h; return b; },
          everyDays: () => b,
          create: () => { triggers.push(t); return t; },
        };
        return b;
      },
    },
    UrlFetchApp: {
      fetch: (url, opts) => {
        fetched.push({ url, opts });
        const match = responses.find((r) => url.includes(r.match));
        const code = match ? (match.code || 200) : 404;
        const body = match ? JSON.stringify(match.body) : 'not found';
        return { getResponseCode: () => code, getContentText: () => body };
      },
    },
  };
  return { services, ss, props, triggers, sent, fetched };
}

module.exports = { makeServices };
