import { v4 as uuidv4 } from 'uuid';
import Item from '../models/Item.js';

export const getItems = async (req, res) => {
  const { since } = req.query;
  const userId = req.user.userId;

  try {
    const query = { user_id: userId };

    if (since) {
      query.updated_at = { $gt: new Date(since) };
    }

    const items = await Item.find(query).sort({ updated_at: 1 });

    res.json({ items });
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Failed to fetch items' });
  }
};

export const batchUpsertItems = async (req, res) => {
  const { items } = req.body;
  const userId = req.user.userId;

  if (!items || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Items array is required' });
  }

  try {
    const results = {
      synced: [],
      conflicts: []
    };

    for (const item of items) {
      try {
        // 1. Check for idempotency key first
        if (item.idempotency_key) {
          const existingIdempotency = await Item.findOne({
            user_id: userId,
            idempotency_key: item.idempotency_key
          });

          if (existingIdempotency) {
            results.synced.push({
              id: item.id,
              cloud_id: existingIdempotency._id
            });
            continue;
          }
        }

        // 2. Check if item exists by ID
        const itemId = item.id || uuidv4();
        const existingItem = await Item.findOne({
          _id: itemId,
          user_id: userId
        });

        if (existingItem) {
          // Update existing item with conflict resolution (Last Write Wins)
          const clientUpdatedAt = new Date(item.updated_at || Date.now());
          const serverUpdatedAt = new Date(existingItem.updated_at);

          if (clientUpdatedAt > serverUpdatedAt) {
            await Item.updateOne(
              { _id: itemId, user_id: userId },
              {
                $set: {
                  name: item.name,
                  barcode: item.barcode,
                  sku: item.sku,
                  price: item.price,
                  unit: item.unit,
                  inventory_qty: item.inventory_qty,
                  category: item.category,
                  recommended: item.recommended,
                  image_path: item.image_path,
                  updated_at: clientUpdatedAt
                }
              }
            );
          }
        } else {
          // Insert new item
          await Item.create({
            _id: itemId,
            user_id: userId,
            name: item.name,
            barcode: item.barcode,
            sku: item.sku,
            price: item.price,
            unit: item.unit,
            inventory_qty: item.inventory_qty,
            category: item.category,
            recommended: item.recommended,
            image_path: item.image_path,
            idempotency_key: item.idempotency_key,
            created_at: new Date(item.created_at || Date.now()),
            updated_at: new Date(item.updated_at || Date.now())
          });
        }

        results.synced.push({
          id: item.id,
          cloud_id: itemId
        });

      } catch (itemError) {
        console.error('Error processing item:', itemError);
        results.conflicts.push({ id: item.id, error: itemError.message });
      }
    }

    res.json(results);

  } catch (error) {
    console.error('Batch upsert items error:', error);
    res.status(500).json({ error: 'Failed to sync items' });
  }
};

export const updateItem = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user.userId;

  try {
    // Check if item exists
    const existing = await Item.findOne({ _id: id, user_id: userId });
    if (!existing) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Allowed fields
    const allowedFields = ['name', 'barcode', 'sku', 'price', 'unit', 'inventory_qty', 'category', 'recommended', 'image_path'];
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

    await Item.updateOne({ _id: id, user_id: userId }, { $set: updateData });

    res.json({ success: true, message: 'Item updated successfully' });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
};

export const deleteItem = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const result = await Item.deleteOne({ _id: id, user_id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
};
