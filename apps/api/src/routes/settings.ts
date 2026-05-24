import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { settingsSchema } from '@leadgenius/shared';
import nodemailer from 'nodemailer';
import { config } from '../config.js';

const router = Router();

router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.settings.findUnique({ where: { id: 'global' } });
    if (!data) throw AppError.notFound('Settings');
    res.json({ data });
  } catch (err) { next(err); }
});

router.put('/', validate(settingsSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await prisma.settings.upsert({
      where: { id: 'global' },
      create: { id: 'global', ...req.body },
      update: req.body,
    });
    res.json({ data });
  } catch (err) { next(err); }
});

router.post('/test-email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to } = req.body as { to: string };
    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
    if (!settings) throw AppError.notFound('Settings');

    const transporter = nodemailer.createTransport({
      host: settings.smtpHost || config.smtp.host,
      port: settings.smtpPort || config.smtp.port,
      secure: (settings.smtpPort || config.smtp.port) === 465,
      auth: { user: settings.smtpUser || config.smtp.user, pass: settings.smtpPass || config.smtp.pass },
    });
    await transporter.sendMail({
      from: `"${settings.fromName || config.fromName}" <${settings.fromEmail || config.fromEmail}>`,
      to,
      subject: 'LeadGenius Test Email',
      text: 'This is a test email from LeadGenius. Your SMTP configuration is working correctly.',
    });
    res.json({ data: { message: 'Test email sent successfully' } });
  } catch (err) { next(err); }
});

router.post('/test-whatsapp', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { to } = req.body as { to: string };
    const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
    if (!settings) throw AppError.notFound('Settings');

    const accountSid = settings.twilioAccountSid || config.twilio.accountSid;
    const authToken = settings.twilioAuthToken || config.twilio.authToken;
    const fromNumber = settings.twilioFromNumber || config.twilio.fromNumber;

    if (!accountSid || !authToken || !fromNumber) {
      throw AppError.validation('Twilio not configured');
    }
    const twilio = (await import('twilio')).default;
    const client = twilio(accountSid, authToken);
    await client.messages.create({ from: fromNumber, to, body: 'LeadGenius test message.' });
    res.json({ data: { message: 'Test WhatsApp sent successfully' } });
  } catch (err) { next(err); }
});

export default router;
