import mongoose from 'mongoose';

const syncMetadataSchema = new mongoose.Schema({
    user_id: {
        type: String,
        required: true,
        ref: 'User',
    },
    entity_type: {
        type: String,
        required: true,
        enum: ['items', 'customers', 'transactions'],
    },
    last_sync_at: {
        type: Date,
        required: true,
    },
    sync_count: {
        type: Number,
        default: 0,
    },
    last_conflict_at: {
        type: Date,
        default: null,
    },
}, {
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

// Unique compound index
syncMetadataSchema.index({ user_id: 1, entity_type: 1 }, { unique: true });
syncMetadataSchema.index({ user_id: 1 });
syncMetadataSchema.index({ entity_type: 1 });

const SyncMetadata = mongoose.model('SyncMetadata', syncMetadataSchema);

export default SyncMetadata;
