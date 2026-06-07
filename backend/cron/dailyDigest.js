const { fetchJobs } = require('../services/jobFetcher');
const { scoreJobsSequentially } = require('../services/jobScorer');
const { sendDigestEmail } = require('../services/emailSender');
const { getTodaysTopic } = require('../services/topicPicker');
const { insertJob, getExistingExternalIds, getUsersWithSetupComplete } = require('../db/queries');

const today = () => new Date().toISOString().split('T')[0];

/**
 * Run the digest for a single user.
 */
async function runDigestForUser(user) {
  console.log(`\n[dailyDigest] Running for user: ${user.email} (id=${user.id})`);

  const preferredRoles = user.preferred_roles ? JSON.parse(user.preferred_roles) : [];
  const candidateProfile = user.candidate_profile || '';

  if (!candidateProfile) {
    console.warn(`[dailyDigest] User ${user.email} has no candidate_profile, skipping`);
    return { fetched: 0, matched: 0, emailSent: false };
  }

  // 1. Deduplicate against this user's existing jobs
  const existingIds = await getExistingExternalIds(user.id);

  // 2. Fetch fresh jobs using user's preferred roles
  const freshJobs = await fetchJobs(existingIds, preferredRoles);
  console.log(`[dailyDigest] ${freshJobs.length} new jobs to score for ${user.email}`);

  // 3. Score sequentially using user's profile
  let matched = [];
  if (freshJobs.length > 0) {
    const scored = await scoreJobsSequentially(freshJobs, candidateProfile);
    console.log(`[dailyDigest] ${scored.length} jobs passed threshold for ${user.email}`);

    // 4. Save matched jobs
    for (const job of scored) {
      await insertJob({ ...job, userId: user.id, fetchedDate: today() });
    }
    matched = scored;
  }

  return { fetched: freshJobs.length, matched: matched.length, jobs: matched };
}

/**
 * Main entry — runs digest for all users with completed setup.
 * @param {number|null} onlyUserId - if set, run for that user only
 */
async function runDailyDigest(onlyUserId = null) {
  const startTime = Date.now();
  console.log(`\n[dailyDigest] Starting digest for ${today()}`);

  try {
    let users = await getUsersWithSetupComplete();
    if (onlyUserId) users = users.filter(u => u.id === onlyUserId);

    if (users.length === 0) {
      console.log('[dailyDigest] No users with completed setup, nothing to do');
      return { usersProcessed: 0 };
    }

    const topic = await getTodaysTopic();
    console.log(`[dailyDigest] Topic: ${topic.topic}`);

    const summary = [];
    for (const user of users) {
      const result = await runDigestForUser(user);

      // Send email per user
      let emailSent = false;
      if (process.env.RESEND_API_KEY && user.email) {
        const emailResult = await sendDigestEmail({
          jobs: result.jobs || [],
          topic,
          date: today(),
          recipientName: user.name,
          recipientEmail: user.email,
        });
        emailSent = emailResult.success;
      } else {
        console.warn(`[dailyDigest] Email skipped for ${user.email} — RESEND_API_KEY not set`);
      }

      summary.push({ email: user.email, ...result, emailSent });
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`[dailyDigest] Done in ${duration}s —`, JSON.stringify(summary));
    return { usersProcessed: users.length, summary };
  } catch (err) {
    console.error('[dailyDigest] Fatal error:', err);
    throw err;
  }
}

module.exports = { runDailyDigest };
