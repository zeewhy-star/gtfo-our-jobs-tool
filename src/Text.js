/**
 * Text.js
 * Pure text helpers: normalizing, fingerprinting, keyword matching, HTML.
 * Nothing here calls a Google service, so all of it is covered by tests.
 */

/** Lowercase, strip accents and punctuation, collapse whitespace. */
function normalizeText_(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Normalize a job title so small differences between boards don't create
 * a second job: drops parentheticals, requisition numbers, and work
 * arrangement tags like "- Remote".
 */
function normalizeTitle_(title) {
  let t = String(title || '');
  t = t.replace(/\([^)]*\)/g, ' ');
  t = t.replace(/\[[^\]]*\]/g, ' ');
  t = t.replace(/\b(req|requisition|job)\s*(id|#|no\.?)?\s*[:#]?\s*[a-z]*-?\d+\b/gi, ' ');
  t = t.replace(/#\s*\d+/g, ' ');
  t = t.replace(/\b[A-Z]{1,4}-?\d{3,}\b/g, ' ');
  t = t.replace(/[-|,:]\s*(remote|hybrid|on-?site|in office)\b.*$/i, ' ');
  return normalizeText_(t)
    .replace(/\bsr\b/g, 'senior')
    .replace(/\bmgr\b/g, 'manager')
    .replace(/\bdir\b/g, 'director')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Remote jobs share one location key; others use the city. */
function normalizeLocation_(location) {
  const raw = String(location || '');
  if (/remote/i.test(raw)) return 'remote';
  const city = raw.split(/[,;/|]/)[0];
  return normalizeText_(city) || 'unknown';
}

/**
 * Fingerprint = employer | title | location. The same job seen on two
 * boards or in two runs gets the same fingerprint, which is what makes
 * duplicate and repost checks work.
 */
function fingerprint_(employer, title, location) {
  return [
    normalizeText_(employer),
    normalizeTitle_(title),
    normalizeLocation_(location),
  ].join('|');
}

/** "Remote", "Hybrid", or "" from any free text. */
function detectArrangement_(text) {
  const t = String(text || '');
  if (/hybrid/i.test(t)) return 'Hybrid';
  if (/remote|work from home|wfh/i.test(t)) return 'Remote';
  if (/on-?site|in office|in-office/i.test(t)) return 'On-site';
  return '';
}

/** Comma-separated setting value to a clean lowercase list. */
function splitList_(value) {
  return String(value || '')
    .split(',')
    .map(function (s) { return s.trim().toLowerCase(); })
    .filter(function (s) { return s.length > 0; });
}

function escapeRegExp_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when any keyword or phrase appears in the text as whole words. */
function matchesAny_(text, keywords) {
  const t = String(text || '');
  return (keywords || []).some(function (k) {
    if (!k) return false;
    return new RegExp('(^|[^a-z0-9])' + escapeRegExp_(k) + '([^a-z0-9]|$)', 'i').test(t);
  });
}

/**
 * Decide whose job a title is: "Zeina", "Clint", "Both", or "".
 * watchPerson limits it to the person the employer is tracked for.
 */
function assignPerson_(title, watchPerson, cfg) {
  const allowed = String(watchPerson || 'Both');
  const people = [];
  [['Zeina', 'zeina'], ['Clint', 'clint']].forEach(function (pair) {
    const name = pair[0];
    const key = pair[1];
    if (allowed !== 'Both' && allowed !== name) return;
    const include = splitList_(cfg[key + '_title_include']);
    const exclude = splitList_(cfg[key + '_title_exclude']);
    if (matchesAny_(title, include) && !matchesAny_(title, exclude)) people.push(name);
  });
  if (people.length === 2) return 'Both';
  return people[0] || '';
}

/** Decode the HTML entities job boards commonly send. */
function decodeEntities_(s) {
  return String(s || '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(Number(n)); })
    .replace(/&amp;/g, '&');
}

/** HTML (possibly entity-escaped) to plain text. */
function stripHtml_(html) {
  return decodeEntities_(decodeEntities_(html))
    .replace(/<\s*(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

function escapeHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Keep cells well under the Sheets 50,000-character limit. */
function truncate_(s, max) {
  const t = String(s || '');
  return t.length > max ? t.slice(0, max - 3) + '...' : t;
}
