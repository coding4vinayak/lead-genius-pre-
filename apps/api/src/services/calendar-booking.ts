import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import crypto from 'crypto';

export interface BookingLinkConfig {
  leadId: string;
  duration?: number;
  title?: string;
}

export interface BookingData {
  leadId: string;
  title: string;
  startTime: string;
  endTime: string;
  timezone?: string;
}

export async function generateBookingLink(leadId: string, config: BookingLinkConfig) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw AppError.notFound('Lead');

  const token = crypto.randomBytes(16).toString('hex');
  const baseUrl = process.env.BOOKING_BASE_URL || 'http://localhost:3000';
  const duration = config.duration || 30;

  const meetingLink = `${baseUrl}/api/calendar/book?token=${token}&leadId=${leadId}&duration=${duration}`;

  return {
    leadId,
    meetingLink,
    token,
    duration,
    title: config.title || `Meeting with ${lead.name || 'Lead'}`,
  };
}

export async function processBooking(bookingData: BookingData) {
  const lead = await prisma.lead.findUnique({ where: { id: bookingData.leadId } });
  if (!lead) throw AppError.notFound('Lead');

  const booking = await prisma.calendarBooking.create({
    data: {
      leadId: bookingData.leadId,
      title: bookingData.title,
      startTime: new Date(bookingData.startTime),
      endTime: new Date(bookingData.endTime),
      meetingLink: `https://meet.example.com/${crypto.randomBytes(8).toString('hex')}`,
      status: 'scheduled',
      bookedAt: new Date(),
    },
  });

  return booking;
}

export async function getAvailableSlots(date: string, timezone: string) {
  const targetDate = new Date(date);
  const slots: Array<{ start: string; end: string }> = [];

  // Generate hourly slots for the business day (9 AM - 5 PM)
  for (let hour = 9; hour < 17; hour++) {
    const start = new Date(targetDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(targetDate);
    end.setHours(hour + 1, 0, 0, 0);

    // Check for existing bookings in this slot
    const existing = await prisma.calendarBooking.findFirst({
      where: {
        status: 'scheduled',
        startTime: { lte: end },
        endTime: { gte: start },
      },
    });

    if (!existing) {
      slots.push({
        start: start.toISOString(),
        end: end.toISOString(),
      });
    }
  }

  return { date, timezone, slots };
}

export async function trackBooking(leadId: string, meetingData: { title: string; startTime: string; endTime: string }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw AppError.notFound('Lead');

  const booking = await prisma.calendarBooking.create({
    data: {
      leadId,
      title: meetingData.title,
      startTime: new Date(meetingData.startTime),
      endTime: new Date(meetingData.endTime),
      meetingLink: `https://meet.example.com/${crypto.randomBytes(8).toString('hex')}`,
      status: 'scheduled',
      bookedAt: new Date(),
    },
  });

  return booking;
}

export async function listBookings(page: number, pageSize: number) {
  const [data, total] = await Promise.all([
    prisma.calendarBooking.findMany({
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { startTime: 'asc' },
    }),
    prisma.calendarBooking.count(),
  ]);
  return { data, total };
}
