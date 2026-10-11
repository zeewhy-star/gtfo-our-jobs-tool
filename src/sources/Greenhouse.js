/**
 * sources/Greenhouse.js
 * Reads an employer's public Greenhouse job board.
 *
 * Endpoint: https://boards-api.greenhouse.io/v1/boards/{token}/jobs?content=true
 * board_token on the Watchlist is the slug in the careers URL, for example
 * "acme" in job-boards.greenhouse.io/acme.
 */

/** Turn a Greenhouse list response into standard listings. Pure. */
function parseGreenhouseJobs_(json, employer) {
  const jobs = (json && json.jobs) || [];
  return jobs.map(function (job) {
    const location = (job.location && job.location.name) || '';
    const description = stripHtml_(job.content || '');
    return {
      source: 'greenhouse',
      external_id: String(job.id),
      title: String(job.title || '').trim(),
      employer: employer,
      location: location,
      arrangement: detectArrangement_(location + ' ' + (job.title || '')),
      salary_text: '',
      salary_min: '',
      salary_max: '',
      posted_text: job.first_published || '',
      apply_url: job.absolute_url || '',
      source_url: job.absolute_url || '',
      description: description,
      // first_published is the original go-live date; updated_at changes on
      // every edit, so it is never used as the posting date.
      system_date: job.first_published || '',
      date_precision: 'time',
    };
  });
}

/** Fetch every open job on a Greenhouse board. */
function fetchGreenhouse_(token, employer) {
  const url = 'https://boards-api.greenhouse.io/v1/boards/' +
    encodeURIComponent(token) + '/jobs?content=true';
  return parseGreenhouseJobs_(fetchJson_(url), employer);
}

/**
 * Some boards leave first_published off the list response. For a job we
 * have never seen, look it up on the job's own endpoint.
 */
function fetchGreenhouseFirstPublished_(token, jobId) {
  const url = 'https://boards-api.greenhouse.io/v1/boards/' +
    encodeURIComponent(token) + '/jobs/' + encodeURIComponent(jobId);
  const json = fetchJson_(url);
  return (json && json.first_published) || '';
}
