const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/auth');
const { round2, toCents, todayStr, isValidDate, allocateFifo, computeRisk } = require('../utils/ledger');

const router = express.Router();
router.use(auth); // every route below requires login

// Returns the customer only if it belongs to the logged-in shopkeeper
function getOwnedCustomer(customerId, userId) {
  return db
    .prepare('SELECT id, name, phone, created_at FROM customers WHERE id = ? AND user_id = ?')
    .get(customerId, userId);
}

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// GET /api/customers?q=search
// GET /api/customers?q=search
router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;

  const rows = db
    .prepare(
      `SELECT c.id, c.name, c.phone, c.created_at,
              COALESCE(SUM(CASE WHEN t.type = 'credit'  THEN t.amount END), 0) AS total_credit,
              COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount END), 0) AS total_payments
       FROM customers c
       LEFT JOIN transactions t ON t.customer_id = c.id
       WHERE c.user_id = ? AND (? = '' OR c.name LIKE ? OR c.phone LIKE ?)
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE`
    )
    .all(req.userId, q, like, like);

  // All transactions of this shopkeeper, grouped by customer, for the risk tag
  const txRows = db
    .prepare(
      `SELECT t.id, t.customer_id, t.type, t.amount, t.entry_date, t.due_date
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE c.user_id = ?`
    )
    .all(req.userId);
  const grouped = {};
  for (const t of txRows) (grouped[t.customer_id] = grouped[t.customer_id] || []).push(t);

  const customers = rows.map((r) => ({
    ...r,
    total_credit: round2(r.total_credit),
    total_payments: round2(r.total_payments),
    balance: round2(r.total_credit - r.total_payments),
    risk: computeRisk(grouped[r.id] || []),
  }));

  res.json({ success: true, data: customers });
});

// POST /api/customers
router.post('/', (req, res) => {
  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Customer name and phone number are required.' });
  }
  if (name.length > 80) {
    return res.status(400).json({ success: false, message: 'Name is too long.' });
  }
  if (!/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
  }

  const duplicate = db
    .prepare('SELECT id FROM customers WHERE user_id = ? AND phone = ?')
    .get(req.userId, phone);
  if (duplicate) {
    return res.status(409).json({ success: false, message: 'A customer with this phone number already exists.' });
  }

  const result = db
    .prepare('INSERT INTO customers (user_id, name, phone) VALUES (?, ?, ?)')
    .run(req.userId, name, phone);

  const customer = db.prepare('SELECT id, name, phone, created_at FROM customers WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({
    success: true,
    data: { ...customer, total_credit: 0, total_payments: 0, balance: 0 },
  });
});

