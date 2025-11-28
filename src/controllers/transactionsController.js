import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';

export const getTransactions = async (req, res) => {
  const { since, from, to, customer_id, payment_type, status } = req.query;
  const userId = req.user.userId;

  try {
    let query = 'SELECT * FROM transactions WHERE user_id = ?';
    const params = [userId];

    if (since) {
      query += ' AND updated_at > ?';
      params.push(new Date(since));
    }

    if (from) {
      query += ' AND date >= ?';
      params.push(new Date(from));
    }

    if (to) {
      query += ' AND date <= ?';
      params.push(new Date(to));
    }

    if (customer_id) {
      query += ' AND customer_id = ?';
      params.push(customer_id);
    }

    if (payment_type) {
      query += ' AND payment_type = ?';
      params.push(payment_type);
    }

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY date DESC';

    const [transactions] = await pool.query(query, params);

    // Map line_items back to lines
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      lines: tx.line_items ? JSON.parse(tx.line_items) : []
    }));

    res.json({ transactions: formattedTransactions });
  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
};

export const createTransactionsBatch = async (req, res) => {
  const { transactions } = req.body;
  const userId = req.user.userId;

  if (!transactions || !Array.isArray(transactions)) {
    return res.status(400).json({ error: 'Transactions array is required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = {
      synced: [],
      conflicts: []
    };

    for (const transaction of transactions) {
      try {
        // 1. Check for idempotency key
        if (transaction.idempotency_key) {
          const [existingIdempotency] = await connection.query(
            'SELECT id, voucher_number FROM transactions WHERE user_id = ? AND idempotency_key = ?',
            [userId, transaction.idempotency_key]
          );

          if (existingIdempotency.length > 0) {
            results.synced.push({
              id: transaction.id,
              cloud_id: existingIdempotency[0].id,
              voucher_number: existingIdempotency[0].voucher_number
            });
            continue;
          }
        }

        // 2. Generate Voucher Number if needed
        let voucherNumber = transaction.voucher_number;
        if (!voucherNumber || transaction.provisional_voucher) {
          const today = new Date();
          const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

          // Get user company code
          const [users] = await connection.query('SELECT company FROM users WHERE id = ?', [userId]);
          const companyCode = users[0]?.company?.substring(0, 3).toUpperCase() || 'GUR';

          // Get sequence
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

        // 3. Create Transaction
        const transactionId = transaction.id || uuidv4();
        const linesJson = JSON.stringify(transaction.lines || []);

        await connection.query(
          `INSERT INTO transactions (
            id, user_id, customer_id, voucher_number, provisional_voucher, 
            date, subtotal, tax, discount, other_charges, grand_total, 
            item_count, unit_count, payment_type, status, receipt_path, 
            idempotency_key, line_items, created_at, updated_at
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

        // 4. Update Inventory
        if (transaction.lines && Array.isArray(transaction.lines)) {
          for (const line of transaction.lines) {
            if (line.item_id) {
              await connection.query(
                'UPDATE items SET inventory_qty = inventory_qty - ? WHERE id = ? AND user_id = ?',
                [line.quantity || 0, line.item_id, userId]
              );
            }
          }
        }

        results.synced.push({
          id: transaction.id,
          cloud_id: transactionId,
          voucher_number: voucherNumber
        });

      } catch (txError) {
        console.error('Error processing transaction:', txError);
        results.conflicts.push({ id: transaction.id, error: txError.message });
      }
    }

    await connection.commit();
    res.json(results);

  } catch (error) {
    await connection.rollback();
    console.error('Batch create transactions error:', error);
    res.status(500).json({ error: 'Failed to sync transactions' });
  } finally {
    connection.release();
  }
};

export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user.userId;

  try {
    const fields = [];
    const values = [];
    const allowedFields = ['status', 'receipt_path']; // Only allow updating specific fields

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        fields.push(`${field} = ?`);
        values.push(updates[field]);
      }
    }

    if (fields.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    fields.push('updated_at = NOW()');
    values.push(id);
    values.push(userId);

    const query = `UPDATE transactions SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;

    const [result] = await pool.query(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, message: 'Transaction updated successfully' });
  } catch (error) {
    console.error('Update transaction error:', error);
    res.status(500).json({ error: 'Failed to update transaction' });
  }
};

export const deleteTransaction = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const [result] = await pool.query('DELETE FROM transactions WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};
