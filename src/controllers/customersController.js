import { v4 as uuidv4 } from 'uuid';
import Customer from '../models/Customer.js';

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

    // Build regex query for flexible search
    const orConditions = [];
    searchFields.forEach(field => {
      searchTerms.forEach(term => {
        orConditions.push({ [field]: { $regex: term, $options: 'i' } });
      });
    });

    const customers = await Customer.find({
      user_id: userId,
      $or: orConditions
    }).limit(limit * 2).lean();

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
    const query = { user_id: userId };

    if (since) {
      query.updated_at = { $gt: new Date(since) };
    }

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await Customer.find(query).sort({ updated_at: 1 });

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

  try {
    const results = {
      synced: [],
      conflicts: []
    };

    for (const customer of customers) {
      try {
        if (customer.idempotency_key) {
          const existingIdempotency = await Customer.findOne({
            user_id: userId,
            idempotency_key: customer.idempotency_key
          });

          if (existingIdempotency) {
            results.synced.push({
              id: customer.id,
              cloud_id: existingIdempotency._id
            });
            continue;
          }
        }

        const customerId = customer.id || uuidv4();
        const existingCustomer = await Customer.findOne({
          _id: customerId,
          user_id: userId
        });

        if (existingCustomer) {
          const clientUpdatedAt = new Date(customer.updated_at || Date.now());
          const serverUpdatedAt = new Date(existingCustomer.updated_at);

          if (clientUpdatedAt > serverUpdatedAt) {
            await Customer.updateOne(
              { _id: customerId, user_id: userId },
              {
                $set: {
                  name: customer.name,
                  phone: customer.phone,
                  email: customer.email,
                  address: customer.address,
                  updated_at: clientUpdatedAt
                }
              }
            );
          }
        } else {
          await Customer.create({
            _id: customerId,
            user_id: userId,
            name: customer.name,
            phone: customer.phone,
            email: customer.email,
            address: customer.address,
            idempotency_key: customer.idempotency_key,
            created_at: new Date(customer.created_at || Date.now()),
            updated_at: new Date(customer.updated_at || Date.now())
          });
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

    res.json(results);

  } catch (error) {
    console.error('Batch upsert customers error:', error);
    res.status(500).json({ error: 'Failed to sync customers' });
  }
};

export const updateCustomer = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const userId = req.user.userId;

  try {
    const existing = await Customer.findOne({ _id: id, user_id: userId });
    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    const allowedFields = ['name', 'phone', 'email', 'address'];
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

    await Customer.updateOne({ _id: id, user_id: userId }, { $set: updateData });

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
    const result = await Customer.deleteOne({ _id: id, user_id: userId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
};
