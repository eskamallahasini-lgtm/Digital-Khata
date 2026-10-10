// Shared helpers: dates, money rounding, FIFO allocation, reminders.

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

function toCents(n) {
  return Math.round(Number(n) * 100);
}

// Today as YYYY-MM-DD in the server's local time
function todayStr() {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

// Strict check for a real calendar date in YYYY-MM-DD format
function isValidDate(s) {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Whole days from date b to date a (a - b)
function daysBetween(a, b) {
  return Math.round((Date.parse(a + 'T00:00:00Z') - Date.parse(b + 'T00:00:00Z')) / 86400000);
}

/**
 * FIFO allocation for ONE customer.
 * All payments form a pool that is applied to credit entries oldest first
 * (by entry_date, then id). Returns the credit entries with `remaining` set.
 */
function allocateFifo(transactions) {
  const sorted = [...transactions].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id
  );

  let pool = sorted
    .filter((t) => t.type === 'payment')
    .reduce((sum, t) => sum + toCents(t.amount), 0);

  const credits = [];
  for (const t of sorted) {
    if (t.type !== 'credit') continue;
    const amountCents = toCents(t.amount);
    const applied = Math.min(pool, amountCents);
    pool -= applied;
    credits.push({ ...t, remaining: (amountCents - applied) / 100 });
  }
  return credits;
}

/**
 * All unpaid credit entries (with a due date) for one shopkeeper,
 * sorted by nearest due date first.
 */
function getReminders(db, userId) {
  const rows = db
    .prepare(
      `SELECT t.id, t.customer_id, t.type, t.amount, t.note, t.entry_date, t.due_date,
              c.name AS customer_name, c.phone AS customer_phone
       FROM transactions t
       JOIN customers c ON c.id = t.customer_id
       WHERE c.user_id = ? AND t.is_reversed = 0`
    )
    .all(userId);

  // Group by customer
  const byCustomer = {};
  for (const r of rows) {
    (byCustomer[r.customer_id] = byCustomer[r.customer_id] || []).push(r);
  }

  const today = todayStr();
  const reminders = [];

  for (const list of Object.values(byCustomer)) {
    for (const credit of allocateFifo(list)) {
      if (!credit.due_date || credit.remaining <= 0) continue;
      const diff = daysBetween(credit.due_date, today);
      reminders.push({
        transaction_id: credit.id,
        customer_id: credit.customer_id,
        customer_name: credit.customer_name,
        customer_phone: credit.customer_phone,
        original_amount: round2(credit.amount),
        remaining_amount: round2(credit.remaining),
        entry_date: credit.entry_date,
        due_date: credit.due_date,
        note: credit.note || '',
        status: diff < 0 ? 'overdue' : diff === 0 ? 'due_today' : 'upcoming',
        days: Math.abs(diff), // days overdue OR days remaining
      });
    }
  }

  reminders.sort(
    (a, b) => a.due_date.localeCompare(b.due_date) || a.transaction_id - b.transaction_id
  );
  return reminders;
}

/**
 * Customer risk tag based on payment history.
 * Looks at credit entries that have a due date and checks whether they were
 * fully paid on time (FIFO). Returns 'reliable' | 'sometimes' | 'late' | null.
 * Needs at least 2 credits with due dates, otherwise there is not enough history.
 */
function computeRisk(transactions) {
  const sorted = [...transactions].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.id - b.id
  );

  let paidSoFar = 0;
  const payments = [];
  for (const t of sorted) {
    if (t.type === 'payment') {
      paidSoFar += toCents(t.amount);
      payments.push({ date: t.entry_date, cum: paidSoFar });
    }
  }

  const today = todayStr();
  let creditSoFar = 0;
  let withDue = 0;
  let late = 0;

  for (const t of sorted) {
    if (t.type !== 'credit') continue;
    creditSoFar += toCents(t.amount);
    if (!t.due_date) continue;
    withDue += 1;
    const settled = payments.find((p) => p.cum >= creditSoFar);
    if (settled) {
      if (settled.date > t.due_date) late += 1;
    } else if (t.due_date < today) {
      late += 1;
    }
  }

  if (withDue < 2) return null;
  const ratio = late / withDue;
  if (ratio === 0) return 'reliable';
  if (ratio >= 0.5) return 'late';
  return 'sometimes';
}

module.exports = { round2, toCents, todayStr, isValidDate, daysBetween, allocateFifo, getReminders, computeRisk };