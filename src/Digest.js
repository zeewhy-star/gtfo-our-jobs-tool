/**
 * Digest.js
 * The 7am combined digest for Zeina and Clint.
 *
 * Phase 1 sends a plain list of new matching jobs, grouped by person, with
 * freshness labels. Scores and tiers join it in Phase 2.
 */

/** Entry point for the daily trigger. Safe to run by hand too. */
function sendDigest() {
  return withLock_(function () {
    const started = Date.now();
    const now = new Date();
    const cfg = getSettings_();

    const pending = readObjects_(TABS.JOBS).filter(function (j) { return !j.digested_at; });
    const watch = readObjects_(TABS.WATCHLIST);
    const threshold = settingNumber_(cfg, 'failure_alert_threshold', 3);
    const failing = watch.filter(function (w) { return Number(w.consecutive_failures || 0) >= threshold; });
    const activeCount = watch.filter(isWatchRowReady_).length;

    const digest = buildDigest_(pending, failing, activeCount, cfg, now);
    const recipients = splitList_(cfg.digest_recipients).join(',');
    if (!recipients) throw new Error('Add at least one address to digest_recipients on the Settings tab.');

    MailApp.sendEmail({
      to: recipients,
      subject: digest.subject,
      body: digest.text,
      htmlBody: digest.html,
      name: 'Job search digest',
    });

    markDigested_(pending, now);

    logRun_({
      component: 'digest',
      source: '',
      listings_found: pending.length,
      new_jobs: digest.shownCount,
      errors: '',
      api_cost: 0,
      duration_sec: Math.round((Date.now() - started) / 100) / 10,
    });
    return digest;
  });
}

/**
 * Build the digest from jobs not yet sent. Pure, so the email layout is
 * covered by tests.
 *
 * @return {{subject: string, html: string, text: string, shownCount: number}}
 */
function buildDigest_(pending, failingSources, activeEmployerCount, cfg, now) {
  const show = [FRESHNESS.VERIFIED, FRESHNESS.LIKELY];
  const matched = pending.filter(function (j) { return j.person; });
  const fresh = matched.filter(function (j) { return show.indexOf(j.freshness) !== -1; });
  const reposts = matched.filter(function (j) { return j.freshness === FRESHNESS.REPOST; });

  const groups = {
    Zeina: fresh.filter(function (j) { return j.person === 'Zeina' || j.person === 'Both'; }),
    Clint: fresh.filter(function (j) { return j.person === 'Clint' || j.person === 'Both'; }),
  };
  Object.keys(groups).forEach(function (k) { groups[k].sort(compareFreshness_); });

  const dateText = Utilities.formatDate(now, 'America/Chicago', 'EEE, MMM d');
  const subject = 'Job digest for ' + dateText + ': ' +
    groups.Zeina.length + ' for Zeina, ' + groups.Clint.length + ' for Clint';

  const html = [];
  const text = [];
  html.push('<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#222;max-width:640px">');
  html.push('<h2 style="font-size:18px;margin:0 0 4px">Job digest, ' + escapeHtml_(dateText) + '</h2>');
  html.push('<p style="color:#666;margin:0 0 16px">' + activeEmployerCount + ' employers on the active watchlist. ' +
    pending.length + ' new postings checked since the last digest.</p>');
  text.push('Job digest, ' + dateText, activeEmployerCount + ' employers on the active watchlist. ' +
    pending.length + ' new postings checked since the last digest.', '');

  ['Zeina', 'Clint'].forEach(function (person) {
    const list = groups[person];
    html.push('<h3 style="font-size:16px;margin:20px 0 8px">' + person + ' (' + list.length + ')</h3>');
    text.push(person.toUpperCase() + ' (' + list.length + ')');
    if (!list.length) {
      html.push('<p style="color:#666;margin:0">No new matches.</p>');
      text.push('No new matches.');
    }
    list.forEach(function (j) {
      html.push(jobHtml_(j));
      text.push(jobText_(j));
    });
    const searchUrl = cfg[person.toLowerCase() + '_linkedin_search_url'];
    if (searchUrl) {
      html.push('<p style="margin:8px 0 0"><a href="' + escapeHtml_(searchUrl) + '">Check LinkedIn hiring posts from the past 24 hours</a></p>');
      text.push('LinkedIn hiring posts, past 24 hours: ' + searchUrl);
    }
    text.push('');
  });

  if (reposts.length) {
    html.push('<h3 style="font-size:16px;margin:20px 0 8px">Possible reposts (' + reposts.length + ')</h3>');
    html.push('<p style="color:#666;margin:0 0 8px">These were first published more than a day before we found them.</p>');
    text.push('POSSIBLE REPOSTS (' + reposts.length + ')');
    reposts.slice(0, 15).forEach(function (j) {
      html.push(jobHtml_(j));
      text.push(jobText_(j));
    });
    if (reposts.length > 15) {
      html.push('<p style="color:#666">Plus ' + (reposts.length - 15) + ' more in the Jobs tab.</p>');
      text.push('Plus ' + (reposts.length - 15) + ' more in the Jobs tab.');
    }
    text.push('');
  }

  if (failingSources.length) {
    html.push('<h3 style="font-size:16px;margin:20px 0 8px;color:#a33">Sources that need a look</h3><ul>');
    text.push('SOURCES THAT NEED A LOOK');
    failingSources.forEach(function (w) {
      const line = w.employer + ': failed ' + w.consecutive_failures + ' runs in a row. ' + (w.last_error || '');
      html.push('<li>' + escapeHtml_(line) + '</li>');
      text.push('- ' + line);
    });
    html.push('</ul>');
  }

  html.push('</div>');
  return {
    subject: subject,
    html: html.join('\n'),
    text: text.join('\n'),
    shownCount: groups.Zeina.length + groups.Clint.length,
  };
}

/** Verified fresh first, then newest first. */
function compareFreshness_(a, b) {
  const rank = function (j) { return j.freshness === FRESHNESS.VERIFIED ? 0 : 1; };
  if (rank(a) !== rank(b)) return rank(a) - rank(b);
  return new Date(b.first_seen_by_us).getTime() - new Date(a.first_seen_by_us).getTime();
}

function jobDetails_(j) {
  return [j.location, j.arrangement, salaryText_(j), j.freshness].filter(Boolean).join(' · ');
}

function salaryText_(j) {
  if (!j.salary_min && !j.salary_max) return '';
  const fmt = function (n) { return '$' + Math.round(Number(n) / 1000) + 'K'; };
  if (j.salary_min && j.salary_max) return fmt(j.salary_min) + ' to ' + fmt(j.salary_max);
  return fmt(j.salary_min || j.salary_max);
}

function jobHtml_(j) {
  const title = j.employer_apply_url
    ? '<a href="' + escapeHtml_(j.employer_apply_url) + '" style="font-weight:bold">' + escapeHtml_(j.title) + '</a>'
    : '<b>' + escapeHtml_(j.title) + '</b>';
  return '<p style="margin:0 0 10px">' + title + '<br>' + escapeHtml_(j.employer) +
    '<br><span style="color:#666">' + escapeHtml_(jobDetails_(j)) + '</span></p>';
}

function jobText_(j) {
  return '- ' + j.title + ', ' + j.employer + ' (' + jobDetails_(j) + ')' +
    (j.employer_apply_url ? '\n  ' + j.employer_apply_url : '');
}
