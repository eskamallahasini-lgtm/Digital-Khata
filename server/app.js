// Load environment variables FIRST (before anything reads process.env)
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  console.error('\nERROR: JWT_SECRET is missing.');
  console.error('Copy server/.env.example to server/.env and restart.\n');
  process.exit(1);
}

const express = require('express');
const cors = require('cors');

const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

require('./database/db'); // creates the database and tables on startup

const authRoutes = require('./routes/auth');
const customerRoutes = require('./routes/customers');
const transactionRoutes = require('./routes/transactions');
const summaryRoutes = require('./routes/summary');
const copilotRoutes = require('./routes/copilot');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());


// Slow down password guessing: max 30 login/register attempts per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many attempts. Please try again after 15 minutes.' },
});
app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173' }));
app.use(express.json());
app.use(helmet());
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
  })
);
app.get('/api/health', (req, res) => {
  res.json({ success: true, data: { status: 'ok' } });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/copilot', copilotRoutes);
app.use('/api', summaryRoutes);
app.use('/api/settings', settingsRoutes); // /api/summary and /api/reminders

// Unknown API route
app.use('/api', (req, res) => {
  res.status(404).json({ success: false, message: 'API route not found.' });
});

// Central error handler (also catches bad JSON bodies)
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ success: false, message: 'Invalid JSON in request.' });
  }
  console.error(err);
  res.status(500).json({ success: false, message: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`Digital Khata server running at http://localhost:${PORT}`);
});