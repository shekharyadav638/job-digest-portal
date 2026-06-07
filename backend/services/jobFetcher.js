require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ADZUNA_APP_ID  = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;
const JSEARCH_API_KEY = process.env.JSEARCH_API_KEY; // optional — openwebninja.com free key

// ── Pre-filter ────────────────────────────────────────────────────────────────

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
  'cinematic', 'freelance writer', 'product manager', 'project manager',
];

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

function preFilterJobs(jobs, preferredRoles = []) {
  const roleKeywords = preferredRoles
    .flatMap(r => r.toLowerCase().split(/[\s\-\/]+/))
    .filter(w => w.length > 2);

  const filtered = jobs.filter(job => {
    const title = job.title.toLowerCase();
    if (REJECT_TITLE_WORDS.some(w => title.includes(w))) return false;
    if (roleKeywords.some(w => title.includes(w))) return true;
    return TECH_TITLE_WORDS.some(w => title.includes(w));
  });

  console.log(`[jobFetcher] Pre-filter: ${jobs.length} → ${filtered.length} (removed ${jobs.length - filtered.length} non-tech)`);
  return filtered;
}

// ── Normalise ─────────────────────────────────────────────────────────────────

function normalise(job) {
  return {
    externalId: String(job.externalId),
    title:      job.title       || '',
    company:    job.company     || '',
    location:   job.location    || '',
    salary:     job.salary      || '',
    description:job.description || '',
    applyUrl:   job.applyUrl    || '',
    source:     job.source,
  };
}

function stripHtml(str = '') {
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

// ── Adzuna (India) ────────────────────────────────────────────────────────────

async function fetchAdzunaPage(page, whatOr) {
  const params = new URLSearchParams({
    app_id: ADZUNA_APP_ID, app_key: ADZUNA_APP_KEY,
    results_per_page: '50', what_or: whatOr, sort_by: 'date',
    'content-type': 'application/json',
  });
  const res = await fetch(`https://api.adzuna.com/v1/api/jobs/in/search/${page}?${params}`);
  if (!res.ok) throw new Error(`Adzuna p${page} HTTP ${res.status}`);
  return (await res.json()).results || [];
}

async function fetchAdzuna(preferredRoles) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.warn('[jobFetcher] Adzuna credentials missing, skipping');
    return [];
  }
  const roleQuery = preferredRoles.length > 0
    ? preferredRoles.slice(0, 5).join(' ')
    : 'backend developer software engineer';
  const techQuery = 'node.js python java spring backend developer software engineer';

  const settled = await Promise.allSettled([
    fetchAdzunaPage(1, roleQuery),
    fetchAdzunaPage(2, roleQuery),
    fetchAdzunaPage(3, roleQuery),
    fetchAdzunaPage(1, techQuery),
  ]);

  const raw = settled.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const seen = new Set();
  const unique = raw.filter(j => { if (seen.has(j.id)) return false; seen.add(j.id); return true; });

  console.log(`[jobFetcher] Adzuna: ${unique.length} jobs`);
  return unique.map(j => normalise({
    externalId: `adzuna-${j.id}`,
    title: j.title, company: j.company?.display_name,
    location: j.location?.display_name,
    salary: j.salary_min ? `${Math.round(j.salary_min/100000)}–${Math.round(j.salary_max/100000)} LPA` : '',
    description: j.description, applyUrl: j.redirect_url, source: 'adzuna',
  }));
}

// ── JSearch — Google for Jobs (indexes Naukri, LinkedIn India, Indeed India) ──
// Free key: https://openwebninja.com  (200 req/month free)

async function fetchJSearch(preferredRoles) {
  if (!JSEARCH_API_KEY) return [];

  const queries = [
    `${preferredRoles.slice(0, 2).join(' OR ')} in India`,
    `remote ${preferredRoles[0] || 'software engineer'}`,
  ];

  const settled = await Promise.allSettled(queries.map(q =>
    fetch(`https://api.openwebninja.com/jsearch/search-v2?query=${encodeURIComponent(q)}&country=in&num_pages=1`, {
      headers: { 'x-api-key': JSEARCH_API_KEY },
    }).then(r => r.ok ? r.json() : Promise.reject(`JSearch HTTP ${r.status}`))
  ));

  const raw = settled.flatMap(r => r.status === 'fulfilled' ? (r.value.data || []) : []);
  const seen = new Set();
  const unique = raw.filter(j => { if (seen.has(j.job_id)) return false; seen.add(j.job_id); return true; });

  console.log(`[jobFetcher] JSearch: ${unique.length} jobs`);
  return unique.map(j => normalise({
    externalId: `jsearch-${j.job_id}`,
    title: j.job_title, company: j.employer_name,
    location: j.job_city ? `${j.job_city}, ${j.job_country}` : (j.job_country || 'India'),
    salary: j.job_salary_currency
      ? `${j.job_salary_currency}${j.job_min_salary || ''}–${j.job_max_salary || ''}`
      : '',
    description: j.job_description?.slice(0, 2000) || '',
    applyUrl: j.job_apply_link, source: 'jsearch',
  }));
}

