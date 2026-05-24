import Handlebars from 'handlebars';
import { prisma } from '../db.js';

export async function renderTemplate(templateId: string, variables: Record<string, string>) {
  const template = await prisma.template.findUnique({ where: { id: templateId } });
  if (!template) throw new Error('Template not found');

  const compiledBody = Handlebars.compile(template.body);
  const body = compiledBody(variables);

  let subject: string | undefined;
  if (template.subject) {
    const compiledSubject = Handlebars.compile(template.subject);
    subject = compiledSubject(variables);
  }

  return { body, subject, channel: template.channel };
}
