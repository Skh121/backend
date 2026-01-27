import express from 'express';
import { googleAuth } from '../controllers/oauth.controller.js';
import { logAction } from '../middleware/auditLog.js';

const router = express.Router();

// Google OAuth
router.post('/google', logAction('auth', 'google_oauth_attempt'), googleAuth);

export default router;

