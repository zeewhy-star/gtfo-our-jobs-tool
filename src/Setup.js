/**
 * Setup.js
 * One-time setup and maintenance functions, run from the Apps Script editor.
 *
 *   setup()           Creates every tab, adds default settings and the
 *                     watchlist, and schedules the collector and digest.
 *                     Safe to run again: it never overwrites your edits.
 *   checkWatchlist()  Tries every active watchlist employer and logs how
 *                     many jobs each returned, without saving anything.
 *   removeTriggers()  Stops all scheduled runs.
 */

function setup() {
  const ss = ss_();
  Object.keys(HEADERS).forEach(function (name) { ensureTab_(ss, name); });

  const placeholder = ss.getSheetByName('Sheet1');
  if (placeholder && ss.getSheets().length > 1 && placeholder.getLastRow() === 0) {
    ss.deleteSheet(placeholder);
  }

  seedSettings_();
  seedWatchlist_();
  settingsCache_ = null;
  installTriggers_();

  logRun_({ component: 'setup', source: '', listings_found: '', new_jobs: '', errors: '', api_cost: 0, duration_sec: '' });
  console.log('Setup finished. Fill in careers_system and board_token on the Watchlist tab, set active to TRUE, then run checkWatchlist().');
}

/** Create a tab with its header row, or add any header columns it lacks. */
function ensureTab_(ss, name) {
  const header = HEADERS[name];
  let s = ss.getSheetByName(name);
  if (!s) s = ss.insertSheet(name);
  const current = s.getLastColumn() > 0
    ? s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]
    : [];
  const mismatch = header.some(function (h, i) { return current[i] !== h; });
  if (current.length && mismatch && s.getLastRow() > 1) {
    throw new Error('The "' + name + '" tab has data and its columns don\'t match the expected order. ' +
      'Fix the header row by hand before running setup() again.');
  }
  if (mismatch || !current.length) {
    s.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold');
  }
  s.setFrozenRows(1);
  return s;
}

function seedSettings_() {
  const existing = new Set(readObjects_(TABS.SETTINGS).map(function (r) { return String(r.key); }));
  const now = new Date();
  const rows = DEFAULT_SETTINGS
    .filter(function (r) { return !existing.has(r[0]); })
    .map(function (r) {
      let value = r[1];
      if (r[0] === 'baseline_until') value = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      return { key: r[0], value: value, notes: r[2] };
    });
  appendObjects_(TABS.SETTINGS, rows);
}

/** Add the starting watchlist once, inactive until board details are filled in. */
function seedWatchlist_() {
  if (readObjects_(TABS.WATCHLIST).length) return;
  appendObjects_(TABS.WATCHLIST, WATCHLIST_SEED.map(function (r) {
    return { employer: r[0], person: r[1], careers_system: '', board_token: '', active: false, consecutive_failures: 0 };
  }));
  const s = sheet_(TABS.WATCHLIST);
  const sysCol = HEADERS[TABS.WATCHLIST].indexOf('careers_system') + 1;
  const activeCol = HEADERS[TABS.WATCHLIST].indexOf('active') + 1;
  const n = WATCHLIST_SEED.length;
  s.getRange(2, sysCol, n, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(SUPPORTED_SYSTEMS.concat(['other']), true).build());
  s.getRange(2, activeCol, n, 1).insertCheckboxes();
}

/** Replace this project's triggers with the collector and digest schedules. */
function installTriggers_() {
  removeTriggers();
  const cfg = getSettings_();
  const minutes = settingNumber_(cfg, 'collector_minutes', 15);
  const allowed = [5, 10, 15, 30];
  ScriptApp.newTrigger('runCollector').timeBased()
    .everyMinutes(allowed.indexOf(minutes) !== -1 ? minutes : 15).create();
  ScriptApp.newTrigger('sendDigest').timeBased()
    .atHour(settingNumber_(cfg, 'digest_hour', 7)).everyDays(1).create();
}

function removeTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
}

/**
 * Check every active watchlist employer and log what comes back, without
 * writing jobs. Use it after filling in a board_token.
 */
function checkWatchlist() {
  const now = new Date();
  const rows = readObjects_(TABS.WATCHLIST).filter(isWatchRowReady_);
  if (!rows.length) {
    console.log('No active watchlist rows yet. Fill in careers_system and board_token, and tick active.');
    return;
  }
  rows.forEach(function (row) {
    try {
      const found = fetchForWatchRow_(row, now);
      const dated = found.filter(function (l) { return l.system_date; }).length;
      console.log(row.employer + ': ' + found.length + ' open jobs, ' + dated + ' with a posting date.');
    } catch (e) {
      console.log(row.employer + ': FAILED. ' + e);
    }
  });
}