// ── RemoteOK ──────────────────────────────────────────────────────────────────
// No auth needed. Tech-focused remote jobs.

const REMOTEOK_TAG_MAP = {
  'node': 'node', 'node.js': 'node', 'express': 'node',
  'react': 'react', 'frontend': 'react',
  'python': 'python', 'django': 'python', 'flask': 'python',
  'java': 'java', 'spring': 'java',
  'golang': 'golang', 'go ': 'golang',
  'ruby': 'ruby', 'rails': 'ruby',
  'devops': 'devops', 'kubernetes': 'devops', 'docker': 'devops',
  'backend': 'backend',
  'typescript': 'typescript',
  'php': 'php',
  'kotlin': 'kotlin',
  'swift': 'ios',
  'android': 'android',
};

async function fetchRemoteOK(preferredRoles) {
  // Map preferred roles to RemoteOK tags
  const tags = new Set(['backend', 'software']);
  for (const role of preferredRoles) {
    const lower = role.toLowerCase();
    for (const [key, tag] of Object.entries(REMOTEOK_TAG_MAP)) {
      if (lower.includes(key)) tags.add(tag);
    }
  }

  const tagList = [...tags].slice(0, 4);
  const settled = await Promise.allSettled(
    tagList.map(tag =>
      fetch(`https://remoteok.com/api?tags=${tag}`, {
        headers: { 'User-Agent': 'JobDigestPortal/1.0 (job-digest-portal)' },
      }).then(r => r.ok ? r.json() : Promise.reject(`RemoteOK HTTP ${r.status}`))
    )
  );

  const seen = new Set();
  const jobs = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    const arr = Array.isArray(r.value) ? r.value.slice(1) : []; // skip legal notice at index 0
    for (const j of arr) {
      if (!j.id || seen.has(j.id)) continue;
      seen.add(j.id);
      jobs.push(normalise({
        externalId: `remoteok-${j.id}`,
        title: j.position, company: j.company,
        location: j.location || 'Remote',
        salary: j.salary || '',
        description: j.description ? stripHtml(j.description) : (j.tags || []).join(', '),
        applyUrl: j.url, source: 'remoteok',
      }));
    }
  }

  console.log(`[jobFetcher] RemoteOK: ${jobs.length} jobs`);
  return jobs;
}

// ── Himalayas ─────────────────────────────────────────────────────────────────
// No auth needed. Has seniority=Junior filter — great for SDE-1.

async function fetchHimalayas(preferredRoles) {
  const query = preferredRoles.slice(0, 2).join(' ') || 'software engineer';
  const settled = await Promise.allSettled([
    fetch(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent(query)}&seniority=Junior&sort=recent`).then(r => r.ok ? r.json() : Promise.reject()),
    fetch(`https://himalayas.app/jobs/api/search?q=${encodeURIComponent('backend developer')}&seniority=Junior&sort=recent`).then(r => r.ok ? r.json() : Promise.reject()),
  ]);

  const seen = new Set();
  const jobs = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const j of (r.value.jobs || [])) {
      if (!j.id || seen.has(j.id)) continue;
      seen.add(j.id);
      jobs.push(normalise({
        externalId: `himalayas-${j.id}`,
        title: j.title, company: j.company?.name || j.companyName || '',
        location: (j.locationRestrictions || []).join(', ') || 'Remote',
        salary: j.salaryRange || j.salary || '',
        description: j.description ? stripHtml(j.description) : '',
        applyUrl: j.applicationLink || j.applyLink || j.url || '',
        source: 'himalayas',
      }));
    }
  }

  console.log(`[jobFetcher] Himalayas: ${jobs.length} jobs`);
  return jobs;
}

