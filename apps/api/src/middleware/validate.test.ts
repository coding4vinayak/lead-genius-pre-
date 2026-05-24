import { describe, it, expect, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { z } from 'zod';
import { validate } from './validate.js';
import { errorHandler } from './error-handler.js';

const testSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive().optional(),
});

describe('validate middleware', () => {
  it('should pass valid body', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validate(testSchema), (req, res) => {
      res.json({ data: req.body });
    });
    app.use(errorHandler);

    const res = await request(app).post('/test').send({ name: 'John', age: 30 });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('John');
  });

  it('should reject invalid body with 400', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validate(testSchema), (req, res) => {
      res.json({ data: req.body });
    });
    app.use(errorHandler);

    const res = await request(app).post('/test').send({ name: '' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe(400);
    expect(res.body.error.details).toBeDefined();
  });

  it('should parse query params from source=query', async () => {
    const app = express();
    const querySchema = z.object({ page: z.coerce.number().default(1) }).passthrough();
    app.get('/test', validate(querySchema, 'query'), (req, res) => {
      res.json({ data: { page: req.query.page } });
    });
    app.use(errorHandler);

    const res = await request(app).get('/test?page=3');

    expect(res.status).toBe(200);
    expect(res.body.data.page).toBe(3);
  });

  it('should use defaults for missing optional fields', async () => {
    const app = express();
    app.use(express.json());
    app.post('/test', validate(testSchema), (req, res) => {
      res.json({ data: req.body });
    });
    app.use(errorHandler);

    const res = await request(app).post('/test').send({ name: 'John' });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe('John');
    expect(res.body.data.age).toBeUndefined();
  });
});
