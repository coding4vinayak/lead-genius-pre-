import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { calendarBookingLinkSchema, calendarBookingSchema, calendarSlotsSchema, paginationSchema } from '@leadgenius/shared';
import {
  generateBookingLink,
  processBooking,
  getAvailableSlots,
  listBookings,
} from '../services/calendar-booking.js';

const router = Router();

router.post('/booking-link', validate(calendarBookingLinkSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { leadId, duration, title } = req.body as { leadId: string; duration?: number; title?: string };
    const result = await generateBookingLink(leadId, { leadId, duration, title });
    res.status(201).json({ data: result });
  } catch (err) { next(err); }
});

router.get('/bookings', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { data, total } = await listBookings(page, pageSize);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.get('/slots', validate(calendarSlotsSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { date, timezone } = req.query as { date: string; timezone: string };
    const result = await getAvailableSlots(date, timezone);
    res.json({ data: result });
  } catch (err) { next(err); }
});

// Public endpoint - leads can book without auth
router.post('/book', validate(calendarBookingSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const bookingData = req.body as { leadId: string; title: string; startTime: string; endTime: string; timezone?: string };
    const booking = await processBooking(bookingData);
    res.status(201).json({ data: booking });
  } catch (err) { next(err); }
});

export default router;
