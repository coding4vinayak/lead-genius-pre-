import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSettings } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const mockNodemailerSend = vi.fn().mockResolvedValue({ messageId: 'smtp-msg-id' });
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({ messageId: 'smtp-msg-id' }) })) },
  createTransport: vi.fn(() => ({ sendMail: vi.fn().mockResolvedValue({ messageId: 'smtp-msg-id' }) })),
}));

const mockSgSend = vi.fn().mockResolvedValue([{ headers: { 'x-message-id': 'sg-msg-id' } }]);
vi.mock('@sendgrid/mail', () => ({
  default: { setApiKey: vi.fn(), send: vi.fn().mockResolvedValue([{ headers: { 'x-message-id': 'sg-msg-id' } }]) },
}));

const { sendEmail } = await import('./email.js');

describe('sendEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send via SMTP when no SendGrid key', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(buildSettings({ sendgridApiKey: null }));
    mockPrisma.message.update.mockResolvedValue({} as any);

    await sendEmail('to@test.com', 'Subject', '<p>Body</p>', 'msg_1');

    expect(mockPrisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }),
    );
  });

  it('should send via SendGrid when API key is set', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(buildSettings({ sendgridApiKey: 'SG.key' }));
    mockPrisma.message.update.mockResolvedValue({} as any);

    await sendEmail('to@test.com', 'Subject', '<p>Body</p>', 'msg_1');

    expect(mockPrisma.message.update).toHaveBeenCalled();
  });

  it('should throw when no settings configured', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(null);

    await expect(sendEmail('to@test.com', 'Subject', '<p>Body</p>', 'msg_1'))
      .rejects.toThrow('Settings not configured');
  });
});
