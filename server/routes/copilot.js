// Khata Copilot: understands simple English messages (typed or spoken).
// It only READS data. For any change it returns a "pending_action"
// that the user must confirm; the frontend then calls the normal, validated API.
const express = require('express');
const db = require('../database/db');
const auth = require('../middleware/auth');
const { round2, todayStr, getReminders } = require('../utils/ledger');

const router = express.Router();
router.use(auth);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = (s) => {
  const [y, m, d] = s.split('-');
  return `${d} ${MONTHS[Number(m) - 1]} ${y}`;
};
const money = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const typeLabel = (t) => (t === 'credit' ? 'You Gave' : 'You Got');
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

const HELP = `I can help with:
- "How much does Ramesh owe?"
- "Total outstanding"  •  "Who is overdue?"
- "Top customers who owe"  •  "Recent transactions"
- "Give Ramesh 500 credit due in 7 days"
- "Ramesh paid 300"
- "Remind Ramesh" (WhatsApp draft)
- "Reverse last entry of Ramesh"

Tip: say "paid" or "received" for payments, and "credit" or "gave" for credit.`;

function getCustomersWithBalance(userId) {
  return db
    .prepare(
      `SELECT c.id, c.name, c.phone,
              COALESCE(SUM(CASE WHEN t.type = 'credit'  THEN t.amount END), 0) -
              COALESCE(SUM(CASE WHEN t.type = 'payment' THEN t.amount END), 0) AS balance
       FROM customers c
       LEFT JOIN transactions t ON t.customer_id = c.id AND t.is_reversed = 0
       WHERE c.user_id = ?
       GROUP BY c.id`
    )
    .all(userId)
    .map((r) => ({ ...r, balance: round2(r.balance) }));
}

// Finds which customer the message is about
function findCustomer(lower, customers) {
  const words = lower.split(/[^a-z0-9]+/).filter(Boolean);

  const full = customers.filter((c) => lower.includes(c.name.toLowerCase()));
  if (full.length) {
    full.sort((a, b) => b.name.length - a.name.length);
    return { customer: full[0] };
  }

  const partial = customers.filter((c) =>
    c.name.toLowerCase().split(/\s+/).some((tok) => tok.length >= 3 && words.includes(tok))
  );
  if (partial.length === 1) return { customer: partial[0] };
  if (partial.length > 1) return { ambiguous: partial };
  return {};
}

// Pulls out the amount and an optional "due in N days" phrase
function parseMessage(lower) {
  let text = lower.replace(/₹|\brs\b\.?|\brupees?\b/g, ' ').replace(/,/g, '');
  let dueDays = null;
  let m;
  if ((m = text.match(/due\s+(?:in|after)\s+(\d+)\s+weeks?/))) {
    dueDays = Number(m[1]) * 7;
    text = text.replace(m[0], ' ');
  } else if ((m = text.match(/due\s+(?:in|after)\s+(\d+)\s+days?/))) {
    dueDays = Number(m[1]);
    text = text.replace(m[0], ' ');
  } else if (/due\s+tomorrow/.test(text)) {
    dueDays = 1;
    text = text.replace(/due\s+tomorrow/, ' ');
  }
  const am = text.match(/\d+(?:\.\d+)?/);
  return { text, amount: am ? Number(am[0]) : null, dueDays };
}

function detectType(text) {
  if (
    /\b(paid|pay|payment|received|receive|got|returned|return|repaid|settled|settle|deposited|liya|jama)\b/.test(text) ||
    /\b(gave|give|given)\s+me\b/.test(text)
  ) {
    return 'payment';
  }
  if (/\b(credit|gave|give|given|took|taken|borrowed|borrow|udhar|udhaar|diya|lent|bought)\b/.test(text)) {
    return 'credit';
  }
  return null;
}

