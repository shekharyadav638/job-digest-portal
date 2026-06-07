require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

// ── Pre-filter config ─────────────────────────────────────────────────────────

// If ANY of these appear in the title → reject immediately (not a tech role)
const REJECT_TITLE_WORDS = [
  'writer', 'copywriter', 'editor', 'proofreader', 'translator',
  'sales', 'account executive', 'account manager', 'business development',
  'marketing', 'seo', 'social media', 'content creator',
  'data analyst', 'business analyst', 'financial analyst', 'data labeling',
  'data annotation', 'data entry', 'transcription',
  'customer success', 'customer support', 'customer service', 'customer operations',
  'recruiter', 'talent acquisition', 'human resources',
  'office assistant', 'administrative', 'receptionist',
  'video editor', 'graphic designer', 'motion designer',
  'operations manager', 'director of revenue', 'director of sales',
  'inside sales', 'head of sales', 'vp of sales',
  'tutor', 'teacher', 'instructor', 'coach',
  'cinematic', 'freelance writer',
];

// If ANY of these appear in the title → keep (generic tech terms)
const TECH_TITLE_WORDS = [
  'engineer', 'developer', 'dev ', 'software', 'backend', 'front-end', 'frontend',
  'fullstack', 'full-stack', 'full stack', 'programmer', 'architect',
  'sde', 'swe', 'sde-1', 'sde-2', 'sde1', 'sde2',
  'node', 'react', 'python', 'java ', 'golang', 'ruby', 'rails', 'php',
  'typescript', 'javascript', '.net', 'scala', 'kotlin', 'swift',
  'devops', 'platform', 'infrastructure', 'cloud', 'sre', 'site reliability',
  'mobile', 'ios ', 'android', 'flutter',
  'machine learning', 'ml engineer', 'ai engineer', 'data engineer',
  'blockchain', 'web3', 'security engineer', 'cybersecurity',
  'tech lead', 'technical lead', 'staff engineer', 'principal engineer',
];

/**
 * Cheap title-based pre-filter — runs before any OpenAI call.
 * Keeps jobs whose title matches a preferred-role keyword or a known tech term,
 * and rejects jobs with obviously non-tech title words.
 */
function preFilterJobs(jobs, preferredRoles = []) {
  // Extract individual words from preferred roles as extra keywords
  const roleKeywords = preferredRoles
    .flatMap(r => r.toLowerCase().split(/[\s\-\/]+/))
    .filter(w => w.length > 2);

  const filtered = jobs.filter(job => {
    const title = job.title.toLowerCase();

    // Hard reject: non-tech title words
    if (REJECT_TITLE_WORDS.some(w => title.includes(w))) return false;

    // Keep: title matches a preferred role keyword
    if (roleKeywords.some(w => title.includes(w))) return true;

    // Keep: title matches a generic tech keyword
    return TECH_TITLE_WORDS.some(w => title.includes(w));
  });

  console.log(`[jobFetcher] Pre-filter: ${jobs.length} → ${filtered.length} jobs (removed ${jobs.length - filtered.length} non-tech)`);
  return filtered;
}

// ── Normalise ─────────────────────────────────────────────────────────────────

function normalise(job) {
  return {
    externalId: String(job.externalId),
    title: job.title || '',
    company: job.company || '',
    location: job.location || '',
    salary: job.salary || '',
    description: job.description || '',
    applyUrl: job.applyUrl || '',
    source: job.source,
  };
}

// ── Adzuna ────────────────────────────────────────────────────────────────────

function adzunaJob(j) {
  return normalise({
    externalId: `adzuna-${j.id}`,
    title: j.title,
    company: j.company?.display_name,
    location: j.location?.display_name,
    salary: j.salary_min
      ? `${Math.round(j.salary_min / 100000)}–${Math.round(j.salary_max / 100000)} LPA`
      : '',
    description: j.description,
    applyUrl: j.redirect_url,
    source: 'adzuna',
  });
}

