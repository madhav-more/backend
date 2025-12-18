import mongoose from 'mongoose';

const tokenBlacklistSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
    },
    expires_at: {
        type: Date,
        required: true,
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: false },
});

// TTL index to automatically delete expired tokens
tokenBlacklistSchema.index({ expires_at: 1 }, { expireAfterSeconds: 0 });

const TokenBlacklist = mongoose.model('TokenBlacklist', tokenBlacklistSchema);

export default TokenBlacklist;
