require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const { initDB } = require('./db');

const transactionsRouter = require('./routes/transactions');
const budgetsRouter = require('./routes/budgets');
const plaidRouter = require('./routes/plaid');
const analyticsRouter = require('./routes/analytics');
const categoriesRouter = require('./routes/categories');
const accountsRouter = require('./routes/accounts');
const goalsRouter = require('./routes/goals');
const subscriptionsRouter = require('./routes/subscriptions');
const exportRouter = require('./routes/export');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

// Initialize database
initDB();

// API Routes
app.use('/api/transactions', transactionsRouter);
app.use('/api/budgets', budgetsRouter);
app.use('/api/plaid', plaidRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/accounts', accountsRouter);
app.use('/api/goals', goalsRouter);
app.use('/api/subscriptions', subscriptionsRouter);
app.use('/api/export', exportRouter);

// Serve frontend in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, 'client', 'dist')));
  app.get('/*splat', (req, res) => {
    res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
  const os = require('os');
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        console.log(`  Phone access: http://${iface.address}:${PORT}`);
      }
    }
  }
});
