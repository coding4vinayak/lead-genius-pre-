import { Queue, Worker, ConnectionOptions } from 'bullmq';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';

const connection: ConnectionOptions = { host: config.redis.host, port: config.redis.port };

export const enrichmentQueue = new Queue('enrichment-queue', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: 200,
    removeOnFail: 100,
  },
});

export async function createEnrichmentWorker(handler: (job: any) => Promise<void>) {
  const worker = new Worker('enrichment-queue', handler, { connection, concurrency: 5 });
  worker.on('completed', (job) => logger.info(`Enrichment job ${job.id} completed`));
  worker.on('failed', (job, err) => logger.error(`Enrichment job ${job?.id} failed`, { error: err.message }));
  return worker;
}
