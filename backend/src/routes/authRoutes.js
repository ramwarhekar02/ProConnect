import express from 'express';
import { login, verifyToken } from '../controllers/authController.js';
import authMiddleware from '../middleware/authMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', login);

// Protected routes
router.get('/verify', authMiddleware, verifyToken);

export default router;
