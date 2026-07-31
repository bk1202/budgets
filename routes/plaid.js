const express = require('express');
const router = express.Router();
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');
const { getDB } = require('../db');

// Initialize Plaid client
const getPlaidClient = () => {
  const config = new Configuration({
    basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
        'PLAID-SECRET': process.env.PLAID_SECRET,
      },
    },
  });
  return new PlaidApi(config);
};

// POST /api/plaid/create-link-token
router.post('/create-link-token', async (req, res) => {
  try {
    const client = getPlaidClient();
    const response = await client.linkTokenCreate({
      user: { client_user_id: 'local-user-1' },
      client_name: 'Budgeting App',
      products: ['transactions'],
      country_codes: ['US'],
      language: 'en',
    });
    res.json({ link_token: response.data.link_token });
  } catch (err) {
    console.error('Plaid link token error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to create link token' });
  }
});

// POST /api/plaid/exchange-token
router.post('/exchange-token', async (req, res) => {
  const { public_token } = req.body;
  try {
    const client = getPlaidClient();
    const exchangeResponse = await client.itemPublicTokenExchange({ public_token });
    const { access_token, item_id } = exchangeResponse.data;

    // Get institution info
    const itemResponse = await client.itemGet({ access_token });
    const institutionResponse = await client.institutionsGetById({
      institution_id: itemResponse.data.item.institution_id,
      country_codes: ['US'],
    });
    const institutionName = institutionResponse.data.institution.name;

    const db = getDB();
    db.prepare('INSERT INTO plaid_items (item_id, access_token, institution_name) VALUES (?, ?, ?)')
      .run(item_id, access_token, institutionName);

    // Fetch accounts
    const accountsResponse = await client.accountsGet({ access_token });
    const insertAccount = db.prepare(
      'INSERT OR REPLACE INTO accounts (plaid_account_id, name, type, subtype, balance) VALUES (?, ?, ?, ?, ?)'
    );
    for (const acct of accountsResponse.data.accounts) {
      insertAccount.run(acct.account_id, acct.name, acct.type, acct.subtype, acct.balances.current || 0);
    }

    // Sync initial transactions
    await syncTransactions(client, access_token, db);

    res.json({ success: true, institution: institutionName });
  } catch (err) {
    console.error('Plaid exchange error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to exchange token' });
  }
});

// POST /api/plaid/sync - sync transactions
router.post('/sync', async (req, res) => {
  try {
    const db = getDB();
    const items = db.prepare('SELECT * FROM plaid_items').all();
    const client = getPlaidClient();
    let total = 0;

    for (const item of items) {
      total += await syncTransactions(client, item.access_token, db);
    }

    res.json({ success: true, synced: total });
  } catch (err) {
    console.error('Sync error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Failed to sync transactions' });
  }
});

async function syncTransactions(client, access_token, db) {
  let added = 0;
  let hasMore = true;
  let cursor = null;

  // Check for cursor
  const item = db.prepare('SELECT * FROM plaid_items WHERE access_token = ?').get(access_token);

  while (hasMore) {
    const request = {
      access_token,
      cursor: cursor,
      count: 500,
    };

    const response = await client.transactionsSync(request);
    const { added: newTxns, modified, removed, next_cursor, has_more } = response.data;

    const insertTxn = db.prepare(`
      INSERT INTO transactions
        (plaid_transaction_id, account_id, amount, date, name, merchant, category_id, category_confidence, pending)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(plaid_transaction_id) DO UPDATE SET
        amount = excluded.amount,
        date = excluded.date,
        name = excluded.name,
        merchant = excluded.merchant,
        category_id = excluded.category_id,
        category_confidence = excluded.category_confidence,
        pending = excluded.pending
    `);

    const getAccountByPlaidId = db.prepare('SELECT id FROM accounts WHERE plaid_account_id = ?');

    // Map Plaid categories to our categories
    const mapCategory = buildCategoryMap(db);

    const insertMany = db.transaction(() => {
      for (const txn of newTxns) {
        const account = getAccountByPlaidId.get(txn.account_id);
        const accountId = account ? account.id : null;
        const catName = txn.personal_finance_category?.detailed || txn.personal_finance_category?.primary || null;
        const categoryId = catName ? mapCategory(catName) : null;

        insertTxn.run(
          txn.transaction_id,
          accountId,
          txn.amount,
          txn.date,
          txn.name,
          txn.merchant_name || null,
          categoryId,
          txn.personal_finance_category?.confidence_level || null,
          txn.pending ? 1 : 0
        );
      }

      // Handle removed transactions
      for (const removedTxn of removed) {
        db.prepare('DELETE FROM transactions WHERE plaid_transaction_id = ?').run(removedTxn.transaction_id);
      }
    });
    insertMany();

    added += newTxns.length;
    hasMore = has_more;
    cursor = next_cursor;
  }

  // Update cursor
  db.prepare('UPDATE plaid_items SET cursor = ? WHERE access_token = ?').run(cursor, access_token);

  return added;
}

function buildCategoryMap(db) {
  const map = {};
  const categories = db.prepare('SELECT id, name FROM categories').all();
  const plaidToLocal = {
    'food and drink': 'Restaurants',
    'groceries': 'Groceries',
    'restaurants': 'Restaurants',
    'fast food': 'Restaurants',
    'coffee shop': 'Restaurants',
    'transportation': 'Transportation',
    'gas': 'Gas',
    'public transit': 'Public Transit',
    'parking': 'Transportation',
    'shopping': 'Shopping',
    'clothing and accessories': 'Clothing',
    'electronics': 'Electronics',
    'entertainment': 'Entertainment',
    'movies and dvds': 'Movies & Shows',
    'recreation': 'Hobbies',
    'rent and utilities': 'Housing',
    'rent': 'Rent/Mortgage',
    'utilities': 'Utilities',
    'healthcare': 'Healthcare',
    'income': 'Income',
    'payroll': 'Salary',
    'transfer': 'Transfer',
  };

  // Build lookup: plaid category name -> local category id
  for (const cat of categories) {
    map[cat.name.toLowerCase()] = cat.id;
  }

  // Return a function that maps plaid category strings to local category ids
  return function(plaidCategory) {
    if (!plaidCategory) return null;
    const localName = plaidToLocal[plaidCategory.toLowerCase()];
    if (localName) {
      return map[localName.toLowerCase()] || null;
    }
    return map[plaidCategory.toLowerCase()] || null;
  };
}

// GET /api/plaid/status
router.get('/status', (req, res) => {
  const db = getDB();
  const items = db.prepare('SELECT * FROM plaid_items').all();
  const accounts = db.prepare('SELECT COUNT(*) as count FROM accounts').get();
  const transactions = db.prepare('SELECT COUNT(*) as count FROM transactions').get();
  res.json({
    connected: items.length > 0,
    institutions: items.map(i => i.institution_name),
    accountCount: accounts.count,
    transactionCount: transactions.count,
  });
});

module.exports = router;
