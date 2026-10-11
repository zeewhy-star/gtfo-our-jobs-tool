/**
 * Freshness.js
 * Pure rules for labeling how new a posting is.
 *
 * Phase 1 uses two of the spec's four signals: the employer's own system
 * date and whether we have seen the fingerprint before (handled by the
 * collector, which only labels jobs it has never seen). The cross-board
 * date and ghost-job flags arrive in Phase 3.
 */

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

/**
 * @param {Object} p
 * @param {Date|string|null} p.systemDate  Employer's own publish date, if known.
 * @param {string} p.precision            'time' or 'day' (Workday only gives days).
 * @param {Date} p.now
 * @param {boolean} p.inBaseline          True during the first week after install.
 * @return {{label: string, ghostFlags: string[]}}
 */
function labelFreshness_(p) {
  const now = p.now instanceof Date ? p.now : new Date(p.now);
  const ghostFlags = [];
  const date = p.systemDate ? new Date(p.systemDate) : null;

  if (date && !isNaN(date.getTime())) {
    const ageMs = now.getTime() - date.getTime();
    // A day-precision date (Workday's "Posted Today") is stored as that
    // day's midnight, so under 24 hours means "posted today". Anything
    // older, including "Posted Yesterday", is not verified: a collector
    // running every 15 minutes would have seen it while it was still today.
    if (ageMs >= 30 * DAY_MS) ghostFlags.push('open 30+ days');
    if (ageMs < DAY_MS) return { label: FRESHNESS.VERIFIED, ghostFlags: ghostFlags };
    return { label: FRESHNESS.REPOST, ghostFlags: ghostFlags };
  }

  // No employer date: we can only trust that we haven't seen it before,
  // and that means nothing until the baseline week has built a history.
  return { label: p.inBaseline ? FRESHNESS.OLD : FRESHNESS.LIKELY, ghostFlags: ghostFlags };
}

/** True while the first-week baseline is still being built. */
function isInBaseline_(baselineUntil, now) {
  if (!baselineUntil) return false;
  const until = new Date(baselineUntil);
  if (isNaN(until.getTime())) return false;
  return now.getTime() < until.getTime();
}
