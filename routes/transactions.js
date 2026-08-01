const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/transactions - list transactions with pagination & filters
router.get('/', (req, res) => {
  const db = getDB();
  const {
    page = 1,
    limit = 50,
    category_id,
    account_id,
    start_date,
    end_date,
    search,
    sort = 'date',
    order = 'desc',
    min_amount,
    max_amount,
  } = req.query;

  const offset = (page - 1) * limit;
  let where = ['1=1'];
  let params = [];

  if (category_id) {
    // Include subcategories
    const subIds = db.prepare(`SELECT id FROM categories WHERE parent_id = ?`).all(category_id).map(c => c.id);
    const allIds = [parseInt(category_id), ...subIds];
    where.push(`t.category_id IN (${allIds.map(() => '?').join(',')})`);
    params.push(...allIds);
  }
  if (account_id) { where.push('t.account_id = ?'); params.push(account_id); }
  if (start_date) { where.push('t.date >= ?'); params.push(start_date); }
  if (end_date) { where.push('t.date <= ?'); params.push(end_date); }
  if (search) { where.push('(t.name LIKE ? OR t.merchant LIKE ?)'); params.push(`%${search}%`, `%${search}%`); }
  if (min_amount) { where.push('ABS(t.amount) >= ?'); params.push(min_amount); }
  if (max_amount) { where.push('ABS(t.amount) <= ?'); params.push(max_amount); }

  try {
    const total = db.prepare(`SELECT COUNT(*) as count FROM transactions t WHERE ${where.join(' AND ')}`).get(...params);
    const transactions = db.prepare(`
      SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
             a.name as account_name
      FROM transactions t
      LEFT JOIN categories c ON t.category_id = c.id
      LEFT JOIN accounts a ON t.account_id = a.id
      WHERE ${where.join(' AND ')}
      ORDER BY ${sort === 'date' ? 't.date' : sort === 'amount' ? 'ABS(t.amount)' : 't.name'} ${order === 'desc' ? 'DESC' : 'ASC'}
      LIMIT ? OFFSET ?
    `).all(...params, parseInt(limit), offset);

    res.json({ transactions, total: total.count, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/transactions/:id
router.get('/:id', (req, res) => {
  const db = getDB();
  const t = db.prepare(`
    SELECT t.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
           a.name as account_name
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE t.id = ?
  `).get(req.params.id);
  if (!t) return res.status(404).json({ error: 'Transaction not found' });
  res.json(t);
});

// PATCH /api/transactions/:id - update category, notes
router.patch('/:id', (req, res) => {
  const db = getDB();
  const { category_id, notes } = req.body;
  try {
    db.prepare('UPDATE transactions SET category_id = ?, notes = ? WHERE id = ?')
      .run(category_id || null, notes || null, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions - manually create a transaction
router.post('/', (req, res) => {
  const db = getDB();
  const { name, amount, date, category_id, merchant, notes, account_id } = req.body;
  if (!name || amount === undefined || !date) {
    return res.status(400).json({ error: 'Name, amount, and date are required' });
  }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount)) {
    return res.status(400).json({ error: 'Invalid amount' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO transactions (name, amount, date, category_id, merchant, notes, account_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(name, parsedAmount, date, category_id || null, merchant || null, notes || null, account_id || null);
    res.status(201).json({ id: result.lastInsertRowid, name, amount: parsedAmount, date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/transactions/bulk-update-category - bulk assign category
router.post('/bulk-update-category', (req, res) => {
  const db = getDB();
  const { transaction_ids, category_id } = req.body;
  try {
    const stmt = db.prepare('UPDATE transactions SET category_id = ? WHERE id = ?');
    const updateMany = db.transaction(() => {
      for (const id of transaction_ids) {
        stmt.run(category_id, id);
      }
    });
    updateMany();
    res.json({ success: true, updated: transaction_ids.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
