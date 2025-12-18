import Transaction from '../models/Transaction.js';
import User from '../models/User.js';
import Item from '../models/Item.js';
import Customer from '../models/Customer.js';

/**
 * Get sales report with filters
 */
export const getSalesReport = async (req, res) => {
  const { from, to, customer_id, payment_type } = req.query;
  const userId = req.user.userId;

  try {
    const query = {
      user_id: userId,
      status: 'completed',
      deleted_at: null
    };

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

    // Fetch transactions with customer data using aggregation
    const transactions = await Transaction.aggregate([
      { $match: query },
      {
        $lookup: {
          from: 'customers',
          localField: 'customer_id',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      { $sort: { date: -1 } }
    ]);

    const user = await User.findById(userId);
    const companyName = user?.company;

    // Calculate summary stats
    const summary = {
      total_transactions: transactions.length,
      total_revenue: transactions.reduce((sum, tx) => sum + (tx.grand_total || 0), 0),
      total_items_sold: transactions.reduce((sum, tx) => sum + (tx.item_count || 0), 0),
      total_discount_given: transactions.reduce((sum, tx) => sum + (tx.discount || 0), 0),
      payment_type_breakdown: {}
    };

    // Group by payment type
    transactions.forEach(tx => {
      const type = tx.payment_type || 'unknown';
      if (!summary.payment_type_breakdown[type]) {
        summary.payment_type_breakdown[type] = { count: 0, total: 0 };
      }
      summary.payment_type_breakdown[type].count++;
      summary.payment_type_breakdown[type].total += tx.grand_total || 0;
    });

    // Format transactions - aggregation doesn't use toJSON, so we transform manually
    const formattedTransactions = transactions.map(tx => ({
      ...tx,
      id: tx._id,
      lines: tx.line_items || [],
      customer_name: tx.customer?.name,
      customer_phone: tx.customer?.phone,
      customer_email: tx.customer?.email,
      customer_address: tx.customer?.address,
      company_name: companyName
    }));

    // Remove MongoDB-specific fields
    formattedTransactions.forEach(tx => {
      delete tx._id;
      delete tx.line_items;
      delete tx.customer;
      delete tx.__v;
    });

    res.json({
      summary,
      transactions: formattedTransactions
    });
  } catch (error) {
    console.error('Get sales report error:', error);
    res.status(500).json({ error: 'Failed to generate sales report', message: error.message });
  }
};

/**
 * Get weekly sales analytics
 */
export const getWeeklySales = async (req, res) => {
  const { weeks = 8 } = req.query;
  const userId = req.user.userId;

  try {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (parseInt(weeks) * 7));

    const weeklySales = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            week: { $week: '$date' }
          },
          week_start: { $min: '$date' },
          transaction_count: { $sum: 1 },
          total_sales: { $sum: '$grand_total' },
          total_items: { $sum: '$item_count' },
          total_discount: { $sum: '$discount' },
          avg_transaction_value: { $avg: '$grand_total' }
        }
      },
      { $sort: { '_id.year': -1, '_id.week': -1 } }
    ]);

    res.json({
      weeks: weeklySales.map(week => ({
        year_week: `${week._id.year}-W${week._id.week}`,
        week_start: week.week_start,
        transactions: week.transaction_count,
        total_sales: week.total_sales || 0,
        total_items: week.total_items || 0,
        total_discount: week.total_discount || 0,
        avg_transaction: week.avg_transaction_value || 0
      }))
    });
  } catch (error) {
    console.error('Get weekly sales error:', error);
    res.status(500).json({ error: 'Failed to generate weekly sales report', message: error.message });
  }
};

/**
 * Get monthly sales analytics
 */
export const getMonthlySales = async (req, res) => {
  const { months = 12 } = req.query;
  const userId = req.user.userId;

  try {
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - parseInt(months));

    const monthlySales = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: { $gte: startDate }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$date' },
            month: { $month: '$date' }
          },
          month_start: { $min: '$date' },
          transaction_count: { $sum: 1 },
          total_sales: { $sum: '$grand_total' },
          total_items: { $sum: '$item_count' },
          total_discount: { $sum: '$discount' },
          total_tax: { $sum: '$tax' },
          avg_transaction_value: { $avg: '$grand_total' },
          max_transaction: { $max: '$grand_total' }
        }
      },
      { $sort: { '_id.year': -1, '_id.month': -1 } }
    ]);

    res.json({
      months: monthlySales.map(month => ({
        year_month: `${month._id.year}-${String(month._id.month).padStart(2, '0')}`,
        month_start: month.month_start,
        transactions: month.transaction_count,
        total_sales: month.total_sales || 0,
        total_items: month.total_items || 0,
        total_discount: month.total_discount || 0,
        total_tax: month.total_tax || 0,
        avg_transaction: month.avg_transaction_value || 0,
        max_transaction: month.max_transaction || 0
      }))
    });
  } catch (error) {
    console.error('Get monthly sales error:', error);
    res.status(500).json({ error: 'Failed to generate monthly sales report', message: error.message });
  }
};

