const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../database/db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/settings
router.get('/', (req, res) => {
  const user = db.prepare('SELECT id, shop_name, phone FROM users WHERE id = ?').get(req.userId);
  res.json({ success: true, data: user });
});

// PUT /api/settings/profile   body: { shop_name }
router.put('/profile', (req, res) => {
  const shopName = String(req.body.shop_name || '').trim();
  if (!shopName) {
    return res.status(400).json({ success: false, message: 'Shop name is required.' });
  }
  if (shopName.length > 80) {
    return res.status(400).json({ success: false, message: 'Shop name is too long.' });
  }

  db.prepare('UPDATE users SET shop_name = ? WHERE id = ?').run(shopName, req.userId);
  const user = db.prepare('SELECT id, shop_name, phone FROM users WHERE id = ?').get(req.userId);
  res.json({ success: true, data: user });
});

// PUT /api/settings/password   body: { current_password, new_password, confirm_password }
router.put('/password', (req, res) => {
  const current = String(req.body.current_password || '');
  const next = String(req.body.new_password || '');
  const confirm = String(req.body.confirm_password || '');

  if (!current || !next || !confirm) {
    return res.status(400).json({ success: false, message: 'All password fields are required.' });
  }
  if (next.length < 6) {
    return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
  }
  if (next !== confirm) {
    return res.status(400).json({ success: false, message: 'New passwords do not match.' });
  }

  const row = db.prepare('SELECT passwordHash FROM users WHERE id = ?').get(req.userId);
  if (!bcrypt.compareSync(current, row.passwordHash)) {
    return res.status(401).json({ success: false, message: 'Current password is incorrect.' });
  }
  if (bcrypt.compareSync(next, row.passwordHash)) {
    return res.status(400).json({ success: false, message: 'New password must be different from the current one.' });
  }

  db.prepare('UPDATE users SET passwordHash = ? WHERE id = ?').run(bcrypt.hashSync(next, 10), req.userId);
  res.json({ success: true, data: { changed: true } });
});

module.exports = router;