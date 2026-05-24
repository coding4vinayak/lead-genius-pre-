import { createServer, Socket, Server } from 'net';
import { parseHeaders } from '../lib/parse-headers.js';
import { captureEmail } from './email-sandbox.js';
import { logger } from '../lib/logger.js';

let server: Server | null = null;

interface SmtpSession {
  helo?: string;
  mailFrom?: string;
  rcptTo: string[];
  data: string[];
  state: 'greeting' | 'helo' | 'mail' | 'rcpt' | 'data' | 'done';
}

function respond(sock: Socket, code: number, msg: string) {
  sock.write(`${code} ${msg}\r\n`);
}

function parseMimeEmail(raw: string): { from: string; fromName: string; to: string; subject: string; html: string; text: string } {
  const lines = raw.split('\r\n');
  const headers: string[] = [];
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] === '') { bodyStart = i + 1; break; }
    headers.push(lines[i]);
  }
  const headerMap = parseHeaders(headers.join('\n'));
  const body = lines.slice(bodyStart).join('\r\n');

  const fromRaw = headerMap['from'] || '';
  const fromMatch = fromRaw.match(/"?([^"]*)"?\s*<([^>]+)>/);
  const fromName = fromMatch?.[1]?.trim() || '';
  const from = fromMatch?.[2] || fromRaw.trim();
  const to = headerMap['to']?.replace(/<[^>]+>/g, '').trim() || '';

  let html = '';
  let text = '';
  const ct = (headerMap['content-type'] || '').toLowerCase();
  if (ct.includes('text/html')) {
    html = body;
    text = body.replace(/<[^>]*>/g, '');
  } else {
    text = body;
  }

  return {
    from: from || 'unknown@unknown.com',
    fromName: fromName || 'Unknown',
    to: to || 'unknown@unknown.com',
    subject: headerMap['subject'] || '(no subject)',
    html,
    text,
  };
}

export function startSmtpServer(port = 1025): Promise<void> {
  return new Promise((resolve, reject) => {
    if (server?.listening) { resolve(); return; }
    const srv = createServer((sock) => {
      sock.setNoDelay(true);
      const session: SmtpSession = { rcptTo: [], data: [], state: 'greeting' };

      respond(sock, 220, 'LeadGenius Email Sandbox ESMTP Ready');

      let buffer = '';

      sock.on('data', (buf) => {
        buffer += buf.toString('utf-8');

        while (buffer.includes('\r\n') || buffer.includes('\n')) {
          const idx = buffer.indexOf('\r\n') !== -1 ? buffer.indexOf('\r\n') : buffer.indexOf('\n');
          const line = buffer.slice(0, idx).trimEnd();
          buffer = buffer.slice(idx + (buffer[idx] === '\r' ? 2 : 1));

          if (!line && session.state !== 'data') continue;

          logger.debug(`SMTP << ${line}`);

          if (session.state === 'data') {
            if (line === '.') {
              const fullRaw = session.data.join('\r\n');
              const parsed = parseMimeEmail(fullRaw);

              const captured = captureEmail({
                to: parsed.to,
                from: parsed.from,
                fromName: parsed.fromName,
                subject: parsed.subject,
                html: parsed.html,
                text: parsed.text,
                tags: ['smtp-captured'],
              });

              logger.info(`SMTP captured email to ${parsed.to}`, {
                sandboxId: captured.id,
                subject: parsed.subject,
                rcptTo: session.rcptTo,
              });

              respond(sock, 250, `OK: captured as ${captured.id}`);
              continue;
            }
            session.data.push(line);
            continue;
          }

          const upper = line.toUpperCase();

          if (upper.startsWith('HELO') || upper.startsWith('EHLO')) {
            session.helo = line.split(' ')[1] || 'unknown';
            session.state = 'helo';
            respond(sock, 250, 'Hello');
            continue;
          }

          if (upper.startsWith('MAIL FROM')) {
            const match = line.match(/<([^>]+)>/);
            session.mailFrom = match?.[1] || 'unknown';
            session.state = 'mail';
            respond(sock, 250, 'OK');
            continue;
          }

          if (upper.startsWith('RCPT TO')) {
            const match = line.match(/<([^>]+)>/);
            if (match?.[1]) session.rcptTo.push(match[1]);
            session.state = 'rcpt';
            respond(sock, 250, 'OK');
            continue;
          }

          if (upper === 'DATA') {
            session.state = 'data';
            session.data = [];
            respond(sock, 354, 'End data with <CRLF>.<CRLF>');
            continue;
          }

          if (upper === 'QUIT') {
            respond(sock, 221, 'Bye');
            sock.end();
            return;
          }

          respond(sock, 250, 'OK');
        }
      });

      sock.on('error', (err) => {
        logger.error('SMTP connection error', { error: err.message });
      });
    });

    srv.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.warn(`SMTP port ${port} in use — skipping SMTP server`);
        if (server) resolve();
      } else {
        reject(err);
      }
    });

    srv.listen(port, '127.0.0.1', () => {
      server = srv;
      logger.info(`SMTP sandbox server listening on 127.0.0.1:${port}`);
      resolve();
    });
  });
}

export function stopSmtpServer(): Promise<void> {
  return new Promise((resolve) => {
    if (!server) { resolve(); return; }
    server.close(() => {
      server = null;
      logger.info('SMTP sandbox server stopped');
      resolve();
    });
  });
}

export function isSmtpRunning(): boolean {
  return server?.listening ?? false;
}
