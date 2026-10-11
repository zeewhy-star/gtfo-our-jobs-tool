const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fixture } = require('./harness');

const g = load();
const NOW = new Date('2026-10-10T15:00:00Z'); // 10am Central

const CFG = Object.fromEntries(g.DEFAULT_SETTINGS.map((r) => [r[0], r[1]]));
CFG.baseline_until = '';

// ---------- Text and fingerprints ----------

test('the same job on two boards gets the same fingerprint', () => {
  const a = g.fingerprint_('American Medical Association', 'Sr. Marketing Manager (Req #4471)', 'Chicago, IL');
  const b = g.fingerprint_('american medical association', 'Senior Marketing Manager', 'Chicago, Illinois');
  assert.equal(a, b);
});

test('remote locations share one key and arrangement tags are dropped', () => {
  const a = g.fingerprint_('Feeding America', 'Content Strategist - Remote', 'Remote - US');
  const b = g.fingerprint_('Feeding America', 'Content Strategist', 'Remote');
  assert.equal(a, b);
});

test('different titles at one employer get different fingerprints', () => {
  const a = g.fingerprint_('HIMSS', 'Marketing Manager', 'Chicago, IL');
  const b = g.fingerprint_('HIMSS', 'Senior Marketing Manager', 'Chicago, IL');
  assert.notEqual(a, b);
});

test('keywords match whole words only', () => {
  assert.equal(g.matchesAny_('SEO Strategist', ['seo']), true);
  assert.equal(g.matchesAny_('Museum Geologist', ['seo']), false);
  assert.equal(g.matchesAny_('Program Manager, Grants', ['program manager']), true);
});

test('titles are assigned to the right person', () => {
  assert.equal(g.assignPerson_('Senior Content Marketing Manager', 'Both', CFG), 'Zeina');
  assert.equal(g.assignPerson_('Operations Manager', 'Both', CFG), 'Clint');
  assert.equal(g.assignPerson_('Marketing Operations Manager', 'Both', CFG), 'Both');
  assert.equal(g.assignPerson_('Registered Nurse', 'Both', CFG), '');
  assert.equal(g.assignPerson_('Marketing Coordinator', 'Both', CFG), '');
  // An employer tracked only for Zeina never produces Clint's jobs.
  assert.equal(g.assignPerson_('Operations Manager', 'Zeina', CFG), '');
});

test('entity-escaped HTML becomes plain text', () => {
  const text = g.stripHtml_('&lt;p&gt;Lead &lt;strong&gt;comms&lt;/strong&gt; &amp;amp; SEO.&lt;/p&gt;');
  assert.equal(text, 'Lead comms & SEO.');
});

// ---------- Freshness ----------

test('an employer date within 24 hours is Verified fresh', () => {
  const r = g.labelFreshness_({ systemDate: '2026-10-10T12:00:00Z', precision: 'time', now: NOW, inBaseline: false });
  assert.equal(r.label, 'Verified fresh');
});

test('an older employer date is a Possible repost, and 30+ days is flagged', () => {
  const r = g.labelFreshness_({ systemDate: '2026-08-01T12:00:00Z', precision: 'time', now: NOW, inBaseline: false });
  assert.equal(r.label, 'Possible repost');
  assert.deepEqual([...r.ghostFlags], ['open 30+ days']);
});

test('no employer date is Likely fresh after the baseline and Old during it', () => {
  assert.equal(g.labelFreshness_({ systemDate: '', now: NOW, inBaseline: false }).label, 'Likely fresh');
  assert.equal(g.labelFreshness_({ systemDate: '', now: NOW, inBaseline: true }).label, 'Old');
});

test('baseline window is read from settings', () => {
  assert.equal(g.isInBaseline_('2026-10-17T15:00:00Z', NOW), true);
  assert.equal(g.isInBaseline_('2026-10-03T15:00:00Z', NOW), false);
  assert.equal(g.isInBaseline_('', NOW), false);
});

// ---------- Sources ----------

test('Greenhouse jobs parse with first_published as the posting date', () => {
  const jobs = g.parseGreenhouseJobs_(fixture('greenhouse.json'), 'Example Association');
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].title, 'Senior Content Marketing Manager (Remote)');
  assert.equal(jobs[0].system_date, '2026-10-10T08:30:00-04:00');
  assert.equal(jobs[0].arrangement, 'Remote');
  assert.match(jobs[0].description, /member communications & SEO program/);
  // updated_at is never used as the posting date.
  assert.equal(jobs[2].system_date, '');
});

