const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/budgets - list all budgets with spending summary
router.get('/', (req, res) => {
  const db = getDB();
  const budgets = db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
      COALESCE(SUM(CASE
        WHEN t.date >= b.start_date AND t.date <= b.end_date AND t.amount < 0
        THEN ABS(t.amount) ELSE 0
      END), 0) as spent
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN transactions t ON (
      (t.category_id = b.category_id OR t.category_id IN (SELECT id FROM categories WHERE parent_id = b.category_id))
      AND t.date >= b.start_date AND t.date <= b.end_date
      AND t.amount < 0
    )
    GROUP BY b.id
    ORDER BY b.created_at DESC
  `).all();

  res.json(budgets);
});

// GET /api/budgets/:id
router.get('/:id', (req, res) => {
  const db = getDB();
  const budget = db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color, c.icon as category_icon,
      COALESCE(SUM(CASE
        WHEN t.date >= b.start_date AND t.date <= b.end_date AND t.amount < 0
        THEN ABS(t.amount) ELSE 0
      END), 0) as spent
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN transactions t ON (
      (t.category_id = b.category_id OR t.category_id IN (SELECT id FROM categories WHERE parent_id = b.category_id))
      AND t.date >= b.start_date AND t.date <= b.end_date
      AND t.amount < 0
    )
    WHERE b.id = ?
    GROUP BY b.id
  `).get(req.params.id);

  if (!budget) return res.status(404).json({ error: 'Budget not found' });
  res.json(budget);
});

// POST /api/budgets - create a new budget
router.post('/', (req, res) => {
  const db = getDB();
  const { name, amount, category_id, start_date, end_date, alert_threshold } = req.body;
  try {
    const result = db.prepare(`
      INSERT INTO budgets (name, amount, category_id, start_date, end_date, alert_threshold)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(name, amount, category_id || null, start_date, end_date, alert_threshold || 0.8);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/budgets/:id
router.patch('/:id', (req, res) => {
  const db = getDB();
  const { name, amount, category_id, start_date, end_date, alert_threshold } = req.body;
  const budget = db.prepare('SELECT * FROM budgets WHERE id = ?').get(req.params.id);
  if (!budget) return res.status(404).json({ error: 'Budget not found' });

  try {
    db.prepare(`
      UPDATE budgets SET name = ?, amount = ?, category_id = ?, start_date = ?, end_date = ?, alert_threshold = ?
      WHERE id = ?
    `).run(
      name || budget.name,
      amount || budget.amount,
      category_id !== undefined ? category_id : budget.category_id,
      start_date || budget.start_date,
      end_date || budget.end_date,
      alert_threshold !== undefined ? alert_threshold : budget.alert_threshold,
      req.params.id
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/budgets/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM budgets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
