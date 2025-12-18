import express from 'express';
import {
    getSalesReport,
    getWeeklySales,
    getMonthlySales,
    getDashboardAnalytics,
    getReportStats
} from '../controllers/reportsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/sales', getSalesReport);
router.get('/weekly', getWeeklySales);
router.get('/monthly', getMonthlySales);
router.get('/analytics', getDashboardAnalytics);
router.get('/stats', getReportStats);

export default router;

