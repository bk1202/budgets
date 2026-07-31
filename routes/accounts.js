const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/accounts
router.get('/', (req, res) => {
  const db = getDB();
  const accounts = db.prepare(`
    SELECT a.*,
      COALESCE(SUM(CASE WHEN t.amount > 0 THEN t.amount ELSE 0 END), 0) as total_inflow,
      COALESCE(SUM(CASE WHEN t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as total_outflow
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id = a.id AND t.date >= date('now', '-30 days')
    GROUP BY a.id
    ORDER BY a.name
  `).all();
  res.json(accounts);
});

module.exports = router;
