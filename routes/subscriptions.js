const express = require('express');
const router = express.Router();
const { getDB } = require('../db');

// GET /api/subscriptions - detect recurring bills/subscriptions
router.get('/', (req, res) => {
  const db = getDB();

  // Find transactions that repeat (same name, multiple occurrences)
  const recurring = db.prepare(`
    SELECT
      name,
      COUNT(*) as occurrences,
      SUM(ABS(amount)) as total_spent,
      AVG(ABS(amount)) as avg_amount,
      MIN(ABS(amount)) as min_amount,
      MAX(ABS(amount)) as max_amount,
      MIN(date) as first_date,
      MAX(date) as last_date,
      c.name as category_name,
      c.color as category_color
    FROM transactions t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.amount < 0
      AND t.date >= date('now', '-180 days')
      AND t.name NOT LIKE '%transfer%'
      AND c.name NOT IN ('Transfer', 'Income', 'Salary')
    GROUP BY t.name
    HAVING COUNT(*) >= 2
    ORDER BY total_spent DESC
    LIMIT 50
  `).all();

  // Calculate estimated monthly cost and next due date for each
  const subscriptions = recurring.map(sub => {
    const firstDate = new Date(sub.first_date + 'T00:00');
    const lastDate = new Date(sub.last_date + 'T00:00');
    const daysSpan = Math.max(1, (lastDate - firstDate) / (1000 * 60 * 60 * 24));
    const daysBetweenOccurrences = daysSpan / (sub.occurrences - 1 || 1);

    // Estimate monthly cost — only if we have enough data
    let estimatedMonthly;
    if (daysBetweenOccurrences >= 25 && daysBetweenOccurrences <= 35) {
      estimatedMonthly = sub.avg_amount;
    } else if (daysBetweenOccurrences >= 6 && daysBetweenOccurrences <= 8) {
      estimatedMonthly = sub.avg_amount * 4.33; // weekly → monthly
    } else if (daysBetweenOccurrences >= 80) {
      estimatedMonthly = sub.avg_amount / (daysBetweenOccurrences / 30);
    } else if (sub.occurrences >= 3 && daysSpan >= 30) {
      // Only estimate monthly for items with 3+ occurrences spanning at least 30 days
      estimatedMonthly = sub.avg_amount * (30 / Math.max(1, daysBetweenOccurrences));
    } else {
      // Too few data points or too close together — mark as unreliable
      estimatedMonthly = sub.avg_amount;
    }

    // Predict next due date
    let nextDue = null;
    if (daysBetweenOccurrences >= 25 && daysBetweenOccurrences <= 35) {
      // Monthly — add a month
      const predicted = new Date(lastDate);
      predicted.setMonth(predicted.getMonth() + 1);
      nextDue = predicted.toISOString().slice(0, 10);
    } else if (daysBetweenOccurrences >= 6 && daysBetweenOccurrences <= 8) {
      // Weekly — add a week
      const predicted = new Date(lastDate);
      predicted.setDate(predicted.getDate() + 7);
      nextDue = predicted.toISOString().slice(0, 10);
    } else {
      // General — add the average interval
      const predicted = new Date(lastDate);
      predicted.setDate(predicted.getDate() + Math.round(daysBetweenOccurrences));
      nextDue = predicted.toISOString().slice(0, 10);
    }

    // Detect likely subscription based on consistent amounts
    const amountVariance = sub.max_amount - sub.min_amount;
    const isLikelySubscription = sub.occurrences >= 3 && amountVariance < sub.avg_amount * 0.1;
    const isConfirmedSubscription = sub.occurrences >= 4 && amountVariance <= 0.01;

    let frequency;
    if (daysBetweenOccurrences >= 25 && daysBetweenOccurrences <= 35) frequency = 'Monthly';
    else if (daysBetweenOccurrences >= 6 && daysBetweenOccurrences <= 8) frequency = 'Weekly';
    else if (daysBetweenOccurrences >= 80) frequency = 'Quarterly';
    else frequency = 'Variable';

    return {
      name: sub.name,
      occurrences: sub.occurrences,
      total_spent: sub.total_spent,
      avg_amount: sub.avg_amount,
      estimated_monthly: estimatedMonthly,
      category_name: sub.category_name || 'Uncategorized',
      category_color: sub.category_color || '#6366f1',
      first_date: sub.first_date,
      last_date: sub.last_date,
      next_due: nextDue,
      frequency,
      is_likely_subscription: isLikelySubscription,
      is_confirmed_subscription: isConfirmedSubscription,
      confidence: isConfirmedSubscription ? 'high' : isLikelySubscription ? 'medium' : 'low',
    };
  });

  // Sort: confirmed subscriptions first, then by estimated monthly cost
  subscriptions.sort((a, b) => {
    if (a.is_confirmed_subscription && !b.is_confirmed_subscription) return -1;
    if (!a.is_confirmed_subscription && b.is_confirmed_subscription) return 1;
    return b.estimated_monthly - a.estimated_monthly;
  });

  // Summary stats
  const confirmedSubs = subscriptions.filter(s => s.is_confirmed_subscription);
  const totalMonthly = confirmedSubs.reduce((sum, s) => sum + s.estimated_monthly, 0);
  const totalYearly = totalMonthly * 12;

  res.json({
    subscriptions,
    summary: {
      total_subscriptions: confirmedSubs.length,
      total_likely: subscriptions.filter(s => s.is_likely_subscription && !s.is_confirmed_subscription).length,
      monthly_spend: totalMonthly,
      yearly_spend: totalYearly,
      all_monthly_spend: subscriptions.reduce((sum, s) => sum + s.estimated_monthly, 0),
    },
  });
});

module.exports = router;
