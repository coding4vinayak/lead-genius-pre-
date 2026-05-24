import { Queue, Worker, ConnectionOptions } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const connection: ConnectionOptions = { host: config.redis.host, port: config.redis.port };

export const campaignQueue = new Queue('campaign-queue', { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } } });
export const sendQueue = new Queue('send-queue', { connection, defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } } });
export const aiQueue = new Queue('ai-queue', { connection, defaultJobOptions: { attempts: 2, backoff: { type: 'exponential', delay: 3000 }, removeOnComplete: 100, removeOnFail: 50 } });

export async function createCampaignWorker(handler: (job: any) => Promise<void>) {
  const worker = new Worker('campaign-queue', handler, { connection, concurrency: 5 });
  worker.on('completed', (job) => logger.info(`Campaign job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Campaign job ${job?.id} failed`, { error: err.message }));
  return worker;
}

export async function createSendWorker(handler: (job: any) => Promise<void>) {
  const worker = new Worker('send-queue', handler, { connection, concurrency: 20 });
  worker.on('completed', (job) => logger.info(`Send job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Send job ${job?.id} failed`, { error: err.message }));
  return worker;
}

export async function createAiWorker(handler: (job: any) => Promise<void>) {
  const worker = new Worker('ai-queue', handler, { connection, concurrency: 5 });
  worker.on('completed', (job) => logger.info(`AI job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`AI job ${job?.id} failed`, { error: err.message }));
  return worker;
}
