import { Router } from 'express';
import * as c from './public.controller';

const router = Router();

router.get('/colleges/:domain/status', c.getCollegeStatus);
router.get('/subscription/plans', c.getPlans);
router.post('/colleges/:domain/subscription/create-order', c.createCollegeSubscriptionOrder);

export default router;