import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLead, buildCalendarBooking } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const {
  generateBookingLink,
  processBooking,
  getAvailableSlots,
  trackBooking,
  listBookings,
} = await import('./calendar-booking.js');

describe('Calendar Booking Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateBookingLink', () => {
    it('should generate a booking link for a lead', async () => {
      const lead = buildLead({ name: 'Jane Doe' });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const result = await generateBookingLink(lead.id, { leadId: lead.id, duration: 30 });

      expect(result.leadId).toBe(lead.id);
      expect(result.meetingLink).toContain('/api/calendar/book');
      expect(result.meetingLink).toContain('token=');
      expect(result.duration).toBe(30);
      expect(result.title).toContain('Jane Doe');
    });

    it('should use default duration if not specified', async () => {
      const lead = buildLead();
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const result = await generateBookingLink(lead.id, { leadId: lead.id });

      expect(result.duration).toBe(30);
    });

    it('should throw not found if lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(generateBookingLink('nonexistent', { leadId: 'nonexistent' })).rejects.toThrow('not found');
    });

    it('should use custom title if provided', async () => {
      const lead = buildLead();
      mockPrisma.lead.findUnique.mockResolvedValue(lead);

      const result = await generateBookingLink(lead.id, { leadId: lead.id, title: 'Custom Meeting' });

      expect(result.title).toBe('Custom Meeting');
    });
  });

  describe('processBooking', () => {
    it('should create a booking', async () => {
      const lead = buildLead();
      const booking = buildCalendarBooking({ leadId: lead.id });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.calendarBooking.create.mockResolvedValue(booking);

      const result = await processBooking({
        leadId: lead.id,
        title: 'Demo Meeting',
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T11:00:00Z',
      });

      expect(result.leadId).toBe(lead.id);
      expect(result.status).toBe('scheduled');
      expect(mockPrisma.calendarBooking.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leadId: lead.id,
          title: 'Demo Meeting',
          status: 'scheduled',
        }),
      });
    });

    it('should throw not found if lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(processBooking({
        leadId: 'nonexistent',
        title: 'Test',
        startTime: '2025-01-15T10:00:00Z',
        endTime: '2025-01-15T11:00:00Z',
      })).rejects.toThrow('not found');
    });
  });

  describe('getAvailableSlots', () => {
    it('should return available slots for a date', async () => {
      mockPrisma.calendarBooking.findFirst.mockResolvedValue(null);

      const result = await getAvailableSlots('2025-01-15', 'UTC');

      expect(result.date).toBe('2025-01-15');
      expect(result.timezone).toBe('UTC');
      expect(result.slots.length).toBeGreaterThan(0);
      expect(result.slots[0]).toHaveProperty('start');
      expect(result.slots[0]).toHaveProperty('end');
    });

    it('should exclude booked slots', async () => {
      // Return a booking for the first call, null for the rest
      mockPrisma.calendarBooking.findFirst
        .mockResolvedValueOnce(buildCalendarBooking())
        .mockResolvedValue(null);

      const result = await getAvailableSlots('2025-01-15', 'UTC');

      // Should have 7 slots instead of 8 (one excluded)
      expect(result.slots.length).toBe(7);
    });
  });

  describe('trackBooking', () => {
    it('should track a booking for a lead', async () => {
      const lead = buildLead();
      const booking = buildCalendarBooking({ leadId: lead.id });
      mockPrisma.lead.findUnique.mockResolvedValue(lead);
      mockPrisma.calendarBooking.create.mockResolvedValue(booking);

      const result = await trackBooking(lead.id, {
        title: 'Follow-up',
        startTime: '2025-01-20T14:00:00Z',
        endTime: '2025-01-20T15:00:00Z',
      });

      expect(result.leadId).toBe(lead.id);
      expect(mockPrisma.calendarBooking.create).toHaveBeenCalled();
    });

    it('should throw not found if lead does not exist', async () => {
      mockPrisma.lead.findUnique.mockResolvedValue(null);

      await expect(trackBooking('nonexistent', {
        title: 'Test',
        startTime: '2025-01-20T14:00:00Z',
        endTime: '2025-01-20T15:00:00Z',
      })).rejects.toThrow('not found');
    });
  });

  describe('listBookings', () => {
    it('should return paginated bookings', async () => {
      const bookings = [buildCalendarBooking(), buildCalendarBooking()];
      mockPrisma.calendarBooking.findMany.mockResolvedValue(bookings);
      mockPrisma.calendarBooking.count.mockResolvedValue(2);

      const result = await listBookings(1, 10);

      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });
  });
});
