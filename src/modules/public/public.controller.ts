import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import razorpay from '../../config/razorpay';

export async function getCollegeStatus(req: Request, res: Response) {
  const domain = req.params.domain.trim().toLowerCase();

  const college = await prisma.college.findFirst({
    where: { domain, is_active: true },
  });

  if (!college) {
    return res.status(404).json({ error: 'College not found' });
  }

  const subscription = await prisma.collegeSubscription.findFirst({
    where: {
      college_id: college.id,
      status: 'ACTIVE',
      expires_at: { gt: new Date() },
    },
    orderBy: { expires_at: 'desc' },
  });

  res.json({
    data: {
      collegeId: college.id,
      collegeName: college.name,
      domain: college.domain,
      subscriptionActive: !!subscription,
      subscription,
    },
  });
}

export async function getPlans(_req: Request, res: Response) {
  const plans = await prisma.saasPlan.findMany({
    where: { is_active: true },
    orderBy: { amount_paise: 'asc' },
  });

  res.json({ data: plans });
}

export async function createCollegeSubscriptionOrder(req: Request, res: Response) {
  try {
    const domain = req.params.domain.trim().toLowerCase();
    const { plan_id } = req.body;

    const college = await prisma.college.findFirst({
      where: { domain, is_active: true },
    });

    if (!college) {
      return res.status(404).json({ error: 'College not found' });
    }

    const plan = await prisma.saasPlan.findFirst({
      where: { id: plan_id, is_active: true },
    });

    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    const order = await razorpay.orders.create({
      amount: plan.amount_paise,
      currency: 'INR',
      receipt: `col_${Date.now()}`,
      notes: {
        purpose: 'COLLEGE_SUBSCRIPTION',
        collegeId: college.id,
        planId: plan.id,
        domain: college.domain,
      },
    });

    await prisma.payment.create({
      data: {
        college_id: college.id,
        user_id: null,
        plan_id: plan.id,
        purpose: 'COLLEGE_SUBSCRIPTION',
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
        collegeName: college.name,
      },
    });
  } catch (error: any) {
    console.error('Create college subscription order error:', error?.error || error);
    res.status(500).json({
      error: error?.error?.description || error?.message || 'Unable to create order',
    });
  }
}