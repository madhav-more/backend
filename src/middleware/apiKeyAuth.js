import crypto from 'crypto';
import ApiKey from '../models/ApiKey.js';

/**
 * Validate API key and check permissions
 * @param {Array<string>} requiredPermissions - Required permission levels
 */
export const validateApiKey = (requiredPermissions = []) => {
    return async (req, res, next) => {
        // Extract API key from header
        const apiKey = req.headers['x-api-key'];

        // If no required permissions, skip validation (read-only)
        if (requiredPermissions.length === 0) {
            return next();
        }

        if (!apiKey) {
            return res.status(401).json({
                error: 'API key required',
                message: 'This operation requires an API key. Generate one from Profile → API Access.'
            });
        }

        try {
            // Hash the provided key
            const keyHash = crypto
                .createHash('sha256')
                .update(apiKey)
                .digest('hex');

            // Look up key in database
            const keyRecord = await ApiKey.findOne({
                key_hash: keyHash,
                is_active: true
            });

            if (!keyRecord) {
                return res.status(403).json({
                    error: 'Invalid API key',
                    message: 'The provided API key is invalid or has been revoked.'
                });
            }

            const permissions = keyRecord.permissions;

            // Check if key has required permissions
            const hasPermission = requiredPermissions.some(required =>
                permissions.includes(required)
            );

            if (!hasPermission) {
                return res.status(403).json({
                    error: 'Insufficient permissions',
                    message: `This operation requires one of: ${requiredPermissions.join(', ')}`
                });
            }

            // Update last_used_at timestamp
            await ApiKey.updateOne(
                { _id: keyRecord._id },
                { $set: { last_used_at: new Date() } }
            );

            // Attach key info to request
            req.apiKey = {
                id: keyRecord._id,
                userId: keyRecord.user_id,
                permissions
            };

            next();

        } catch (error) {
            console.error('API key validation error:', error);
            return res.status(500).json({
                error: 'Internal server error',
                message: 'Failed to validate API key'
            });
        }
    };
};

/**
 * Optional API key validation - doesn't fail if key is missing
 */
export const optionalApiKey = async (req, res, next) => {
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
        req.apiKey = null;
        return next();
    }

    try {
        const keyHash = crypto
            .createHash('sha256')
            .update(apiKey)
            .digest('hex');

        const keyRecord = await ApiKey.findOne({
            key_hash: keyHash,
            is_active: true
        });

        if (keyRecord) {
            req.apiKey = {
                id: keyRecord._id,
                userId: keyRecord.user_id,
                permissions: keyRecord.permissions
            };

            // Update last_used_at
            await ApiKey.updateOne(
                { _id: keyRecord._id },
                { $set: { last_used_at: new Date() } }
            );
        } else {
            req.apiKey = null;
        }

        next();

    } catch (error) {
        console.error('Optional API key check error:', error);
        req.apiKey = null;
        next();
    }
};
