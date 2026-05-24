import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

let userStore = new Map<string, any>();
vi.mock('../db.js', () => {
  const store = userStore;
  const handlers = {
    findUnique: vi.fn((args: any) => {
      if (args?.where?.email) return store.get(args.where.email) || null;
      return store.get(args?.where?.id) || null;
    }),
    findFirst: vi.fn((args: any) => {
      if (args?.where?.resetToken) {
        return [...store.values()].find((u: any) => u.resetToken === args.where.resetToken) || null;
      }
      return store.get(args?.where?.email) || null;
    }),
    create: vi.fn((args: any) => {
      const d = { id: 'usr_' + Date.now(), ...args.data, createdAt: new Date(), updatedAt: new Date() };
      store.set(d.id, d);
      store.set(d.email, d);
      return d;
    }),
    update: vi.fn((args: any) => {
      const existing = store.get(args?.where?.id);
      if (!existing) return null;
      const updated = { ...existing, ...args.data };
      store.set(updated.id, updated);
      store.set(updated.email, updated);
      return updated;
    }),
  };
  return { prisma: { user: handlers } };
});

let matchPassword = true;
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
    compare: vi.fn(() => Promise.resolve(matchPassword)),
  },
  hash: vi.fn().mockResolvedValue('$2a$12$hashedpassword'),
  compare: vi.fn(() => Promise.resolve(matchPassword)),
}));

const { default: authRoutes } = await import('./auth.js');

async function buildApp() {
  const app = express();
  app.use(express.json());
  const { errorHandler } = await import('../middleware/error-handler.js');
  app.use('/api/auth', authRoutes);
  app.use(errorHandler);
  return app;
}

describe('auth routes', () => {
  let app: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = await buildApp();
  });

  it('POST /api/auth/signup — creates user and returns token', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test@example.com',
      password: 'testpass1',
      name: 'Test User',
    });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toBeTruthy();
    expect(res.body.data.user.email).toBe('test@example.com');
  });

  it('POST /api/auth/signup — 409 on duplicate email', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'dup@test.com', password: 'testpass1' });
    const res = await request(app).post('/api/auth/signup').send({ email: 'dup@test.com', password: 'testpass1' });
    expect(res.status).toBe(409);
  });

  it('POST /api/auth/signup — 400 on invalid input', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'not-email', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('POST /api/auth/login — returns token for valid credentials', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'login@test.com', password: 'testpass1' });
    const res = await request(app).post('/api/auth/login').send({ email: 'login@test.com', password: 'testpass1' });
    expect(res.status).toBe(200);
    expect(res.body.data.token).toBeTruthy();
  });

  it('POST /api/auth/login — 401 on wrong password', async () => {
    matchPassword = false;
    await request(app).post('/api/auth/signup').send({ email: 'wrongpw@test.com', password: 'testpass1' });
    const res = await request(app).post('/api/auth/login').send({ email: 'wrongpw@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
    matchPassword = true;
  });

  it('POST /api/auth/login — 401 on non-existent user', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.com', password: 'testpass1' });
    expect(res.status).toBe(401);
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should generate reset token for existing user', async () => {
      await request(app).post('/api/auth/signup').send({ email: 'resetuser@test.com', password: 'testpass1' });

      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'resetuser@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('reset link');
    });

    it('should not reveal if email does not exist', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('reset link');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reset password with valid token', async () => {
      await request(app).post('/api/auth/signup').send({ email: 'resetflow@test.com', password: 'testpass1' });
      await request(app).post('/api/auth/forgot-password').send({ email: 'resetflow@test.com' });

      const storedUser = userStore.get('resetflow@test.com');
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: storedUser?.resetToken, password: 'newpassword1' });

      expect(res.status).toBe(200);
      expect(res.body.data.message).toContain('reset');
    });

    it('should reject short password', async () => {
      const res = await request(app)
        .post('/api/auth/reset-password')
        .send({ token: 'some-token', password: 'short' });

      expect(res.status).toBe(400);
    });
  });

  it('GET /api/auth/me — returns user with valid token', async () => {
    const signup = await request(app).post('/api/auth/signup').send({ email: 'me@test.com', password: 'testpass1' });
    const token = signup.body.data.token;
    const res = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.email).toBe('me@test.com');
  });

  it('GET /api/auth/me — 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('GET /api/auth/me — 401 with invalid token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer invalid-token');
    expect(res.status).toBe(401);
  });
});
