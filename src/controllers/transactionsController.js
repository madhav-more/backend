import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Item from '../models/Item.js';

export const getTransactions = async (req, res) => {
  const { since, from, to, customer_id, payment_type, status } = req.query;
  const userId = req.user.userId;

  try {
    const query = { user_id: userId };

    if (since) {
      query.updated_at = { $gt: new Date(since) };
    }

    if (from) {
      query.date = { ...query.date, $gte: new Date(from) };
    }

    if (to) {
      query.date = { ...query.date, $lte: new Date(to) };
    }

    if (customer_id) {
      query.customer_id = customer_id;
    }

    if (payment_type) {
      query.payment_type = payment_type;
    }

    if (status) {
      query.status = status;
    }

    const transactions = await Transaction.find(query).sort({ date: -1 });

    // toJSON transform automatically converts _id to id and line_items to lines

    res.json({ transactions });
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

  // Start a session for atomic operations
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const results = {
      synced: [],
      conflicts: []
    };

    for (const transaction of transactions) {
      try {
        // 1. Check for idempotency key
        if (transaction.idempotency_key) {
          const existingIdempotency = await Transaction.findOne({
            user_id: userId,
            idempotency_key: transaction.idempotency_key
          }).session(session);

          if (existingIdempotency) {
            results.synced.push({
              id: transaction.id,
              cloud_id: existingIdempotency._id,
              voucher_number: existingIdempotency.voucher_number
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
          const user = await User.findById(userId).session(session);
          const companyCode = user?.company?.substring(0, 3).toUpperCase() || 'GUR';

          // Get sequence
          const lastTx = await Transaction.findOne({
            user_id: userId,
            voucher_number: { $regex: new RegExp(`-${dateStr}-`) }
          }).sort({ voucher_number: -1 }).session(session);

          let sequence = 1;
          if (lastTx) {
            const lastVoucher = lastTx.voucher_number;
            const lastSeq = parseInt(lastVoucher.split('-').pop());
            sequence = lastSeq + 1;
          }

          voucherNumber = `${companyCode}-${dateStr}-${sequence.toString().padStart(4, '0')}`;
        }

        // 3. Create Transaction
        const transactionId = transaction.id || uuidv4();
        const newTransaction = await Transaction.create([{
          _id: transactionId,
          user_id: userId,
          customer_id: transaction.customer_id,
          voucher_number: voucherNumber,
          provisional_voucher: null,
          date: new Date(transaction.date || Date.now()),
          subtotal: transaction.subtotal,
          tax: transaction.tax,
          discount: transaction.discount,
          other_charges: transaction.other_charges,
          grand_total: transaction.grand_total,
          item_count: transaction.item_count,
          unit_count: transaction.unit_count,
          payment_type: transaction.payment_type,
          status: transaction.status,
          receipt_path: transaction.receipt_path,
          idempotency_key: transaction.idempotency_key,
          line_items: transaction.lines || [],
          created_at: new Date(transaction.created_at || Date.now()),
          updated_at: new Date(transaction.updated_at || Date.now())
        }], { session });

        // 4. Update Inventory (atomic)
        if (transaction.lines && Array.isArray(transaction.lines)) {
          for (const line of transaction.lines) {
            if (line.item_id) {
              await Item.updateOne(
                { _id: line.item_id, user_id: userId },
                { $inc: { inventory_qty: -(line.quantity || 0) } },
                { session }
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

    await session.commitTransaction();
    res.json(results);

  } catch (error) {
    await session.abortTransaction();
    console.error('Batch create transactions error:', error);
    res.status(500).json({ error: 'Failed to sync transactions' });
  } finally {
    session.endSession();
  }
};

export const updateTransaction = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user.userId;

  try {
    const allowedFields = ['status', 'receipt_path'];
    const updateData = {};

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        updateData[field] = updates[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updateData.updated_at = new Date();

    const result = await Transaction.updateOne(
      { _id: id, user_id: userId },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
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
    const result = await Transaction.deleteOne({ _id: id, user_id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    console.error('Delete transaction error:', error);
    res.status(500).json({ error: 'Failed to delete transaction' });
  }
};
