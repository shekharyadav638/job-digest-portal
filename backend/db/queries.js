const { getDb, isPg } = require('./init');

// ─── Users ───────────────────────────────────────────────────────────────────

async function createUser({ name, email, passwordHash }) {
  const db = getDb();
  if (isPg()) {
    const res = await db.query(
      `INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email, setup_complete, created_at`,
      [name, email, passwordHash]
    );
    return res.rows[0];
  }
  const stmt = db.prepare(`INSERT INTO users (name, email, password_hash) VALUES (?,?,?)`);
  const result = stmt.run(name, email, passwordHash);
  return getUserById(result.lastInsertRowid);
}

async function getUserByEmail(email) {
  const db = getDb();
  if (isPg()) {
    const res = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    return res.rows[0] || null;
  }
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

async function getUserById(id) {
  const db = getDb();
  if (isPg()) {
    const res = await db.query(
      'SELECT id, name, email, resume_filename, candidate_profile, preferred_roles, suggested_roles, setup_complete, created_at FROM users WHERE id = $1',
      [id]
    );
    return res.rows[0] || null;
  }
  return db.prepare(
    'SELECT id, name, email, resume_filename, candidate_profile, preferred_roles, suggested_roles, setup_complete, created_at FROM users WHERE id = ?'
  ).get(id) || null;
}

async function getUsersWithSetupComplete() {
  const db = getDb();
  if (isPg()) {
    const res = await db.query(
      'SELECT id, name, email, candidate_profile, preferred_roles FROM users WHERE setup_complete = 1'
    );
    return res.rows;
  }
  return db.prepare(
    'SELECT id, name, email, candidate_profile, preferred_roles FROM users WHERE setup_complete = 1'
  ).all();
}

async function saveResumeAndProfile(userId, { resumeText, resumeFilename, candidateProfile, suggestedRoles }) {
  const db = getDb();
  const profileStr = typeof candidateProfile === 'string' ? candidateProfile : JSON.stringify(candidateProfile);
  const rolesStr = typeof suggestedRoles === 'string' ? suggestedRoles : JSON.stringify(suggestedRoles);

  if (isPg()) {
    await db.query(
      `UPDATE users SET resume_text=$1, resume_filename=$2, candidate_profile=$3, suggested_roles=$4 WHERE id=$5`,
      [resumeText, resumeFilename, profileStr, rolesStr, userId]
    );
  } else {
    db.prepare(
      `UPDATE users SET resume_text=?, resume_filename=?, candidate_profile=?, suggested_roles=? WHERE id=?`
    ).run(resumeText, resumeFilename, profileStr, rolesStr, userId);
  }
}

async function savePreferences(userId, preferredRoles) {
  const db = getDb();
  const rolesStr = JSON.stringify(preferredRoles);
  if (isPg()) {
    await db.query(`UPDATE users SET preferred_roles=$1, setup_complete=1 WHERE id=$2`, [rolesStr, userId]);
  } else {
    db.prepare(`UPDATE users SET preferred_roles=?, setup_complete=1 WHERE id=?`).run(rolesStr, userId);
  }
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

async function insertJob(job) {
  const db = getDb();
  const {
    userId, externalId, title, company, location, salary,
    description, applyUrl, source, matchScore, matchReason, coverLetter, fetchedDate
  } = job;

  if (isPg()) {
    const res = await db.query(
      `INSERT INTO jobs (user_id, external_id, title, company, location, salary, description, apply_url, source, match_score, match_reason, cover_letter, fetched_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       ON CONFLICT (external_id, user_id) DO NOTHING
       RETURNING *`,
      [userId, externalId, title, company, location, salary, description, applyUrl, source, matchScore, matchReason, coverLetter, fetchedDate]
    );
    return res.rows[0] || null;
  }

  const result = db.prepare(
    `INSERT OR IGNORE INTO jobs (user_id, external_id, title, company, location, salary, description, apply_url, source, match_score, match_reason, cover_letter, fetched_date)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(userId, externalId, title, company, location, salary, description, applyUrl, source, matchScore, matchReason, coverLetter, fetchedDate);

  if (result.changes === 0) return null;
  return getJobById(result.lastInsertRowid, userId);
}

async function getJobs(userId, { date, applied } = {}) {
  const db = getDb();

  // Specific date requested — return only that day (historical browsing)
  if (date) {
    if (isPg()) {
      let query = 'SELECT * FROM jobs WHERE user_id = $1 AND fetched_date = $2';
      const params = [userId, date];
      if (applied !== undefined) { query += ' AND applied = $3'; params.push(applied ? 1 : 0); }
      query += ' ORDER BY match_score DESC';
      const res = await db.query(query, params);
      return res.rows;
    }
    let query = 'SELECT * FROM jobs WHERE user_id = ? AND fetched_date = ?';
    const params = [userId, date];
    if (applied !== undefined) { query += ' AND applied = ?'; params.push(applied ? 1 : 0); }
    query += ' ORDER BY match_score DESC';
    return db.prepare(query).all(...params);
  }

  // No date: return ALL jobs for the user so pending items carry across days
  // and applied history is always visible. Pending first (score desc), then applied (applied_at desc).
  if (isPg()) {
    let query = 'SELECT * FROM jobs WHERE user_id = $1';
    const params = [userId];
    if (applied !== undefined) { query += ' AND applied = $2'; params.push(applied ? 1 : 0); }
    query += ' ORDER BY applied ASC, match_score DESC';
    const res = await db.query(query, params);
    return res.rows;
  }

  let query = 'SELECT * FROM jobs WHERE user_id = ?';
  const params = [userId];
  if (applied !== undefined) { query += ' AND applied = ?'; params.push(applied ? 1 : 0); }
  query += ' ORDER BY applied ASC, match_score DESC';
  return db.prepare(query).all(...params);
}

async function getJobById(id, userId) {
  const db = getDb();
  if (isPg()) {
    const res = await db.query('SELECT * FROM jobs WHERE id = $1 AND user_id = $2', [id, userId]);
    return res.rows[0] || null;
  }
  return db.prepare('SELECT * FROM jobs WHERE id = ? AND user_id = ?').get(id, userId) || null;
}

async function markJobApplied(id, userId, applied) {
  const db = getDb();
  const appliedAt = applied ? new Date().toISOString() : null;
  const appliedVal = applied ? 1 : 0;

  if (isPg()) {
    const res = await db.query(
      'UPDATE jobs SET applied=$1, applied_at=$2 WHERE id=$3 AND user_id=$4 RETURNING *',
      [appliedVal, appliedAt, id, userId]
    );
    return res.rows[0] || null;
  }

  db.prepare('UPDATE jobs SET applied=?, applied_at=? WHERE id=? AND user_id=?').run(appliedVal, appliedAt, id, userId);
  return getJobById(id, userId);
}

async function getExistingExternalIds(userId) {
  const db = getDb();
  if (isPg()) {
    const res = await db.query('SELECT external_id FROM jobs WHERE user_id=$1', [userId]);
    return new Set(res.rows.map(r => r.external_id));
  }
  const rows = db.prepare('SELECT external_id FROM jobs WHERE user_id=?').all(userId);
  return new Set(rows.map(r => r.external_id));
}

// ─── Stats ───────────────────────────────────────────────────────────────────

async function getStats(userId) {
  const db = getDb();
  const weekStart = new Date(Date.now() - 7 * 86400000).toISOString();
  const monthStart = new Date(Date.now() - 30 * 86400000).toISOString();

  if (isPg()) {
    const today = new Date().toISOString().split('T')[0];
    const res = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE applied=1 AND applied_at::date = $2::date) AS "appliedToday",
        COUNT(*) FILTER (WHERE applied=1 AND applied_at >= $3) AS "appliedThisWeek",
        COUNT(*) FILTER (WHERE applied=1 AND applied_at >= $4) AS "appliedThisMonth",
        COUNT(*) AS "totalMatched",
        COUNT(*) FILTER (WHERE applied=1) AS "totalApplied"
      FROM jobs WHERE user_id=$1
    `, [userId, today, weekStart, monthStart]);
    return res.rows[0];
  }

  const row = db.prepare(`
    SELECT
      SUM(CASE WHEN applied=1 AND date(applied_at)=date('now') THEN 1 ELSE 0 END) AS appliedToday,
      SUM(CASE WHEN applied=1 AND applied_at >= ? THEN 1 ELSE 0 END) AS appliedThisWeek,
      SUM(CASE WHEN applied=1 AND applied_at >= ? THEN 1 ELSE 0 END) AS appliedThisMonth,
      COUNT(*) AS totalMatched,
      SUM(CASE WHEN applied=1 THEN 1 ELSE 0 END) AS totalApplied
    FROM jobs WHERE user_id=?
  `).get(weekStart, monthStart, userId);

  return {
    appliedToday: row.appliedToday || 0,
    appliedThisWeek: row.appliedThisWeek || 0,
    appliedThisMonth: row.appliedThisMonth || 0,
    totalMatched: row.totalMatched || 0,
    totalApplied: row.totalApplied || 0,
  };
}

async function getAppliedJobs(userId, filter = 'all') {
  const db = getDb();
  let cutoff;
  if (filter === 'week') cutoff = new Date(Date.now() - 7 * 86400000).toISOString();
  else if (filter === 'month') cutoff = new Date(Date.now() - 30 * 86400000).toISOString();

  if (isPg()) {
    let query = 'SELECT * FROM jobs WHERE user_id=$1 AND applied=1';
    const params = [userId];
    if (cutoff) { query += ' AND applied_at >= $2'; params.push(cutoff); }
    query += ' ORDER BY applied_at DESC';
    const res = await db.query(query, params);
    return res.rows;
  }

  let query = 'SELECT * FROM jobs WHERE user_id=? AND applied=1';
  const params = [userId];
  if (cutoff) { query += ' AND applied_at >= ?'; params.push(cutoff); }
  query += ' ORDER BY applied_at DESC';
  return db.prepare(query).all(...params);
}

// ─── Topics ──────────────────────────────────────────────────────────────────

async function saveTopic({ date, topic, category = 'HLD', description, keyPoints = [] }) {
  const db = getDb();
  const kpStr = JSON.stringify(keyPoints);
  if (isPg()) {
    await db.query(
      `INSERT INTO topics (date, topic, category, description, key_points)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (date) DO NOTHING`,
      [date, topic, category, description, kpStr]
    );
  } else {
    db.prepare(
      `INSERT OR IGNORE INTO topics (date, topic, category, description, key_points) VALUES (?,?,?,?,?)`
    ).run(date, topic, category, description, kpStr);
  }
}

function parseTopic(row) {
  if (!row) return null;
  return { ...row, keyPoints: row.key_points ? JSON.parse(row.key_points) : [] };
}

async function getTopicByDate(date) {
  const db = getDb();
  if (isPg()) {
    const res = await db.query('SELECT * FROM topics WHERE date=$1', [date]);
    return parseTopic(res.rows[0]);
  }
  return parseTopic(db.prepare('SELECT * FROM topics WHERE date=?').get(date));
}

async function getRecentTopics(limit = 20) {
  const db = getDb();
  if (isPg()) {
    const res = await db.query('SELECT topic, category FROM topics ORDER BY date DESC LIMIT $1', [limit]);
    return res.rows;
  }
  return db.prepare('SELECT topic, category FROM topics ORDER BY date DESC LIMIT ?').all(limit);
}

module.exports = {
  createUser, getUserByEmail, getUserById, getUsersWithSetupComplete,
  saveResumeAndProfile, savePreferences,
  insertJob, getJobs, getJobById, markJobApplied, getExistingExternalIds,
  getStats, getAppliedJobs,
  saveTopic, getTopicByDate, getRecentTopics,
};
