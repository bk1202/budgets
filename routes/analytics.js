const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/analytics/summary - spending summary for dashboard
router.get('/summary', (req, res) => {
  const db = getDB();
  const { days = 30 } = req.query;

  // Total spending (excluding income/transfers)
  const spending = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE amount < 0
      AND date >= date('now', '-' || ? || ' days')
      AND category_id NOT IN (SELECT id FROM categories WHERE name IN ('Income', 'Transfer', 'Salary'))
  `).get(days);

  // Income
  const income = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as total
    FROM transactions
    WHERE amount > 0
      AND date >= date('now', '-' || ? || ' days')
  `).get(days);

  // Transaction count
  const count = db.prepare(`
    SELECT COUNT(*) as total FROM transactions
    WHERE date >= date('now', '-' || ? || ' days')
  `).get(days);

  // Top categories
  const topCategories = db.prepare(`
    SELECT c.name, c.color, c.icon,
      SUM(ABS(t.amount)) as total
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    WHERE t.amount < 0
      AND t.date >= date('now', '-' || ? || ' days')
      AND c.name NOT IN ('Income', 'Transfer', 'Salary')
    GROUP BY c.id
    ORDER BY total DESC
    LIMIT 8
  `).all(days);

  // Daily spending trend
  const dailyTrend = db.prepare(`
    SELECT date, SUM(ABS(amount)) as total
    FROM transactions
    WHERE amount < 0
      AND date >= date('now', '-' || ? || ' days')
      AND category_id NOT IN (SELECT id FROM categories WHERE name IN ('Income', 'Transfer', 'Salary'))
    GROUP BY date
    ORDER BY date
  `).all(days);

  // Weekly comparison
  const thisWeek = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE amount < 0
      AND date >= date('now', '-7 days')
      AND category_id NOT IN (SELECT id FROM categories WHERE name IN ('Income', 'Transfer', 'Salary'))
  `).get();

  const lastWeek = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as total
    FROM transactions
    WHERE amount < 0
      AND date >= date('now', '-14 days')
      AND date < date('now', '-7 days')
      AND category_id NOT IN (SELECT id FROM categories WHERE name IN ('Income', 'Transfer', 'Salary'))
  `).get();

  res.json({
    totalSpending: spending.total,
    totalIncome: income.total,
    transactionCount: count.total,
    topCategories,
    dailyTrend,
    weekOverWeek: {
      thisWeek: thisWeek.total,
      lastWeek: lastWeek.total,
      change: lastWeek.total > 0 ? ((thisWeek.total - lastWeek.total) / lastWeek.total) * 100 : 0,
    },
  });
});

// GET /api/analytics/monthly-breakdown
router.get('/monthly-breakdown', (req, res) => {
  const db = getDB();
  const breakdown = db.prepare(`
    SELECT strftime('%Y-%m', date) as month,
      SUM(CASE WHEN amount < 0 AND category_id NOT IN (SELECT id FROM categories WHERE name IN ('Income', 'Transfer', 'Salary')) THEN ABS(amount) ELSE 0 END) as spending,
      SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income
    FROM transactions
    WHERE date >= date('now', '-12 months')
    GROUP BY strftime('%Y-%m', date)
    ORDER BY month
  `).all();
  res.json(breakdown);
});

// GET /api/analytics/category-breakdown
router.get('/category-breakdown', (req, res) => {
  const db = getDB();
  const { start_date, end_date } = req.query;
  let where = "WHERE t.amount < 0 AND c.name NOT IN ('Income', 'Transfer', 'Salary')";
  let params = [];

  if (start_date) { where += ' AND t.date >= ?'; params.push(start_date); }
  if (end_date) { where += ' AND t.date <= ?'; params.push(end_date); }

  const breakdown = db.prepare(`
    SELECT c.id, c.name, c.color, c.icon,
      SUM(ABS(t.amount)) as total,
      COUNT(*) as count
    FROM transactions t
    JOIN categories c ON t.category_id = c.id
    ${where}
    GROUP BY c.id
    ORDER BY total DESC
  `).all(...params);

  res.json(breakdown);
});

