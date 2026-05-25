import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';
import { createNotification } from './notification.js';
import { logActivity } from './lead-activity.js';

function extractMentions(body: string): string[] {
  const matches = body.match(/@(\w+)/g);
  if (!matches) return [];
  return Array.from(new Set(matches.map((m) => m.slice(1))));
}

export async function createNote(leadId: string, authorId: string, body: string) {
  const mentions = extractMentions(body);

  const note = await prisma.leadNote.create({
    data: {
      leadId,
      authorId,
      body,
      mentions,
    },
  });

  await logActivity(leadId, authorId, 'note_added', 'Note added to lead').catch(() => {});

  if (mentions.length > 0) {
    const mentionedUsers = await prisma.user.findMany({
      where: { name: { in: mentions } },
    });

    await Promise.all(
      mentionedUsers
        .filter((u) => u.id !== authorId)
        .map((u) =>
          createNotification(
            u.id,
            'system',
            'You were mentioned in a note',
            `You were mentioned in a note on a lead`,
            { leadId, noteId: note.id },
          ).catch(() => {}),
        ),
    );
  }

  return note;
}

export async function getNotes(leadId: string, page = 1, pageSize = 20) {
  const [data, total] = await Promise.all([
    prisma.leadNote.findMany({
      where: { leadId },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { author: { select: { id: true, name: true, email: true } } },
    }),
    prisma.leadNote.count({ where: { leadId } }),
  ]);

  return { data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } };
}

export async function updateNote(noteId: string, authorId: string, body: string) {
  const note = await prisma.leadNote.findUnique({ where: { id: noteId } });
  if (!note) throw AppError.notFound('Note');
  if (note.authorId !== authorId) throw AppError.forbidden('Only the author can update this note');

  const mentions = extractMentions(body);
  return prisma.leadNote.update({
    where: { id: noteId },
    data: { body, mentions },
  });
}

export async function deleteNote(noteId: string, authorId: string) {
  const note = await prisma.leadNote.findUnique({ where: { id: noteId } });
  if (!note) throw AppError.notFound('Note');
  if (note.authorId !== authorId) throw AppError.forbidden('Only the author can delete this note');

  return prisma.leadNote.delete({ where: { id: noteId } });
}
