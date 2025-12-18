import Transaction from '../models/Transaction.js';

export const initDailyVouchers = async (req, res) => {
  const { company_code, date, user_id } = req.body;

  if (!company_code || !date || !user_id) {
    return res.status(400).json({
      error: 'company_code, date, and user_id are required'
    });
  }

  try {
    const dateStr = date;
    const prefix = `${company_code}-${dateStr}`;

    const lastTransaction = await Transaction.findOne({
      user_id,
      voucher_number: { $regex: new RegExp(`^${prefix}-`) }
    }).sort({ voucher_number: -1 });

    let nextSequence = 1;
    if (lastTransaction) {
      const lastVoucher = lastTransaction.voucher_number;
      const match = lastVoucher.match(/-(\d+)$/);
      if (match) {
        nextSequence = parseInt(match[1]) + 1;
      }
    }

    res.json({
      success: true,
      company_code,
      date,
      next_sequence: nextSequence,
      prefix,
    });
  } catch (error) {
    console.error('Init daily vouchers error:', error);
    res.status(500).json({ error: 'Failed to initialize daily vouchers' });
  }
};

export const generateVoucherNumber = async (req, res) => {
  const { provisional_voucher, company_code, date, sequence, transaction_data } = req.body;
  const userId = req.user.userId;

  if (!provisional_voucher || !company_code || !date || !sequence) {
    return res.status(400).json({
      error: 'provisional_voucher, company_code, date, and sequence are required'
    });
  }

  try {
    const voucher_number = `${company_code}-${date}-${sequence}`;

    const existing = await Transaction.findOne({
      user_id: userId,
      voucher_number
    });

    if (existing) {
      return res.status(409).json({
        error: 'Voucher number already exists',
        voucher_number,
      });
    }

    res.json({
      success: true,
      voucher_number,
      provisional_voucher,
      company_code,
      date,
      sequence,
    });
  } catch (error) {
    console.error('Generate voucher error:', error);
    res.status(500).json({ error: 'Failed to generate voucher number' });
  }
};

export const confirmVoucherNumber = async (req, res) => {
  const { provisional_voucher, voucher_number, transaction_id } = req.body;
  const userId = req.user.userId;

  if (!provisional_voucher || !voucher_number || !transaction_id) {
    return res.status(400).json({
      error: 'provisional_voucher, voucher_number, and transaction_id are required'
    });
  }

  try {
    const result = await Transaction.updateOne(
      { _id: transaction_id, user_id: userId },
      { $set: { voucher_number, provisional_voucher: null, updated_at: new Date() } }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      message: 'Voucher number confirmed',
      voucher_number,
      transaction_id,
    });
  } catch (error) {
    console.error('Confirm voucher error:', error);
    res.status(500).json({ error: 'Failed to confirm voucher number' });
  }
};
