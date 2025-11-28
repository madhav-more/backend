import { v4 as uuidv4 } from 'uuid';
import pool from '../config/database.js';

/**
 * Search customers with autosuggest functionality
 */
export const searchCustomers = async (req, res) => {
  const { query, limit = 10, searchFields = ['name', 'phone', 'email'] } = req.body;
  const userId = req.user.userId;

  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query parameter is required' });
  }

  try {
    const searchTerms = query.toLowerCase().split(' ').filter(term => term.length > 0);

    if (searchTerms.length === 0) {
      return res.json({ customers: [] });
    }

    // Build dynamic SQL query
    let sql = 'SELECT * FROM customers WHERE user_id = ? AND (';
    const params = [userId];

    const orConditions = [];
    searchFields.forEach(field => {
      searchTerms.forEach(term => {
        orConditions.push(`${field} LIKE ?`);
        params.push(`%${term}%`);
      });
    });

    sql += orConditions.join(' OR ') + ') LIMIT ?';
    params.push(limit * 2);

    const [customers] = await pool.query(sql, params);

    // Calculate relevance scores
    const scoredCustomers = customers.map(customer => {
      const score = calculateRelevanceScore(customer, query, searchFields);
      return { ...customer, relevanceScore: score };
    });

    // Sort and slice
    const sortedCustomers = scoredCustomers
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);

    res.json({
      customers: sortedCustomers,
      total: sortedCustomers.length,
      query: query
    });

  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({ error: 'Failed to search customers' });
  }
};

const calculateRelevanceScore = (customer, query, searchFields) => {
  let score = 0;
  const queryLower = query.toLowerCase();

  searchFields.forEach(field => {
    const value = customer[field] ? customer[field].toString().toLowerCase() : '';
    if (value === queryLower) score += 100;
    else if (value.startsWith(queryLower)) score += 50;
    else if (value.includes(queryLower)) score += 25;
  });

  return score;
};

export const getCustomers = async (req, res) => {
  const { since, search } = req.query;
  const userId = req.user.userId;

  try {
    let query = 'SELECT * FROM customers WHERE user_id = ?';
    const params = [userId];

    if (since) {
      query += ' AND updated_at > ?';
      params.push(new Date(since));
    }

    if (search) {
      query += ' AND (name LIKE ? OR phone LIKE ? OR email LIKE ?)';
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam, searchParam);
    }

    query += ' ORDER BY updated_at ASC';

    const [customers] = await pool.query(query, params);

    res.json({ customers });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Failed to fetch customers' });
  }
};

export const batchUpsertCustomers = async (req, res) => {
  const { customers } = req.body;
  const userId = req.user.userId;

  if (!customers || !Array.isArray(customers)) {
    return res.status(400).json({ error: 'Customers array is required' });
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const results = {
      synced: [],
      conflicts: []
    };

    for (const customer of customers) {
      try {
        if (customer.idempotency_key) {
          const [existingIdempotency] = await connection.query(
            'SELECT id FROM customers WHERE user_id = ? AND idempotency_key = ?',
            [userId, customer.idempotency_key]
          );

          if (existingIdempotency.length > 0) {
            results.synced.push({
              id: customer.id,
              cloud_id: existingIdempotency[0].id
            });
            continue;
          }
        }

        const customerId = customer.id || uuidv4();

        const [existingCustomers] = await connection.query(
          'SELECT * FROM customers WHERE user_id = ? AND id = ?',
          [userId, customerId]
        );

        const existingCustomer = existingCustomers[0];

        if (existingCustomer) {
          const clientUpdatedAt = new Date(customer.updated_at || Date.now());
          const serverUpdatedAt = new Date(existingCustomer.updated_at);

          if (clientUpdatedAt > serverUpdatedAt) {
            await connection.query(
              `UPDATE customers SET 
                name = ?, phone = ?, email = ?, address = ?, 
                updated_at = ?
               WHERE id = ? AND user_id = ?`,
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
              id, user_id, name, phone, email, address, 
              idempotency_key, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              customerId, userId, customer.name, customer.phone, customer.email, customer.address,
              customer.idempotency_key,
              new Date(customer.created_at || Date.now()),
              new Date(customer.updated_at || Date.now())
            ]
          );
        }

        results.synced.push({
          id: customer.id,
          cloud_id: customerId
        });

      } catch (customerError) {
        console.error('Error processing customer:', customerError);
        results.conflicts.push({ id: customer.id, error: customerError.message });
      }
    }

    await connection.commit();
    res.json(results);

  } catch (error) {
    await connection.rollback();
    console.error('Batch upsert customers error:', error);
    res.status(500).json({ error: 'Failed to sync customers' });
  } finally {
    connection.release();
  }
};

export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user.userId;

  try {
    const [existing] = await pool.query('SELECT id FROM customers WHERE id = ? AND user_id = ?', [id, userId]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const fields = [];
    const values = [];
    const allowedFields = ['name', 'phone', 'email', 'address'];

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

    const query = `UPDATE customers SET ${fields.join(', ')} WHERE id = ? AND user_id = ?`;

    await pool.query(query, values);

    res.json({ success: true, message: 'Customer updated successfully' });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Failed to update customer' });
  }
};

export const deleteCustomer = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;

  try {
    const [result] = await pool.query('DELETE FROM customers WHERE id = ? AND user_id = ?', [id, userId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};
