/**
 * sources/SmartRecruiters.js
 * Reads an employer's public SmartRecruiters postings.
 *
 * Endpoint: https://api.smartrecruiters.com/v1/companies/{company}/postings
 * board_token on the Watchlist is the company name in jobs.smartrecruiters.com/{company}.
 */

/** Turn a SmartRecruiters postings response into standard listings. Pure. */
function parseSmartRecruitersPostings_(json, employer, company) {
  const postings = (json && json.content) || [];
  return postings.map(function (p) {
    const loc = p.location || {};
    const location = loc.fullLocation ||
      [loc.city, loc.region].filter(Boolean).join(', ') || (loc.remote ? 'Remote' : '');
    let arrangement = '';
    if (loc.remote) arrangement = 'Remote';
    else if (loc.hybrid) arrangement = 'Hybrid';
    else arrangement = detectArrangement_(location + ' ' + (p.name || ''));
    const url = 'https://jobs.smartrecruiters.com/' + company + '/' + p.id;
    return {
      source: 'smartrecruiters',
      external_id: String(p.id || p.uuid || ''),
      title: String(p.name || '').trim(),
      employer: employer,
      location: location,
      arrangement: arrangement,
      salary_text: '',
      salary_min: '',
      salary_max: '',
      posted_text: p.releasedDate || '',
      apply_url: url,
      source_url: url,
      description: '',
      system_date: p.releasedDate || '',
      date_precision: 'time',
    };
  });
}

function fetchSmartRecruiters_(company, employer) {
  const c = String(company).trim();
  const url = 'https://api.smartrecruiters.com/v1/companies/' + encodeURIComponent(c) + '/postings?limit=100';
  return parseSmartRecruitersPostings_(fetchJson_(url), employer, c);
}
