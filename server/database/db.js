// Opens the SQLite database and creates tables automatically.
const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'khata.db');
const db = new Database(dbPath);

// Enforce foreign keys and use a safer journal mode
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shop_name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    passwordHash TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('credit', 'payment')),
    amount REAL NOT NULL CHECK (amount > 0),
    note TEXT,
    entry_date TEXT NOT NULL,
    due_date TEXT,
    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);
  CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_phone ON customers(user_id, phone);
  CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_due ON transactions(due_date);
`);

// ---- Upgrade for transaction reversal (safe to run many times) ----
// is_reversed = 1 on the ORIGINAL entry and on its REVERSAL entry, so both are
// ignored in balances. reversal_of points from the reversal entry to the original.
const cols = db.prepare('PRAGMA table_info(transactions)').all().map((c) => c.name);
if (!cols.includes('is_reversed')) {
  db.exec('ALTER TABLE transactions ADD COLUMN is_reversed INTEGER NOT NULL DEFAULT 0');
}
if (!cols.includes('reversal_of')) {
  db.exec('ALTER TABLE transactions ADD COLUMN reversal_of INTEGER REFERENCES transactions(id)');
}
if (!cols.includes('reversal_reason')) {
  db.exec('ALTER TABLE transactions ADD COLUMN reversal_reason TEXT');
}
db.exec('CREATE INDEX IF NOT EXISTS idx_transactions_active ON transactions(customer_id, is_reversed)');

module.exports = db;