// GET /api/customers/:id/ledger
router.get('/:id/ledger', (req, res) => {
  const customerId = parseId(req.params.id);
  if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer id.' });

  const customer = getOwnedCustomer(customerId, req.userId);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

  const txns = db
    .prepare(
      `SELECT id, type, amount, note, entry_date, due_date
       FROM transactions WHERE customer_id = ?`
    )
    .all(customerId);

  // Running balance is calculated oldest -> newest, so it is correct
  // no matter how the list is displayed afterwards.
  const chronological = [...txns].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id
  );
  let runningCents = 0;
  const runningById = {};
  for (const t of chronological) {
    runningCents += t.type === 'credit' ? toCents(t.amount) : -toCents(t.amount);
    runningById[t.id] = runningCents / 100;
  }

  // Remaining unpaid amount on each credit entry (FIFO)
  const remainingById = {};
  for (const c of allocateFifo(txns)) remainingById[c.id] = c.remaining;

  // Newest first for display
  const transactions = [...chronological].reverse().map((t) => ({
    ...t,
    amount: round2(t.amount),
    running_balance: round2(runningById[t.id]),
    remaining: t.type === 'credit' ? round2(remainingById[t.id]) : null,
  }));

  const totals = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN type = 'credit'  THEN amount END), 0) AS total_credit,
              COALESCE(SUM(CASE WHEN type = 'payment' THEN amount END), 0) AS total_payments
       FROM transactions WHERE customer_id = ?`
    )
    .get(customerId);

  res.json({
    success: true,
    data: {
      customer,
      total_credit: round2(totals.total_credit),
      total_payments: round2(totals.total_payments),
      balance: round2(totals.total_credit - totals.total_payments),
      risk: computeRisk(txns),
      transactions,
    },
  });
});

// POST /api/customers/:id/transactions
router.post('/:id/transactions', (req, res) => {
  const customerId = parseId(req.params.id);
  if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer id.' });

  const customer = getOwnedCustomer(customerId, req.userId);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

  const type = req.body.type;
  const amount = Number(req.body.amount);
  const note = String(req.body.note || '').trim();
  const entryDate = req.body.entry_date ? String(req.body.entry_date) : todayStr();
  const dueDateRaw = req.body.due_date ? String(req.body.due_date) : null;

  if (type !== 'credit' && type !== 'payment') {
    return res.status(400).json({ success: false, message: 'Transaction type must be credit or payment.' });
  }
  if (!Number.isFinite(amount) || round2(amount) <= 0) {
    return res.status(400).json({ success: false, message: 'Amount must be greater than zero.' });
  }
  if (amount > 100000000) {
    return res.status(400).json({ success: false, message: 'Amount is too large.' });
  }
  if (note.length > 200) {
    return res.status(400).json({ success: false, message: 'Note must be 200 characters or fewer.' });
  }
  if (!isValidDate(entryDate)) {
    return res.status(400).json({ success: false, message: 'Entry date is invalid. Use YYYY-MM-DD.' });
  }

  // Due date only makes sense for credit entries
  let dueDate = null;
  if (type === 'credit' && dueDateRaw) {
    if (!isValidDate(dueDateRaw)) {
      return res.status(400).json({ success: false, message: 'Due date is invalid. Use YYYY-MM-DD.' });
    }
    if (dueDateRaw < entryDate) {
      return res.status(400).json({ success: false, message: 'Due date cannot be before the entry date.' });
    }
    dueDate = dueDateRaw;
  }

  const result = db
    .prepare(
      `INSERT INTO transactions (customer_id, type, amount, note, entry_date, due_date)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(customerId, type, round2(amount), note || null, entryDate, dueDate);

  res.status(201).json({
    success: true,
    data: { id: result.lastInsertRowid, customer_id: customerId, type, amount: round2(amount), note, entry_date: entryDate, due_date: dueDate },
  });
});
// PUT /api/customers/:id  (edit name / phone)
router.put('/:id', (req, res) => {
  const customerId = parseId(req.params.id);
  if (!customerId) return res.status(400).json({ success: false, message: 'Invalid customer id.' });

  const customer = getOwnedCustomer(customerId, req.userId);
  if (!customer) return res.status(404).json({ success: false, message: 'Customer not found.' });

  const name = String(req.body.name || '').trim();
  const phone = String(req.body.phone || '').trim();

  if (!name || !phone) {
    return res.status(400).json({ success: false, message: 'Customer name and phone number are required.' });
  }
  if (name.length > 80) {
    return res.status(400).json({ success: false, message: 'Name is too long.' });
  }
  if (!/^[0-9]{10}$/.test(phone)) {
    return res.status(400).json({ success: false, message: 'Phone number must be exactly 10 digits.' });
  }

  const duplicate = db
    .prepare('SELECT id FROM customers WHERE user_id = ? AND phone = ? AND id <> ?')
    .get(req.userId, phone, customerId);
  if (duplicate) {
    return res.status(409).json({ success: false, message: 'Another customer already has this phone number.' });
  }

  db.prepare('UPDATE customers SET name = ?, phone = ? WHERE id = ?').run(name, phone, customerId);
  res.json({ success: true, data: { id: customerId, name, phone } });
});

module.exports = router;