const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/goals - list all savings goals with progress
router.get('/', (req, res) => {
  const db = getDB();
  const goals = db.prepare(`
    SELECT * FROM savings_goals
    ORDER BY created_at DESC
  `).all();
  res.json(goals);
});

// GET /api/goals/:id
router.get('/:id', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });
  res.json(goal);
});

// POST /api/goals - create a new savings goal
router.post('/', (req, res) => {
  const db = getDB();
  const { name, target_amount, current_amount, target_date } = req.body;
  if (!name || !target_amount) {
    return res.status(400).json({ error: 'Name and target amount are required' });
  }
  try {
    const result = db.prepare(`
      INSERT INTO savings_goals (name, target_amount, current_amount, target_date)
      VALUES (?, ?, ?, ?)
    `).run(name, target_amount, current_amount || 0, target_date || null);
    res.status(201).json({ id: result.lastInsertRowid, name, target_amount, current_amount: current_amount || 0, target_date });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/goals/:id - update goal (including adding funds)
router.patch('/:id', (req, res) => {
  const db = getDB();
  const goal = db.prepare('SELECT * FROM savings_goals WHERE id = ?').get(req.params.id);
  if (!goal) return res.status(404).json({ error: 'Goal not found' });

  const { name, target_amount, current_amount, target_date, add_amount } = req.body;
  try {
    let newCurrent;
    if (add_amount !== undefined && add_amount !== null && add_amount !== '') {
      const addVal = parseFloat(add_amount);
      if (isNaN(addVal) || addVal <= 0) {
        return res.status(400).json({ error: 'Invalid add_amount' });
      }
      newCurrent = goal.current_amount + addVal;
    } else {
      newCurrent = current_amount !== undefined ? current_amount : goal.current_amount;
    }

    db.prepare(`
      UPDATE savings_goals
      SET name = ?, target_amount = ?, current_amount = ?, target_date = ?
      WHERE id = ?
    `).run(
      name || goal.name,
      target_amount || goal.target_amount,
      newCurrent,
      target_date !== undefined ? target_date : goal.target_date,
      req.params.id
    );
    res.json({ success: true, current_amount: newCurrent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/goals/:id
router.delete('/:id', (req, res) => {
  const db = getDB();
  db.prepare('DELETE FROM savings_goals WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
