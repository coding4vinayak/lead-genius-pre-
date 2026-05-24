import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from './error-handler.js';
import { AppError } from '../lib/errors.js';

function asyncRoute(fn: Function) {
  return (req: any, res: any, next: any) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

describe('errorHandler', () => {
  it('should return AppError status and JSON shape', async () => {
    const app = express();
    app.get('/test', () => { throw AppError.notFound('Resource'); });
    app.use(errorHandler);

    const res = await request(app).get('/test');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: 404, message: 'Resource not found', details: undefined },
    });
  });

  it('should return AppError with details', async () => {
    const app = express();
    app.get('/test', () => { throw AppError.validation('Invalid', [{ field: 'x' }]); });
    app.use(errorHandler);

    const res = await request(app).get('/test');

    expect(res.status).toBe(400);
    expect(res.body.error.details).toEqual([{ field: 'x' }]);
  });

  it('should return 500 for unknown errors', async () => {
    const app = express();
    app.get('/test', () => { throw new Error('Unknown'); });
    app.use(errorHandler);

    const res = await request(app).get('/test');

    expect(res.status).toBe(500);
    expect(res.body.error.message).toBe('Internal server error');
  });

  it('should handle async route errors via next()', async () => {
    const app = express();
    app.get('/test', asyncRoute(async () => { throw AppError.conflict('Conflict'); }));
    app.use(errorHandler);

    const res = await request(app).get('/test');

    expect(res.status).toBe(409);
    expect(res.body.error.message).toBe('Conflict');
  });
});
