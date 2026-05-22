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
// auth.routes.ts — replace the /me inline handler
router.get('/me', authenticate, async (req, res) => {
  const jwtUser = (req as any).user as JwtPayload;

  const user = await prisma.user.findUnique({
    where: { id: jwtUser.userId },
    select: {
      id: true, college_id: true, email: true, full_name: true,
      role: true, is_active: true, created_at: true,
      roll_no: true, class_name: true, sec: true,
      starting_year: true, ending_year: true, branch: true, year: true,
    },
  });

  if (!user) {
    res.status(404).json({ error: 'User not found' });
    return;
  }

  // Map class_name → class for Flutter
  res.json({
    data: { ...user, class: user.class_name, class_name: undefined }
  });
});

export default router;
