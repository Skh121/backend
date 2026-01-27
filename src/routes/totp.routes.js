import express from 'express';
import {
  setupTOTP,
  verifyAndEnableTOTP,
  disableTOTP,
  regenerateBackupCodes,
  getTOTPStatus,
  verifyTOTPLogin,
} from '../controllers/totp.controller.js';
import { authenticate } from '../middleware/auth.js';
import { logAction } from '../middleware/auditLog.js';

const router = express.Router();

// Public route - TOTP login verification (no auth required)
router.post('/verify-login', verifyTOTPLogin);

// Protected routes - require authentication
router.post('/setup', authenticate, logAction('security', 'totp_setup'), setupTOTP);
router.post('/verify', authenticate, logAction('security', 'totp_enabled'), verifyAndEnableTOTP);
router.post('/disable', authenticate, logAction('security', 'totp_disabled'), disableTOTP);
router.post('/regenerate-backup-codes', authenticate, logAction('security', 'backup_codes_regenerated'), regenerateBackupCodes);
router.get('/status', authenticate, getTOTPStatus);

export default router;
