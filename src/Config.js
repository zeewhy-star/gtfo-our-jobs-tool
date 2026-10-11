/**
 * Config.js
 * Tab names, column headers, and default settings.
 *
 * Every tab and column from the system spec is created on setup, even the
 * ones later phases fill in, so nothing has to be migrated later.
 */

const TABS = {
  RAW: 'Raw',
  JOBS: 'Jobs',
  WATCHLIST: 'Watchlist',
  SOURCES: 'Sources',
  BLOCKLIST: 'Blocklist',
  SETTINGS: 'Settings',
  RUN_LOG: 'Run log',
  TEST_SET: 'Test set',
};

const HEADERS = {
  [TABS.RAW]: [
    'found_at', 'runner', 'source', 'external_id', 'title', 'employer', 'location',
    'salary_text', 'posted_text', 'apply_url', 'source_url', 'description', 'processed',
  ],
  [TABS.JOBS]: [
    'fingerprint', 'person', 'title', 'employer', 'location', 'arrangement',
    'salary_min', 'salary_max', 'sources_seen', 'source_tier', 'employer_apply_url',
    'employer_system_date', 'earliest_date_seen', 'first_seen_by_us', 'freshness',
    'ghost_flags', 'fit', 'load', 'want', 'stability', 'tier', 'reason',
    'keyword_gaps', 'status', 'notes', 'digested_at',
  ],
  [TABS.WATCHLIST]: [
    'employer', 'person', 'careers_system', 'board_token', 'active',
    'last_checked', 'last_success', 'consecutive_failures', 'last_error',
  ],
  [TABS.SOURCES]: [
    'name', 'type', 'tier', 'query_or_url', 'enabled', 'last_success', 'consecutive_failures',
  ],
  [TABS.BLOCKLIST]: ['domain_or_name', 'reason', 'date_added'],
  [TABS.SETTINGS]: ['key', 'value', 'notes'],
  [TABS.RUN_LOG]: [
    'timestamp', 'component', 'source', 'listings_found', 'new_jobs', 'errors',
    'api_cost', 'duration_sec',
  ],
  [TABS.TEST_SET]: [
    'posting_text', 'person', 'human_fit', 'human_load', 'human_want', 'human_stability',
    'human_tier', 'model_scores', 'model_tier', 'match',
  ],
};

/** Careers systems the collector knows how to read. */
const SUPPORTED_SYSTEMS = ['greenhouse', 'lever', 'workday'];

/** Freshness labels, in the order the digest shows them. */
const FRESHNESS = {
  VERIFIED: 'Verified fresh',
  LIKELY: 'Likely fresh',
  REPOST: 'Possible repost',
  OLD: 'Old',
};

/**
 * Default settings. setup() adds any key that is missing and never overwrites
 * a value someone already changed in the Settings tab.
 */
const DEFAULT_SETTINGS = [
  ['digest_recipients', 'zoyacoub@gmail.com, spottsclint@gmail.com', 'Comma-separated. Everyone here gets the combined morning digest.'],
  ['digest_hour', '7', 'Hour (Central) the digest is sent. Rerun setup() after changing it.'],
  ['collector_minutes', '15', 'How often the collector runs: 5, 10, 15, or 30. Rerun setup() after changing it.'],
  ['baseline_until', '', 'Set by setup() to 7 days after install. Until then, only Verified fresh jobs reach the digest.'],
  ['max_run_seconds', '25', 'The collector stops starting new work after this many seconds, to stay inside Google\'s daily run-time limit.'],
  ['max_employers_per_run', '40', 'Most employers checked per run. The rest are picked up next run.'],
  ['max_detail_fetches_per_run', '10', 'Extra Greenhouse lookups per run to find a posting\'s original publish date.'],
  ['failure_alert_threshold', '3', 'A source that fails this many runs in a row is listed in the digest.'],
  ['zeina_title_include', 'marketing, communications, content, seo, search, digital, brand, editorial, web, engagement, membership marketing', 'A title must contain at least one of these to count as Zeina\'s.'],
  ['zeina_title_exclude', 'intern, internship, assistant, coordinator, sales, nurse, physician, fellow, fellowship, part-time, temporary', 'A title with any of these is never Zeina\'s.'],
  ['clint_title_include', 'operations, program manager, project manager, program, project, business operations, governance, committee, budget, finance, administration', 'A title must contain at least one of these to count as Clint\'s.'],
  ['clint_title_exclude', 'intern, internship, nurse, physician, facilities, customer service, call center, driver, security officer, part-time, temporary', 'A title with any of these is never Clint\'s.'],
  ['zeina_linkedin_search_url', 'https://www.linkedin.com/search/results/content/?keywords=%23hiring%20marketing%20association&datePosted=%22past-24h%22', 'Saved LinkedIn post search linked from the digest. Paste in your own saved search to replace it.'],
  ['clint_linkedin_search_url', 'https://www.linkedin.com/search/results/content/?keywords=%23hiring%20operations%20association&datePosted=%22past-24h%22', 'Saved LinkedIn post search linked from the digest.'],
  ['claude_daily_cap_usd', '1', 'Phase 2: daily spending cap for Claude API scoring.'],
];

