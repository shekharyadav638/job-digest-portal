require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const ADZUNA_APP_ID = process.env.ADZUNA_APP_ID;
const ADZUNA_APP_KEY = process.env.ADZUNA_APP_KEY;

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

function buildAdzunaQuery(preferredRoles) {
  if (!preferredRoles || preferredRoles.length === 0) {
    return 'backend developer software engineer';
  }
  // Use first 3 roles to build the query
  return preferredRoles.slice(0, 3).join(' ').toLowerCase();
}

async function fetchAdzuna(preferredRoles) {
  if (!ADZUNA_APP_ID || !ADZUNA_APP_KEY) {
    console.warn('[jobFetcher] Adzuna credentials missing, skipping');
    return [];
  }

  const query = encodeURIComponent(buildAdzunaQuery(preferredRoles));
  const url = `https://api.adzuna.com/v1/api/jobs/in/search/1?app_id=${ADZUNA_APP_ID}&app_key=${ADZUNA_APP_KEY}&results_per_page=20&what=${query}&content-type=application/json`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Adzuna HTTP ${res.status}`);
    const data = await res.json();

    return (data.results || []).map(j => normalise({
      externalId: `adzuna-${j.id}`,
      title: j.title,
      company: j.company?.display_name,
      location: j.location?.display_name,
      salary: j.salary_min ? `${j.salary_min}–${j.salary_max}`.trim() : '',
      description: j.description,
      applyUrl: j.redirect_url,
      source: 'adzuna',
    }));
  } catch (err) {
    console.error('[jobFetcher] Adzuna error:', err.message);
    return [];
  }
}

async function fetchRemotive(preferredRoles = []) {
  try {
    const searchTerm = preferredRoles.length > 0
      ? encodeURIComponent(preferredRoles.slice(0, 2).join(' '))
      : 'backend+developer';
    const res = await fetch(`https://remotive.com/api/remote-jobs?category=software-dev&search=${searchTerm}&limit=20`);
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
    console.error('[jobFetcher] Remotive error:', err.message);
    return [];
  }
}

/**
 * @param {Set} existingIds - external_ids already in DB for this user
 * @param {string[]} preferredRoles - user's selected job roles for Adzuna search
 */
async function fetchJobs(existingIds = new Set(), preferredRoles = []) {
  const [adzuna, remotive] = await Promise.all([
    fetchAdzuna(preferredRoles),
    fetchRemotive(preferredRoles),
  ]);
  const all = [...adzuna, ...remotive];
  const fresh = all.filter(j => !existingIds.has(j.externalId));
  console.log(`[jobFetcher] Fetched ${all.length} total, ${fresh.length} new after dedup`);
  return fresh;
}

module.exports = { fetchJobs };
