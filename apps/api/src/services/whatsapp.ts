import twilio from 'twilio';
import { prisma } from '../db.js';
import { logger } from '../lib/logger.js';

export async function sendWhatsApp(to: string, body: string, messageId: string) {
  const settings = await prisma.settings.findUnique({ where: { id: 'global' } });
  if (!settings) throw new Error('Settings not configured');

  const client = twilio(settings.twilioAccountSid || '', settings.twilioAuthToken || '');
  const from = `whatsapp:${settings.twilioFromNumber || ''}`;
  const toNumber = to.startsWith('whatsapp:') ? to : `whatsapp:${to}`;

  const msg = await client.messages.create({ from, to: toNumber, body });

  await prisma.message.update({
    where: { id: messageId },
    data: { providerId: msg.sid, status: 'sent', deliveredAt: new Date() },
  });

  logger.info(`WhatsApp sent to ${to}`, { messageId, providerId: msg.sid });
}
