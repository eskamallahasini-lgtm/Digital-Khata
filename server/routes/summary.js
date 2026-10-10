const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/auth');
const { round2, getReminders } = require('../utils/ledger');

const router = express.Router();
router.use(auth);

// GET /api/summary
router.get('/summary', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.id,
              COALESCE(SUM(CASE WHEN t.type = 'credit'  THEN t.amount END), 0) -
              COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount END), 0) AS balance
       FROM customers c
       LEFT JOIN transactions t ON t.customer_id = c.id AND t.is_reversed = 0
       WHERE c.user_id = ?
       GROUP BY c.id`
    )
    .all(req.userId);

  let totalOutstanding = 0;
  let customersWithDue = 0;
  for (const r of rows) {
    const b = round2(r.balance);
    if (b > 0) {
      totalOutstanding += b;
      customersWithDue += 1;
    }
  }

  const reminders = getReminders(db, req.userId);
  const collectToday = reminders.filter((r) => r.status === 'overdue' || r.status === 'due_today');

  res.json({
    success: true,
    data: {
      total_outstanding: round2(totalOutstanding),
      total_customers: rows.length,
      customers_with_balance: customersWithDue,
      overdue_count: reminders.filter((r) => r.status === 'overdue').length,
      upcoming_count: reminders.filter((r) => r.status !== 'overdue').length,
      collect_today_count: collectToday.length,
      collect_today_amount: round2(collectToday.reduce((s, r) => s + r.remaining_amount, 0)),
      reminders_preview: reminders.slice(0, 5),
    },
  });
});

// GET /api/reminders
router.get('/reminders', (req, res) => {
  res.json({ success: true, data: getReminders(db, req.userId) });
});

// GET /api/monthly  (last 6 months with entries: credit given vs payments received)
router.get('/monthly', (req, res) => {
  const rows = db
    .prepare(
      `SELECT substr(t.entry_date, 1, 7) AS month,
              COALESCE(SUM(CASE WHEN t.type = 'credit'  THEN t.amount END), 0) AS credit,
              COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount END), 0) AS payment
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE c.user_id = ?
       GROUP BY month
       ORDER BY month DESC
       LIMIT 6`
    )
    .all(req.userId);

  const data = rows.reverse().map((r) => ({
    month: r.month,
    credit: round2(r.credit),
    payment: round2(r.payment),
  }));
  res.json({ success: true, data });
});

// CSV helper. A leading = + - @ is neutralised so Excel never runs it as a formula.
function csvCell(value) {
  let s = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// GET /api/export  (this shopkeeper's data only)
router.get('/export', (req, res) => {
  const rows = db
    .prepare(
      `SELECT c.name, c.phone, t.type, t.amount, t.note, t.entry_date, t.due_date
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE c.user_id = ?
       ORDER BY c.name COLLATE NOCASE, t.entry_date, t.id`
    )
    .all(req.userId);

  const lines = [['Customer', 'Phone', 'Type', 'Amount', 'Note', 'Entry date', 'Due date'].join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.name,
        r.phone,
        r.type === 'credit' ? 'You Gave' : 'You Got',
        r.amount,
        r.note,
        r.entry_date,
        r.due_date,
      ]
        .map(csvCell)
        .join(',')
    );
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="digital-khata-export.csv"');
  res.send('\uFEFF' + lines.join('\r\n')); // BOM so Excel reads ₹ and Indian names correctly
});

module.exports = router;