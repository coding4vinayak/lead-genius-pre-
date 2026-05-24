import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildTask } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockPublishEvent = vi.fn();
vi.mock('../services/event-bus.js', () => ({ publishEvent: mockPublishEvent }));

const { default: taskRoutes } = await import('./tasks.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tasks', taskRoutes);
  app.use(errorHandler);
  return app;
}

describe('Tasks API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/tasks', () => {
    it('should list tasks with pagination', async () => {
      const tasks = [buildTask(), buildTask()];
      mockPrisma.task.findMany.mockResolvedValue(tasks);
      mockPrisma.task.count.mockResolvedValue(2);

      const res = await request(createApp()).get('/api/tasks?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta).toEqual({ total: 2, page: 1, pageSize: 10, totalPages: 1 });
    });

    it('should filter by status', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(0);

      await request(createApp()).get('/api/tasks?status=pending&page=1&pageSize=10');

      expect(mockPrisma.task.findMany.mock.calls[0][0].where.status).toBe('pending');
    });

    it('should filter by priority', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(0);

      await request(createApp()).get('/api/tasks?priority=high&page=1&pageSize=10');

      expect(mockPrisma.task.findMany.mock.calls[0][0].where.priority).toBe('high');
    });

    it('should filter by assigneeId', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(0);

      await request(createApp()).get('/api/tasks?assigneeId=user_1&page=1&pageSize=10');

      expect(mockPrisma.task.findMany.mock.calls[0][0].where.assigneeId).toBe('user_1');
    });

    it('should filter by automationId', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(0);

      await request(createApp()).get('/api/tasks?automationId=auto_1&page=1&pageSize=10');

      expect(mockPrisma.task.findMany.mock.calls[0][0].where.automationId).toBe('auto_1');
    });

    it('should use default pagination values', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(0);

      await request(createApp()).get('/api/tasks');

      expect(mockPrisma.task.count).toHaveBeenCalledOnce();
    });
  });

  describe('GET /api/tasks/:id', () => {
    it('should return a task by id', async () => {
      const task = buildTask({ id: 'task_1', title: 'My Task' });
      mockPrisma.task.findUnique.mockResolvedValue(task);

      const res = await request(createApp()).get('/api/tasks/task_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('task_1');
      expect(res.body.data.title).toBe('My Task');
    });

    it('should return 404 for non-existent task', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      const res = await request(createApp()).get('/api/tasks/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(404);
      expect(res.body.error.message).toBe('Task not found');
    });
  });

  describe('POST /api/tasks', () => {
    it('should create a task and return 201', async () => {
      const newTask = buildTask({ id: 'task_new', title: 'New Task' });
      mockPrisma.task.create.mockResolvedValue(newTask);

      const res = await request(createApp())
        .post('/api/tasks')
        .send({ title: 'New Task', priority: 'high' });

      expect(res.status).toBe(201);
      expect(res.body.data.title).toBe('New Task');
    });

    it('should reject missing title', async () => {
      const res = await request(createApp())
        .post('/api/tasks')
        .send({ description: 'No title' });

      expect(res.status).toBe(400);
      expect(res.body.error.details).toBeDefined();
    });
  });

  describe('PUT /api/tasks/:id', () => {
    it('should update a task', async () => {
      const updated = buildTask({ id: 'task_1', title: 'Updated Title' });
      mockPrisma.task.update.mockResolvedValue(updated);

      const res = await request(createApp())
        .put('/api/tasks/task_1')
        .send({ title: 'Updated Title' });

      expect(res.status).toBe(200);
      expect(res.body.data.title).toBe('Updated Title');
    });
  });

  describe('DELETE /api/tasks/:id', () => {
    it('should delete a task and return its id', async () => {
      mockPrisma.task.delete.mockResolvedValue(buildTask({ id: 'task_1' }));

      const res = await request(createApp()).delete('/api/tasks/task_1');

      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe('task_1');
    });
  });

  describe('POST /api/tasks/:id/complete', () => {
    it('should mark task as completed and publish event', async () => {
      const completed = buildTask({ id: 'task_1', title: 'Done Task', status: 'completed', completedAt: new Date() });
      mockPrisma.task.update.mockResolvedValue(completed);

      const res = await request(createApp()).post('/api/tasks/task_1/complete');

      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe('completed');
      expect(mockPrisma.task.update.mock.calls[0][0].data.status).toBe('completed');
      expect(mockPrisma.task.update.mock.calls[0][0].data.completedAt).toBeDefined();
      expect(mockPublishEvent).toHaveBeenCalledWith(
        'task.completed',
        'task',
        'task_1',
        { taskId: 'task_1', title: 'Done Task' },
      );
    });
  });

  describe('POST /api/tasks/:id/assign', () => {
    it('should assign a task to a user', async () => {
      const assigned = buildTask({ id: 'task_1', assigneeId: 'user_42' });
      mockPrisma.task.update.mockResolvedValue(assigned);

      const res = await request(createApp())
        .post('/api/tasks/task_1/assign')
        .send({ assigneeId: 'user_42' });

      expect(res.status).toBe(200);
      expect(res.body.data.assigneeId).toBe('user_42');
      expect(mockPrisma.task.update.mock.calls[0][0].data.assigneeId).toBe('user_42');
    });
  });
});
