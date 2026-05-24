import { Queue } from 'bullmq';
import { connection } from './connection.js';

export const sendQueue = new Queue('send-queue', {
  connection,
  defaultJobOptions: { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
});
