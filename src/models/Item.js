import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
        ref: 'User',
    },
    name: {
        type: String,
        required: true,
    },
    barcode: {
        type: String,
        default: null,
    },
    sku: {
        type: String,
        default: null,
    },
    price: {
        type: Number,
        default: 0.00,
    },
    unit: {
        type: String,
        default: null,
    },
    inventory_qty: {
        type: Number,
        default: 0.000,
    },
    category: {
        type: String,
        default: null,
    },
    recommended: {
        type: Boolean,
        default: false,
    },
    image_path: {
        type: String,
        default: null,
    },
    idempotency_key: {
        type: String,
        default: null,
    },
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
            return ret;
        }
    }
});

// Indexes for performance
itemSchema.index({ user_id: 1 });
itemSchema.index({ user_id: 1, updated_at: 1 });
itemSchema.index({ user_id: 1, idempotency_key: 1 });
itemSchema.index({ deleted_at: 1 });
itemSchema.index({ barcode: 1 });
itemSchema.index({ category: 1 });

const Item = mongoose.model('Item', itemSchema);

export default Item;
