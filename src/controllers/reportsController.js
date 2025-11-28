import pool from '../config/database.js';

export const getSalesReport = async (req, res) => {
  const { from, to, customer_id, payment_type } = req.query;
  const userId = req.user.userId;

  try {
    let query = `
      SELECT t.*, c.name as customer_name, c.phone as customer_phone, c.email as customer_email, c.address as customer_address
      FROM transactions t
      LEFT JOIN customers c ON t.customer_id = c.id
      WHERE t.user_id = ? AND t.status = 'completed'
    `;
    const params = [userId];

    if (from) {
      query += ' AND t.date >= ?';
      params.push(new Date(from));
    }

    if (to) {
      query += ' AND t.date <= ?';
      params.push(new Date(to));
    }

    if (customer_id) {
      query += ' AND t.customer_id = ?';
      params.push(customer_id);
    }

    if (payment_type) {
      query += ' AND t.payment_type = ?';
      params.push(payment_type);
    }

    query += ' ORDER BY t.date DESC';

    const [transactions] = await pool.query(query, params);

    const [users] = await pool.query('SELECT company FROM users WHERE id = ?', [userId]);
    const companyName = users[0]?.company;

    // Calculate summary stats
    const summary = {
      total_transactions: transactions.length,
      total_revenue: transactions.reduce((sum, tx) => sum + (parseFloat(tx.grand_total) || 0), 0),
      total_items_sold: transactions.reduce((sum, tx) => sum + (tx.item_count || 0), 0),
      total_discount_given: transactions.reduce((sum, tx) => sum + (parseFloat(tx.discount) || 0), 0),
      payment_type_breakdown: {}
    };

    // Group by payment type
    transactions.forEach(tx => {
      const type = tx.payment_type || 'unknown';
      if (!summary.payment_type_breakdown[type]) {
        summary.payment_type_breakdown[type] = { count: 0, total: 0 };
      }
      summary.payment_type_breakdown[type].count++;
      summary.payment_type_breakdown[type].total += parseFloat(tx.grand_total) || 0;
    });

    // Format transactions
    const formattedTransactions = transactions.map(tx => ({
      id: tx.id,
      date: tx.date,
      subtotal: tx.subtotal,
      tax: tx.tax,
      discount: tx.discount,
      other_charges: tx.other_charges,
      grand_total: tx.grand_total,
      item_count: tx.item_count,
      unit_count: tx.unit_count,
      payment_type: tx.payment_type,
      status: tx.status,
      customer_name: tx.customer_name,
      customer_phone: tx.customer_phone,
      customer_email: tx.customer_email,
      customer_address: tx.customer_address,
      company_name: companyName,
      items: tx.line_items ? JSON.parse(tx.line_items) : []
    }));

    res.json({
      summary,
      transactions: formattedTransactions
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report' });
  }
};
