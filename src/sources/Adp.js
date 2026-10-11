/**
 * sources/Adp.js
 * Reads an employer's ADP Workforce Now career center.
 *
 * board_token on the Watchlist is the `cid` value in the careers page
 * address, for example the part after cid= in
 * workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid=1c4f...
 * A full careers page address also works; the cid is pulled out of it.
 */

const ADP_BASE_ = 'https://workforcenow.adp.com/mascsr/default';

/** Accept a bare cid or a careers page address. Pure. */
function parseAdpCid_(token) {
  const t = String(token || '').trim();
  const m = t.match(/[?&]cid=([0-9a-f-]{36})/i);
  if (m) return m[1];
  return /^[0-9a-f-]{36}$/i.test(t) ? t : '';
}

/** Turn an ADP job-requisitions response into standard listings. Pure. */
function parseAdpJobs_(json, employer, cid) {
  const reqs = (json && json.jobRequisitions) || [];
  return reqs.map(function (r) {
    const locs = (r.requisitionLocations || []).map(function (l) {
      const a = l.address || {};
      const state = a.countrySubdivisionLevel1 ? a.countrySubdivisionLevel1.codeValue : '';
      return [a.cityName, state].filter(Boolean).join(', ') ||
        String((l.nameCode && l.nameCode.shortName) || '').trim();
    }).filter(Boolean);
    const location = locs.join('; ');
    const fields = (r.customFieldGroup && r.customFieldGroup.stringFields) || [];
    const externalId = readAdpField_(fields, 'ExternalJobID');
    const pay = r.payGradeRange || {};
    const min = pay.minimumRate ? pay.minimumRate.amountValue : '';
    const max = pay.maximumRate ? pay.maximumRate.amountValue : '';
    const hourly = /hour/i.test(readAdpField_(fields, 'SalaryRange'));
    const url = ADP_BASE_ + '/mdf/recruitment/recruitment.html?cid=' + cid +
      '&ccId=19000101_000001&type=MP&lang=en_US' + (externalId ? '&jobId=' + externalId : '');
    return {
      source: 'adp',
      external_id: String(externalId || r.itemID || ''),
      title: String(r.requisitionTitle || '').trim(),
      employer: employer,
      location: location,
      arrangement: detectArrangement_(location + ' ' + (r.requisitionTitle || '')),
      salary_text: readAdpField_(fields, 'SalaryRange'),
      // Hourly ranges are converted to a yearly figure so the salary floor
      // filter compares like with like (2,080 working hours a year).
      salary_min: min === '' ? '' : (hourly ? Math.round(min * 2080) : min),
      salary_max: max === '' ? '' : (hourly ? Math.round(max * 2080) : max),
      posted_text: r.postDate || '',
      apply_url: url,
      source_url: url,
      description: '',
      system_date: r.postDate || '',
      date_precision: 'time',
    };
  });
}

/** ADP sends custom fields either as an object or as a list of name/value pairs. */
function readAdpField_(fields, name) {
  if (!fields) return '';
  if (Array.isArray(fields)) {
    const hit = fields.find(function (f) { return f && (f.nameCode && f.nameCode.codeValue === name || f.name === name); });
    return hit ? String(hit.stringValue || hit.value || '') : '';
  }
  return fields[name] ? String(fields[name]) : '';
}

function fetchAdp_(token, employer) {
  const cid = parseAdpCid_(token);
  if (!cid) throw new Error('ADP board_token needs the cid from the careers page address.');
  const url = ADP_BASE_ + '/careercenter/public/events/staffing/v1/job-requisitions?cid=' + cid +
    '&ccId=19000101_000001&lang=en_US&locale=en_US&$top=100';
  return parseAdpJobs_(fetchJson_(url), employer, cid);
}
