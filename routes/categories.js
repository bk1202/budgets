const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/categories
router.get('/', (req, res) => {
  const db = getDB();
  const categories = db.prepare(`
    SELECT c.*, COUNT(t.id) as transaction_count,
      COALESCE(SUM(CASE WHEN t.amount < 0 AND t.date >= date('now', '-30 days') THEN ABS(t.amount) ELSE 0 END), 0) as recent_spending
    FROM categories c
    LEFT JOIN transactions t ON t.category_id = c.id
    GROUP BY c.id
    ORDER BY c.parent_id IS NULL DESC, c.name
  `).all();

  // Build tree structure
  const tree = categories
    .filter(c => !c.parent_id)
    .map(parent => ({
      ...parent,
      children: categories.filter(c => c.parent_id === parent.id),
    }));

  res.json(tree);
});

// POST /api/categories
router.post('/', (req, res) => {
  const db = getDB();
  const { name, color, icon, parent_id } = req.body;
  try {
    const result = db.prepare('INSERT INTO categories (name, color, icon, parent_id) VALUES (?, ?, ?, ?)')
      .run(name, color || '#6366f1', icon || 'tag', parent_id || null);
    res.status(201).json({ id: result.lastInsertRowid, ...req.body });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
