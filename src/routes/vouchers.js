import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import * as voucherController from '../controllers/voucherController.js';

const router = express.Router();

router.post('/init-daily', authenticateToken, voucherController.initDailyVouchers);
router.post('/generate', authenticateToken, voucherController.generateVoucherNumber);
router.post('/confirm', authenticateToken, voucherController.confirmVoucherNumber);

export default router;
