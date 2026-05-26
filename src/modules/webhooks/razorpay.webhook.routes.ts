import express from 'express';
import crypto from 'crypto';
import prisma from '../../config/prisma';

const router = express.Router();

router.post(
  '/razorpay',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
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

      if (!eventId) {
        return res.status(400).send('Missing event id');
      }

      const event = JSON.parse(rawBody);

      try {
        await prisma.razorpayWebhookEvent.create({
          data: {
            event_id: eventId,
            event_name: event.event,
          },
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
            const newStatus =
              newPaid >= invoice.total_amount_paise ? 'PAID' : 'PARTIAL';

            await tx.feeInvoice.update({
              where: { id: invoice.id },
              data: {
                paid_amount_paise: newPaid,
                status: newStatus,
              },
            });

            await tx.feeReceipt.create({
              data: {
                college_id: payment.college_id,
                student_id: payment.user_id!,
                fee_invoice_id: invoice.id,
                payment_id: payment.id,
                receipt_no: `RCPT-${Date.now()}`,
                amount_paise: payment.amount_paise,
              },
            });
          }

          if (payment.purpose === 'SAAS_SUBSCRIPTION') {
            if (!payment.user_id) return;

            const orderEntity = event.payload.order?.entity;
            const planId = orderEntity?.notes?.planId;

            if (!planId) return;

            const plan = await tx.saasPlan.findUnique({
              where: { id: planId },
            });

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
                status: 'ACTIVE',
              },
            });
          }

          if (payment.purpose === 'COLLEGE_SUBSCRIPTION' && payment.plan_id) {
            const plan = await tx.saasPlan.findUnique({
              where: { id: payment.plan_id },
            });

            if (!plan) return;

            const expires = new Date();
            expires.setDate(expires.getDate() + plan.duration_days);

            await tx.collegeSubscription.create({
              data: {
                college_id: payment.college_id,
                plan_id: plan.id,
                starts_at: new Date(),
                expires_at: expires,
                status: 'ACTIVE',
              },
            });
          }
        });
      }

      await prisma.razorpayWebhookEvent.update({
        where: { event_id: eventId },
        data: { processed: true },
      });

      return res.sendStatus(200);
    } catch (error) {
      console.error('Razorpay webhook error:', error);
      return res.status(500).send('Webhook processing failed');
    }
  }
);

export default router;