/**
 * Get dashboard analytics summary
 */
export const getDashboardAnalytics = async (req, res) => {
  const userId = req.user.userId;

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Today's sales
    const todaySales = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: { $gte: today }
        }
      },
      {
        $group: {
          _id: null,
          transaction_count: { $sum: 1 },
          total_sales: { $sum: '$grand_total' },
          total_items: { $sum: '$item_count' }
        }
      }
    ]);

    // This week's sales
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());

    const weekSales = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: { $gte: weekStart }
        }
      },
      {
        $group: {
          _id: null,
          transaction_count: { $sum: 1 },
          total_sales: { $sum: '$grand_total' }
        }
      }
    ]);

    // This month's sales
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    const monthSales = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: { $gte: monthStart }
        }
      },
      {
        $group: {
          _id: null,
          transaction_count: { $sum: 1 },
          total_sales: { $sum: '$grand_total' }
        }
      }
    ]);

    // Top items (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const topItemsAggreg = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: { $gte: thirtyDaysAgo }
        }
      },
      { $unwind: '$line_items' },
      {
        $group: {
          _id: '$line_items.item_id',
          item_name: { $first: '$line_items.item_name' },
          total_quantity: { $sum: '$line_items.quantity' },
          times_sold: { $sum: 1 }
        }
      },
      { $sort: { total_quantity: -1 } },
      { $limit: 5 }
    ]);

    // Low stock items
    const lowStock = await Item.find({
      user_id: userId,
      deleted_at: null,
      inventory_qty: { $lt: 10 }
    }).sort({ inventory_qty: 1 }).limit(10);

    res.json({
      today: {
        transactions: todaySales[0]?.transaction_count || 0,
        sales: todaySales[0]?.total_sales || 0,
        items_sold: todaySales[0]?.total_items || 0
      },
      this_week: {
        transactions: weekSales[0]?.transaction_count || 0,
        sales: weekSales[0]?.total_sales || 0
      },
      this_month: {
        transactions: monthSales[0]?.transaction_count || 0,
        sales: monthSales[0]?.total_sales || 0
      },
      top_items: topItemsAggreg.map(item => ({
        id: item._id,
        name: item.item_name,
        times_sold: item.times_sold,
        total_quantity: item.total_quantity
      })),
      low_stock: lowStock.map(item => ({
        id: item.id || item._id,
        name: item.name,
        quantity: item.inventory_qty,
        unit: item.unit,
        category: item.category
      }))
    });
  } catch (error) {
    console.error('Get dashboard analytics error:', error);
    res.status(500).json({ error: 'Failed to generate dashboard analytics', message: error.message });
  }
};

/**
 * Get report statistics for a date range
 */
export const getReportStats = async (req, res) => {
  const { startDate, endDate } = req.query;
  const userId = req.user.userId;

  try {
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    // Query transactions in date range
    const stats = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          transaction_count: { $sum: 1 },
          total_revenue: { $sum: '$grand_total' },
          total_items: { $sum: '$item_count' },
          total_tax: { $sum: '$tax' },
          total_discount: { $sum: '$discount' },
          average_transaction_value: { $avg: '$grand_total' }
        }
      }
    ]);

    // Get payment method breakdown
    const paymentBreakdown = await Transaction.aggregate([
      {
        $match: {
          user_id: userId,
          status: 'completed',
          deleted_at: null,
          date: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: '$payment_type',
          count: { $sum: 1 },
          total: { $sum: '$grand_total' }
        }
      }
    ]);

    const payment_method_breakdown = {};
    paymentBreakdown.forEach(row => {
      payment_method_breakdown[row._id || 'cash'] = {
        count: row.count,
        total: row.total || 0
      };
    });

    const statData = stats[0] || {};

    res.json({
      total_transactions: statData.transaction_count || 0,
      total_revenue: statData.total_revenue || 0,
      total_items: statData.total_items || 0,
      total_tax: statData.total_tax || 0,
      total_discount: statData.total_discount || 0,
      average_transaction_value: statData.average_transaction_value || 0,
      payment_method_breakdown,
      date_range: {
        start: startDate,
        end: endDate
      }
    });
  } catch (error) {
    console.error('Get report stats error:', error);
    res.status(500).json({ error: 'Failed to generate report statistics', message: error.message });
  }
};
