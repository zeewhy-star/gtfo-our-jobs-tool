# GTFO our jobs tool

A job search system for Zeina and Clint. It checks target employers' careers sites every 15 minutes, keeps only postings it has never seen, labels how fresh each one is, and sends one combined digest at 7am Central.

It runs entirely in Google Apps Script, attached to a Google Sheet that serves as the database. The full design is the System spec tab in the Job Search Master Profiles doc.

## Where things are

| Path | What it holds |
| --- | --- |
| `src/Config.js` | Tab names, columns, default settings, and the starting watchlist |
| `src/Services.js` | Every call to Google: the Sheet, web requests, locks, the run log |
| `src/Text.js` | Fingerprints, keyword matching, and text cleanup |
| `src/Freshness.js` | The rules that label a posting Verified fresh, Likely fresh, Possible repost, or Old |
| `src/sources/` | One file per careers system: Greenhouse, Lever, Workday, ADP, UltiPro, SmartRecruiters, Workable |
| `src/Collector.js` | The 15-minute run |
| `src/Digest.js` | The 7am email |
| `src/Setup.js` | `setup()`, `checkWatchlist()`, `removeTriggers()` |
| `test/` | Tests that run on a laptop with saved sample responses, no Google needed |
| `INSTALL.md` | First-time install, step by step |

## Watchlist coverage

`setup()` adds all 65 kept employers, with the careers system each one was found to use in October 2026. 14 start active:

| System | Employers |
| --- | --- |
| ADP | American Academy of Dermatology, American Academy of Pediatrics, American Society for Clinical Pathology, Radiological Society of North America |
| UltiPro | American College of Surgeons, American Library Association, Thresholds |
| Workday | American Hospital Association, University of Chicago |
| Greenhouse | American Marketing Association, Chicago Public Media (WBEZ) |
| SmartRecruiters | Northwestern Medicine, Chicago Architecture Center |
| Workable | Make-A-Wish Illinois |

The other 51 start off, and their notes column says why:

- 17 use a system the collector can't read yet: iCIMS (4 employers), Jobvite (2), ApplicantStack (2), and one each on Cornerstone, Paycor, PrimePay, Paycom, Taleo, PeopleAdmin, PeopleSoft, Infor, and Paradox.
- 4 need a quick manual check: Chicago Botanic Garden is on ADP but its cid is behind a short link, Big Brothers Big Sisters may be on Paylocity, and the American Planning Association and Chicago Community Trust post on their own sites.
- 30 have no system identified yet.

Run `checkWatchlist()` on install day. The UltiPro and SmartRecruiters readers were built from those systems' published formats but couldn't be tested against the live sites from here, so that first check is what confirms them.

## Phase status

| Phase | Status |
| --- | --- |
| 1. Pipeline: Sheet, settings, run log, watchlist sources, fingerprints, plain digest | Built, needs its 7-day run |
| 2. Scoring with Claude Haiku 5.5 and tiers | Not started |
| 3. More sources, guardrails, instant alerts, health check | Not started |
| 4. Writing help | Handled by the job application writer skill in the Claude app |
| 5. Application tracking, and Clint's own copy | Not started |

Phase 1 is done when the digest arrives every morning for 7 days, with no duplicate jobs and every run in the Run log.

## Runbook

### Add an employer to the watchlist

1. Find the employer's careers page and look at the address of a job listing.
   - `job-boards.greenhouse.io/acme` or `boards.greenhouse.io/acme`: careers_system `greenhouse`, board_token `acme`
   - `jobs.lever.co/acme`: careers_system `lever`, board_token `acme`
   - `acme.wd5.myworkdayjobs.com/en-US/Careers`: careers_system `workday`, board_token is the full careers page address
   - `workforcenow.adp.com/...recruitment.html?cid=...`: careers_system `adp`, board_token is the cid (or paste the whole address)
   - `recruiting.ultipro.com/ACME1001ACME/JobBoard/...`: careers_system `ultipro`, board_token is the full job board address, or just the code after ultipro.com/
   - `jobs.smartrecruiters.com/Acme`: careers_system `smartrecruiters`, board_token `Acme`
   - `apply.workable.com/acme`: careers_system `workable`, board_token `acme`
   - Anything else (iCIMS, Jobvite, Paycom, Paylocity, ApplicantStack, Taleo, PeopleAdmin): mark it `other` and note the system in the notes column. Phase 3 adds the ones that come up most.
2. Fill in careers_system and board_token on the Watchlist tab and tick active.
3. In the Apps Script editor, run `checkWatchlist()`. The log shows how many open jobs each employer returned.

The first check of a new employer marks everything already open there as Old, so you won't get a flood of old jobs in the next digest.

### Change who gets the digest, or when

Edit `digest_recipients` or `digest_hour` on the Settings tab. After changing `digest_hour` or `collector_minutes`, run `setup()` again so the schedule updates. Running `setup()` again never erases your edits.

### Tune which titles count for each person

Edit `zeina_title_include`, `zeina_title_exclude`, `clint_title_include`, and `clint_title_exclude` on the Settings tab. They are comma-separated words or phrases and match whole words only, so `seo` matches "SEO Manager" but not "Geologist."

### Block an employer or a site

Add a row to the Blocklist tab. A name blocks that employer; anything with a dot, like `example.com`, blocks any job whose apply link contains it.

### The digest didn't arrive

1. Open the Run log tab. A `digest` row at 7am means it was sent: check spam, and check `digest_recipients`.
2. No `digest` row: in the Apps Script editor, open Triggers (the clock icon) and confirm `sendDigest` is listed. If it isn't, run `setup()`.
3. Open Executions (the list icon) for the error message from the failed run.

### A source keeps failing

The digest lists any employer that failed 3 runs in a row, with the error. A 404 usually means the board_token changed: check the employer's careers page and update it. To stop checking an employer, untick active.

### Stop everything

Run `removeTriggers()`. Run `setup()` to turn scheduled runs back on.

## Working on the code

Run the tests before every push:

```
npm test
```

Then push to Apps Script with `npm run push`, which runs the tests first and only pushes if they pass. Commit every change to GitHub so any version can be restored.

## Limits to know

- Google allows about 90 minutes of scheduled run time a day on a free account. Each collector run stops starting new work after `max_run_seconds` (25) and checks at most `max_employers_per_run` (40), picking up the rest next run. The Run log shows each run's duration.
- Google allows 100 email recipients a day on a free account. One digest to two people uses 2.
- Workday only reports posting dates by day ("Posted Today"), so Workday jobs are Verified fresh only on the day they were posted.
