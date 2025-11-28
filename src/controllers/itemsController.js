import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';

export const getItems = async (req, res) => {
  const { since } = req.query;
  const userId = req.user.userId;

  try {
    let query = 'SELECT * FROM items WHERE user_id = ?';
    const params = [userId];

    if (since) {
      query += ' AND updated_at > ?';
      params.push(new Date(since));
    }

    query += ' ORDER BY updated_at ASC';

    const [items] = await pool.query(query, params);

    // Convert decimal strings to numbers if needed, or keep as strings for precision
    // mysql2 returns decimals as strings by default to preserve precision

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

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = {
      synced: [],
      conflicts: []
    };

    for (const item of items) {
      try {
        // 1. Check for idempotency key first
        if (item.idempotency_key) {
          const [existingIdempotency] = await connection.query(
            'SELECT id FROM items WHERE user_id = ? AND idempotency_key = ?',
            [userId, item.idempotency_key]
          );

          if (existingIdempotency.length > 0) {
            results.synced.push({
              id: item.id,
              cloud_id: existingIdempotency[0].id
            });
            continue;
          }
        }

        // 2. Check if item exists by ID
        // Use client-provided ID if available (for sync), otherwise generate new
        const itemId = item.id || uuidv4();

        const [existingItems] = await connection.query(
          'SELECT * FROM items WHERE user_id = ? AND id = ?',
          [userId, itemId]
        );

        const existingItem = existingItems[0];

        if (existingItem) {
          // Update existing item
          // Conflict resolution: Last Write Wins based on updated_at
          const clientUpdatedAt = new Date(item.updated_at || Date.now());
          const serverUpdatedAt = new Date(existingItem.updated_at);

          if (clientUpdatedAt > serverUpdatedAt) {
            await connection.query(
              `UPDATE items SET 
                name = ?, barcode = ?, sku = ?, price = ?, unit = ?, 
                inventory_qty = ?, category = ?, recommended = ?, image_path = ?, 
                updated_at = ?
               WHERE id = ? AND user_id = ?`,
              [
                item.name, item.barcode, item.sku, item.price, item.unit,
                item.inventory_qty, item.category, item.recommended, item.image_path,
                clientUpdatedAt,
                itemId, userId
              ]
            );
          }
        } else {
          // Insert new item
          await connection.query(
            `INSERT INTO items (
              id, user_id, name, barcode, sku, price, unit, 
              inventory_qty, category, recommended, image_path, 
              idempotency_key, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              itemId, userId, item.name, item.barcode, item.sku, item.price, item.unit,
              item.inventory_qty, item.category, item.recommended, item.image_path,
              item.idempotency_key,
              new Date(item.created_at || Date.now()),
              new Date(item.updated_at || Date.now())
            ]
          );
        }

        results.synced.push({
          id: item.id, // Client ID
          cloud_id: itemId // Server ID (same if client provided UUID)
        });

      } catch (itemError) {
        console.error('Error processing item:', itemError);
        results.conflicts.push({ id: item.id, error: itemError.message });
      }
    }

    await connection.commit();
    res.json(results);

  } catch (error) {
    await connection.rollback();
    console.error('Batch upsert items error:', error);
    res.status(500).json({ error: 'Failed to sync items' });
  } finally {
    connection.release();
  }
};

export const updateItem = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user.userId;

  try {
    // Check if item exists
    const [existing] = await pool.query('SELECT id FROM items WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Dynamic update query
    const fields = [];
    const values = [];

    // Allowed fields
    const allowedFields = ['name', 'barcode', 'sku', 'price', 'unit', 'inventory_qty', 'category', 'recommended', 'image_path'];

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

    // Add WHERE clause params
    values.push(id);
    values.push(userId);

    const query = `UPDATE items SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;

    await pool.query(query, values);

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
    const [result] = await pool.query('DELETE FROM items WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true, message: 'Item deleted successfully' });
  } catch (error) {
    console.error('Delete item error:', error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
};
