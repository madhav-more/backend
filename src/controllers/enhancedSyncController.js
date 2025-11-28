import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import { v4 as uuidv4 } from 'uuid';

export const pushChanges = async (req, res) => {
  const { items, customers, transactions, user_id } = req.body;
  const userId = req.user.userId;

  if (userId !== user_id) {
    return res.status(403).json({ error: 'User mismatch' });
  }

  try {
    const results = {
      items: { synced: [], conflicts: [] },
      customers: { synced: [], conflicts: [] },
      transactions: { synced: [], conflicts: [] }
    };

    if (items && Array.isArray(items)) {
      for (const item of items) {
        try {
          if (item.idempotency_key) {
            const existingByIdempotency = await Item.findOne({
              idempotency_key: item.idempotency_key,
              user_id: userId
            });

            if (existingByIdempotency) {
              results.items.synced.push({
                id: item.id,
                id: existingByIdempotency._id,
                cloud_id: existingByIdempotency._id.toString()
              });
              continue;
            }
          }

          let existingItem = await Item.findOne({
            id: item.id,
            user_id: userId
          });

          if (existingItem) {
            if (new Date(item.updated_at) > existingItem.updatedAt) {
              await Item.findByIdAndUpdate(existingItem._id, {
                ...item,
                user_id: userId,
                updatedAt: new Date(item.updated_at)
              });
            }
            existingItem = await Item.findById(existingItem._id);
          } else {
            const newItem = new Item({
              id: item.id,
              cloud_id: item.cloud_id || uuidv4(),
              ...item,
              user_id: userId,
              updatedAt: new Date(item.updated_at || Date.now())
            });
            existingItem = await newItem.save();
          }

          results.items.synced.push({
            id: item.id,
            id: existingItem._id,
            cloud_id: existingItem._id.toString(),
            voucher_number: existingItem.voucher_number
          });
        } catch (itemError) {
          console.error('Item sync error:', itemError);
          results.items.conflicts.push({
            id: item.id,
            error: itemError.message
          });
        }
      }
    }

    if (customers && Array.isArray(customers)) {
      for (const customer of customers) {
        try {
          if (customer.idempotency_key) {
            const existingByIdempotency = await Customer.findOne({
              idempotency_key: customer.idempotency_key,
              user_id: userId
            });

            if (existingByIdempotency) {
              results.customers.synced.push({
                id: customer.id,
                id: existingByIdempotency._id,
                cloud_id: existingByIdempotency._id.toString()
              });
              continue;
            }
          }

          let existingCustomer = await Customer.findOne({
            id: customer.id,
            user_id: userId
          });

          if (existingCustomer) {
            if (new Date(customer.updated_at) > existingCustomer.updatedAt) {
              await Customer.findByIdAndUpdate(existingCustomer._id, {
                ...customer,
                user_id: userId,
                updatedAt: new Date(customer.updated_at)
              });
            }
            existingCustomer = await Customer.findById(existingCustomer._id);
          } else {
            const newCustomer = new Customer({
              id: customer.id,
              cloud_id: customer.cloud_id || uuidv4(),
              ...customer,
              user_id: userId,
              updatedAt: new Date(customer.updated_at || Date.now())
            });
            existingCustomer = await newCustomer.save();
          }

          results.customers.synced.push({
            id: customer.id,
            id: existingCustomer._id,
            cloud_id: existingCustomer._id.toString()
          });
        } catch (customerError) {
          console.error('Customer sync error:', customerError);
          results.customers.conflicts.push({
            id: customer.id,
            error: customerError.message
          });
        }
      }
    }

    if (transactions && Array.isArray(transactions)) {
      for (const transaction of transactions) {
        try {
          if (transaction.idempotency_key) {
            const existingByIdempotency = await Transaction.findOne({
              idempotency_key: transaction.idempotency_key,
              user_id: userId
            });

            if (existingByIdempotency) {
              results.transactions.synced.push({
                id: transaction.id,
                id: existingByIdempotency._id,
                cloud_id: existingByIdempotency._id.toString(),
                voucher_number: existingByIdempotency.voucher_number
              });
              continue;
            }
          }

          let existingTx = await Transaction.findOne({
            id: transaction.id,
            user_id: userId
          });

          if (existingTx) {
            if (new Date(transaction.updated_at) > existingTx.updatedAt) {
              await Transaction.findByIdAndUpdate(existingTx._id, {
                ...transaction,
                user_id: userId,
                updatedAt: new Date(transaction.updated_at)
              });
            }
            existingTx = await Transaction.findById(existingTx._id);
          } else {
            const newTx = new Transaction({
              id: transaction.id,
              cloud_id: transaction.cloud_id || uuidv4(),
              ...transaction,
              user_id: userId,
              updatedAt: new Date(transaction.updated_at || Date.now())
            });
            existingTx = await newTx.save();
          }

          results.transactions.synced.push({
            id: transaction.id,
            id: existingTx._id,
            cloud_id: existingTx._id.toString(),
            voucher_number: existingTx.voucher_number
          });
        } catch (txError) {
          console.error('Transaction sync error:', txError);
          results.transactions.conflicts.push({
            id: transaction.id,
            error: txError.message
          });
        }
      }
    }

    res.json(results);
  } catch (error) {
    console.error('Push changes error:', error);
    res.status(500).json({ error: 'Failed to push changes' });
  }
};

export const pullChanges = async (req, res) => {
  const { since } = req.body;
  const userId = req.user.userId;

  try {
    const sinceDate = since ? new Date(since) : new Date(0);

    const items = await Item.find({
      user_id: userId,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    const customers = await Customer.find({
      user_id: userId,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    const transactions = await Transaction.find({
      user_id: userId,
      updatedAt: { $gt: sinceDate }
    }).sort({ updatedAt: 1 });

    res.json({
      items,
      customers,
      transactions,
      server_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pull changes error:', error);
    res.status(500).json({ error: 'Failed to pull changes' });
  }
};
