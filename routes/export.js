const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/export/transactions - export transactions as CSV
router.get('/transactions', (req, res) => {
  const db = getDB();
  const { start_date, end_date, category_id } = req.query;

  let where = ['1=1'];
  let params = [];

  if (start_date) { where.push('t.date >= ?'); params.push(start_date); }
  if (end_date) { where.push('t.date <= ?'); params.push(end_date); }
  if (category_id) {
    const subIds = db.prepare('SELECT id FROM categories WHERE parent_id = ?').all(category_id).map(c => c.id);
    const allIds = [parseInt(category_id), ...subIds];
    where.push(`t.category_id IN (${allIds.map(() => '?').join(',')})`);
    params.push(...allIds);
  }

  const transactions = db.prepare(`
    SELECT t.date, t.name, t.merchant, t.amount,
           c.name as category_name, a.name as account_name,
           CASE WHEN t.pending = 1 THEN 'Yes' ELSE 'No' END as pending,
           t.notes
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    LEFT JOIN accounts a ON t.account_id = a.id
    WHERE ${where.join(' AND ')}
    ORDER BY t.date DESC
  `).all(...params);

  // Build CSV
  const headers = ['Date', 'Name', 'Merchant', 'Amount', 'Category', 'Account', 'Pending', 'Notes'];
  const csvRows = [headers.join(',')];

  for (const t of transactions) {
    const row = [
      t.date || '',
      `"${(t.name || '').replace(/"/g, '""')}"`,
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      (t.amount || 0).toFixed(2),
      `"${(t.category_name || 'Uncategorized').replace(/"/g, '""')}"`,
      `"${(t.account_name || '').replace(/"/g, '""')}"`,
      t.pending || 'No',
      `"${(t.notes || '').replace(/"/g, '""')}"`,
    ];
    csvRows.push(row.join(','));
  }

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=transactions-${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csvRows.join('\n'));
});

module.exports = router;
