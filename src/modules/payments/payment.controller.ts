import { Response } from 'express';
import prisma from '../../config/prisma';
import razorpay from '../../config/razorpay';
import { AuthRequest } from '../../types';

export async function getPlans(_req: AuthRequest, res: Response) {
  const plans = await prisma.saasPlan.findMany({
    where: { is_active: true },
    orderBy: { amount_paise: 'asc' },
  });
  res.json({ data: plans });
}

export async function mySubscription(req: AuthRequest, res: Response) {
  const user = req.user!;
  const sub = await prisma.userSubscription.findFirst({
    where: {
      user_id: user.userId,
      college_id: user.collegeId,
      status: 'ACTIVE',
      expires_at: { gt: new Date() },
    },
    orderBy: { expires_at: 'desc' },
  });

  res.json({ data: { active: !!sub, subscription: sub } });
}

export async function createSubscriptionOrder(req: AuthRequest, res: Response) {
  const user = req.user!;
  const { plan_id } = req.body;

  const plan = await prisma.saasPlan.findFirst({
    where: { id: plan_id, is_active: true },
  });
  if (!plan) return res.status(404).json({ error: 'Plan not found' });

  const order = await razorpay.orders.create({
    amount: plan.amount_paise,
    currency: 'INR',
    receipt: `sub_${Date.now()}`,
    notes: {
      purpose: 'SAAS_SUBSCRIPTION',
      userId: user.userId,
      collegeId: user.collegeId,
      planId: plan.id,
    },
  });

  await prisma.payment.create({
    data: {
      college_id: user.collegeId,
      user_id: user.userId,
      purpose: 'SAAS_SUBSCRIPTION',
      amount_paise: plan.amount_paise,
      razorpay_order_id: order.id,
    },
  });

  res.json({
    data: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: plan.amount_paise,
      currency: 'INR',
    },
  });
}

export async function myFeeInvoices(req: AuthRequest, res: Response) {
  const user = req.user!;
  const invoices = await prisma.feeInvoice.findMany({
    where: { college_id: user.collegeId, student_id: user.userId },
    include: { items: true, receipts: true },
    orderBy: { created_at: 'desc' },
  });
  res.json({ data: invoices });
}

export async function createFeeOrder(req: AuthRequest, res: Response) {
  const user = req.user!;
  const { invoiceId } = req.params;

  const invoice = await prisma.feeInvoice.findFirst({
    where: {
      id: invoiceId,
      college_id: user.collegeId,
      student_id: user.userId,
      status: { in: ['DUE', 'PARTIAL'] },
    },
  });

  if (!invoice) return res.status(404).json({ error: 'Fee invoice not found' });

  const balance = invoice.total_amount_paise - invoice.paid_amount_paise;
  if (balance <= 0) return res.status(400).json({ error: 'Invoice already paid' });

  const order = await razorpay.orders.create({
    amount: balance,
    currency: 'INR',
    receipt: `fee_${Date.now()}`,
    notes: {
      purpose: 'COLLEGE_FEE',
      userId: user.userId,
      collegeId: user.collegeId,
      invoiceId: invoice.id,
    },
  });

  await prisma.payment.create({
    data: {
      college_id: user.collegeId,
      user_id: user.userId,
      purpose: 'COLLEGE_FEE',
      amount_paise: balance,
      razorpay_order_id: order.id,
      fee_invoice_id: invoice.id,
    },
  });

  res.json({
    data: {
      keyId: process.env.RAZORPAY_KEY_ID,
      orderId: order.id,
      amount: balance,
      currency: 'INR',
    },
  });
}

export async function getReceipt(req: AuthRequest, res: Response) {
  const user = req.user!;
  const receipt = await prisma.feeReceipt.findFirst({
    where: {
      id: req.params.receiptId,
      college_id: user.collegeId,
      student_id: user.userId,
    },
    include: { invoice: { include: { items: true } }, payment: true },
  });

  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });
  res.json({ data: receipt });
}

export async function createSubscriptionOrder(req: AuthRequest, res: Response) {
  try {
    const user = req.user!;
    const { plan_id } = req.body;

    const plan = await prisma.saasPlan.findFirst({
      where: { id: plan_id, is_active: true },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const order = await razorpay.orders.create({
      amount: plan.amount_paise,
      currency: 'INR',
      receipt: `sub_${Date.now()}`,
      notes: {
        purpose: 'SAAS_SUBSCRIPTION',
        userId: user.userId,
        collegeId: user.collegeId,
        planId: plan.id,
      },
    });

    await prisma.payment.create({
      data: {
        college_id: user.collegeId,
        user_id: user.userId,
        purpose: 'SAAS_SUBSCRIPTION',
        amount_paise: plan.amount_paise,
        razorpay_order_id: order.id,
      },
    });

    res.json({
      data: {
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: plan.amount_paise,
        currency: 'INR',
      },
    });
  } catch (error: any) {
    console.error('Create subscription order error:', error?.error || error);
    res.status(500).json({
      error: error?.error?.description || error?.message || 'Unable to create order',
    });
  }
}