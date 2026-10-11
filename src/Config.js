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
    'last_checked', 'last_success', 'consecutive_failures', 'last_error', 'notes',
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
const SUPPORTED_SYSTEMS = ['greenhouse', 'lever', 'workday', 'adp', 'ultipro', 'smartrecruiters', 'workable'];

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
 * The 65 employers marked Keep on the watchlist candidates tab, with the
 * careers system each one was found to use (researched October 10, 2026).
 *
 * Columns: employer, person, careers_system, board_token, notes.
 * setup() turns a row on (active) when its careers_system is one the
 * collector can read. Rows marked "other" stay off; their notes say which
 * system they use, so they can be added as more systems are supported.
 * "not found" means no careers system was identified yet.
 */
const WATCHLIST_SEED = [
  ['American Medical Association', 'Both', 'other', '', 'Cornerstone: ama-assn.csod.com'],
  ['American Hospital Association', 'Both', 'workday', 'https://aha.wd501.myworkdayjobs.com/AHA', ''],
  ['American Bar Association', 'Both', 'other', '', 'not found'],
  ['American Library Association', 'Both', 'ultipro', 'AME1043ALA', ''],
  ['American Dental Association', 'Both', 'other', '', 'not found'],
  ['American College of Surgeons', 'Both', 'ultipro', 'AME1058AMECS/JobBoard/fcdd5634-1774-41fd-982f-92b3b69e46c3', ''],
  ['American Marketing Association', 'Zeina', 'greenhouse', 'americanmarketingassociation', ''],
  ['HIMSS', 'Both', 'other', '', 'iCIMS: external-himss.icims.com'],
  ['American Society for Clinical Pathology', 'Both', 'adp', 'aa0ee485-1627-4e67-b9b5-67df4821b456', ''],
  ['Academy of Nutrition and Dietetics', 'Both', 'other', '', 'not found'],
  ['American Planning Association', 'Both', 'other', '', 'Posts on its own Jobs Online board at planning.org'],
  ['American Osteopathic Association', 'Both', 'other', '', 'not found'],
  ['Institute of Food Technologists', 'Both', 'other', '', 'not found'],
  ['American Academy of Pediatrics', 'Both', 'adp', '1c4f1a20-df3f-4cd6-aa97-5b35b14125af', ''],
  ['American Academy of Orthopaedic Surgeons', 'Both', 'other', '', 'PrimePay Recruit: aaos.primepay-recruit.com'],
  ['Radiological Society of North America', 'Both', 'adp', 'fba45fc1-8707-4a44-988e-5bfc07af47fc', ''],
  ['Society of Actuaries', 'Zeina', 'other', '', 'not found'],
  ['Society of Critical Care Medicine', 'Both', 'other', '', 'not found'],
  ['Rotary International', 'Both', 'other', '', 'Paycor: recruitingbypaycor.com'],
  ['Lions Clubs International', 'Both', 'other', '', 'not found'],
  ['National Association of Realtors', 'Both', 'other', '', 'ApplicantStack: realtors.applicantstack.com'],
  ['Association Forum', 'Both', 'other', '', 'not found'],
  ['American Academy of Dermatology', 'Zeina', 'adp', '14489640-cfbb-47bf-9e22-e45734a624c4', ''],
  ['Smithbucklin', 'Clint', 'other', '', 'Jobvite, via smithbucklin.com/careers/current-openings'],
  ['Association Management Center', 'Clint', 'other', '', 'not found'],
  ['Feeding America', 'Both', 'other', '', 'Jobvite: jobs.jobvite.com/feedingamerica'],
  ['MacArthur Foundation', 'Both', 'other', '', 'not found'],
  ['The Chicago Community Trust', 'Both', 'other', '', 'Posts openings on cct.org/careers'],
  ['Greater Chicago Food Depository', 'Both', 'other', '', 'Paycom, via chicagosfoodbank.org/careers'],
  ['United Way of Metro Chicago', 'Both', 'other', '', 'not found'],
  ['Field Museum', 'Both', 'other', '', 'not found'],
  ['Northwestern Medicine', 'Both', 'smartrecruiters', 'NorthwesternMedicine', ''],
  ['Rush University System for Health', 'Both', 'other', '', 'Infor, plus HealthcareSource for Rush Copley'],
  ['UChicago Medicine', 'Both', 'other', '', 'iCIMS: careers-ucm.icims.com'],
  ['Lurie Children\'s Hospital', 'Both', 'other', '', 'iCIMS: careers-luriechildrens.icims.com'],
  ['University of Chicago', 'Both', 'workday', 'https://uchicago.wd5.myworkdayjobs.com/External', ''],
  ['Northwestern University', 'Both', 'other', '', 'PeopleSoft: careers.northwestern.edu'],
  ['University of Illinois Chicago', 'Both', 'other', '', 'not found'],
  ['Loyola University Chicago', 'Both', 'other', '', 'PeopleAdmin: careers.luc.edu'],
  ['Alliant Credit Union', 'Zeina', 'other', '', 'iCIMS: careers-alliantcreditunion.icims.com'],
  ['BCU', 'Zeina', 'other', '', 'not found'],
  ['Consumers Credit Union', 'Zeina', 'other', '', 'not found'],
  ['Alzheimer\'s Association', 'Both', 'other', '', 'Paradox: jobs.alz.org'],
  ['Ronald McDonald House Charities', 'Both', 'other', '', 'not found'],
  ['YMCA of Metro Chicago', 'Both', 'other', '', 'not found'],
  ['Catholic Charities of Chicago', 'Both', 'other', '', 'not found'],
  ['Heartland Alliance', 'Both', 'other', '', 'not found'],
  ['Thresholds', 'Both', 'ultipro', 'THR1001THRSH', ''],
  ['Big Brothers Big Sisters of Metro Chicago', 'Both', 'other', '', 'Possibly Paylocity; not confirmed'],
  ['Habitat for Humanity Chicago', 'Both', 'other', '', 'not found'],
  ['Make-A-Wish Illinois', 'Both', 'workable', 'make-a-wish-illinois', ''],
  ['Chicago Public Media (WBEZ)', 'Both', 'greenhouse', 'cpm', ''],
  ['WTTW', 'Both', 'other', '', 'Taleo Business Edition: phe.tbe.taleo.net'],
  ['Shedd Aquarium', 'Both', 'other', '', 'ApplicantStack: sheddaquarium.applicantstack.com'],
  ['Art Institute of Chicago', 'Both', 'other', '', 'not found'],
  ['Museum of Science and Industry', 'Both', 'other', '', 'not found'],
  ['Lincoln Park Zoo', 'Both', 'other', '', 'not found'],
  ['Chicago Botanic Garden', 'Both', 'other', '', 'ADP, but its cid is behind a short link (tinyurl.com/CBGjobs); open it and copy the cid'],
  ['Morton Arboretum', 'Both', 'other', '', 'not found'],
  ['Northern Illinois Food Bank', 'Both', 'other', '', 'not found'],
  ['Joyce Foundation', 'Both', 'other', '', 'not found'],
  ['McCormick Foundation', 'Both', 'other', '', 'not found'],
  ['Chicago Architecture Center', 'Both', 'smartrecruiters', 'ChicagoArchitectureFoundation', 'SmartRecruiters account found in older postings; confirm with checkWatchlist()'],
  ['OneGoal', 'Both', 'other', '', 'not found'],
  ['Openlands', 'Both', 'other', '', 'not found'],
];
