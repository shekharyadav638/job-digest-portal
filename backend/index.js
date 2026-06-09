require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const { initDb } = require('./db/init');
const { runDailyDigest } = require('./cron/dailyDigest');
const { authMiddleware } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
  credentials: true,
}));
app.use(express.json());

// Public routes
app.use('/api/auth', require('./routes/auth'));

// Protected routes
app.use('/api/jobs', require('./routes/jobs'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/topic', require('./routes/topic'));
app.use('/api/profile', require('./routes/profile'));

// Dashboard: manual trigger for the logged-in user
app.post('/api/cron/trigger', authMiddleware, async (req, res) => {
  console.log(`[cron/trigger] Manual trigger by user ${req.userId}`);
  try {
    const result = await runDailyDigest(req.userId);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// External cron trigger (called by cron-job.org) — protected by CRON_SECRET header
app.post('/api/cron/run', async (req, res) => {
  const secret = req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  console.log('[cron/run] External trigger received');
  try {
    const result = await runDailyDigest();
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

async function start() {
  await initDb();

  const cronSchedule = process.env.CRON_SCHEDULE || '30 1 * * *';
  cron.schedule(cronSchedule, async () => {
    console.log('[cron] Running daily digest for all users...');
    try {
      await runDailyDigest();
    } catch (err) {
      console.error('[cron] Digest failed:', err.message);
    }
  });
  console.log(`[cron] Scheduled: ${cronSchedule}`);

  // Keep-alive: ping own health endpoint every 14 min so Render free tier doesn't sleep.
  // Set SELF_URL=https://your-app.onrender.com in Render env vars to enable.
  const selfUrl = process.env.SELF_URL;
  if (selfUrl) {
    setInterval(async () => {
      try {
        await fetch(`${selfUrl}/api/health`);
        console.log('[keepalive] Pinged self');
      } catch (e) {
        console.warn('[keepalive] Ping failed:', e.message);
      }
    }, 14 * 60 * 1000);
    console.log(`[keepalive] Self-ping enabled → ${selfUrl}/api/health`);
  }

  app.listen(PORT, () => {
    console.log(`[server] Backend running at http://localhost:${PORT}`);
    if (selfUrl) {
      console.log(`[cron] External trigger URL: POST ${selfUrl}/api/cron/run  (header: x-cron-secret: <CRON_SECRET>)`);
    }
  });
}

start().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
