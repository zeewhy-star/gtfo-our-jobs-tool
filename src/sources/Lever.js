/**
 * sources/Lever.js
 * Reads an employer's public Lever postings.
 *
 * Endpoint: https://api.lever.co/v0/postings/{site}?mode=json
 * board_token on the Watchlist is the slug in jobs.lever.co/{site}.
 */

/** Turn a Lever postings response into standard listings. Pure. */
function parseLeverPostings_(json, employer) {
  const postings = Array.isArray(json) ? json : [];
  return postings.map(function (p) {
    const cats = p.categories || {};
    const location = cats.location || (cats.allLocations || []).join('; ') || '';
    const range = p.salaryRange || null;
    const workplace = p.workplaceType || '';
    let arrangement = detectArrangement_(workplace + ' ' + location);
    if (workplace === 'onsite') arrangement = 'On-site';
    return {
      source: 'lever',
      external_id: String(p.id || ''),
      title: String(p.text || '').trim(),
      employer: employer,
      location: location,
      arrangement: arrangement,
      salary_text: range ? [range.currency, range.min, range.max, range.interval].filter(Boolean).join(' ') : '',
      salary_min: range && range.min ? range.min : '',
      salary_max: range && range.max ? range.max : '',
      posted_text: p.createdAt ? new Date(p.createdAt).toISOString() : '',
      apply_url: p.applyUrl || p.hostedUrl || '',
      source_url: p.hostedUrl || '',
      description: String(p.descriptionPlain || stripHtml_(p.description || '')).trim(),
      system_date: p.createdAt ? new Date(p.createdAt).toISOString() : '',
      date_precision: 'time',
    };
  });
}

function fetchLever_(site, employer) {
  const url = 'https://api.lever.co/v0/postings/' + encodeURIComponent(site) + '?mode=json';
  return parseLeverPostings_(fetchJson_(url), employer);
}
