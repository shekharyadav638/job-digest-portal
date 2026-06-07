const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authMiddleware } = require('../middleware/auth');
const { extractTextFromBuffer, extractProfileAndRoles, formatProfileString } = require('../services/resumeParser');
const { saveResumeAndProfile, savePreferences, getUserById } = require('../db/queries');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.mimetype === 'text/plain') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF and TXT files are accepted'));
    }
  },
});

// GET /api/profile
router.get('/', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Parse JSON fields for response
    const profile = {
      ...user,
      suggested_roles: user.suggested_roles ? JSON.parse(user.suggested_roles) : [],
      preferred_roles: user.preferred_roles ? JSON.parse(user.preferred_roles) : [],
      candidate_profile: user.candidate_profile ? JSON.parse(user.candidate_profile) : null,
    };
    res.json(profile);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// POST /api/profile/resume
router.post('/resume', authMiddleware, upload.single('resume'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const resumeText = await extractTextFromBuffer(
      req.file.buffer,
      req.file.mimetype,
      req.file.originalname
    );

    if (!resumeText || resumeText.trim().length < 100) {
      return res.status(400).json({ error: 'Could not extract enough text from the file. Make sure it is a readable PDF or TXT.' });
    }

    const { profile, suggestedRoles } = await extractProfileAndRoles(resumeText);
    const candidateProfileStr = formatProfileString(profile);

    await saveResumeAndProfile(req.userId, {
      resumeText,
      resumeFilename: req.file.originalname,
      candidateProfile: candidateProfileStr,
      suggestedRoles,
    });

    res.json({
      message: 'Resume processed successfully',
      profile,
      suggestedRoles,
    });
  } catch (err) {
    console.error('[POST /api/profile/resume]', err);
    res.status(500).json({ error: err.message || 'Failed to process resume' });
  }
});

// PUT /api/profile/preferences
router.put('/preferences', authMiddleware, async (req, res) => {
  const { preferredRoles } = req.body;
  if (!Array.isArray(preferredRoles) || preferredRoles.length === 0) {
    return res.status(400).json({ error: 'preferredRoles must be a non-empty array' });
  }

  try {
    await savePreferences(req.userId, preferredRoles);
    const user = await getUserById(req.userId);
    res.json({ message: 'Preferences saved', user });
  } catch (err) {
    console.error('[PUT /api/profile/preferences]', err);
    res.status(500).json({ error: 'Failed to save preferences' });
  }
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') return res.status(400).json({ error: 'File too large (max 5MB)' });
  if (err.message) return res.status(400).json({ error: err.message });
  next(err);
});

module.exports = router;
