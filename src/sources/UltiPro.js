/**
 * sources/UltiPro.js
 * Reads an employer's UKG (UltiPro) Recruiting job board.
 *
 * board_token on the Watchlist is either the full job board address,
 * recruiting.ultipro.com/{TENANT}/JobBoard/{board id}, or just the tenant
 * code ({TENANT}); with only the tenant, the board id is looked up from the
 * address the tenant page forwards to.
 *
 * The board is read with the same search call its own page makes, sorted
 * newest first.
 */

/** Split a token into tenant and board id (board id may be empty). Pure. */
function parseUltiProToken_(token) {
  const t = String(token || '').trim().replace(/^https?:\/\/recruiting\.ultipro\.com\//i, '');
  const m = t.match(/^([A-Za-z0-9]+)(?:\/JobBoard\/([0-9a-f-]{36}))?/i);
  if (!m) return null;
  return { tenant: m[1], board: m[2] || '' };
}

/** Turn a LoadSearchResults response into standard listings. Pure. */
function parseUltiProJobs_(json, employer, parts) {
  const opps = (json && (json.opportunities || json.Opportunities)) || [];
  return opps.map(function (o) {
    const locs = (o.Locations || []).map(function (l) {
      const a = l.Address || {};
      const state = a.State ? (a.State.Code || a.State.Name) : '';
      return [a.City, state].filter(Boolean).join(', ') || l.LocalizedDescription || '';
    }).filter(Boolean);
    const location = locs.join('; ');
    const url = 'https://recruiting.ultipro.com/' + parts.tenant + '/JobBoard/' + parts.board +
      '/OpportunityDetail?opportunityId=' + o.Id;
    return {
      source: 'ultipro',
      external_id: String(o.Id || o.RequisitionNumber || ''),
      title: String(o.Title || '').trim(),
      employer: employer,
      location: location,
      arrangement: detectArrangement_(location + ' ' + (o.Title || '') + ' ' + (o.JobLocationType || '')),
      salary_text: '',
      salary_min: '',
      salary_max: '',
      posted_text: o.PostedDate || '',
      apply_url: url,
      source_url: url,
      description: stripHtml_(o.BriefDescription || ''),
      system_date: o.PostedDate || '',
      date_precision: 'time',
    };
  });
}

/** The request body the job board page itself sends. Pure. */
function ultiProSearchBody_(top) {
  return {
    opportunitySearch: {
      Top: top || 50,
      Skip: 0,
      QueryString: '',
      OrderBy: [{ Value: 'postedDateDesc', PropertyName: 'PostedDate', Ascending: false }],
      Filters: [
        { t: 'TermsSearchFilterDto', fieldName: 4, extra: null, values: [] },
        { t: 'TermsSearchFilterDto', fieldName: 5, extra: null, values: [] },
        { t: 'TermsSearchFilterDto', fieldName: 6, extra: null, values: [] },
      ],
    },
    matchCriteria: {
      PreferredJobs: [], Educations: [], LicenseAndCertifications: [], Skills: [],
      hasNoLicenses: false, SkippedSkills: [],
    },
  };
}

/** Find a tenant's board id from where its home page forwards. */
function resolveUltiProBoard_(tenant) {
  const res = UrlFetchApp.fetch('https://recruiting.ultipro.com/' + tenant,
    { followRedirects: false, muteHttpExceptions: true });
  const headers = res.getHeaders();
  const location = headers.Location || headers.location || '';
  const m = String(location).match(/JobBoard\/([0-9a-f-]{36})/i);
  if (!m) throw new Error('Could not find the UltiPro job board for ' + tenant +
    '. Paste the full job board address into board_token instead.');
  return m[1];
}

function fetchUltiPro_(token, employer) {
  const parts = parseUltiProToken_(token);
  if (!parts) throw new Error('UltiPro board_token should look like TENANT or TENANT/JobBoard/{id}.');
  if (!parts.board) parts.board = resolveUltiProBoard_(parts.tenant);
  const url = 'https://recruiting.ultipro.com/' + parts.tenant + '/JobBoard/' + parts.board +
    '/JobBoardView/LoadSearchResults';
  const json = fetchJson_(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(ultiProSearchBody_(50)),
  });
  return parseUltiProJobs_(json, employer, parts);
}