// ── Jobicy ────────────────────────────────────────────────────────────────────
// No auth needed. Good industry + tag filtering.

async function fetchJobicy(preferredRoles) {
  const techTags = ['backend', 'node', 'python', 'java', 'devops', 'fullstack'];

  // Pick tags from preferred roles if possible
  const matchedTags = techTags.filter(tag =>
    preferredRoles.some(r => r.toLowerCase().includes(tag))
  );
  const tagsToFetch = matchedTags.length > 0 ? matchedTags.slice(0, 2) : ['backend', 'node'];

  const settled = await Promise.allSettled(
    tagsToFetch.map(tag =>
      fetch(`https://jobicy.com/api/v2/remote-jobs?count=50&industry=software-development&tag=${tag}`)
        .then(r => r.ok ? r.json() : Promise.reject(`Jobicy HTTP ${r.status}`))
    )
  );

  const seen = new Set();
  const jobs = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const j of (r.value.jobs || [])) {
      if (!j.id || seen.has(j.id)) continue;
      seen.add(j.id);
      jobs.push(normalise({
        externalId: `jobicy-${j.id}`,
        title: j.jobTitle, company: j.companyName,
        location: j.jobGeo || 'Remote',
        salary: j.annualSalaryMin
          ? `$${Math.round(j.annualSalaryMin/1000)}k–$${Math.round(j.annualSalaryMax/1000)}k`
          : '',
        description: stripHtml(j.jobDescription || ''),
        applyUrl: j.url, source: 'jobicy',
      }));
    }
  }

  console.log(`[jobFetcher] Jobicy: ${jobs.length} jobs`);
  return jobs;
}

// ── Remotive ──────────────────────────────────────────────────────────────────

async function fetchRemotive() {
  const categories = ['software-dev', 'devops-sysadmin'];
  const settled = await Promise.allSettled(
    categories.map(cat =>
      fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=30`)
        .then(r => r.ok ? r.json() : Promise.reject(`Remotive HTTP ${r.status}`))
    )
  );

  const seen = new Set();
  const jobs = [];
  for (const r of settled) {
    if (r.status !== 'fulfilled') continue;
    for (const j of (r.value.jobs || [])) {
      if (seen.has(j.id)) continue;
      seen.add(j.id);
      jobs.push(normalise({
        externalId: `remotive-${j.id}`,
        title: j.title, company: j.company_name,
        location: j.candidate_required_location || 'Remote',
        salary: j.salary || '',
        description: stripHtml(j.description || ''),
        applyUrl: j.url, source: 'remotive',
      }));
    }
  }

  console.log(`[jobFetcher] Remotive: ${jobs.length} jobs`);
  return jobs;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function fetchJobs(existingIds = new Set(), preferredRoles = []) {
  // All sources fire in parallel
  const [adzuna, jsearch, remoteok, himalayas, jobicy, remotive] = await Promise.allSettled([
    fetchAdzuna(preferredRoles),
    fetchJSearch(preferredRoles),
    fetchRemoteOK(preferredRoles),
    fetchHimalayas(preferredRoles),
    fetchJobicy(preferredRoles),
    fetchRemotive(),
  ]);

  const all = [
    ...(adzuna.status    === 'fulfilled' ? adzuna.value    : []),
    ...(jsearch.status   === 'fulfilled' ? jsearch.value   : []),
    ...(remoteok.status  === 'fulfilled' ? remoteok.value  : []),
    ...(himalayas.status === 'fulfilled' ? himalayas.value : []),
    ...(jobicy.status    === 'fulfilled' ? jobicy.value    : []),
    ...(remotive.status  === 'fulfilled' ? remotive.value  : []),
  ];

  // Dedup across sources by externalId
  const seenIds = new Set();
  const deduped = all.filter(j => {
    if (seenIds.has(j.externalId)) return false;
    seenIds.add(j.externalId);
    return true;
  });

  // Remove jobs already in DB for this user
  const fresh = deduped.filter(j => !existingIds.has(j.externalId));

  // Cheap title pre-filter before any OpenAI call
  const relevant = preFilterJobs(fresh, preferredRoles);

  console.log(`[jobFetcher] Total: ${all.length} → deduped: ${deduped.length} → new: ${fresh.length} → relevant: ${relevant.length}`);
  return relevant;
}

module.exports = { fetchJobs };
