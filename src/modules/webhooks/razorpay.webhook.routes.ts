import express from 'express';
import crypto from 'crypto';
import prisma from '../../config/prisma';
//import { enqueueNotification } from '../notifications/notification.queue';

const router = express.Router();

router.post('/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.header('x-razorpay-signature');
  const eventId = req.header('x-razorpay-event-id');
  const rawBody = req.body.toString('utf8');

  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET!)
    .update(rawBody)
    .digest('hex');

  if (!signature || signature !== expected) {
    return res.status(400).send('Invalid signature');
  }

  const event = JSON.parse(rawBody);
  if (!eventId) return res.status(400).send('Missing event id');

  try {
    await prisma.razorpayWebhookEvent.create({
      data: { event_id: eventId, event_name: event.event },
    });
  } catch {
    return res.sendStatus(200);
  }

  if (event.event === 'order.paid' || event.event === 'payment.captured') {
    const paymentEntity = event.payload.payment.entity;
    const orderId = paymentEntity.order_id;

    await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { razorpay_order_id: orderId },
      });
      if (!payment || payment.status === 'PAID') return;

      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: 'PAID',
          razorpay_payment_id: paymentEntity.id,
          paid_at: new Date(),
        },
      });

      if (payment.purpose === 'COLLEGE_FEE' && payment.fee_invoice_id) {
        const invoice = await tx.feeInvoice.findUnique({
          where: { id: payment.fee_invoice_id },
        });
        if (!invoice) return;

        const newPaid = invoice.paid_amount_paise + payment.amount_paise;
        const newStatus = newPaid >= invoice.total_amount_paise ? 'PAID' : 'PARTIAL';

        await tx.feeInvoice.update({
          where: { id: invoice.id },
          data: { paid_amount_paise: newPaid, status: newStatus },
        });

        const receipt = await tx.feeReceipt.create({
          data: {
            college_id: payment.college_id,
            student_id: payment.user_id,
            fee_invoice_id: invoice.id,
            payment_id: payment.id,
            receipt_no: `RCPT-${Date.now()}`,
            amount_paise: payment.amount_paise,
          },
        });

        
      }

      if (payment.purpose === 'SAAS_SUBSCRIPTION') {
        const planId = event.payload.order.entity.notes.planId;
        const plan = await tx.saasPlan.findUnique({ where: { id: planId } });
        if (!plan) return;

        const expires = new Date();
        expires.setDate(expires.getDate() + plan.duration_days);

        await tx.userSubscription.create({
          data: {
            college_id: payment.college_id,
            user_id: payment.user_id,
            plan_id: plan.id,
            starts_at: new Date(),
            expires_at: expires,
          },
        });

       
      }
    });
  }

  await prisma.razorpayWebhookEvent.update({
    where: { event_id: eventId },
    data: { processed: true },
  });

  res.sendStatus(200);
});

export default router;