test('Lever postings parse with salary and workplace type', () => {
  const jobs = g.parseLeverPostings_(fixture('lever.json'), 'Example Nonprofit');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].arrangement, 'Hybrid');
  assert.equal(jobs[0].salary_min, 92000);
  assert.equal(jobs[0].system_date, '2026-10-10T14:00:00.000Z');
  assert.equal(jobs[1].arrangement, 'Remote');
});

test('Workday careers URLs are split into host, tenant, and site', () => {
  const p = g.parseWorkdayUrl_('https://northwestern.wd5.myworkdayjobs.com/en-US/nu_careers?q=x');
  assert.deepEqual({ ...p }, { host: 'northwestern.wd5.myworkdayjobs.com', tenant: 'northwestern', site: 'nu_careers' });
  assert.equal(g.parseWorkdayUrl_('https://example.com/careers'), null);
});

test('Workday "Posted ..." text becomes a day-precision date', () => {
  const today = new Date(g.parseWorkdayPostedOn_('Posted Today', NOW));
  const three = new Date(g.parseWorkdayPostedOn_('Posted 3 Days Ago', NOW));
  assert.equal(Math.round((today - three) / 86400000), 3);
  assert.equal(g.parseWorkdayPostedOn_('Posted 30+ Days Ago', NOW) !== '', true);
  assert.equal(g.parseWorkdayPostedOn_('Something else', NOW), '');
});

test('Workday jobs parse with links built from the careers site', () => {
  const parts = g.parseWorkdayUrl_('https://example.wd1.myworkdayjobs.com/External');
  const jobs = g.parseWorkdayJobs_(fixture('workday.json'), 'Example Health', parts, NOW);
  assert.equal(jobs.length, 3);
  assert.equal(jobs[0].apply_url,
    'https://example.wd1.myworkdayjobs.com/External/job/Chicago-IL/Associate-Director--SEO-and-Content-Strategy_JR12345');
  assert.equal(jobs[0].arrangement, 'Hybrid');
  assert.equal(jobs[0].date_precision, 'day');
  assert.equal(jobs[0].external_id, 'JR12345');
});

// ---------- Collector logic ----------

function workdayListings() {
  const parts = g.parseWorkdayUrl_('https://example.wd1.myworkdayjobs.com/External');
  const jobs = g.parseWorkdayJobs_(fixture('workday.json'), 'Example Health', parts, NOW);
  jobs.forEach((j) => { j._watch = { person: 'Both', last_success: new Date('2026-10-09T15:00:00Z') }; });
  return jobs;
}

test('new jobs are labeled and assigned; already-seen fingerprints are skipped', () => {
  const listings = workdayListings();
  const first = g.buildNewJobs_(listings, [], [], CFG, NOW);
  assert.equal(first.jobs.length, 3);
  const byTitle = Object.fromEntries(first.jobs.map((j) => [j.title, j]));
  assert.equal(byTitle['Associate Director, SEO and Content Strategy'].freshness, 'Verified fresh');
  assert.equal(byTitle['Associate Director, SEO and Content Strategy'].person, 'Zeina');
  assert.equal(byTitle['Senior Project Manager'].freshness, 'Possible repost');
  assert.equal(byTitle['Senior Project Manager'].person, 'Clint');
  assert.equal(byTitle['Registered Nurse'].person, '');

  const again = g.buildNewJobs_(listings, first.jobs.map((j) => j.fingerprint), [], CFG, NOW);
  assert.equal(again.jobs.length, 0);
});

test('the same job listed twice in one run is kept once', () => {
  const listings = workdayListings();
  const dupe = { ...listings[0], external_id: 'other' };
  const r = g.buildNewJobs_([...listings, dupe], [], [], CFG, NOW);
  assert.equal(r.jobs.length, 3);
});

test('an employer\'s first check marks its open jobs Old instead of new', () => {
  const listings = workdayListings();
  listings.forEach((l) => { l._watch = { person: 'Both', last_success: '' }; });
  const r = g.buildNewJobs_(listings, [], [], CFG, NOW);
  const labels = [...r.jobs.map((j) => j.freshness)].sort();
  // Posted Today still proves it is new; the rest are Old.
  assert.deepEqual(labels, ['Old', 'Old', 'Verified fresh']);
});

test('Workday "Posted Yesterday" is not counted as verified fresh', () => {
  const date = g.parseWorkdayPostedOn_('Posted Yesterday', NOW);
  const r = g.labelFreshness_({ systemDate: date, precision: 'day', now: NOW, inBaseline: false });
  assert.equal(r.label, 'Possible repost');
});

