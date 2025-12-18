import mongoose from 'mongoose';

const lineItemSchema = new mongoose.Schema({
    item_id: String,
    item_name: String,
    quantity: Number,
    price: Number,
    unit: String,
    total: Number,
}, { _id: false });

const transactionSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
        ref: 'User',
    },
    customer_id: {
        type: String,
        ref: 'Customer',
        default: null,
    },
    voucher_number: {
        type: String,
        default: null,
    },
    provisional_voucher: {
        type: String,
        default: null,
    },
    date: {
        type: Date,
        required: true,
    },
    subtotal: {
        type: Number,
        default: 0.00,
    },
    tax: {
        type: Number,
        default: 0.00,
    },
    discount: {
        type: Number,
        default: 0.00,
    },
    other_charges: {
        type: Number,
        default: 0.00,
    },
    grand_total: {
        type: Number,
        default: 0.00,
    },
    item_count: {
        type: Number,
        default: 0,
    },
    unit_count: {
        type: Number,
        default: 0.000,
    },
    payment_type: {
        type: String,
        default: null,
    },
    status: {
        type: String,
        default: 'completed',
    },
    receipt_path: {
        type: String,
        default: null,
    },
    idempotency_key: {
        type: String,
        default: null,
    },
    line_items: [lineItemSchema],
    deleted_at: {
        type: Date,
        default: null,
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    toJSON: {
        transform: function (doc, ret) {
            ret.id = ret._id;
            delete ret._id;
            delete ret.__v;
            // Also transform line_items for consistency
            if (ret.line_items && Array.isArray(ret.line_items)) {
                ret.lines = ret.line_items;
                delete ret.line_items;
            }
            return ret;
        }
    }
});

// Indexes
transactionSchema.index({ user_id: 1 });
transactionSchema.index({ user_id: 1, updated_at: 1 });
transactionSchema.index({ user_id: 1, voucher_number: 1 });
transactionSchema.index({ user_id: 1, idempotency_key: 1 });
transactionSchema.index({ deleted_at: 1 });
transactionSchema.index({ date: 1 });
transactionSchema.index({ customer_id: 1 });
transactionSchema.index({ status: 1 });

const Transaction = mongoose.model('Transaction', transactionSchema);

export default Transaction;
