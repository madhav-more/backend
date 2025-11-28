import express from 'express';
import { pullChanges, pushChanges } from '../controllers/syncController.js';
import { flexibleAuth } from '../middleware/flexibleAuth.js';

const router = express.Router();

// Use flexible auth to support both JWT and simple user ID
router.use(flexibleAuth);

router.post('/pull', pullChanges);
router.post('/push', pushChanges);

export default router;