test('blocked employers and domains are dropped', () => {
  const listings = workdayListings();
  assert.equal(g.buildNewJobs_(listings, [], ['Example Health'], CFG, NOW).jobs.length, 0);
  assert.equal(g.buildNewJobs_(listings, [], ['example.wd1.myworkdayjobs.com'], CFG, NOW).jobs.length, 0);
  assert.equal(g.buildNewJobs_(listings, [], ['Some Other Org'], CFG, NOW).jobs.length, 3);
});

test('the batch rotates through a long watchlist', () => {
  const rows = ['a', 'b', 'c', 'd', 'e'];
  const one = g.pickBatch_(rows, 0, 2);
  assert.deepEqual([...one.rows], ['a', 'b']);
  const two = g.pickBatch_(rows, one.nextCursor, 2);
  assert.deepEqual([...two.rows], ['c', 'd']);
  const three = g.pickBatch_(rows, two.nextCursor, 2);
  assert.deepEqual([...three.rows], ['e', 'a']);
  assert.deepEqual([...g.pickBatch_([], 3, 2).rows], []);
});

test('only active, filled-in watchlist rows are checked', () => {
  assert.equal(g.isWatchRowReady_({ active: true, careers_system: 'Workday', board_token: 'https://x.wd1.myworkdayjobs.com/s' }), true);
  assert.equal(g.isWatchRowReady_({ active: 'TRUE', careers_system: 'lever', board_token: 'x' }), true);
  assert.equal(g.isWatchRowReady_({ active: false, careers_system: 'lever', board_token: 'x' }), false);
  assert.equal(g.isWatchRowReady_({ active: true, careers_system: 'other', board_token: 'x' }), false);
  assert.equal(g.isWatchRowReady_({ active: true, careers_system: 'lever', board_token: '' }), false);
});

// ---------- Digest ----------

test('the digest groups by person, shows fresh jobs, and lists reposts separately', () => {
  const r = g.buildNewJobs_(workdayListings(), [], [], CFG, NOW);
  const failing = [{ employer: 'HIMSS', consecutive_failures: 4, last_error: 'HTTP 404' }];
  const d = g.buildDigest_(r.jobs, failing, 12, CFG, NOW);
  assert.match(d.subject, /1 for Zeina, 0 for Clint/);
  assert.match(d.html, /Associate Director, SEO and Content Strategy/);
  assert.match(d.html, /Possible reposts \(1\)/);
  assert.match(d.html, /HIMSS: failed 4 runs in a row/);
  assert.doesNotMatch(d.html, /Registered Nurse/);
  assert.equal(d.shownCount, 1);
});

test('a quiet day still sends a short digest', () => {
  const d = g.buildDigest_([], [], 0, CFG, NOW);
  assert.match(d.subject, /0 for Zeina, 0 for Clint/);
  assert.match(d.text, /No new matches/);
});

test('digest text has no em dashes or emojis', () => {
  const r = g.buildNewJobs_(workdayListings(), [], [], CFG, NOW);
  const d = g.buildDigest_(r.jobs, [], 3, CFG, NOW);
  for (const s of [d.subject, d.html, d.text]) {
    assert.doesNotMatch(s, /—/);
    assert.doesNotMatch(s, /\p{Extended_Pictographic}/u);
  }
});

test('rows written to Raw and Jobs only use columns those tabs have', () => {
  const r = g.buildNewJobs_(workdayListings(), [], [], CFG, NOW);
  const jobCols = new Set(g.HEADERS['Jobs']);
  const rawCols = new Set(g.HEADERS['Raw']);
  for (const j of r.jobs) {
    for (const k of Object.keys(j)) if (k !== '_greenhouse') assert.ok(jobCols.has(k), 'Jobs is missing column ' + k);
  }
  for (const row of r.raw) {
    for (const k of Object.keys(row)) assert.ok(rawCols.has(k), 'Raw is missing column ' + k);
  }
});

test('every setting the code reads has a default', () => {
  const keys = new Set(g.DEFAULT_SETTINGS.map((r) => r[0]));
  for (const k of ['digest_recipients', 'digest_hour', 'collector_minutes', 'baseline_until',
    'max_run_seconds', 'max_employers_per_run', 'max_detail_fetches_per_run', 'failure_alert_threshold',
    'zeina_title_include', 'zeina_title_exclude', 'clint_title_include', 'clint_title_exclude']) {
    assert.ok(keys.has(k), 'No default for ' + k);
  }
});
