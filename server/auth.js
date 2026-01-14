const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const router = express.Router();
const dbPath = path.join(__dirname, 'data', 'auth.db');
const db = new Database(dbPath);

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL,
  username_lower TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);
`);

const PASSWORD_RULES_MESSAGE = 'Password must be at least 8 characters and include uppercase, lowercase, and a number.';

const validatePassword = (password) => {
  const issues = [];
  if (password.length < 8) issues.push('minLength');
  if (!/[A-Z]/.test(password)) issues.push('uppercase');
  if (!/[a-z]/.test(password)) issues.push('lowercase');
  if (!/\d/.test(password)) issues.push('number');
  return issues;
};

const JWT_SECRET = process.env.SESSION_SECRET || 'dev_secret_change_me';
if (!process.env.SESSION_SECRET) {
  console.warn('WARNING: SESSION_SECRET missing. Set it in server/.env for production.');
}

const signToken = (user) => jwt.sign(
  { sub: user.id, username: user.username },
  JWT_SECRET,
  { expiresIn: '7d' }
);

const authRequired = (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

router.post('/register', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (username.length < 3) {
    return res.status(400).json({ error: 'Username must be at least 3 characters' });
  }
  const passwordIssues = validatePassword(password);
  if (passwordIssues.length) {
    return res.status(400).json({ error: PASSWORD_RULES_MESSAGE });
  }

  const usernameLower = username.toLowerCase();
  const exists = db.prepare('SELECT id FROM users WHERE username_lower = ?').get(usernameLower);
  if (exists) return res.status(409).json({ error: 'Username already exists' });

  const hash = bcrypt.hashSync(password, 10);
  const now = new Date().toISOString();

  const info = db.prepare(
    'INSERT INTO users (username, username_lower, password_hash, created_at) VALUES (?, ?, ?, ?)'
  ).run(username, usernameLower, hash, now);

  const user = { id: info.lastInsertRowid, username };
  const token = signToken(user);

  return res.json({ user, token });
});

router.post('/login', (req, res) => {
  const username = String(req.body?.username || '').trim();
  const password = String(req.body?.password || '');

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const usernameLower = username.toLowerCase();
  const user = db.prepare(
    'SELECT id, username, password_hash FROM users WHERE username_lower = ?'
  ).get(usernameLower);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = signToken({ id: user.id, username: user.username });
  return res.json({ user: { id: user.id, username: user.username }, token });
});

router.get('/me', authRequired, (req, res) => {
  return res.json({ user: { id: req.user.sub, username: req.user.username } });
});

module.exports = router;
