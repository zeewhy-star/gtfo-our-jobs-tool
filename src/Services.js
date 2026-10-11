/**
 * Services.js
 * The only file that talks to Google services directly: the Sheet, web
 * requests, script properties, and locks. Keeping them here keeps the rest
 * of the code testable.
 */

// ---------- Sheet access ----------

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('The "' + name + '" tab is missing. Run setup() from the Apps Script editor.');
  return s;
}

/** Read a tab into objects keyed by header, each with its sheet row number. */
function readObjects_(name) {
  const values = sheet_(name).getDataRange().getValues();
  if (values.length < 2) return [];
  const header = values[0];
  return values.slice(1).map(function (row, i) {
    const obj = { _row: i + 2 };
    header.forEach(function (h, j) { obj[h] = row[j]; });
    return obj;
  });
}

/** Append objects as rows, matching the tab's header order. */
function appendObjects_(name, objects) {
  if (!objects.length) return;
  const s = sheet_(name);
  const header = HEADERS[name];
  const rows = objects.map(function (o) {
    return header.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; });
  });
  s.getRange(s.getLastRow() + 1, 1, rows.length, header.length).setValues(rows);
}

/** Update named columns on one row. */
function updateRow_(name, rowNumber, patch) {
  const s = sheet_(name);
  const header = HEADERS[name];
  Object.keys(patch).forEach(function (key) {
    const col = header.indexOf(key);
    if (col === -1) throw new Error('Unknown column "' + key + '" on tab "' + name + '".');
    s.getRange(rowNumber, col + 1).setValue(patch[key]);
  });
}

/**
 * Stamp digested_at on many Jobs rows with one write instead of one write
 * per row, which matters after the first week's baseline adds thousands.
 */
function markDigested_(jobs, when) {
  if (!jobs.length) return;
  const s = sheet_(TABS.JOBS);
  const col = HEADERS[TABS.JOBS].indexOf('digested_at') + 1;
  const last = s.getLastRow();
  const range = s.getRange(2, col, last - 1, 1);
  const values = range.getValues();
  jobs.forEach(function (j) { values[j._row - 2][0] = when; });
  range.setValues(values);
}

/**
 * Write a watchlist row's last_checked, last_success, consecutive_failures,
 * and last_error in one call. Those four columns sit side by side.
 */
function setWatchStatus_(rowNumber, values) {
  const col = HEADERS[TABS.WATCHLIST].indexOf('last_checked') + 1;
  sheet_(TABS.WATCHLIST).getRange(rowNumber, col, 1, 4).setValues([values]);
}

/** All values in one column, without the header. */
function readColumn_(name, columnName) {
  const s = sheet_(name);
  const col = HEADERS[name].indexOf(columnName) + 1;
  const last = s.getLastRow();
  if (last < 2) return [];
  return s.getRange(2, col, last - 1, 1).getValues().map(function (r) { return r[0]; });
}

// ---------- Settings ----------

let settingsCache_ = null;

/** Settings tab as a {key: value} object, read once per run. */
function getSettings_() {
  if (settingsCache_) return settingsCache_;
  const out = {};
  readObjects_(TABS.SETTINGS).forEach(function (r) {
    if (r.key) out[String(r.key).trim()] = r.value;
  });
  settingsCache_ = out;
  return out;
}

function settingNumber_(cfg, key, fallback) {
  const n = Number(cfg[key]);
  return isFinite(n) && String(cfg[key]).trim() !== '' ? n : fallback;
}

// ---------- Web requests ----------

/**
 * GET or POST with up to 3 tries and growing waits. Throws with the status
 * code and a short body excerpt if every try fails.
 */
function fetchJson_(url, options) {
  const opts = Object.assign({ muteHttpExceptions: true, followRedirects: true }, options || {});
  opts.headers = Object.assign({ Accept: 'application/json' }, opts.headers || {});
  let lastError = '';
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = UrlFetchApp.fetch(url, opts);
      const code = res.getResponseCode();
      if (code >= 200 && code < 300) return JSON.parse(res.getContentText());
      lastError = 'HTTP ' + code + ': ' + truncate_(res.getContentText(), 200);
      // A 4xx other than rate limiting won't fix itself on a retry.
      if (code >= 400 && code < 500 && code !== 429) break;
    } catch (e) {
      lastError = String(e && e.message ? e.message : e);
    }
    if (attempt < 3) Utilities.sleep(1000 * attempt);
  }
  throw new Error(lastError || 'Request failed: ' + url);
}

// ---------- Locks and properties ----------

/** Run fn only if no other run of the same job is in progress. */
function withLock_(fn) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    console.log('Another run is still going; skipping this one.');
    return null;
  }
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function getProp_(key) {
  return PropertiesService.getScriptProperties().getProperty(key);
}

function setProp_(key, value) {
  PropertiesService.getScriptProperties().setProperty(key, String(value));
}

// ---------- Run log ----------

function logRun_(entry) {
  appendObjects_(TABS.RUN_LOG, [Object.assign({ timestamp: new Date() }, entry)]);
}
