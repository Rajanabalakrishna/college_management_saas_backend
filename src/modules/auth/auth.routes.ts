import { Router } from 'express';
import { register, login, refresh, logout } from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = Router();

// ── Public routes (no token needed) ──────────────────────
router.post('/register', register);
router.post('/login',    login);
router.post('/refresh',  refresh);
router.post('/logout',   logout);

// ── Protected route (token required) ─────────────────────
router.get('/me', authenticate, (req, res) => {
  res.json({ data: (req as any).user });
});

export default router;