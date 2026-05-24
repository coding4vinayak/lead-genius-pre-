import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildSettings } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

let mockMessagesCreate: ReturnType<typeof vi.fn>;
vi.mock('twilio', () => {
  mockMessagesCreate = vi.fn().mockResolvedValue({ sid: 'SMtest123' });
  return {
    default: vi.fn(() => ({ messages: { create: mockMessagesCreate } })),
  };
});

const { sendWhatsApp } = await import('./whatsapp.js');

describe('sendWhatsApp', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should send WhatsApp message via Twilio', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(buildSettings());
    mockPrisma.message.update.mockResolvedValue({} as any);

    await sendWhatsApp('+1234567890', 'Hello there', 'msg_1');

    expect(mockMessagesCreate).toHaveBeenCalledOnce();
    expect(mockPrisma.message.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'sent' }) }),
    );
  });

  it('should add whatsapp: prefix to from number', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(buildSettings());
    mockPrisma.message.update.mockResolvedValue({} as any);

    await sendWhatsApp('+1234567890', 'Hello', 'msg_1');

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.from).toMatch(/^whatsapp:/);
  });

  it('should not double-add whatsapp: prefix to to number', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(buildSettings());
    mockPrisma.message.update.mockResolvedValue({} as any);

    await sendWhatsApp('whatsapp:+1234567890', 'Hello', 'msg_1');

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.to).toBe('whatsapp:+1234567890');
  });

  it('should strip phone number and add whatsapp: prefix', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(buildSettings());
    mockPrisma.message.update.mockResolvedValue({} as any);

    await sendWhatsApp('+1234567890', 'Hello', 'msg_1');

    const callArgs = mockMessagesCreate.mock.calls[0][0];
    expect(callArgs.to).toBe('whatsapp:+1234567890');
  });

  it('should throw when no settings', async () => {
    mockPrisma.settings.findUnique.mockResolvedValue(null);

    await expect(sendWhatsApp('+1234567890', 'Hello', 'msg_1'))
      .rejects.toThrow('Settings not configured');
  });
});
