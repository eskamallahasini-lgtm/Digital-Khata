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

module.exports = db;