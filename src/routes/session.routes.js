import express from 'express';
import {
  getMySessions,
  revokeSessionById,
  revokeAllSessions,
  getSessionStats,
  trustSession,
} from '../controllers/session.controller.js';
import { authenticate } from '../middleware/auth.js';
import { logAction } from '../middleware/auditLog.js';

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.get('/', getMySessions);
router.get('/stats', getSessionStats);
router.delete('/:sessionId', logAction('security', 'session_revoked', (req) => ({ sessionId: req.params.sessionId })), revokeSessionById);
router.post('/revoke-all', logAction('security', 'all_sessions_revoked'), revokeAllSessions);
router.post('/:sessionId/trust', logAction('security', 'session_trusted', (req) => ({ sessionId: req.params.sessionId })), trustSession);

export default router;
