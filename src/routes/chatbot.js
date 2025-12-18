import express from 'express';
import {
    generateApiKey,
    getApiKeyInfo,
    revokeApiKey,
    validateCommand
} from '../controllers/chatbotController.js';
import { authenticateToken } from '../middleware/auth.js';
import { optionalApiKey } from '../middleware/apiKeyAuth.js';

const router = express.Router();

// All routes require JWT authentication
router.use(authenticateToken);

// API Key Management Routes
router.post('/api-key/generate', generateApiKey);
router.get('/api-key/info', getApiKeyInfo);
router.delete('/api-key/:keyId', revokeApiKey);

// Command Validation Route (optional API key)
router.post('/validate-command', optionalApiKey, validateCommand);

export default router;
