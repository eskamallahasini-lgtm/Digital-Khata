const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../database/db');

const authMiddleware = require('../middleware/auth');

const router = express.Router();

function makeToken(userId) {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

const phoneRegex = /^[0-9]{10}$/;

// POST /api/auth/register
router.post('/register', (req, res) => {
  const shopName = String(req.body.shop_name || '').trim();
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');
  const confirm = String(req.body.confirm_password || '');

  if (!shopName || !phone || !password || !confirm) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (shopName.length > 80) {
    return res.status(400).json({ success: false, message: 'Shop name is too long.' });
  }
  if (!phoneRegex.test(phone)) {
    return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
  }
  if (password !== confirm) {
    return res.status(400).json({ success: false, message: 'Passwords do not match.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone);
  if (existing) {
    return res.status(409).json({ success: false, message: 'This phone number is already registered.' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db
    .prepare('INSERT INTO users (shop_name, phone, passwordHash) VALUES (?, ?, ?)')
    .run(shopName, phone, passwordHash);

  const user = { id: result.lastInsertRowid, shop_name: shopName, phone };
  res.status(201).json({ success: true, data: { token: makeToken(user.id), user } });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  const phone = String(req.body.phone || '').trim();
  const password = String(req.body.password || '');

  if (!phone || !password) {
    return res.status(400).json({ success: false, message: 'Phone number and password are required.' });
  }

  const row = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!row || !bcrypt.compareSync(password, row.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Invalid phone number or password.' });
  }

  const user = { id: row.id, shop_name: row.shop_name, phone: row.phone };
  res.json({ success: true, data: { token: makeToken(user.id), user } });
});
// PUT /api/auth/password  (logged-in user changes their password)
router.put('/password', authMiddleware, (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');
  const confirm = String(req.body.confirm_password || '');

  if (!current || !next || !confirm) {
    return res.status(400).json({ success: false, message: 'All fields are required.' });
  }
  if (next.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }
  if (next !== confirm) {
    return res.status(400).json({ success: false, message: 'New passwords do not match.' });
  }

  const row = db.prepare('SELECT passwordHash FROM users WHERE id = ?').get(req.userId);
  if (!row || !bcrypt.compareSync(current, row.passwordHash)) {
    return res.status(400).json({ success: false, message: 'Current password is incorrect.' });
  }

  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.userId);
  res.json({ success: true, data: { changed: true } });
});
module.exports = router;