async function fetchAdzunaPage(page, whatOr) {
  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID,
    app_key: ADZUNA_APP_KEY,
    results_per_page: '50',
    what_or: whatOr,
    sort_by: 'date',
    'content-type': 'application/json',
  });
  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params}`);
  if (!res.ok) throw new Error(`Adzuna page ${page} HTTP ${res.status}`);
  const data = await res.json();
  return data.results || [];
}

async function fetchAdzuna(preferredRoles) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.warn('[jobFetcher] Adzuna credentials missing, skipping');
    return [];
  }

  // Run two queries in parallel:
  // 1. preferred roles (OR match)
  // 2. tech stack keywords — catches more specific listings
  const roleQuery = preferredRoles.length > 0
    ? preferredRoles.slice(0, 5).join(' ')
    : 'backend developer software engineer';

  const techQuery = 'node.js express python django java spring backend developer';

  try {
    // Fetch pages 1-3 for role query + page 1 for tech query — all in parallel
    const [r1, r2, r3, t1] = await Promise.allSettled([
      fetchAdzunaPage(1, roleQuery),
      fetchAdzunaPage(2, roleQuery),
      fetchAdzunaPage(3, roleQuery),
      fetchAdzunaPage(1, techQuery),
    ]);

    const raw = [
      ...(r1.status === 'fulfilled' ? r1.value : []),
      ...(r2.status === 'fulfilled' ? r2.value : []),
      ...(r3.status === 'fulfilled' ? r3.value : []),
      ...(t1.status === 'fulfilled' ? t1.value : []),
    ];

    // Deduplicate by Adzuna job id
    const seen = new Set();
    const unique = raw.filter(j => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });

    console.log(`[jobFetcher] Adzuna returned ${unique.length} jobs (across 4 queries)`);
    return unique.map(adzunaJob);
  } catch (err) {
    console.error('[jobFetcher] Adzuna error:', err.message);
    return [];
  }
}

// ── Remotive ──────────────────────────────────────────────────────────────────
// Fetch by category only (no search term) — Remotive ignores category when
// search is provided. We rely on our own title pre-filter instead.

const REMOTIVE_CATEGORIES = ['software-dev', 'devops-sysadmin'];

async function fetchRemotive() {
  const results = await Promise.all(
    REMOTIVE_CATEGORIES.map(async category => {
      try {
        const res = await fetch(
          `https://remotive.com/api/remote-jobs?category=${category}&limit=30`
        );
        if (!res.ok) throw new Error(`Remotive HTTP ${res.status}`);
        const data = await res.json();
        return (data.jobs || []).map(j => normalise({
          externalId: `remotive-${j.id}`,
          title: j.title,
          company: j.company_name,
          location: j.candidate_required_location || 'Remote',
          salary: j.salary || '',
          description: j.description?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '',
          applyUrl: j.url,
          source: 'remotive',
        }));
      } catch (err) {
        console.error(`[jobFetcher] Remotive (${category}) error:`, err.message);
        return [];
      }
    })
  );

  // Deduplicate across categories by externalId
  const seen = new Set();
  return results.flat().filter(j => {
    if (seen.has(j.externalId)) return false;
    seen.add(j.externalId);
    return true;
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

/**
 * @param {Set}      existingIds    - external_ids already in DB for this user
 * @param {string[]} preferredRoles - user's selected job roles
 */
async function fetchJobs(existingIds = new Set(), preferredRoles = []) {
  const [adzuna, remotive] = await Promise.all([
    fetchAdzuna(preferredRoles),
    fetchRemotive(),
  ]);

  const all = [...adzuna, ...remotive];

  // 1. Dedup against DB
  const fresh = all.filter(j => !existingIds.has(j.externalId));

  // 2. Cheap title pre-filter before any OpenAI call
  const relevant = preFilterJobs(fresh, preferredRoles);

  console.log(`[jobFetcher] Fetched ${all.length} total → ${fresh.length} new → ${relevant.length} after pre-filter`);
  return relevant;
}

module.exports = { fetchJobs };
