const test = require('node:test');
const assert = require('node:assert/strict');
const { load, fixture } = require('./harness');

const g = load();
const NOW = new Date('2026-10-10T15:00:00Z'); // 10am Central

test('ADP cids are read from a bare id or a careers page address', () => {
  const cid = '1c4f1a20-df3f-4cd6-aa97-5b35b14125af';
  assert.equal(g.parseAdpCid_(cid), cid);
  assert.equal(g.parseAdpCid_(`https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=${cid}&ccId=19000101_000001`), cid);
  assert.equal(g.parseAdpCid_('not-a-cid'), '');
});

test('ADP jobs parse with post date, location, and yearly pay', () => {
  const cid = 'aa0ee485-1627-4e67-b9b5-67df4821b456';
  const jobs = g.parseAdpJobs_(fixture('adp.json'), 'ASCP', cid);
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].title, 'Senior Manager, Digital Content');
  assert.equal(jobs[0].location, 'Itasca, IL');
  assert.equal(jobs[0].salary_min, 100000);
  assert.equal(jobs[0].external_id, '545794');
  assert.match(jobs[0].apply_url, /cid=aa0ee485.*jobId=545794/);
  // Hourly pay becomes a yearly figure.
  assert.equal(jobs[1].salary_min, Math.round(30.69 * 2080));
  const fresh = g.labelFreshness_({ systemDate: jobs[0].system_date, precision: 'time', now: NOW, inBaseline: false });
  assert.equal(fresh.label, 'Verified fresh');
});

test('SmartRecruiters postings parse with release date and hybrid flag', () => {
  const jobs = g.parseSmartRecruitersPostings_(fixture('smartrecruiters.json'), 'Northwestern Medicine', 'NorthwesternMedicine');
  assert.equal(jobs.length, 2);
  assert.equal(jobs[0].arrangement, 'Hybrid');
  assert.equal(jobs[0].apply_url, 'https://jobs.smartrecruiters.com/NorthwesternMedicine/744000091234567');
  assert.equal(jobs[0].system_date, '2026-10-10T13:30:00.000Z');
  assert.equal(jobs[1].location, 'Lake Forest, IL');
});

test('Workable jobs parse with a day-precision date in Central time', () => {
  const jobs = g.parseWorkableJobs_(fixture('workable.json'), 'Make-A-Wish Illinois');
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, 'Chicago, Illinois');
  assert.equal(jobs[0].date_precision, 'day');
  assert.equal(jobs[0].apply_url, 'https://apply.workable.com/j/A1B2C3D4E5/apply');
  const fresh = g.labelFreshness_({ systemDate: jobs[0].system_date, precision: 'day', now: NOW, inBaseline: false });
  assert.equal(fresh.label, 'Verified fresh');
});

test('UltiPro tokens accept a tenant, a board path, or a full address', () => {
  assert.deepEqual({ ...g.parseUltiProToken_('THR1001THRSH') }, { tenant: 'THR1001THRSH', board: '' });
  const full = 'https://recruiting.ultipro.com/AME1058AMECS/JobBoard/fcdd5634-1774-41fd-982f-92b3b69e46c3/';
  assert.deepEqual({ ...g.parseUltiProToken_(full) }, { tenant: 'AME1058AMECS', board: 'fcdd5634-1774-41fd-982f-92b3b69e46c3' });
  assert.equal(g.parseUltiProToken_('!!'), null);
});

test('UltiPro opportunities parse with posted date and a detail link', () => {
  const parts = { tenant: 'AME1058AMECS', board: 'fcdd5634-1774-41fd-982f-92b3b69e46c3' };
  const jobs = g.parseUltiProJobs_(fixture('ultipro.json'), 'American College of Surgeons', parts);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].location, 'Chicago, IL');
  assert.equal(jobs[0].description, 'Coordinate committee operations.');
  assert.match(jobs[0].apply_url, /OpportunityDetail\?opportunityId=6b1f2a40/);
  const body = g.ultiProSearchBody_(50);
  assert.equal(body.opportunitySearch.OrderBy[0].Value, 'postedDateDesc');
});

test('the seeded watchlist turns on only rows the collector can read', () => {
  const rows = g.watchlistSeedRows_();
  assert.equal(rows.length, 65);
  const active = rows.filter((r) => r.active);
  assert.equal(active.length, 14);
  for (const r of active) {
    assert.ok(g.isWatchRowReady_(r), r.employer + ' should be ready');
    assert.ok(g.SUPPORTED_SYSTEMS.includes(r.careers_system));
  }
  for (const r of rows.filter((x) => !x.active)) assert.ok(r.notes, r.employer + ' needs a note');
  // Every Workday address in the seed parses.
  for (const r of rows.filter((x) => x.careers_system === 'workday')) assert.ok(g.parseWorkdayUrl_(r.board_token), r.employer);
  for (const r of rows.filter((x) => x.careers_system === 'adp')) assert.ok(g.parseAdpCid_(r.board_token), r.employer);
});
