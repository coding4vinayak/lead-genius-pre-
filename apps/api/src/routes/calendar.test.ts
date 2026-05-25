import { describe, it, expect, beforeEach, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '../middleware/error-handler.js';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildCalendarBooking } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { default: calendarRoutes } = await import('./calendar.js');

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/calendar', calendarRoutes);
  app.use(errorHandler);
  return app;
}

describe('Calendar API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/calendar/booking-link', () => {
    it('should generate a booking link', async () => {
      const lead = buildLead({ name: 'Jane Doe' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const res = await request(createApp())
        .post('/api/calendar/booking-link')
        .send({ leadId: lead.id, duration: 30 });

      expect(res.status).toBe(201);
      expect(res.body.data.meetingLink).toContain('/api/calendar/book');
      expect(res.body.data.leadId).toBe(lead.id);
      expect(res.body.data.duration).toBe(30);
    });

    it('should reject missing leadId', async () => {
      const res = await request(createApp())
        .post('/api/calendar/booking-link')
        .send({ duration: 30 });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/calendar/booking-link')
        .send({ leadId: 'nonexistent' });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/calendar/bookings', () => {
    it('should list bookings with pagination', async () => {
      const bookings = [buildCalendarBooking(), buildCalendarBooking()];
      mockPrisma.calendarBooking.findMany.mockResolvedValue(bookings);
      mockPrisma.calendarBooking.count.mockResolvedValue(2);

      const res = await request(createApp())
        .get('/api/calendar/bookings?page=1&pageSize=10');

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);
      expect(res.body.meta.total).toBe(2);
    });
  });

  describe('GET /api/calendar/slots', () => {
    it('should return available slots', async () => {
      mockPrisma.calendarBooking.findFirst.mockResolvedValue(null);

      const res = await request(createApp())
        .get('/api/calendar/slots?date=2025-01-15&timezone=UTC');

      expect(res.status).toBe(200);
      expect(res.body.data.slots).toBeInstanceOf(Array);
      expect(res.body.data.slots.length).toBeGreaterThan(0);
    });

    it('should require date param', async () => {
      const res = await request(createApp())
        .get('/api/calendar/slots?timezone=UTC');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/calendar/book', () => {
    it('should book a meeting', async () => {
      const lead = buildLead();
      const booking = buildCalendarBooking({ leadId: lead.id });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.calendarBooking.create.mockResolvedValue(booking);

      const res = await request(createApp())
        .post('/api/calendar/book')
        .send({
          leadId: lead.id,
          title: 'Demo Meeting',
          startTime: '2025-01-15T10:00:00Z',
          endTime: '2025-01-15T11:00:00Z',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.status).toBe('scheduled');
    });

    it('should reject missing required fields', async () => {
      const res = await request(createApp())
        .post('/api/calendar/book')
        .send({ leadId: 'lead_1' });

      expect(res.status).toBe(400);
    });

    it('should return 404 for non-existent lead', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      const res = await request(createApp())
        .post('/api/calendar/book')
        .send({
          leadId: 'nonexistent',
          title: 'Test',
          startTime: '2025-01-15T10:00:00Z',
          endTime: '2025-01-15T11:00:00Z',
        });

      expect(res.status).toBe(404);
    });
  });
});
