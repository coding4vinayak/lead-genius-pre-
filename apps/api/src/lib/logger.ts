import winston from 'winston';
import { getCorrelationId } from '../middleware/correlation-id.js';

const correlationFormat = winston.format((info) => {
  const correlationId = getCorrelationId();
  if (correlationId) {
    info.correlationId = correlationId;
  }
  return info;
});

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: winston.format.combine(
    winston.format.timestamp(),
    correlationFormat(),
    winston.format.json(),
  ),
  transports: [new winston.transports.Console()],
});
