import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';

export const pullChanges = async (req, res) => {
  const { since } = req.body;
  const userId = req.user.userId;

  try {
    const sinceDate = since ? new Date(since) : new Date(0);

    const [items] = await pool.query(
      'SELECT * FROM items WHERE user_id = ? AND updatedAt > ? ORDER BY updatedAt ASC',
      [userId, sinceDate]
    );

    const [customers] = await pool.query(
      'SELECT * FROM customers WHERE user_id = ? AND updatedAt > ? ORDER BY updatedAt ASC',
      [userId, sinceDate]
    );

    const [transactions] = await pool.query(
      'SELECT * FROM transactions WHERE user_id = ? AND updatedAt > ? ORDER BY updatedAt ASC',
      [userId, sinceDate]
    );

    // Map DB fields to API fields if needed
    const mapFields = (records) => records.map(r => {
      const { _id, ...rest } = r;
      return { id: _id, ...rest };
    });

    const formattedTransactions = transactions.map(tx => {
      const { _id, lines, ...rest } = tx;
      return {
        id: _id,
        ...rest,
        lines: lines || [] // lines is JSON in DB
      };
    });

    res.json({
      items: mapFields(items).map(i => ({ ...i, image_path: i.image_url })), // Map back for frontend compat if needed, or update frontend
      customers: mapFields(customers),
      transactions: formattedTransactions,
      server_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pull changes error:', error);
    res.status(500).json({ error: 'Failed to pull changes' });
  }
};

export const pushChanges = async (req, res) => {
  const { items, customers, transactions } = req.body;
  const userId = req.user.userId;

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = {
      items: { synced: [], conflicts: [] },
      customers: { synced: [], conflicts: [] },
      transactions: { synced: [], conflicts: [] }
    };

    // Process items
    if (items && Array.isArray(items)) {
      for (const item of items) {
        try {
          if (item.idempotency_key) {
            const [existingIdempotency] = await connection.query(
              'SELECT _id FROM items WHERE user_id = ? AND idempotency_key = ?',
              [userId, item.idempotency_key]
            );
            if (existingIdempotency.length > 0) {
              results.items.synced.push({ id: item.id, cloud_id: existingIdempotency[0]._id });
              continue;
            }
          }

          const itemId = item.id || uuidv4();
          const [existingItems] = await connection.query('SELECT * FROM items WHERE user_id = ? AND _id = ?', [userId, itemId]);
          const existingItem = existingItems[0];

          if (existingItem) {
            const clientUpdatedAt = new Date(item.updated_at || Date.now());
            const serverUpdatedAt = new Date(existingItem.updatedAt);

            if (clientUpdatedAt > serverUpdatedAt) {
              await connection.query(
                `UPDATE items SET 
                  name = ?, barcode = ?, sku = ?, price = ?, unit = ?, 
                  inventory_qty = ?, category = ?, recommended = ?, image_url = ?, 
                  updatedAt = ?
                 WHERE _id = ? AND user_id = ?`,
                [
                  item.name, item.barcode, item.sku, item.price, item.unit,
                  item.inventory_qty, item.category, item.recommended, item.image_path || item.image_url,
                  clientUpdatedAt,
                  itemId, userId
                ]
              );
            }
          } else {
            await connection.query(
              `INSERT INTO items (
                _id, user_id, name, barcode, sku, price, unit, 
                inventory_qty, category, recommended, image_url, 
                idempotency_key, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                itemId, userId, item.name, item.barcode, item.sku, item.price, item.unit,
                item.inventory_qty, item.category, item.recommended, item.image_path || item.image_url,
                item.idempotency_key,
                new Date(item.created_at || Date.now()),
                new Date(item.updated_at || Date.now())
              ]
            );
          }
          results.items.synced.push({ id: item.id, cloud_id: itemId });
        } catch (err) {
          results.items.conflicts.push({ id: item.id, error: err.message });
        }
      }
    }

    // Process customers
    if (customers && Array.isArray(customers)) {
      for (const customer of customers) {
        try {
          if (customer.idempotency_key) {
            const [existingIdempotency] = await connection.query(
              'SELECT _id FROM customers WHERE user_id = ? AND idempotency_key = ?',
              [userId, customer.idempotency_key]
            );
            if (existingIdempotency.length > 0) {
              results.customers.synced.push({ id: customer.id, cloud_id: existingIdempotency[0]._id });
              continue;
            }
          }

          const customerId = customer.id || uuidv4();
          const [existingCustomers] = await connection.query('SELECT * FROM customers WHERE user_id = ? AND _id = ?', [userId, customerId]);
          const existingCustomer = existingCustomers[0];

          if (existingCustomer) {
            const clientUpdatedAt = new Date(customer.updated_at || Date.now());
            const serverUpdatedAt = new Date(existingCustomer.updatedAt);

            if (clientUpdatedAt > serverUpdatedAt) {
              await connection.query(
                `UPDATE customers SET 
                  name = ?, phone = ?, email = ?, address = ?, 
                  updatedAt = ?
                 WHERE _id = ? AND user_id = ?`,
                [
                  customer.name, customer.phone, customer.email, customer.address,
                  clientUpdatedAt,
                  customerId, userId
                ]
              );
            }
          } else {
            await connection.query(
              `INSERT INTO customers (
                _id, user_id, name, phone, email, address, 
                idempotency_key, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                customerId, userId, customer.name, customer.phone, customer.email, customer.address,
                customer.idempotency_key,
                new Date(customer.created_at || Date.now()),
                new Date(customer.updated_at || Date.now())
              ]
            );
          }
          results.customers.synced.push({ id: customer.id, cloud_id: customerId });
        } catch (err) {
          results.customers.conflicts.push({ id: customer.id, error: err.message });
        }
      }
    }

    // Process transactions
    if (transactions && Array.isArray(transactions)) {
      for (const transaction of transactions) {
        try {
          if (transaction.idempotency_key) {
            const [existingIdempotency] = await connection.query(
              'SELECT _id, voucher_number FROM transactions WHERE user_id = ? AND idempotency_key = ?',
              [userId, transaction.idempotency_key]
            );
            if (existingIdempotency.length > 0) {
              results.transactions.synced.push({
                id: transaction.id,
                cloud_id: existingIdempotency[0]._id,
                voucher_number: existingIdempotency[0].voucher_number
              });
              continue;
            }
          }

          const transactionId = transaction.id || uuidv4();
          const [existingTx] = await connection.query('SELECT * FROM transactions WHERE user_id = ? AND _id = ?', [userId, transactionId]);

          if (existingTx.length > 0) {
            const existingTransaction = existingTx[0];
            const clientUpdatedAt = new Date(transaction.updated_at || Date.now());
            const serverUpdatedAt = new Date(existingTransaction.updatedAt);

            if (clientUpdatedAt > serverUpdatedAt) {
              const linesJson = JSON.stringify(transaction.lines || []);

              await connection.query(
                `UPDATE transactions SET 
                  customer_id = ?, voucher_number = ?, provisional_voucher = ?, 
                  date = ?, subtotal = ?, tax = ?, discount = ?, other_charges = ?, grand_total = ?, 
                  item_count = ?, unit_count = ?, payment_type = ?, status = ?, receipt_path = ?, 
                  lines = ?, updatedAt = ?
                 WHERE _id = ? AND user_id = ?`,
                [
                  transaction.customer_id, transaction.voucher_number || existingTransaction.voucher_number, transaction.provisional_voucher,
                  new Date(transaction.date || existingTransaction.date), transaction.subtotal, transaction.tax, transaction.discount, transaction.other_charges, transaction.grand_total,
                  transaction.item_count, transaction.unit_count, transaction.payment_type, transaction.status, transaction.receipt_path,
                  linesJson, clientUpdatedAt,
                  transactionId, userId
                ]
              );

              results.transactions.synced.push({
                id: transaction.id,
                cloud_id: transactionId,
                voucher_number: existingTransaction.voucher_number
              });
            }
          } else {
            // Generate voucher number
            let voucherNumber = transaction.voucher_number;
            if (!voucherNumber || transaction.provisional_voucher) {
              const today = new Date();
              const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

              const [users] = await connection.query('SELECT company FROM users WHERE _id = ?', [userId]);
              const companyCode = users[0]?.company?.substring(0, 3).toUpperCase() || 'GUR';

              const [lastTx] = await connection.query(
                'SELECT voucher_number FROM transactions WHERE user_id = ? AND voucher_number LIKE ? ORDER BY voucher_number DESC LIMIT 1',
                [userId, `%-${dateStr}-%`]
              );

              let sequence = 1;
              if (lastTx.length > 0) {
                const lastVoucher = lastTx[0].voucher_number;
                const lastSeq = parseInt(lastVoucher.split('-').pop());
                sequence = lastSeq + 1;
              }

              voucherNumber = `${companyCode}-${dateStr}-${sequence.toString().padStart(4, '0')}`;
            }

            const linesJson = JSON.stringify(transaction.lines || []);

            await connection.query(
              `INSERT INTO transactions (
                _id, user_id, customer_id, voucher_number, provisional_voucher, 
                date, subtotal, tax, discount, other_charges, grand_total, 
                item_count, unit_count, payment_type, status, receipt_path, 
                idempotency_key, lines, createdAt, updatedAt
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                transactionId, userId, transaction.customer_id, voucherNumber, null,
                new Date(transaction.date || Date.now()), transaction.subtotal, transaction.tax, transaction.discount, transaction.other_charges, transaction.grand_total,
                transaction.item_count, transaction.unit_count, transaction.payment_type, transaction.status, transaction.receipt_path,
                transaction.idempotency_key, linesJson,
                new Date(transaction.created_at || Date.now()),
                new Date(transaction.updated_at || Date.now())
              ]
            );

            // Update inventory
            if (transaction.lines && Array.isArray(transaction.lines)) {
              for (const line of transaction.lines) {
                if (line.item_id) {
                  await connection.query(
                    'UPDATE items SET inventory_qty = inventory_qty - ? WHERE _id = ? AND user_id = ?',
                    [line.quantity || 0, line.item_id, userId]
                  );
                }
              }
            }

            results.transactions.synced.push({
              id: transaction.id,
              cloud_id: transactionId,
              voucher_number: voucherNumber
            });
          }
        } catch (err) {
          results.transactions.conflicts.push({ id: transaction.id, error: err.message });
        }
      }
    }

    await connection.commit();
    res.json({
      ...results,
      server_timestamp: new Date().toISOString()
    });

  } catch (error) {
    await connection.rollback();
    console.error('Push changes error:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  } finally {
    connection.release();
  }
};
