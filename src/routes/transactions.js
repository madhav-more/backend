import express from 'express';
import { createTransactionsBatch, getTransactions, deleteTransaction } from '../controllers/transactionsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/batch', createTransactionsBatch);
router.get('/', getTransactions);
router.delete('/:id', deleteTransaction);

export default router;
