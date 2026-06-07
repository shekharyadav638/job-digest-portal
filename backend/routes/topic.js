const express = require('express');
const router = express.Router();
const { getTodaysTopic } = require('../services/topicPicker');

// GET /api/topic/today
router.get('/today', async (req, res) => {
  try {
    const topic = await getTodaysTopic();
    res.json(topic);
  } catch (err) {
    console.error('[GET /api/topic/today]', err);
    res.status(500).json({ error: 'Failed to get topic' });
  }
});

module.exports = router;
