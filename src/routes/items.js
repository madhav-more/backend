import express from 'express';
import { getItems, batchUpsertItems, updateItem, deleteItem } from '../controllers/itemsController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.use(authenticateToken);

router.get('/', getItems);
router.post('/batch', batchUpsertItems);
router.put('/:id', updateItem);
router.delete('/:id', deleteItem);

export default router;
