import { Queue, Worker, ConnectionOptions } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const connection: ConnectionOptions = { host: config.redis.host, port: config.redis.port };

export const webhookQueue = new Queue('webhook-queue', {
  connection,
  defaultJobOptions: {
    attempts: 5,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

export async function createWebhookWorker(handler: (job: any) => Promise<void>) {
  const worker = new Worker('webhook-queue', handler, { connection, concurrency: 10 });
  worker.on('completed', (job) => logger.info(`Webhook job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Webhook job ${job?.id} failed`, { error: err.message }));
  return worker;
}
