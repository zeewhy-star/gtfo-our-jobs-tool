# Notes for Claude Code

This repo is a Google Apps Script project for Zeina Yacoub and Clint Spotts's job search. The design lives in the System spec tab of the "Job Search Master Profiles" doc; README.md has the file map and runbook, and INSTALL.md has first-time setup.

## How the code is organized

- All calls to Google services (SpreadsheetApp, UrlFetchApp, MailApp, LockService, PropertiesService, ScriptApp) go in `src/Services.js` or the entry-point functions (`runCollector`, `sendDigest`, `setup`, `checkWatchlist`). Everything else stays pure so it can be tested in Node.
- Apps Script shares one global scope across files. Helper names end in `_` so they don't show up in the editor's Run menu; entry points don't.
- Every source in `src/sources/` returns listings in the same shape. Copy an existing parser when adding one, and add a saved sample response under `test/fixtures/`.
- Columns are defined once in `HEADERS` in `src/Config.js`. Never write a column that isn't there, and never reorder existing columns: the live Sheet depends on the order.

## Rules

- Run `npm test` before every push to Apps Script; `npm run push` does both.
- Never put API keys in code, the Sheet, or a commit. Keys go in Apps Script's Script Properties.
- `.clasp.json` holds the script ID for one person's copy and is not committed.
- Text that reaches Zeina or Clint (digest, alerts, logs they read) has no em dashes and no emojis, and follows the banlist at https://claudisms.ai/claudisms.md.
- Phase 4 writing (resumes, cover letters, prep briefs) belongs to the job-application-writer skill in the Claude app, not this code.
