import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema({
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
    phone: {
        type: String,
        default: null,
    },
    email: {
        type: String,
        default: null,
    },
    address: {
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

// Indexes
customerSchema.index({ user_id: 1 });
customerSchema.index({ user_id: 1, updated_at: 1 });
customerSchema.index({ user_id: 1, idempotency_key: 1 });
customerSchema.index({ deleted_at: 1 });
customerSchema.index({ phone: 1 });

// Text index for search functionality
customerSchema.index({ name: 'text', phone: 'text', email: 'text' });

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
