const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_DIR = path.join(__dirname, '.freebuff');
const DB_PATH = path.join(DB_DIR, 'budgeting.db');
let db;

function getDB() {
  if (!db) {
    // Ensure the directory exists before creating the database
    if (!fs.existsSync(DB_DIR)) {
      fs.mkdirSync(DB_DIR, { recursive: true });
    }
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function initDB() {
  const db = getDB();

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      color TEXT DEFAULT '#6366f1',
      icon TEXT DEFAULT 'tag',
      parent_id INTEGER,
      FOREIGN KEY (parent_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plaid_account_id TEXT UNIQUE,
      name TEXT NOT NULL,
      type TEXT,
      subtype TEXT,
      balance REAL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS plaid_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      item_id TEXT UNIQUE NOT NULL,
      access_token TEXT NOT NULL,
      institution_name TEXT,
      cursor TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      plaid_transaction_id TEXT UNIQUE,
      account_id INTEGER,
      amount REAL NOT NULL,
      date TEXT NOT NULL,
      name TEXT NOT NULL,
      merchant TEXT,
      category_id INTEGER,
      category_confidence TEXT,
      pending INTEGER DEFAULT 0,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES accounts(id),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS budgets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      category_id INTEGER,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      alert_threshold REAL DEFAULT 0.8,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS savings_goals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      target_amount REAL NOT NULL,
      current_amount REAL DEFAULT 0,
      target_date TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id);
    CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category_id);
  `);

  // Seed default categories if none exist
  const count = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (count.count === 0) {
    seedCategories(db);
  }

  console.log('Database initialized successfully');
}

function seedCategories(db) {
  const insert = db.prepare('INSERT INTO categories (name, color, icon, parent_id) VALUES (?, ?, ?, ?)');
  const categories = [
    ['Food & Dining', '#ef4444', 'utensils', null],
    ['Groceries', '#f97316', 'shopping-cart', 1],
    ['Restaurants', '#ef4444', 'coffee', 1],
    ['Transportation', '#3b82f6', 'car', null],
    ['Gas', '#3b82f6', 'fuel', 4],
    ['Public Transit', '#6366f1', 'train', 4],
    ['Shopping', '#8b5cf6', 'shopping-bag', null],
    ['Clothing', '#a855f7', 'shirt', 7],
    ['Electronics', '#8b5cf6', 'smartphone', 7],
    ['Entertainment', '#ec4899', 'music', null],
    ['Movies & Shows', '#ec4899', 'film', 10],
    ['Hobbies', '#f43f5e', 'gamepad', 10],
    ['Housing', '#14b8a6', 'home', null],
    ['Rent/Mortgage', '#14b8a6', 'building', 13],
    ['Utilities', '#06b6d4', 'zap', 13],
    ['Healthcare', '#22c55e', 'heart', null],
    ['Income', '#10b981', 'trending-up', null],
    ['Salary', '#10b981', 'briefcase', 17],
    ['Transfer', '#6b7280', 'repeat', null],
    ['Other', '#6b7280', 'more-horizontal', null],
  ];

  const insertMany = db.transaction(() => {
    for (const cat of categories) {
      insert.run(...cat);
    }
  });
  insertMany();
}

module.exports = { getDB, initDB };
