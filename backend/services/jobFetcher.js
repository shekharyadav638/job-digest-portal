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
    fetchAdzunaPage(4, roleQuery),
    fetchAdzunaPage(5, roleQuery),
    fetchAdzunaPage(1, techQuery),
    fetchAdzunaPage(2, techQuery),
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

  const roleQuery = preferredRoles.slice(0, 2).join(' OR ') || 'software engineer';
  const queries = [
    `${roleQuery} in India`,
    `remote ${preferredRoles[0] || 'software engineer'}`,
  ];

  const jobs = [];
  const seen = new Set();

  for (const q of queries) {
    try {
      const url = `https://api.openwebninja.com/jsearch/search-v2?query=${encodeURIComponent(q)}&num_pages=1`;
      const res = await fetch(url, { headers: { 'x-api-key': JSEARCH_API_KEY } });
      if (!res.ok) {
        const text = await res.text();
        console.warn(`[jobFetcher] JSearch HTTP ${res.status} for "${q}":`, text.slice(0, 200));
        continue;
      }
      const data = await res.json();
      if (!data.data) {
        console.warn('[jobFetcher] JSearch unexpected response shape:', JSON.stringify(data).slice(0, 200));
        continue;
      }
      for (const j of data.data) {
        const id = j.job_id;
        if (!id || seen.has(id)) continue;
        seen.add(id);
        jobs.push(normalise({
          externalId: `jsearch-${id}`,
          title: j.job_title, company: j.employer_name,
          location: j.job_city ? `${j.job_city}, ${j.job_country}` : (j.job_country || 'India'),
          salary: j.job_min_salary ? `${j.job_min_salary}–${j.job_max_salary} ${j.job_salary_currency || ''}`.trim() : '',
          description: (j.job_description || '').slice(0, 2000),
          applyUrl: j.job_apply_link, source: 'jsearch',
        }));
      }
    } catch (err) {
      console.error(`[jobFetcher] JSearch error for "${q}":`, err.message);
    }
  }

  console.log(`[jobFetcher] JSearch: ${jobs.length} jobs`);
  return jobs;
}

// ── The Muse ──────────────────────────────────────────────────────────────────
// No auth needed. 500 req/hr. Entry Level filter perfect for SDE-1.

async function fetchTheMuse(preferredRoles) {
  const pages = [0, 1, 2];
  const locations = ['Flexible / Remote', 'India'];
  const seen = new Set();
  const jobs = [];

  for (const location of locations) {
    for (const page of pages) {
      try {
        const params = new URLSearchParams({
          category: 'Software Engineer',
          level: 'Entry Level',
          location,
          page: String(page),
        });
        const res = await fetch(`https://www.themuse.com/api/public/jobs?${params}`, {
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) {
          console.warn(`[jobFetcher] TheMuse HTTP ${res.status}`);
          break;
        }
        const data = await res.json();
        const list = data.results || [];
        if (list.length === 0) break; // no more pages

        for (const j of list) {
          const id = j.id;
          if (!id || seen.has(String(id))) continue;
          seen.add(String(id));
          const loc = (j.locations || []).map(l => l.name).join(', ') || 'Remote';
          jobs.push(normalise({
            externalId: `themuse-${id}`,
            title: j.name, company: j.company?.name || '',
            location: loc, salary: '',
            description: j.contents ? stripHtml(j.contents) : '',
            applyUrl: j.refs?.landing_page || '', source: 'themuse',
          }));
        }
      } catch (err) {
        console.error(`[jobFetcher] TheMuse error:`, err.message);
        break;
      }
    }
  }

  console.log(`[jobFetcher] TheMuse: ${jobs.length} jobs`);
  return jobs;
}

// ── Himalayas ─────────────────────────────────────────────────────────────────
// No auth needed. Has seniority=Junior filter — great for SDE-1.

async function fetchHimalayas(preferredRoles) {
  const query = preferredRoles.slice(0, 2).join(' ') || 'software engineer';
  const urls = [
    `https://himalayas.app/jobs/api/search?q=${encodeURIComponent(query)}&sort=recent`,
    `https://himalayas.app/jobs/api?offset=0&limit=50`,
    `https://himalayas.app/jobs/api?offset=50&limit=50`,
  ];

  const seen = new Set();
  const jobs = [];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        console.warn(`[jobFetcher] Himalayas HTTP ${res.status} for ${url}`);
        continue;
      }
      const data = await res.json();
      // Response may be { jobs: [...] } or { data: [...] } or plain array
      const list = data.jobs || data.data || (Array.isArray(data) ? data : []);
      if (list.length === 0) console.warn(`[jobFetcher] Himalayas empty response for ${url}:`, JSON.stringify(data).slice(0, 300));
      for (const j of list) {
        const id = j.id || j.slug;
        if (!id || seen.has(String(id))) continue;
        seen.add(String(id));
        jobs.push(normalise({
          externalId: `himalayas-${id}`,
          title: j.title,
          company: typeof j.company === 'string' ? j.company : (j.company?.name || j.companyName || ''),
          location: Array.isArray(j.locationRestrictions)
            ? j.locationRestrictions.join(', ')
            : (j.location || j.jobGeo || 'Remote'),
          salary: j.salaryRange || j.salary || '',
          description: j.description ? stripHtml(j.description) : '',
          applyUrl: j.applicationLink || j.applyLink || j.url || '',
          source: 'himalayas',
        }));
      }
    } catch (err) {
      console.error(`[jobFetcher] Himalayas error:`, err.message);
    }
  }

  console.log(`[jobFetcher] Himalayas: ${jobs.length} jobs`);
  return jobs;
}

