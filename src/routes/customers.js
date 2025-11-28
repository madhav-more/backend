import express from 'express';
import { getCustomers, batchUpsertCustomers, updateCustomer, searchCustomers, deleteCustomer } from '../controllers/customersController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getCustomers);
router.post('/search', searchCustomers);
router.post('/batch', batchUpsertCustomers);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

export default router;