// POST /api/copilot   body: { message }
router.post('/', (req, res) => {
  const message = String(req.body.message || '').trim();
  if (!message) return res.status(400).json({ success: false, message: 'Please type or say something.' });
  if (message.length > 300) return res.status(400).json({ success: false, message: 'Message is too long.' });

  const send = (reply, extra = {}) => res.json({ success: true, data: { reply, ...extra } });

  const lower = message.toLowerCase();
  const customers = getCustomersWithBalance(req.userId);
  const found = findCustomer(lower, customers);
  const customer = found.customer || null;
  const { text, amount, dueDays } = parseMessage(lower);
  const txType = detectType(text);

  // ---- Help ----
  if (/\b(help|what can you do|commands)\b/.test(lower)) return send(HELP);

  // ---- Several customers match ----
  if (found.ambiguous) {
    return send(
      `I found more than one match: ${found.ambiguous.map((c) => c.name).join(', ')}.\nPlease say the full name.`
    );
  }

  // ---- Reverse a transaction (needs confirmation) ----
  if (/\b(reverse|undo|revert|cancel)\b/.test(lower)) {
    let sql = `SELECT t.id, t.type, t.amount, t.entry_date, c.name
               FROM transactions t JOIN customers c ON c.id = t.customer_id
               WHERE c.user_id = ? AND t.is_reversed = 0`;
    const params = [req.userId];
    if (customer) {
      sql += ' AND c.id = ?';
      params.push(customer.id);
    }
    if (amount) {
      sql += ' AND t.amount = ?';
      params.push(amount);
    }
    sql += ' ORDER BY t.entry_date DESC, t.id DESC LIMIT 1';
    const tx = db.prepare(sql).get(...params);
    if (!tx) return send('I could not find a matching entry to reverse.');
    return send(
      `Reverse this entry?\n${typeLabel(tx.type)} ${money(tx.amount)} for ${tx.name} on ${fmt(tx.entry_date)}`,
      { pending_action: { kind: 'reverse', transaction_id: tx.id } }
    );
  }

  // ---- Add a credit / payment (needs confirmation) ----
  if (txType && amount) {
    if (!customer) {
      return send('I could not find that customer. Check the spelling, or add the customer first.');
    }
    if (amount <= 0) return send('The amount must be greater than zero.');
    const dueDate = txType === 'credit' && dueDays !== null ? addDays(todayStr(), dueDays) : null;
    return send(
      `Ready to record:\n${typeLabel(txType)} ${money(amount)} for ${customer.name}` +
        (dueDate ? `\nDue date: ${fmt(dueDate)}` : '') +
        '\nPlease confirm.',
      {
        pending_action: {
          kind: 'add_transaction',
          customer_id: customer.id,
          type: txType,
          amount,
          note: 'Added via Copilot',
          due_date: dueDate,
        },
      }
    );
  }

  // ---- Draft a WhatsApp reminder ----
  if (customer && /\b(remind|reminder|message|whatsapp|sms|nudge|notify)\b/.test(lower)) {
    if (customer.balance <= 0) return send(`${customer.name} has no pending balance, so no reminder is needed.`);
    const shop = db.prepare('SELECT shop_name FROM users WHERE id = ?').get(req.userId);
    const msg =
      `Hello ${customer.name}, this is a friendly reminder from ${shop.shop_name}. ` +
      `Your pending balance is ${money(customer.balance)}. ` +
      `Please pay at your earliest convenience. Thank you!`;
    return send(`Here is a reminder draft for ${customer.name}:\n\n"${msg}"`, {
      whatsapp_url: `https://wa.me/91${customer.phone}?text=${encodeURIComponent(msg)}`,
    });
  }

  // ---- Questions about one customer ----
  if (customer) {
    const rems = getReminders(db, req.userId).filter((r) => r.customer_id === customer.id);
    const lines = [];
    if (customer.balance > 0) lines.push(`${customer.name} owes you ${money(customer.balance)}.`);
    else if (customer.balance < 0) lines.push(`${customer.name} has paid ${money(-customer.balance)} extra (advance).`);
    else lines.push(`${customer.name} has no pending balance. All settled ✅`);

    if (rems.length) {
      const r = rems[0];
      if (r.status === 'overdue') {
        lines.push(`⚠️ ${money(r.remaining_amount)} is overdue by ${plural(r.days, 'day')} (due ${fmt(r.due_date)}).`);
      } else if (r.status === 'due_today') {
        lines.push(`Due today: ${money(r.remaining_amount)}.`);
      } else {
        lines.push(`Next due: ${money(r.remaining_amount)} on ${fmt(r.due_date)} (${plural(r.days, 'day')} left).`);
      }
    }

    const last = db
      .prepare(
        `SELECT type, amount, entry_date, note FROM transactions
         WHERE customer_id = ? AND is_reversed = 0
         ORDER BY entry_date DESC, id DESC LIMIT 3`
      )
      .all(customer.id);
    if (last.length) {
      lines.push('\nRecent entries:');
      for (const t of last) {
        lines.push(`• ${fmt(t.entry_date)}: ${typeLabel(t.type)} ${money(t.amount)}${t.note ? ' (' + t.note + ')' : ''}`);
      }
    }
    return send(lines.join('\n'), { link: `/customers/${customer.id}` });
  }

  // ---- Overdue ----
  if (/\b(overdue|late|past due|missed)\b/.test(lower)) {
    const overdue = getReminders(db, req.userId).filter((r) => r.status === 'overdue');
    if (!overdue.length) return send('Great news! Nothing is overdue right now 🎉');
    const total = overdue.reduce((s, r) => s + r.remaining_amount, 0);
    const lines = [`${plural(overdue.length, 'overdue payment')}, total ${money(total)}:`];
    for (const r of overdue.slice(0, 5)) {
      lines.push(`• ${r.customer_name}: ${money(r.remaining_amount)} (${plural(r.days, 'day')} overdue)`);
    }
    if (overdue.length > 5) lines.push(`...and ${overdue.length - 5} more.`);
    return send(lines.join('\n'), { link: '/reminders' });
  }

  // ---- Number of customers ----
  if (/how many customers|number of customers|customer count/.test(lower)) {
    return send(`You have ${plural(customers.length, 'customer')}.`);
  }

  // ---- Total outstanding ----
  if (/\b(total|outstanding|collect|receivable)\b/.test(lower)) {
    const owing = customers.filter((c) => c.balance > 0);
    const total = owing.reduce((s, c) => s + c.balance, 0);
    return send(`Total outstanding: ${money(total)} from ${plural(owing.length, 'customer')}.`);
  }

  // ---- Top customers who owe ----
  if (/\b(top|most|highest|biggest|largest|defaulters?)\b/.test(lower)) {
    const top = customers.filter((c) => c.balance > 0).sort((a, b) => b.balance - a.balance).slice(0, 5);
    if (!top.length) return send('Nobody owes you anything right now.');
    return send(['Customers who owe the most:', ...top.map((c, i) => `${i + 1}. ${c.name}: ${money(c.balance)}`)].join('\n'));
  }

  // ---- Upcoming dues ----
  if (/\b(upcoming|reminders?|dues?|due soon|this week)\b/.test(lower)) {
    const upcoming = getReminders(db, req.userId).filter((r) => r.status !== 'overdue');
    if (!upcoming.length) return send('No upcoming due dates.');
    const lines = ['Upcoming dues:'];
    for (const r of upcoming.slice(0, 5)) {
      lines.push(`• ${r.customer_name}: ${money(r.remaining_amount)} on ${fmt(r.due_date)}`);
    }
    return send(lines.join('\n'), { link: '/reminders' });
  }

  // ---- Recent transactions ----
  if (/\b(recent|latest|last|history|transactions?|today)\b/.test(lower)) {
    const rows = db
      .prepare(
        `SELECT t.type, t.amount, t.entry_date, c.name
         FROM transactions t JOIN customers c ON c.id = t.customer_id
         WHERE c.user_id = ? AND t.is_reversed = 0
         ORDER BY t.entry_date DESC, t.id DESC LIMIT 5`
      )
      .all(req.userId);
    if (!rows.length) return send('No transactions yet.');
    return send(
      ['Latest transactions:', ...rows.map((t) => `• ${fmt(t.entry_date)}: ${typeLabel(t.type)} ${money(t.amount)} (${t.name})`)].join('\n'),
      { link: '/transactions' }
    );
  }

  // ---- Overview ----
  if (/\b(summary|overview|status|report)\b/.test(lower)) {
    const owing = customers.filter((c) => c.balance > 0);
    const total = owing.reduce((s, c) => s + c.balance, 0);
    const rems = getReminders(db, req.userId);
    const overdue = rems.filter((r) => r.status === 'overdue').length;
    return send(
      `Overview:\n• Outstanding: ${money(total)}\n• Customers: ${customers.length} (${owing.length} owing)\n• Overdue: ${overdue}\n• Upcoming: ${rems.length - overdue}`
    );
  }

  return send("Sorry, I didn't understand that. Type \"help\" to see what I can do.");
});

module.exports = router;