// ── Jobicy ────────────────────────────────────────────────────────────────────
// No auth needed. Good industry + tag filtering.

async function fetchJobicy(preferredRoles) {
  const techTags = ['backend', 'node', 'python', 'java', 'devops', 'fullstack', 'react', 'software-engineer'];
  const matchedTags = techTags.filter(tag =>
    preferredRoles.some(r => r.toLowerCase().includes(tag))
  );
  const tagsToFetch = matchedTags.length > 0 ? matchedTags.slice(0, 3) : ['backend', 'node', 'software-engineer'];

  const seen = new Set();
  const jobs = [];

  for (const tag of tagsToFetch) {
    try {
      const url = `https://jobicy.com/api/v2/remote-jobs?count=50&tag=${tag}`;
      const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        console.warn(`[jobFetcher] Jobicy HTTP ${res.status} for tag "${tag}"`);
        continue;
      }
      const data = await res.json();
      if (!data.jobs) {
        console.warn('[jobFetcher] Jobicy unexpected response:', JSON.stringify(data).slice(0, 200));
        continue;
      }
      for (const j of data.jobs) {
        const id = j.id;
        if (!id || seen.has(String(id))) continue;
        seen.add(String(id));
        jobs.push(normalise({
          externalId: `jobicy-${id}`,
          title: j.jobTitle, company: j.companyName,
          location: j.jobGeo || 'Remote',
          salary: j.annualSalaryMin
            ? `$${Math.round(j.annualSalaryMin/1000)}k–$${Math.round(j.annualSalaryMax/1000)}k`
            : '',
          description: stripHtml(j.jobDescription || ''),
          applyUrl: j.url, source: 'jobicy',
        }));
      }
    } catch (err) {
      console.error(`[jobFetcher] Jobicy error for tag "${tag}":`, err.message);
    }
  }

  console.log(`[jobFetcher] Jobicy: ${jobs.length} jobs`);
  return jobs;
}

// ── Remotive ──────────────────────────────────────────────────────────────────

async function fetchRemotive() {
  const categories = ['software-dev', 'devops-sysadmin', 'data'];
  const settled = await Promise.allSettled(
    categories.map(cat =>
      fetch(`https://remotive.com/api/remote-jobs?category=${cat}&limit=50`)
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

// ── Arbeitnow ─────────────────────────────────────────────────────────────────
// Free, no auth. Good remote tech jobs. https://www.arbeitnow.com/api/job-board-api

async function fetchArbeitnow(preferredRoles) {
  const tags = preferredRoles
    .flatMap(r => r.toLowerCase().split(/\s+/))
    .filter(w => w.length > 3)
    .map(w => w.replace(/[^a-z0-9-]/g, ''));
  const queries = tags.length > 0 ? tags.slice(0, 2) : ['backend', 'software-engineer'];

  const seen = new Set();
  const jobs = [];

  for (const tag of queries) {
    try {
      const res = await fetch(`https://www.arbeitnow.com/api/job-board-api?tag=${encodeURIComponent(tag)}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!res.ok) {
        console.warn(`[jobFetcher] Arbeitnow HTTP ${res.status} for tag "${tag}"`);
        continue;
      }
      const data = await res.json();
      for (const j of (data.data || [])) {
        if (!j.slug || seen.has(j.slug)) continue;
        seen.add(j.slug);
        jobs.push(normalise({
          externalId: `arbeitnow-${j.slug}`,
          title: j.title,
          company: j.company_name,
          location: j.location || (j.remote ? 'Remote' : ''),
          salary: '',
          description: stripHtml(j.description || ''),
          applyUrl: j.url,
          source: 'arbeitnow',
        }));
      }
    } catch (err) {
      console.error(`[jobFetcher] Arbeitnow error for tag "${tag}":`, err.message);
    }
  }

  console.log(`[jobFetcher] Arbeitnow: ${jobs.length} jobs`);
  return jobs;
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function fetchJobs(existingIds = new Set(), preferredRoles = []) {
  // All sources fire in parallel
  const [adzuna, jsearch, themuse, himalayas, jobicy, remotive, arbeitnow] = await Promise.allSettled([
    fetchAdzuna(preferredRoles),
    fetchJSearch(preferredRoles),
    fetchTheMuse(preferredRoles),
    fetchHimalayas(preferredRoles),
    fetchJobicy(preferredRoles),
    fetchRemotive(),
    fetchArbeitnow(preferredRoles),
  ]);

  const all = [
    ...(adzuna.status    === 'fulfilled' ? adzuna.value    : []),
    ...(jsearch.status   === 'fulfilled' ? jsearch.value   : []),
    ...(themuse.status   === 'fulfilled' ? themuse.value   : []),
    ...(himalayas.status === 'fulfilled' ? himalayas.value : []),
    ...(jobicy.status    === 'fulfilled' ? jobicy.value    : []),
    ...(remotive.status  === 'fulfilled' ? remotive.value  : []),
    ...(arbeitnow.status === 'fulfilled' ? arbeitnow.value : []),
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
