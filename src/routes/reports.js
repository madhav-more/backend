import express from 'express';
import { getSalesReport } from '../controllers/reportsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/sales', getSalesReport);

export default router;
