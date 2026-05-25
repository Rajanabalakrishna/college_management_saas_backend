import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';
import admin from 'firebase-admin';
import prisma from '../../config/prisma';

const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
});

if (!admin.apps.length) {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON && !admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    ),
  });
}
}

export const notificationQueue = new Queue('notifications', { connection });

export async function enqueueNotification(input: {
  collegeId: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  data: Record<string, unknown>;
}) {
  const notification = await prisma.notification.create({
    data: {
      college_id: input.collegeId,
      user_id: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      data_json: input.data,
    },
  });

  await notificationQueue.add(
    'send-fcm',
    { notificationId: notification.id },
    { attempts: 5, backoff: { type: 'exponential', delay: 3000 } }
  );
}

new Worker(
  'notifications',
  async (job) => {
    const notification = await prisma.notification.findUnique({
      where: { id: job.data.notificationId },
    });
    if (!notification) return;

    const devices = await prisma.userDevice.findMany({
      where: { user_id: notification.user_id },
    });
    if (!devices.length) return;

    await admin.messaging().sendEachForMulticast({
      tokens: devices.map((d) => d.fcm_token),
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: {
        notificationId: notification.id,
        type: notification.type,
      },
      android: { priority: 'high' },
    });
  },
  { connection }
);