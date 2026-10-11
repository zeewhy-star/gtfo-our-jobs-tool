/**
 * sources/Workable.js
 * Reads an employer's public Workable job widget.
 *
 * Endpoint: https://apply.workable.com/api/v1/widget/accounts/{account}
 * board_token on the Watchlist is the account name in apply.workable.com/{account}.
 * Workable reports the publish date without a time, so dates have day precision.
 */

/** Turn a Workable widget response into standard listings. Pure. */
function parseWorkableJobs_(json, employer) {
  const jobs = (json && json.jobs) || [];
  return jobs.map(function (j) {
    const location = [j.city, j.state].filter(Boolean).join(', ') || j.country || '';
    const published = j.published_on || j.created_at || '';
    let arrangement = j.telecommuting ? 'Remote' : '';
    if (!arrangement) arrangement = detectArrangement_(location + ' ' + (j.title || ''));
    return {
      source: 'workable',
      external_id: String(j.shortcode || j.code || ''),
      title: String(j.title || '').trim(),
      employer: employer,
      location: location,
      arrangement: arrangement,
      salary_text: '',
      salary_min: '',
      salary_max: '',
      posted_text: published,
      apply_url: j.application_url || j.url || j.shortlink || '',
      source_url: j.url || j.shortlink || '',
      description: stripHtml_(j.description || ''),
      system_date: published ? workableDate_(published) : '',
      date_precision: 'day',
    };
  });
}

/** "2026-10-10" means that day in Central time, not midnight UTC. */
function workableDate_(text) {
  const m = String(text).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return String(text);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).toISOString();
}

function fetchWorkable_(account, employer) {
  const url = 'https://apply.workable.com/api/v1/widget/accounts/' +
    encodeURIComponent(String(account).trim()) + '?details=true';
  return parseWorkableJobs_(fetchJson_(url), employer);
}
