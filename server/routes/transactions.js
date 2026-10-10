const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/auth');
const { round2, todayStr, isValidDate } = require('../utils/ledger');

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
      `SELECT t.*
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE t.id = ? AND c.user_id = ?`
    )
    .get(id, userId);
}

// GET /api/transactions?q=&type=&status=&from=&to=
router.get('/', (req, res) => {
  const q = String(req.query.q || '').trim();
  const like = `%${q}%`;
  const type = ['credit', 'payment'].includes(req.query.type) ? req.query.type : '';
  const status = ['active', 'reversed'].includes(req.query.status) ? req.query.status : '';
  const from = isValidDate(String(req.query.from || '')) ? String(req.query.from) : '';
  const to = isValidDate(String(req.query.to || '')) ? String(req.query.to) : '';

  const rows = db
    .prepare(
      `SELECT t.id, t.customer_id, c.name AS customer_name, c.phone AS customer_phone,
              t.type, t.amount, t.note, t.entry_date, t.due_date,
              t.is_reversed, t.reversal_of, t.reversal_reason
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE c.user_id = ?
         AND (? = '' OR c.name LIKE ? OR c.phone LIKE ? OR t.note LIKE ?)
         AND (? = '' OR t.type = ?)
         AND (? = '' OR (? = 'active' AND t.is_reversed = 0) OR (? = 'reversed' AND t.is_reversed = 1))
         AND (? = '' OR t.entry_date >= ?)
         AND (? = '' OR t.entry_date <= ?)
       ORDER BY t.entry_date DESC, t.id DESC
       LIMIT 300`
    )
    .all(req.userId, q, like, like, like, type, type, status, status, status, from, from, to, to);

  const data = rows.map((r) => ({
    id: r.id,
    customer_id: r.customer_id,
    customer_name: r.customer_name,
    customer_phone: r.customer_phone,
    type: r.type,
    amount: round2(r.amount),
    note: r.note,
    entry_date: r.entry_date,
    due_date: r.due_date,
    status: r.reversal_of ? 'reversal' : r.is_reversed ? 'reversed' : 'active',
    reversal_of: r.reversal_of,
    reversal_reason: r.reversal_reason,
  }));

  res.json({ success: true, data });
});

// POST /api/transactions/:id/reverse   body: { reason }
router.post('/:id/reverse', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction id.' });

  const reason = String(req.body.reason || '').trim();
  if (reason.length > 200) {
    return res.status(400).json({ success: false, message: 'Reason must be 200 characters or fewer.' });
  }

  const tx = getOwnedTransaction(id, req.userId);
  if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found.' });
  if (tx.reversal_of) {
    return res.status(400).json({ success: false, message: 'A reversal entry cannot be reversed.' });
  }
  if (tx.is_reversed) {
    return res.status(409).json({ success: false, message: 'This transaction is already reversed.' });
  }

  const opposite = tx.type === 'credit' ? 'payment' : 'credit';

  // Both changes happen together or not at all
  const run = db.transaction(() => {
    db.prepare('UPDATE transactions SET is_reversed = 1, reversal_reason = ? WHERE id = ?').run(reason || null, tx.id);
    const result = db
      .prepare(
        `INSERT INTO transactions
           (customer_id, type, amount, note, entry_date, due_date, is_reversed, reversal_of, reversal_reason)
         VALUES (?, ?, ?, ?, ?, NULL, 1, ?, ?)`
      )
      .run(tx.customer_id, opposite, tx.amount, `Reversal of entry #${tx.id}`, todayStr(), tx.id, reason || null);
    return result.lastInsertRowid;
  });

  const reversalId = run();
  res.json({ success: true, data: { original_id: tx.id, reversal_id: reversalId } });
});

// DELETE /api/transactions/:id
router.delete('/:id', (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ success: false, message: 'Invalid transaction id.' });

  const tx = getOwnedTransaction(id, req.userId);
  if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found.' });
  if (tx.reversal_of) {
    return res.status(400).json({ success: false, message: 'Delete the original entry instead of its reversal.' });
  }

  // Delete the entry together with any reversal entry that points to it
  const run = db.transaction(() => {
    db.prepare('DELETE FROM transactions WHERE reversal_of = ?').run(id);
    db.prepare('DELETE FROM transactions WHERE id = ?').run(id);
  });
  run();

  res.json({ success: true, data: { id } });
});

module.exports = router;