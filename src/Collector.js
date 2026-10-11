/**
 * Collector.js
 * The fast collector: every 15 minutes it checks watchlist employers'
 * careers systems, keeps only jobs it has never seen, labels their
 * freshness, and writes them to the Raw and Jobs tabs.
 *
 * Scoring and instant alerts join this same run in Phases 2 and 3.
 */

/** Entry point for the time trigger. Safe to run by hand too. */
function runCollector() {
  return withLock_(function () {
    const started = Date.now();
    const now = new Date();
    const cfg = getSettings_();
    const maxSeconds = settingNumber_(cfg, 'max_run_seconds', 25);
    const maxEmployers = settingNumber_(cfg, 'max_employers_per_run', 40);

    const watch = readObjects_(TABS.WATCHLIST).filter(isWatchRowReady_);
    const cursor = Number(getProp_('collector_cursor') || 0);
    const batch = pickBatch_(watch, cursor, maxEmployers);

    const listings = [];
    const errors = [];
    let checked = 0;
    batch.rows.forEach(function (row) {
      if ((Date.now() - started) / 1000 > maxSeconds) return;
      checked++;
      try {
        const found = fetchForWatchRow_(row, now);
        found.forEach(function (l) { l._watch = row; });
        Array.prototype.push.apply(listings, found);
        setWatchStatus_(row._row, [now, now, 0, '']);
      } catch (e) {
        const msg = truncate_(String(e && e.message ? e.message : e), 300);
        errors.push(row.employer + ': ' + msg);
        setWatchStatus_(row._row, [
          now, row.last_success || '', Number(row.consecutive_failures || 0) + 1, msg,
        ]);
      }
    });
    // Advance only past the employers actually checked, so any skipped for
    // time are first in line next run.
    if (watch.length) setProp_('collector_cursor', (batch.start + checked) % watch.length);

    const existing = new Set(readColumn_(TABS.JOBS, 'fingerprint').map(String));
    const blocklist = readObjects_(TABS.BLOCKLIST).map(function (b) { return b.domain_or_name; });
    const result = buildNewJobs_(listings, existing, blocklist, cfg, now);

    fillGreenhouseDates_(result, cfg, now);

    appendObjects_(TABS.RAW, result.raw);
    appendObjects_(TABS.JOBS, result.jobs);

    logRun_({
      component: 'collector',
      source: checked + ' of ' + watch.length + ' employers',
      listings_found: listings.length,
      new_jobs: result.jobs.length,
      errors: truncate_(errors.join(' | '), 1000),
      api_cost: 0,
      duration_sec: Math.round((Date.now() - started) / 100) / 10,
    });
    return result;
  });
}

/** A watchlist row is checked only when it is active and fully filled in. */
function isWatchRowReady_(row) {
  const active = row.active === true || String(row.active).toUpperCase() === 'TRUE';
  const system = String(row.careers_system || '').toLowerCase().trim();
  return active && SUPPORTED_SYSTEMS.indexOf(system) !== -1 && String(row.board_token || '').trim() !== '';
}

/**
 * Take up to `max` rows starting at `cursor`, wrapping around, so a long
 * watchlist is covered across runs instead of overrunning one. Pure.
 */
function pickBatch_(rows, cursor, max) {
  if (!rows.length) return { rows: [], start: 0, nextCursor: 0 };
  const start = ((Number(cursor) || 0) % rows.length + rows.length) % rows.length;
  const count = Math.min(max, rows.length);
  const picked = [];
  for (let i = 0; i < count; i++) picked.push(rows[(start + i) % rows.length]);
  return { rows: picked, start: start, nextCursor: (start + count) % rows.length };
}

function fetchForWatchRow_(row, now) {
  const system = String(row.careers_system).toLowerCase().trim();
  const token = String(row.board_token).trim();
  if (system === 'greenhouse') return fetchGreenhouse_(token, row.employer);
  if (system === 'lever') return fetchLever_(token, row.employer);
  if (system === 'workday') return fetchWorkday_(token, row.employer, now, 2);
  throw new Error('Unsupported careers system: ' + row.careers_system);
}

/**
 * An employer added to the watchlist after install has never had a
 * successful check. Its first check builds that employer's own baseline, so
 * every job already open there isn't announced as new. Pure.
 */
function isFirstCheck_(watchRow) {
  return !!watchRow && !watchRow.last_success;
}