/**
 * The 65 employers marked Keep on the watchlist candidates tab. setup() adds
 * them as inactive rows. Each one goes active once someone fills in its
 * careers_system and board_token.
 */
const WATCHLIST_SEED = [
  ['American Medical Association', 'Both'],
  ['American Hospital Association', 'Both'],
  ['American Bar Association', 'Both'],
  ['American Library Association', 'Both'],
  ['American Dental Association', 'Both'],
  ['American College of Surgeons', 'Both'],
  ['American Marketing Association', 'Zeina'],
  ['HIMSS', 'Both'],
  ['American Society for Clinical Pathology', 'Both'],
  ['Academy of Nutrition and Dietetics', 'Both'],
  ['American Planning Association', 'Both'],
  ['American Osteopathic Association', 'Both'],
  ['Institute of Food Technologists', 'Both'],
  ['American Academy of Pediatrics', 'Both'],
  ['American Academy of Orthopaedic Surgeons', 'Both'],
  ['Radiological Society of North America', 'Both'],
  ['Society of Actuaries', 'Zeina'],
  ['Society of Critical Care Medicine', 'Both'],
  ['Rotary International', 'Both'],
  ['Lions Clubs International', 'Both'],
  ['National Association of Realtors', 'Both'],
  ['Association Forum', 'Both'],
  ['American Academy of Dermatology', 'Zeina'],
  ['Smithbucklin', 'Clint'],
  ['Association Management Center', 'Clint'],
  ['Feeding America', 'Both'],
  ['MacArthur Foundation', 'Both'],
  ['The Chicago Community Trust', 'Both'],
  ['Greater Chicago Food Depository', 'Both'],
  ['United Way of Metro Chicago', 'Both'],
  ['Field Museum', 'Both'],
  ['Northwestern Medicine', 'Both'],
  ['Rush University System for Health', 'Both'],
  ['UChicago Medicine', 'Both'],
  ['Lurie Children\'s Hospital', 'Both'],
  ['University of Chicago', 'Both'],
  ['Northwestern University', 'Both'],
  ['University of Illinois Chicago', 'Both'],
  ['Loyola University Chicago', 'Both'],
  ['Alliant Credit Union', 'Zeina'],
  ['BCU', 'Zeina'],
  ['Consumers Credit Union', 'Zeina'],
  ['Alzheimer\'s Association', 'Both'],
  ['Ronald McDonald House Charities', 'Both'],
  ['YMCA of Metro Chicago', 'Both'],
  ['Catholic Charities of Chicago', 'Both'],
  ['Heartland Alliance', 'Both'],
  ['Thresholds', 'Both'],
  ['Big Brothers Big Sisters of Metro Chicago', 'Both'],
  ['Habitat for Humanity Chicago', 'Both'],
  ['Make-A-Wish Illinois', 'Both'],
  ['Chicago Public Media (WBEZ)', 'Both'],
  ['WTTW', 'Both'],
  ['Shedd Aquarium', 'Both'],
  ['Art Institute of Chicago', 'Both'],
  ['Museum of Science and Industry', 'Both'],
  ['Lincoln Park Zoo', 'Both'],
  ['Chicago Botanic Garden', 'Both'],
  ['Morton Arboretum', 'Both'],
  ['Northern Illinois Food Bank', 'Both'],
  ['Joyce Foundation', 'Both'],
  ['McCormick Foundation', 'Both'],
  ['Chicago Architecture Center', 'Both'],
  ['OneGoal', 'Both'],
  ['Openlands', 'Both'],
];
