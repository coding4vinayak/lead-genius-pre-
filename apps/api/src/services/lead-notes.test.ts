import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockPrisma } from '../test/mockDb.js';
import { buildLeadNote } from '../test/factories.js';

const mockPrisma = createMockPrisma();
vi.mock('../db.js', () => ({ prisma: mockPrisma }));
vi.mock('./notification.js', () => ({ createNotification: vi.fn().mockResolvedValue({}) }));
vi.mock('./websocket.js', () => ({ broadcastToUser: vi.fn() }));

const { createNote, getNotes, updateNote, deleteNote } = await import('./lead-notes.js');

describe('Lead Notes Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createNote', () => {
    it('should create a note', async () => {
      const note = buildLeadNote({ body: 'Hello world' });
      mockPrisma.leadNote.create.mockResolvedValue(note);
      mockPrisma.leadActivity.create.mockResolvedValue({});

      const result = await createNote('lead_1', 'user_1', 'Hello world');

      expect(mockPrisma.leadNote.create).toHaveBeenCalledWith({
        data: {
          leadId: 'lead_1',
          authorId: 'user_1',
          body: 'Hello world',
          mentions: [],
        },
      });
      expect(result).toEqual(note);
    });

    it('should extract @mentions and notify users', async () => {
      const note = buildLeadNote({ body: 'Hey @john and @jane', mentions: ['john', 'jane'] });
      mockPrisma.leadNote.create.mockResolvedValue(note);
      mockPrisma.leadActivity.create.mockResolvedValue({});
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user_john', name: 'john', email: 'john@example.com' },
        { id: 'user_jane', name: 'jane', email: 'jane@example.com' },
      ]);

      const { createNotification } = await import('./notification.js');

      await createNote('lead_1', 'user_1', 'Hey @john and @jane');

      expect(mockPrisma.leadNote.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ mentions: ['john', 'jane'] }),
      });
      expect(createNotification).toHaveBeenCalledTimes(2);
    });

    it('should not notify the author if they mention themselves', async () => {
      const note = buildLeadNote({ body: 'Note @myself', mentions: ['myself'] });
      mockPrisma.leadNote.create.mockResolvedValue(note);
      mockPrisma.leadActivity.create.mockResolvedValue({});
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user_1', name: 'myself', email: 'myself@example.com' },
      ]);

      const { createNotification } = await import('./notification.js');

      await createNote('lead_1', 'user_1', 'Note @myself');

      expect(createNotification).not.toHaveBeenCalled();
    });
  });

  describe('getNotes', () => {
    it('should return paginated notes', async () => {
      const notes = [buildLeadNote(), buildLeadNote()];
      mockPrisma.leadNote.findMany.mockResolvedValue(notes);
      mockPrisma.leadNote.count.mockResolvedValue(2);

      const result = await getNotes('lead_1', 1, 20);

      expect(result.data).toHaveLength(2);
      expect(result.meta).toEqual({ total: 2, page: 1, pageSize: 20, totalPages: 1 });
    });
  });

  describe('updateNote', () => {
    it('should update note if author matches', async () => {
      const note = buildLeadNote({ id: 'note_1', authorId: 'user_1' });
      mockPrisma.leadNote.findUnique.mockResolvedValue(note);
      mockPrisma.leadNote.update.mockResolvedValue({ ...note, body: 'Updated' });

      const result = await updateNote('note_1', 'user_1', 'Updated');

      expect(mockPrisma.leadNote.update).toHaveBeenCalledWith({
        where: { id: 'note_1' },
        data: { body: 'Updated', mentions: [] },
      });
      expect(result.body).toBe('Updated');
    });

    it('should throw if not the author', async () => {
      const note = buildLeadNote({ id: 'note_1', authorId: 'user_1' });
      mockPrisma.leadNote.findUnique.mockResolvedValue(note);

      await expect(updateNote('note_1', 'user_other', 'Updated')).rejects.toThrow();
    });

    it('should throw if note not found', async () => {
      mockPrisma.leadNote.findUnique.mockResolvedValue(null);

      await expect(updateNote('note_x', 'user_1', 'Updated')).rejects.toThrow();
    });
  });

  describe('deleteNote', () => {
    it('should delete note if author matches', async () => {
      const note = buildLeadNote({ id: 'note_1', authorId: 'user_1' });
      mockPrisma.leadNote.findUnique.mockResolvedValue(note);
      mockPrisma.leadNote.delete.mockResolvedValue(note);

      await deleteNote('note_1', 'user_1');

      expect(mockPrisma.leadNote.delete).toHaveBeenCalledWith({ where: { id: 'note_1' } });
    });

    it('should throw if not the author', async () => {
      const note = buildLeadNote({ id: 'note_1', authorId: 'user_1' });
      mockPrisma.leadNote.findUnique.mockResolvedValue(note);

      await expect(deleteNote('note_1', 'user_other')).rejects.toThrow();
    });
  });
});
