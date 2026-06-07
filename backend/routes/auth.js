const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createUser, getUserByEmail, getUserById } = require('../db/queries');
const { authMiddleware } = require('../middleware/auth');

function signToken(userId, email) {
  return jwt.sign({ userId, email }, process.env.JWT_SECRET, { expiresIn: '7d' });
}

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email, password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const existing = await getUserByEmail(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await createUser({ name, email, passwordHash });
    const token = signToken(user.id, email);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('[POST /api/auth/signup]', err);
    res.status(500).json({ error: 'Signup failed' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });

  try {
    const user = await getUserByEmail(email);
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken(user.id, user.email);
    const { password_hash, resume_text, ...safeUser } = user;

    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('[POST /api/auth/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await getUserById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

module.exports = router;
