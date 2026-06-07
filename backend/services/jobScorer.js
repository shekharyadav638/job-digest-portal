require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { OpenAI } = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Score a single job against a candidate profile string.
 * @param {object} job
 * @param {string} candidateProfileStr - formatted profile text
 */
async function scoreJob(job, candidateProfileStr) {
  const prompt = `You are evaluating a job listing for a specific candidate. Return a JSON object only, no explanation.

Candidate profile:
${candidateProfileStr}

Job listing:
Title: ${job.title}
Company: ${job.company}
Location: ${job.location}
Description: ${job.description.slice(0, 1500)}

Return this exact JSON:
{
  "score": <integer 0-100, how well this job matches the candidate>,
  "reason": "<one sentence explaining the score>",
  "cover_letter": "<a 150-200 word personalised cover letter the candidate can use when applying>"
}

Score guide:
- 80-100: Excellent match. Exact skills, right seniority level, right tech stack.
- 55-79: Good match. Most skills align, minor gaps or seniority difference.
- 30-54: Partial match. Some relevant skills but notable gaps.
- Below 30: Poor match. Different domain entirely.`;

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return { score: parsed.score, reason: parsed.reason, coverLetter: parsed.cover_letter };
  } catch (err) {
    console.error(`[jobScorer] Error scoring "${job.title}":`, err.message);
    return null;
  }
}

/**
 * Score jobs sequentially with a 500ms delay to avoid rate limits.
 * @param {object[]} jobs
 * @param {string} candidateProfileStr - formatted profile text for this user
 * @returns {object[]} jobs that scored >= 60, with score/reason/coverLetter attached
 */
async function scoreJobsSequentially(jobs, candidateProfileStr) {
  const results = [];

  for (const job of jobs) {
    console.log(`[jobScorer] Scoring: ${job.title} @ ${job.company}`);
    const scored = await scoreJob(job, candidateProfileStr);

    if (scored && scored.score >= 55) {
      results.push({
        ...job,
        matchScore: scored.score,
        matchReason: scored.reason,
        coverLetter: scored.coverLetter,
      });
      console.log(`  ✓ Score: ${scored.score}`);
    } else if (scored) {
      console.log(`  ✗ Score: ${scored.score} — below threshold`);
    } else {
      console.log(`  ✗ Scoring failed`);
    }

    await sleep(500);
  }

  return results;
}

module.exports = { scoreJobsSequentially };
