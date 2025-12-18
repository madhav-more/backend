import mongoose from 'mongoose';

const apiKeySchema = new mongoose.Schema({
    _id: {
        type: String,
        required: true,
    },
    user_id: {
        type: String,
        required: true,
        ref: 'User',
    },
    key_hash: {
        type: String,
        required: true,
    },
    key_prefix: {
        type: String,
        required: true,
    },
    permissions: {
        type: [String],
        required: true,
        default: [],
    },
    is_active: {
        type: Boolean,
        default: true,
    },
    last_used_at: {
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
apiKeySchema.index({ user_id: 1 });
apiKeySchema.index({ key_hash: 1 });
apiKeySchema.index({ is_active: 1 });

const ApiKey = mongoose.model('ApiKey', apiKeySchema);

export default ApiKey;
