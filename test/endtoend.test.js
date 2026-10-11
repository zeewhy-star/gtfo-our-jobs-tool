// Runs setup(), runCollector(), and sendDigest() against in-memory fakes of
// Google's services: the closest thing to install day without Google.
const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fixture } = require('./harness');
const { makeServices } = require('./fakes');

const HOUR = 60 * 60 * 1000;

function leverBody() {
  const body = fixture('lever.json');
  body[0].createdAt = Date.now() - 2 * HOUR;    // posted 2 hours ago
  body[1].createdAt = Date.now() - 10 * 24 * HOUR; // posted 10 days ago
  return body;
}

function boot(responses) {
  const env = makeServices(responses);
  const g = load(env.services);
  const newRun = () => g.__run('settingsCache_ = null');
  return { env, g, newRun };
}

function tab(env, name) {
  const s = env.ss.getSheetByName(name);
  const rows = s.getDataRange().getValues();
  const header = rows[0];
  return rows.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

function setCell(env, tabName, rowIndex, column, value) {
  const s = env.ss.getSheetByName(tabName);
  const header = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0];
  s.set(rowIndex + 2, header.indexOf(column) + 1, value);
}

function activate(env, employer, system, token) {
  const i = tab(env, 'Watchlist').findIndex((w) => w.employer === employer);
  setCell(env, 'Watchlist', i, 'careers_system', system);
  setCell(env, 'Watchlist', i, 'board_token', token);
  setCell(env, 'Watchlist', i, 'active', true);
  return i;
}

function endBaseline(env) {
  const i = tab(env, 'Settings').findIndex((r) => r.key === 'baseline_until');
  setCell(env, 'Settings', i, 'value', new Date(Date.now() - HOUR));
}

test('setup creates every tab, settings, the watchlist, and two schedules', () => {
  const { env, g } = boot([]);
  g.setup();
  const names = env.ss.getSheets().map((s) => s.getName()).sort();
  assert.deepEqual(names, Object.keys(g.HEADERS).sort());
  assert.equal(tab(env, 'Watchlist').length, 65);
  assert.ok(tab(env, 'Settings').some((r) => r.key === 'digest_recipients'));
  const baseline = tab(env, 'Settings').find((r) => r.key === 'baseline_until').value;
  assert.ok(baseline instanceof Date || !isNaN(new Date(baseline)));
  assert.deepEqual(env.triggers.map((t) => t.fn).sort(), ['runCollector', 'sendDigest']);
  assert.equal(env.triggers.find((t) => t.fn === 'runCollector').everyMinutes, 15);
  assert.equal(env.triggers.find((t) => t.fn === 'sendDigest').atHour, 7);
});

test('running setup again keeps edits and does not duplicate anything', () => {
  const { env, g, newRun } = boot([]);
  g.setup();
  const i = tab(env, 'Settings').findIndex((r) => r.key === 'digest_hour');
  setCell(env, 'Settings', i, 'value', 8);
  newRun();
  g.setup();
  assert.equal(tab(env, 'Watchlist').length, 65);
  assert.equal(tab(env, 'Settings').filter((r) => r.key === 'digest_hour').length, 1);
  assert.equal(tab(env, 'Settings').find((r) => r.key === 'digest_hour').value, 8);
  assert.equal(env.triggers.length, 2);
  assert.equal(env.triggers.find((t) => t.fn === 'sendDigest').atHour, 8);
});