// GET /api/analytics/recommendations - AI-style spending recommendations
router.get('/recommendations', (req, res) => {
  const db = getDB();
  const recommendations = [];

  // Find categories with overspending vs budgets
  const budgetAlerts = db.prepare(`
    SELECT b.*, c.name as category_name, c.color as category_color,
      COALESCE(SUM(CASE WHEN t.date >= b.start_date AND t.date <= b.end_date AND t.amount < 0 THEN ABS(t.amount) ELSE 0 END), 0) as spent
    FROM budgets b
    LEFT JOIN categories c ON b.category_id = c.id
    LEFT JOIN transactions t ON (
      (t.category_id = b.category_id OR t.category_id IN (SELECT id FROM categories WHERE parent_id = b.category_id))
      AND t.date >= b.start_date AND t.date <= b.end_date
      AND t.amount < 0
    )
    GROUP BY b.id
  `).all();

  for (const budget of budgetAlerts) {
    const pct = budget.spent / budget.amount;
    if (pct >= budget.alert_threshold) {
      recommendations.push({
        type: 'budget_alert',
        severity: pct >= 1 ? 'high' : 'medium',
        title: pct >= 1 ? `Budget exceeded: ${budget.category_name}` : `Budget alert: ${budget.category_name}`,
        description: pct >= 1
          ? `You've spent $${budget.spent.toFixed(2)} of your $${budget.amount.toFixed(2)} budget for ${budget.category_name}. Consider reducing spending in this category.`
          : `You've used ${(pct * 100).toFixed(0)}% of your $${budget.amount.toFixed(2)} ${budget.category_name} budget.`,
        category: budget.category_name,
        color: budget.category_color,
        action: 'Review budget',
      });
    }
  }

  // Find unusual spending spikes
  const spikes = db.prepare(`
    WITH weekly AS (
      SELECT category_id,
        SUM(CASE WHEN date >= date('now', '-7 days') THEN ABS(amount) ELSE 0 END) as this_week,
        SUM(CASE WHEN date >= date('now', '-14 days') AND date < date('now', '-7 days') THEN ABS(amount) ELSE 0 END) as last_week
      FROM transactions
      WHERE amount < 0
        AND category_id NOT IN (SELECT id FROM categories WHERE name IN ('Income', 'Transfer', 'Salary'))
        AND date >= date('now', '-14 days')
      GROUP BY category_id
    )
    SELECT w.*, c.name, c.color
    FROM weekly w
    JOIN categories c ON w.category_id = c.id
    WHERE w.last_week > 0 AND w.this_week > w.last_week * 1.5
      AND w.this_week > 50
    ORDER BY (w.this_week - w.last_week) DESC
    LIMIT 3
  `).all();

  for (const spike of spikes) {
    recommendations.push({
      type: 'spending_spike',
      severity: 'medium',
      title: `Spending increase: ${spike.name}`,
      description: `Your ${spike.name.toLowerCase()} spending jumped from $${spike.last_week.toFixed(0)} to $${spike.this_week.toFixed(0)} this week.`,
      category: spike.name,
      color: spike.color,
      action: 'View transactions',
    });
  }

  // Find recurring subscriptions
  const recurring = db.prepare(`
    SELECT name, COUNT(*) as count, SUM(ABS(amount)) as total, AVG(ABS(amount)) as avg_amount
    FROM transactions
    WHERE amount < 0
      AND date >= date('now', '-90 days')
    GROUP BY name
    HAVING count >= 2
    ORDER BY total DESC
    LIMIT 5
  `).all();

  for (const sub of recurring.slice(0, 3)) {
    recommendations.push({
      type: 'recurring',
      severity: 'low',
      title: `Recurring: ${sub.name}`,
      description: `You've spent $${sub.total.toFixed(2)} on ${sub.name} over the last 90 days (${sub.count} transactions, avg $${sub.avg_amount.toFixed(2)}). Consider if this subscription is still worth it.`,
      category: 'Shopping',
      color: '#8b5cf6',
      action: 'Review subscription',
    });
  }

  // Savings rate recommendation
  const incomeData = db.prepare(`
    SELECT COALESCE(SUM(amount), 0) as income
    FROM transactions WHERE amount > 0 AND date >= date('now', '-30 days')
  `).get();

  const spendingData = db.prepare(`
    SELECT COALESCE(SUM(ABS(amount)), 0) as spending
    FROM transactions
    WHERE amount < 0 AND date >= date('now', '-30 days')
      AND category_id NOT IN (SELECT id FROM categories WHERE name IN ('Income', 'Transfer', 'Salary'))
  `).get();

  if (incomeData.income > 0) {
    const savingsRate = ((incomeData.income - spendingData.spending) / incomeData.income) * 100;
    if (savingsRate < 20) {
      recommendations.push({
        type: 'savings_rate',
        severity: savingsRate < 0 ? 'high' : 'medium',
        title: `Low savings rate: ${savingsRate.toFixed(0)}%`,
        description: savingsRate < 0
          ? 'Your spending exceeds your income. Review non-essential expenses immediately.'
          : `Your savings rate is ${savingsRate.toFixed(0)}%. Aim for at least 20% to build financial security.`,
        category: 'General',
        color: '#f59e0b',
        action: 'See breakdown',
      });
    }
  }

  res.json(recommendations);
});

module.exports = router;
