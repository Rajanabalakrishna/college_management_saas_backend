import { Response, NextFunction } from 'express';
import prisma from '../config/prisma';
import { AuthRequest } from '../types';

export async function requireActiveSubscription(
  req: AuthRequest,
  res: Response,
  next: NextFunction
) {
  const user = req.user!;
  const active = await prisma.userSubscription.findFirst({
    where: {
      user_id: user.userId,
      college_id: user.collegeId,
      status: 'ACTIVE',
      expires_at: { gt: new Date() },
    },
  });

  if (!active) {
    res.status(402).json({ error: 'Subscription required' });
    return;
  }

  next();
}