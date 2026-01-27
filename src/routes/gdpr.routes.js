import express from 'express';
import {
  exportUserData,
  requestAccountDeletion,
  getDeletionEligibility,
  adminDeleteUser,
} from '../controllers/gdpr.controller.js';
import { authenticate, adminOnly } from '../middleware/auth.js';

const router = express.Router();

// User routes - require authentication
router.get('/export-data', authenticate, exportUserData);
router.get('/deletion-eligibility', authenticate, getDeletionEligibility);
router.post('/request-deletion', authenticate, requestAccountDeletion);

// Admin routes
router.delete('/admin/delete-user/:userId', adminOnly, adminDeleteUser);

export default router;
