require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { OpenAI } = require('openai');

// Import lib directly to avoid pdf-parse's internal test file issue
let pdfParse;
try {
  pdfParse = require('pdf-parse/lib/pdf-parse');
} catch {
  pdfParse = require('pdf-parse');
}

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function extractTextFromBuffer(buffer, mimetype, originalname) {
  // Plain text
  if (mimetype === 'text/plain' || originalname.endsWith('.txt')) {
    return buffer.toString('utf-8');
  }

  // PDF
  try {
    const data = await pdfParse(buffer);
    return data.text;
  } catch (err) {
    throw new Error(`Could not parse PDF: ${err.message}`);
  }
}

async function extractProfileAndRoles(resumeText) {
  const prompt = `You are a career counsellor. Analyse this resume and return a JSON object only, no explanation.

Resume text:
"""
${resumeText.slice(0, 8000)}
"""

Return this exact JSON:
{
  "profile": {
    "name": "<candidate's full name>",
    "roleTarget": "<target role like SDE-1 / Backend Engineer>",
    "experience": "<X years experience summary in one sentence>",
    "skills": ["skill1", "skill2", ...],
    "highlights": ["achievement1", "achievement2", "achievement3"],
    "education": "<degree, institution, year>",
    "preferred": "<preferred work type: remote/hybrid/onsite, role type>"
  },
  "suggestedRoles": [
    "<specific job title 1>",
    "<specific job title 2>",
    "<specific job title 3>",
    "<specific job title 4>",
    "<specific job title 5>",
    "<specific job title 6>",
    "<specific job title 7>",
    "<specific job title 8>"
  ]
}

For suggestedRoles: provide 6-8 specific, searchable job titles that best match this candidate's experience and skills. Examples: "Backend Engineer", "Node.js Developer", "Full Stack Developer", "SDE-1", "Software Engineer", "API Developer", "DevOps Engineer". Be specific to the candidate's actual skills.`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    response_format: { type: 'json_object' },
  });

  const parsed = JSON.parse(response.choices[0].message.content);
  return {
    profile: parsed.profile,
    suggestedRoles: parsed.suggestedRoles || [],
  };
}

function formatProfileString(profile) {
  return `
Name: ${profile.name}
Role target: ${profile.roleTarget}
Experience: ${profile.experience}
Skills: ${profile.skills.join(', ')}
Highlights:
${profile.highlights.map(h => `- ${h}`).join('\n')}
Education: ${profile.education}
Preferred: ${profile.preferred}
`.trim();
}

module.exports = { extractTextFromBuffer, extractProfileAndRoles, formatProfileString };
