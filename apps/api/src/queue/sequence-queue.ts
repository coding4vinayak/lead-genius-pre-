import { Queue, Worker, ConnectionOptions } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const connection: ConnectionOptions = { host: config.redis.host, port: config.redis.port };

export const sequenceQueue = new Queue('sequence-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

export async function createSequenceWorker(handler: (job: any) => Promise<void>) {
  const worker = new Worker('sequence-queue', handler, { connection, concurrency: 5 });
  worker.on('completed', (job) => logger.info(`Sequence job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Sequence job ${job?.id} failed`, { error: err.message }));
  return worker;
}