test('a full day: first check builds a baseline, new postings reach the digest once', () => {
  const lever = { match: 'api.lever.co/v0/postings/examplenp', body: leverBody() };
  const { env, g, newRun } = boot([lever]);
  g.setup();
  endBaseline(env);
  activate(env, 'Feeding America', 'lever', 'examplenp');

  // First check of this employer: everything open is Old.
  newRun();
  g.runCollector();
  let jobs = tab(env, 'Jobs');
  assert.equal(jobs.length, 2);
  assert.deepEqual(jobs.map((j) => j.freshness).sort(), ['Old', 'Verified fresh']);

  // The same postings on the next run add nothing.
  newRun();
  g.runCollector();
  assert.equal(tab(env, 'Jobs').length, 2);

  // A new posting appears an hour later.
  lever.body = leverBody().concat([{
    id: 'new-1', text: 'Senior Communications Manager', categories: { location: 'Chicago, IL' },
    createdAt: Date.now() - 0.5 * HOUR, hostedUrl: 'https://jobs.lever.co/examplenp/new-1', workplaceType: 'hybrid',
  }]);
  newRun();
  g.runCollector();
  jobs = tab(env, 'Jobs');
  assert.equal(jobs.length, 3);
  const added = jobs.find((j) => j.title === 'Senior Communications Manager');
  assert.equal(added.freshness, 'Verified fresh');
  assert.equal(added.person, 'Zeina');
  assert.equal(tab(env, 'Raw').length, 3);

  // Digest goes out once, then marks everything as sent.
  newRun();
  g.sendDigest();
  assert.equal(env.sent.length, 1);
  const mail = env.sent[0];
  assert.equal(mail.to, 'zoyacoub@gmail.com,spottsclint@gmail.com');
  assert.match(mail.htmlBody, /Senior Communications Manager/);
  assert.match(mail.htmlBody, /Program Manager, Member Engagement/);
  assert.ok(tab(env, 'Jobs').every((j) => j.digested_at));

  newRun();
  g.sendDigest();
  assert.match(env.sent[1].subject, /0 for Zeina, 0 for Clint/);

  const log = tab(env, 'Run log').map((r) => r.component);
  assert.deepEqual(log, ['setup', 'collector', 'collector', 'collector', 'digest', 'digest']);
});

test('a failing source is counted, logged, and listed in the digest', () => {
  const { env, g, newRun } = boot([{ match: 'api.lever.co/v0/postings/broken', code: 404, body: {} }]);
  g.setup();
  const i = activate(env, 'HIMSS', 'lever', 'broken');
  for (let run = 0; run < 3; run++) { newRun(); g.runCollector(); }
  const row = tab(env, 'Watchlist')[i];
  assert.equal(row.consecutive_failures, 3);
  assert.match(row.last_error, /HTTP 404/);
  assert.match(tab(env, 'Run log').at(-1).errors, /HIMSS: HTTP 404/);
  newRun();
  g.sendDigest();
  assert.match(env.sent[0].htmlBody, /HIMSS: failed 3 runs in a row/);
});

test('a 404 is not retried, but a server error is retried 3 times', () => {
  const { env, g, newRun } = boot([
    { match: 'postings/gone', code: 404, body: {} },
    { match: 'postings/flaky', code: 503, body: {} },
  ]);
  g.setup();
  activate(env, 'HIMSS', 'lever', 'gone');
  activate(env, 'WTTW', 'lever', 'flaky');
  newRun();
  g.runCollector();
  assert.equal(env.fetched.filter((f) => f.url.includes('gone')).length, 1);
  assert.equal(env.fetched.filter((f) => f.url.includes('flaky')).length, 3);
});

test('Workday sites are read with a POST to the careers site\'s own endpoint', () => {
  const wd = fixture('workday.json');
  const { env, g, newRun } = boot([{ match: 'example.wd1.myworkdayjobs.com/wday/cxs/example/External/jobs', body: wd }]);
  g.setup();
  endBaseline(env);
  const i = activate(env, 'Northwestern Medicine', 'workday', 'https://example.wd1.myworkdayjobs.com/en-US/External');
  // Pretend this employer was already checked once, so this run is normal.
  setCell(env, 'Watchlist', i, 'last_success', new Date(Date.now() - HOUR));
  newRun();
  g.runCollector();
  const call = env.fetched[0];
  assert.equal(call.opts.method, 'post');
  assert.equal(JSON.parse(call.opts.payload).limit, 20);
  const jobs = tab(env, 'Jobs');
  assert.equal(jobs.length, 3);
  assert.equal(jobs.find((j) => /SEO/.test(j.title)).freshness, 'Verified fresh');
});
