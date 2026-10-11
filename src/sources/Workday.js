/**
 * sources/Workday.js
 * Reads an employer's public Workday careers site.
 *
 * board_token on the Watchlist is the careers page URL, for example
 * https://northwestern.wd5.myworkdayjobs.com/en-US/nu_careers
 * The collector calls the same JSON endpoint that page uses to list jobs.
 *
 * Workday only reports dates as "Posted Today", "Posted Yesterday", and so
 * on, so its dates have day precision.
 */

/** Split a Workday careers URL into host, tenant, and site. Pure. */
function parseWorkdayUrl_(url) {
  const m = String(url || '').trim()
    .match(/^https?:\/\/(([^./]+)\.(wd\d+)\.myworkdayjobs\.com)\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/?#]+)/);
  if (!m) return null;
  return { host: m[1], tenant: m[2], site: m[4] };
}

/**
 * "Posted Today" -> today's date, "Posted 3 Days Ago" -> three days back.
 * "Posted 30+ Days Ago" returns a date 30 days back. Pure.
 */
function parseWorkdayPostedOn_(text, now) {
  const t = String(text || '').toLowerCase();
  const base = new Date(now.getTime());
  base.setHours(0, 0, 0, 0);
  let days = null;
  if (/today/.test(t)) days = 0;
  else if (/yesterday/.test(t)) days = 1;
  else {
    const m = t.match(/(\d+)\+?\s*days?\s*ago/);
    if (m) days = Number(m[1]);
  }
  if (days === null) return '';
  return new Date(base.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/** Turn a Workday jobs response into standard listings. Pure. */
function parseWorkdayJobs_(json, employer, parts, now) {
  const postings = (json && json.jobPostings) || [];
  return postings.map(function (p) {
    const url = 'https://' + parts.host + '/' + parts.site + (p.externalPath || '');
    const reqId = (p.bulletFields && p.bulletFields[0]) || p.externalPath || '';
    const location = p.locationsText || '';
    return {
      source: 'workday',
      external_id: String(reqId),
      title: String(p.title || '').trim(),
      employer: employer,
      location: location,
      arrangement: detectArrangement_(location + ' ' + (p.remoteType || '')),
      salary_text: '',
      salary_min: '',
      salary_max: '',
      posted_text: p.postedOn || '',
      apply_url: url,
      source_url: url,
      description: '',
      system_date: parseWorkdayPostedOn_(p.postedOn, now),
      date_precision: 'day',
    };
  });
}

/** Fetch the newest jobs from a Workday site, up to `pages` pages of 20. */
function fetchWorkday_(careersUrl, employer, now, pages) {
  const parts = parseWorkdayUrl_(careersUrl);
  if (!parts) throw new Error('Not a Workday careers URL: ' + careersUrl);
  const endpoint = 'https://' + parts.host + '/wday/cxs/' + parts.tenant + '/' + parts.site + '/jobs';
  const all = [];
  const pageCount = pages || 2;
  for (let i = 0; i < pageCount; i++) {
    const json = fetchJson_(endpoint, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ appliedFacets: {}, limit: 20, offset: i * 20, searchText: '' }),
    });
    const batch = parseWorkdayJobs_(json, employer, parts, now);
    batch.forEach(function (b) { all.push(b); });
    if (batch.length < 20) break;
  }
  return all;
}
