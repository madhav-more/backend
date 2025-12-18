import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';
import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import SyncMetadata from '../models/SyncMetadata.js';

/**
 * Pull changes from server (cloud → local)
 * Returns all records updated after the 'since' timestamp
 */
export const pullChanges = async (req, res) => {
  const { since } = req.body;
  const userId = req.user.userId;

  try {
    const sinceDate = since ? new Date(since) : new Date(0);

    // Fetch items (including soft-deleted ones)
    const items = await Item.find({
      user_id: userId,
      updated_at: { $gt: sinceDate }
    }).sort({ updated_at: 1 });

    // Fetch customers
    const customers = await Customer.find({
      user_id: userId,
      updated_at: { $gt: sinceDate }
    }).sort({ updated_at: 1 });

    // Fetch transactions with line items
    const transactions = await Transaction.find({
      user_id: userId,
      updated_at: { $gt: sinceDate }
    }).sort({ updated_at: 1 });

    // toJSON transform will automatically handle _id -> id and line_items -> lines

    res.json({
      items,
      customers,
      transactions,
      server_timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Pull changes error:', error);
    res.status(500).json({ error: 'Failed to pull changes', message: error.message });
  }
};

/**
 * Push changes from client (local → cloud)
 * Handles CREATE, UPDATE, and DELETE operations with conflict resolution
 */
export const pushChanges = async (req, res) => {
  const { items, customers, transactions } = req.body;
  const userId = req.user.userId;

  // Start a session for atomic operations
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const results = {
      items: { synced: [], conflicts: [] },
      customers: { synced: [], conflicts: [] },
      transactions: { synced: [], conflicts: [] }
    };

    // ==================== PROCESS ITEMS ====================
    if (items && Array.isArray(items)) {
      console.log(`Processing ${items.length} items for sync`);
      for (const item of items) {
        try {
          console.log(`Syncing item: ${item.name}, Price: ${item.price}, ID: ${item.id}`);

          // Handle deletion
          if (item.deleted_at) {
            const result = await Item.updateOne(
              { _id: item.id, user_id: userId },
              { $set: { deleted_at: new Date(item.deleted_at), updated_at: new Date() } },
              { session }
            );

            if (result.modifiedCount > 0) {
              results.items.synced.push({ id: item.id, cloud_id: item.id, deleted: true });
            }
            continue;
          }

          // Check for idempotency
          if (item.idempotency_key) {
            const existingIdempotency = await Item.findOne({
              user_id: userId,
              idempotency_key: item.idempotency_key,
              deleted_at: null
            }).session(session);

            if (existingIdempotency) {
              results.items.synced.push({ id: item.id, cloud_id: existingIdempotency._id });
              continue;
            }
          }

          const itemId = item.id || uuidv4();
          const existingItem = await Item.findOne({
            _id: itemId,
            user_id: userId,
            deleted_at: null
          }).session(session);

          if (existingItem) {
            // UPDATE existing item
            const clientUpdatedAt = new Date(item.updated_at || Date.now());
            const serverUpdatedAt = new Date(existingItem.updated_at);

            // Conflict resolution: last-write-wins based on updated_at
            if (clientUpdatedAt >= serverUpdatedAt) {
              await Item.updateOne(
                { _id: itemId, user_id: userId },
                {
                  $set: {
                    name: item.name,
                    barcode: item.barcode || null,
                    sku: item.sku || null,
                    price: item.price || 0,
                    unit: item.unit || 'piece',
                    inventory_qty: item.inventory_qty || 0,
                    category: item.category || null,
                    recommended: item.recommended || false,
                    image_path: item.image_path || item.image_url || null,
                    updated_at: clientUpdatedAt,
                    deleted_at: null
                  }
                },
                { session }
              );
              results.items.synced.push({ id: item.id, cloud_id: itemId, action: 'updated' });
            } else {
              // Server version is newer - conflict
              results.items.conflicts.push({
                id: item.id,
                reason: 'Server version is newer',
                server_updated_at: serverUpdatedAt,
                client_updated_at: clientUpdatedAt
              });
            }
          } else {
            // CREATE new item
            await Item.create([{
              _id: itemId,
              user_id: userId,
              name: item.name,
              barcode: item.barcode || null,
              sku: item.sku || null,
              price: item.price || 0,
              unit: item.unit || 'piece',
              inventory_qty: item.inventory_qty || 0,
              category: item.category || null,
              recommended: item.recommended || false,
              image_path: item.image_path || item.image_url || null,
              idempotency_key: item.idempotency_key || `item-${itemId}`,
              created_at: new Date(item.created_at || Date.now()),
              updated_at: new Date(item.updated_at || Date.now())
            }], { session });
            results.items.synced.push({ id: item.id, cloud_id: itemId, action: 'created' });
          }
        } catch (err) {
          console.error('Item sync error:', err);
          results.items.conflicts.push({ id: item.id, error: err.message });
        }
      }
    }

    // ==================== PROCESS CUSTOMERS ====================
    if (customers && Array.isArray(customers)) {
      for (const customer of customers) {
        try {
          // Handle deletion
          if (customer.deleted_at) {
            const result = await Customer.updateOne(
              { _id: customer.id, user_id: userId },
              { $set: { deleted_at: new Date(customer.deleted_at), updated_at: new Date() } },
              { session }
            );

            if (result.modifiedCount > 0) {
              results.customers.synced.push({ id: customer.id, cloud_id: customer.id, deleted: true });
            }
            continue;
          }

          // Check for idempotency
          if (customer.idempotency_key) {
            const existingIdempotency = await Customer.findOne({
              user_id: userId,
              idempotency_key: customer.idempotency_key,
              deleted_at: null
            }).session(session);

            if (existingIdempotency) {
              results.customers.synced.push({ id: customer.id, cloud_id: existingIdempotency._id });
              continue;
            }
          }

          const customerId = customer.id || uuidv4();
          const existingCustomer = await Customer.findOne({
            _id: customerId,
            user_id: userId,
            deleted_at: null
          }).session(session);

          if (existingCustomer) {
            // UPDATE existing customer
            const clientUpdatedAt = new Date(customer.updated_at || Date.now());
            const serverUpdatedAt = new Date(existingCustomer.updated_at);

            if (clientUpdatedAt >= serverUpdatedAt) {
              await Customer.updateOne(
                { _id: customerId, user_id: userId },
                {
                  $set: {
                    name: customer.name,
                    phone: customer.phone || null,
                    email: customer.email || null,
                    address: customer.address || null,
                    updated_at: clientUpdatedAt,
                    deleted_at: null
                  }
                },
                { session }
              );
              results.customers.synced.push({ id: customer.id, cloud_id: customerId, action: 'updated' });
            } else {
              results.customers.conflicts.push({
                id: customer.id,
                reason: 'Server version is newer'
              });
            }
          } else {
            // CREATE new customer
            await Customer.create([{
              _id: customerId,
              user_id: userId,
              name: customer.name,
              phone: customer.phone || null,
              email: customer.email || null,
              address: customer.address || null,
              idempotency_key: customer.idempotency_key || `customer-${customerId}`,
              created_at: new Date(customer.created_at || Date.now()),
              updated_at: new Date(customer.updated_at || Date.now())
            }], { session });
            results.customers.synced.push({ id: customer.id, cloud_id: customerId, action: 'created' });
          }
        } catch (err) {
          console.error('Customer sync error:', err);
          results.customers.conflicts.push({ id: customer.id, error: err.message });
        }
      }
    }

    // ==================== PROCESS TRANSACTIONS ====================
    if (transactions && Array.isArray(transactions)) {
      for (const transaction of transactions) {
        try {
          // Handle deletion
          if (transaction.deleted_at) {
            const result = await Transaction.updateOne(
              { _id: transaction.id, user_id: userId },
              { $set: { deleted_at: new Date(transaction.deleted_at), updated_at: new Date() } },
              { session }
            );

            if (result.modifiedCount > 0) {
              results.transactions.synced.push({ id: transaction.id, cloud_id: transaction.id, deleted: true });
            }
            continue;
          }

          // Check for idempotency
          if (transaction.idempotency_key) {
            const existingIdempotency = await Transaction.findOne({
              user_id: userId,
              idempotency_key: transaction.idempotency_key,
              deleted_at: null
            }).session(session);

            if (existingIdempotency) {
              results.transactions.synced.push({
                id: transaction.id,
                cloud_id: existingIdempotency._id,
                voucher_number: existingIdempotency.voucher_number
              });
              continue;
            }
          }

          const transactionId = transaction.id || uuidv4();
          const existingTx = await Transaction.findOne({
            _id: transactionId,
            user_id: userId,
            deleted_at: null
          }).session(session);

          if (existingTx) {
            // UPDATE existing transaction
            const clientUpdatedAt = new Date(transaction.updated_at || Date.now());
            const serverUpdatedAt = new Date(existingTx.updated_at);

            if (clientUpdatedAt >= serverUpdatedAt) {
              await Transaction.updateOne(
                { _id: transactionId, user_id: userId },
                {
                  $set: {
                    customer_id: transaction.customer_id || null,
                    voucher_number: transaction.voucher_number || existingTx.voucher_number,
                    provisional_voucher: transaction.provisional_voucher || null,
                    date: new Date(transaction.date || existingTx.date),
                    subtotal: transaction.subtotal || 0,
                    tax: transaction.tax || 0,
                    discount: transaction.discount || 0,
                    other_charges: transaction.other_charges || 0,
                    grand_total: transaction.grand_total || 0,
                    item_count: transaction.item_count || 0,
                    unit_count: transaction.unit_count || 0,
                    payment_type: transaction.payment_type || 'cash',
                    status: transaction.status || 'completed',
                    receipt_path: transaction.receipt_path || transaction.receipt_file_path || null,
                    line_items: transaction.lines || [],
                    updated_at: clientUpdatedAt,
                    deleted_at: null
                  }
                },
                { session }
              );

              results.transactions.synced.push({
                id: transaction.id,
                cloud_id: transactionId,
                voucher_number: existingTx.voucher_number,
                action: 'updated'
              });
            } else {
              results.transactions.conflicts.push({
                id: transaction.id,
                reason: 'Server version is newer'
              });
            }
          } else {
            // CREATE new transaction - generate voucher number
            let voucherNumber = transaction.voucher_number;
            if (!voucherNumber || transaction.provisional_voucher) {
              const today = new Date();
              const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

              const user = await User.findById(userId).session(session);
              const companyCode = user?.company?.substring(0, 3).toUpperCase() || 'GUR';

              const lastTx = await Transaction.findOne({
                user_id: userId,
                voucher_number: { $regex: new RegExp(`-${dateStr}-`) },
                deleted_at: null
              }).sort({ voucher_number: -1 }).session(session);

              let sequence = 1;
              if (lastTx) {
                const lastVoucher = lastTx.voucher_number;
                const lastSeq = parseInt(lastVoucher.split('-').pop());
                sequence = lastSeq + 1;
              }

              voucherNumber = `${companyCode}-${dateStr}-${sequence.toString().padStart(4, '0')}`;
            }

            await Transaction.create([{
              _id: transactionId,
              user_id: userId,
              customer_id: transaction.customer_id || null,
              voucher_number: voucherNumber,
              provisional_voucher: null,
              date: new Date(transaction.date || Date.now()),
              subtotal: transaction.subtotal || 0,
              tax: transaction.tax || 0,
              discount: transaction.discount || 0,
              other_charges: transaction.other_charges || 0,
              grand_total: transaction.grand_total || 0,
              item_count: transaction.item_count || 0,
              unit_count: transaction.unit_count || 0,
              payment_type: transaction.payment_type || 'cash',
              status: transaction.status || 'completed',
              receipt_path: transaction.receipt_path || transaction.receipt_file_path || null,
              idempotency_key: transaction.idempotency_key || `transaction-${transactionId}`,
              line_items: transaction.lines || [],
              created_at: new Date(transaction.created_at || Date.now()),
              updated_at: new Date(transaction.updated_at || Date.now())
            }], { session });

            // Update inventory for completed transactions
            if (transaction.status === 'completed' && transaction.lines && Array.isArray(transaction.lines)) {
              for (const line of transaction.lines) {
                if (line.item_id) {
                  await Item.updateOne(
                    { _id: line.item_id, user_id: userId, deleted_at: null },
                    { $inc: { inventory_qty: -(line.quantity || 0) } },
                    { session }
                  );
                }
              }
            }

            results.transactions.synced.push({
              id: transaction.id,
              cloud_id: transactionId,
              voucher_number: voucherNumber,
              action: 'created'
            });
          }
        } catch (err) {
          console.error('Transaction sync error:', err);
          results.transactions.conflicts.push({ id: transaction.id, error: err.message });
        }
      }
    }

    await session.commitTransaction();

    // Update sync metadata
    const entities = ['items', 'customers', 'transactions'];
    for (const entity of entities) {
      await SyncMetadata.findOneAndUpdate(
        { user_id: userId, entity_type: entity },
        {
          $set: { last_sync_at: new Date() },
          $inc: { sync_count: 1 }
        },
        { upsert: true, new: true }
      );
    }

    res.json({
      ...results,
      server_timestamp: new Date().toISOString()
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Push changes error:', error);
    res.status(500).json({ error: 'Failed to push changes', message: error.message });
  } finally {
    session.endSession();
  }
};
