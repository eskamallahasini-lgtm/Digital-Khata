const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/auth');
const { round2, isValidDate } = require('../utils/ledger');

const router = express.Router();
router.use(auth);

function parseId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// Returns the transaction only if it belongs to one of THIS shopkeeper's customers
function getOwnedTransaction(id, userId) {
  return db
    .prepare(
      `SELECT t.id, t.type
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE t.id = ? AND c.user_id = ?`
    )
    .get(id, userId);
}

// PUT /api/transactions/:id  (edit amount, note, dates; the type cannot change)
router.put('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction id.' });

  const existing = getOwnedTransaction(id, req.userId);
  if (!existing) return res.status(404).json({ success: false, message: 'Transaction not found.' });

  const amount = Number(req.body.amount);
  const note = String(req.body.note || '').trim();
  const entryDate = req.body.entry_date ? String(req.body.entry_date) : '';
  const dueDateRaw = req.body.due_date ? String(req.body.due_date) : null;

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

  let dueDate = null;
  if (existing.type === 'credit' && dueDateRaw) {
    if (!isValidDate(dueDateRaw)) {
      return res.status(400).json({ success: false, message: 'Due date is invalid. Use YYYY-MM-DD.' });
    }
    if (dueDateRaw < entryDate) {
      return res.status(400).json({ success: false, message: 'Due date cannot be before the entry date.' });
    }
    dueDate = dueDateRaw;
  }

  db.prepare(
    'UPDATE transactions SET amount = ?, note = ?, entry_date = ?, due_date = ? WHERE id = ?'
  ).run(round2(amount), note || null, entryDate, dueDate, id);

  res.json({ success: true, data: { id } });
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction id.' });

  if (!getOwnedTransaction(id, req.userId)) {
    return res.status(404).json({ success: false, message: 'Transaction not found.' });
  }

  db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  res.json({ success: true, data: { id } });
});

module.exports = router;