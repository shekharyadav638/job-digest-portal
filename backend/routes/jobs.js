const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getJobs, getJobById, markJobApplied } = require('../db/queries');

router.use(authMiddleware);

// GET /api/jobs?date=YYYY-MM-DD&applied=0|1
router.get('/', async (req, res) => {
  try {
    const { date, applied } = req.query;
    const filter = {};
    if (date) filter.date = date;
    if (applied !== undefined) filter.applied = applied === '1' || applied === 'true';
    const jobs = await getJobs(req.userId, filter);
    res.json(jobs);
  } catch (err) {
    console.error('[GET /api/jobs]', err);
    res.status(500).json({ error: 'Failed to fetch jobs' });
  }
});

// GET /api/jobs/:id
router.get('/:id', async (req, res) => {
  try {
    const job = await getJobById(req.params.id, req.userId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('[GET /api/jobs/:id]', err);
    res.status(500).json({ error: 'Failed to fetch job' });
  }
});

// PATCH /api/jobs/:id/apply
router.patch('/:id/apply', async (req, res) => {
  try {
    const { applied } = req.body;
    if (applied === undefined) return res.status(400).json({ error: 'applied field required' });
    const job = await markJobApplied(req.params.id, req.userId, applied);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) {
    console.error('[PATCH /api/jobs/:id/apply]', err);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

module.exports = router;
