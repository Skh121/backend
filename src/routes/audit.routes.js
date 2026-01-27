import express from 'express';
import {
  getMyActivity,
  getLoginHistory,
  getMySecurityEvents,
  getMyStats,
  getAllLogs,
  getSecurityEvents,
  getFailedLogins,
  getAuditStats,
  getUserLogs,
} from '../controllers/audit.controller.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// User routes - protected by authentication
router.get('/my-activity', authenticate, getMyActivity);
router.get('/login-history', authenticate, getLoginHistory);
router.get('/security-events', authenticate, getMySecurityEvents);
router.get('/stats', authenticate, getMyStats);

// Admin routes - protected by admin-only middleware
router.get('/admin/logs', adminOnly, getAllLogs);
router.get('/admin/security-events', adminOnly, getSecurityEvents);
router.get('/admin/failed-logins', adminOnly, getFailedLogins);
router.get('/admin/stats', adminOnly, getAuditStats);
router.get('/admin/user/:userId', adminOnly, getUserLogs);

export default router;