/** True when the employer or apply link matches a Blocklist entry. Pure. */
function isBlocked_(listing, blocklist) {
  const employer = normalizeText_(listing.employer);
  const url = String(listing.apply_url || '').toLowerCase();
  return (blocklist || []).some(function (entry) {
    const e = String(entry || '').trim().toLowerCase();
    if (!e) return false;
    if (e.indexOf('.') !== -1 && url.indexOf(e) !== -1) return true;
    return normalizeText_(e) === employer;
  });
}

/**
 * Turn fetched listings into rows for Raw and Jobs. Only fingerprints never
 * seen before become new rows, which is the "first seen by us" check. Pure.
 *
 * @return {{jobs: Object[], raw: Object[], skipped: number}}
 */
function buildNewJobs_(listings, existingFingerprints, blocklist, cfg, now) {
  const seen = new Set(existingFingerprints);
  const inBaseline = isInBaseline_(cfg.baseline_until, now);
  const jobs = [];
  const raw = [];
  let skipped = 0;

  listings.forEach(function (l) {
    if (!l.title) { skipped++; return; }
    if (isBlocked_(l, blocklist)) { skipped++; return; }
    const fp = fingerprint_(l.employer, l.title, l.location);
    if (seen.has(fp)) return;
    seen.add(fp);

    const watchPerson = l._watch ? l._watch.person : 'Both';
    const baseline = inBaseline || isFirstCheck_(l._watch);
    const fresh = labelFreshness_({
      systemDate: l.system_date, precision: l.date_precision, now: now, inBaseline: baseline,
    });
    // While a baseline is being built, only an employer date can prove a
    // job is new; everything else already open is simply Old.
    const label = baseline && fresh.label === FRESHNESS.REPOST ? FRESHNESS.OLD : fresh.label;

    raw.push({
      found_at: now, runner: 'collector', source: l.source, external_id: l.external_id,
      title: l.title, employer: l.employer, location: l.location,
      salary_text: l.salary_text, posted_text: l.posted_text, apply_url: l.apply_url,
      source_url: l.source_url, description: truncate_(l.description, 8000), processed: 'yes',
    });

    jobs.push({
      fingerprint: fp,
      person: assignPerson_(l.title, watchPerson, cfg),
      title: l.title,
      employer: l.employer,
      location: l.location,
      arrangement: l.arrangement,
      salary_min: l.salary_min,
      salary_max: l.salary_max,
      sources_seen: l.source,
      source_tier: 1,
      employer_apply_url: l.apply_url,
      employer_system_date: l.system_date ? new Date(l.system_date) : '',
      earliest_date_seen: l.system_date ? new Date(l.system_date) : now,
      first_seen_by_us: now,
      freshness: label,
      ghost_flags: fresh.ghostFlags.join(', '),
      status: 'New',
      _greenhouse: l.source === 'greenhouse' && !l.system_date ? l : null,
    });
  });

  return { jobs: jobs, raw: raw, skipped: skipped };
}

/**
 * For new Greenhouse jobs missing first_published, look it up and relabel.
 * Capped per run so a big board can't eat the run-time budget.
 */
function fillGreenhouseDates_(result, cfg, now) {
  const cap = settingNumber_(cfg, 'max_detail_fetches_per_run', 10);
  const inBaseline = isInBaseline_(cfg.baseline_until, now);
  let used = 0;
  result.jobs.forEach(function (job) {
    const l = job._greenhouse;
    delete job._greenhouse;
    if (!l || used >= cap) return;
    // An employer's first check builds its baseline; no lookups needed.
    if (isFirstCheck_(l._watch)) return;
    used++;
    try {
      const date = fetchGreenhouseFirstPublished_(l._watch.board_token, l.external_id);
      if (!date) return;
      const fresh = labelFreshness_({ systemDate: date, precision: 'time', now: now, inBaseline: inBaseline });
      job.employer_system_date = new Date(date);
      job.earliest_date_seen = new Date(date);
      job.freshness = inBaseline && fresh.label === FRESHNESS.REPOST ? FRESHNESS.OLD : fresh.label;
      job.ghost_flags = fresh.ghostFlags.join(', ');
    } catch (e) {
      console.log('Could not read Greenhouse date for ' + l.employer + ' job ' + l.external_id + ': ' + e);
    }
  });
}
