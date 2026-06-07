const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const { getStats, getAppliedJobs } = require('../db/queries');

router.use(authMiddleware);

// GET /api/stats
router.get('/', async (req, res) => {
  try {
    const stats = await getStats(req.userId);
    res.json(stats);
  } catch (err) {
    console.error('[GET /api/stats]', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// GET /api/stats/applied?filter=week|month|all
router.get('/applied', async (req, res) => {
  try {
    const { filter = 'all' } = req.query;
    const jobs = await getAppliedJobs(req.userId, filter);
    res.json(jobs);
  } catch (err) {
    console.error('[GET /api/stats/applied]', err);
    res.status(500).json({ error: 'Failed to fetch applied jobs' });
  }
});

module.exports = router;
