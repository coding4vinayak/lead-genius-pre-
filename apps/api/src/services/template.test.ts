import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildTemplate } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));

const { renderTemplate } = await import('./template.js');

describe('renderTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render Handlebars template with variables', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(
      buildTemplate({ body: '<p>Hi {{name}}, welcome to {{company}}!</p>', subject: 'Hello {{name}}' }),
    );

    const result = await renderTemplate('tmpl_1', { name: 'Alice', company: 'Acme' });

    expect(result.body).toBe('<p>Hi Alice, welcome to Acme!</p>');
    expect(result.subject).toBe('Hello Alice');
  });

  it('should render without subject', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(
      buildTemplate({ body: 'Hello {{name}}', subject: null }),
    );

    const result = await renderTemplate('tmpl_1', { name: 'Bob' });

    expect(result.body).toBe('Hello Bob');
    expect(result.subject).toBeUndefined();
  });

  it('should handle missing variables gracefully', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(
      buildTemplate({ body: 'Hi {{name}}!', subject: null }),
    );

    const result = await renderTemplate('tmpl_1', {});

    expect(result.body).toBe('Hi !');
  });

  it('should throw when template not found', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(null);

    await expect(renderTemplate('nonexistent', {})).rejects.toThrow('Template not found');
  });

  it('should return channel from template', async () => {
    mockPrisma.template.findUnique.mockResolvedValue(
      buildTemplate({ channel: 'whatsapp', body: 'Hi {{name}}' }),
    );

    const result = await renderTemplate('tmpl_1', { name: 'Alice' });

    expect(result.channel).toBe('whatsapp');
  });
});
