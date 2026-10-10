// Verifies the JWT and attaches the logged-in user's id to req.userId.
// The user id ALWAYS comes from the verified token, never from the request body.
const jwt = require('jsonwebtoken');
const db = require('../database/db');

module.exports = function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({ success: false, message: 'Please log in to continue.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(payload.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Account not found. Please log in again.' });
    }
    req.userId = user.id;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid. Please log in again.' });
  }
};