import { Router } from 'express';
import { authenticate } from '../../middleware/auth.middleware';
import * as c from './payment.controller';

const router = Router();

router.get('/subscription/plans', authenticate, c.getPlans);
router.get('/subscription/me', authenticate, c.mySubscription);
router.post('/subscription/create-order', authenticate, c.createSubscriptionOrder);

router.get('/fees/me', authenticate, c.myFeeInvoices);
router.post('/fees/:invoiceId/pay', authenticate, c.createFeeOrder);
router.get('/fees/receipts/:receiptId', authenticate, c.getReceipt);

export default router;