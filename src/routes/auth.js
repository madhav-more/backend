import express from 'express';
import { signup, login, validateToken, refreshToken, logout } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = express.Router();

router.post('/signup', signup);
router.post('/login', login);
router.get('/validate', authenticateToken, validateToken);
router.post('/refresh', authenticateToken, refreshToken);
router.post('/logout', authenticateToken, logout);

export default router;
