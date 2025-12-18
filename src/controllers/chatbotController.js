import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import ApiKey from '../models/ApiKey.js';

/**
 * Generate new API key for chatbot
 */
export const generateApiKey = async (req, res) => {
    const userId = req.user.userId;

    try {
        // Check if user already has an active API key
        const existing = await ApiKey.findOne({
            user_id: userId,
            is_active: true
        });

        if (existing) {
            return res.status(400).json({
                error: 'API key already exists',
                message: 'You already have an active API key. Revoke it first to generate a new one.'
            });
        }

        // Generate cryptographically secure API key
        const randomBytes = crypto.randomBytes(24);
        const apiKey = `pk_live_${randomBytes.toString('base64url')}`;

        // Hash the key for storage
        const keyHash = crypto
            .createHash('sha256')
            .update(apiKey)
            .digest('hex');

        // Store first 12 characters for display
        const keyPrefix = apiKey.substring(0, 12);

        // Default permissions: WRITE and ADMIN
        const permissions = ['WRITE', 'ADMIN'];

        const keyId = uuidv4();

        // Insert into database
        await ApiKey.create({
            _id: keyId,
            user_id: userId,
            key_hash: keyHash,
            key_prefix: keyPrefix,
            permissions,
            is_active: true
        });

        // Return the full key (ONLY TIME it's shown)
        res.json({
            success: true,
            message: 'API key generated successfully. Save this key securely - you won\'t see it again.',
            apiKey,
            keyPrefix,
            permissions,
            createdAt: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error generating API key:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to generate API key'
        });
    }
};

/**
 * Get user's API key info (without revealing the key)
 */
export const getApiKeyInfo = async (req, res) => {
    const userId = req.user.userId;

    try {
        const key = await ApiKey.findOne({
            user_id: userId,
            is_active: true
        });

        if (!key) {
            return res.json({
                hasKey: false,
                message: 'No active API key found'
            });
        }

        res.json({
            hasKey: true,
            keyInfo: {
                id: key._id,
                prefix: key.key_prefix,
                permissions: key.permissions,
                createdAt: key.created_at,
                lastUsedAt: key.last_used_at
            }
        });

    } catch (error) {
        console.error('Error fetching API key info:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to fetch API key info'
        });
    }
};

/**
 * Revoke API key
 */
export const revokeApiKey = async (req, res) => {
    const userId = req.user.userId;
    const { keyId } = req.params;

    try {
        // Verify the key belongs to the user
        const key = await ApiKey.findOne({
            _id: keyId,
            user_id: userId
        });

        if (!key) {
            return res.status(404).json({
                error: 'API key not found',
                message: 'The specified API key does not exist or does not belong to you.'
            });
        }

        // Soft delete (set is_active to FALSE)
        await ApiKey.updateOne(
            { _id: keyId },
            { $set: { is_active: false, updated_at: new Date() } }
        );

        res.json({
            success: true,
            message: 'API key revoked successfully'
        });

    } catch (error) {
        console.error('Error revoking API key:', error);
        res.status(500).json({
            error: 'Internal server error',
            message: 'Failed to revoke API key'
        });
    }
};

/**
 * Validate a chatbot command (used by frontend before execution)
 */
export const validateCommand = async (req, res) => {
    const { action, data, filters } = req.body;

    // Define which actions require which permissions
    const permissionMap = {
        'GET_ITEMS': [],
        'GET_CUSTOMERS': [],
        'ADD_ITEM': ['WRITE', 'ADMIN'],
        'EDIT_ITEM': ['WRITE', 'ADMIN'],
        'DELETE_ITEM': ['ADMIN'],
        'DELETE_CUSTOMER': ['ADMIN']
    };

    const requiredPermissions = permissionMap[action];

    if (!requiredPermissions) {
        return res.status(400).json({
            valid: false,
            error: 'Invalid action',
            message: `Unknown action: ${action}`
        });
    }

    // Check if permissions are needed
    if (requiredPermissions.length === 0) {
        return res.json({
            valid: true,
            requiresApiKey: false,
            action
        });
    }

    // Check if API key is present and has required permissions
    if (!req.apiKey) {
        return res.json({
            valid: false,
            requiresApiKey: true,
            requiredPermissions,
            message: 'API key required for this action'
        });
    }

    const hasPermission = requiredPermissions.some(perm =>
        req.apiKey.permissions.includes(perm)
    );

    if (!hasPermission) {
        return res.json({
            valid: false,
            error: 'Insufficient permissions',
            message: `This action requires one of: ${requiredPermissions.join(', ')}`,
            userPermissions: req.apiKey.permissions
        });
    }

    // Validate required fields for write operations
    if (action === 'ADD_ITEM') {
        const required = ['name', 'price', 'category', 'unit'];
        const missing = required.filter(field => !data || !data[field]);

        if (missing.length > 0) {
            return res.json({
                valid: false,
                error: 'Missing required fields',
                message: `Missing: ${missing.join(', ')}`
            });
        }
    }

    res.json({
        valid: true,
        requiresApiKey: true,
        action,
        permissions: req.apiKey.permissions
    });
};
