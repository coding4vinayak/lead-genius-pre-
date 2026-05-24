import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Socket } from 'net';
import { startSmtpServer, stopSmtpServer, isSmtpRunning } from './smtp-server.js';
import { clearEmails, getAllEmails } from './email-sandbox.js';

function smtpConnect(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    const sock = new Socket();
    sock.setNoDelay(true);
    sock.connect(port, '127.0.0.1', () => resolve(sock));
    sock.on('error', reject);
  });
}

function waitResp(sock: Socket, timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('SMTP response timeout')), timeoutMs);
    const onData = (data: Buffer) => {
      cleanup();
      resolve(data.toString().trim());
    };
    const onEnd = () => {
      cleanup();
      reject(new Error('Connection closed'));
    };
    const cleanup = () => {
      clearTimeout(timer);
      sock.removeListener('data', onData);
      sock.removeListener('end', onEnd);
    };
    sock.on('data', onData);
    sock.on('end', onEnd);
  });
}

async function smtpSession(port: number): Promise<Socket> {
  const sock = await smtpConnect(port);
  const greeting = await waitResp(sock);
  expect(greeting).toContain('220');
  return sock;
}

async function smtpCommand(sock: Socket, cmd: string, expected?: string): Promise<string> {
  await new Promise<void>((r) => sock.write(cmd + '\r\n', r));
  const resp = await waitResp(sock);
  if (expected) expect(resp).toContain(expected);
  return resp;
}

async function smtpQuit(sock: Socket): Promise<void> {
  sock.destroy();
}

describe('smtp-server', () => {
  const TEST_PORT = 11990;

  beforeEach(async () => {
    clearEmails();
    await stopSmtpServer();
  });

  afterEach(async () => {
    await stopSmtpServer();
  });

  it('should start and stop the server', async () => {
    await startSmtpServer(TEST_PORT);
    expect(isSmtpRunning()).toBe(true);
    await stopSmtpServer();
    expect(isSmtpRunning()).toBe(false);
  });

  it('should handle EADDRINUSE gracefully', async () => {
    await startSmtpServer(TEST_PORT);
    await startSmtpServer(TEST_PORT);
    expect(isSmtpRunning()).toBe(true);
  });

  it('should greet on connect and accept QUIT', async () => {
    await startSmtpServer(TEST_PORT);
    const sock = await smtpSession(TEST_PORT);
    expect(sock).toBeDefined();
    sock.destroy();
  });

  it('should capture email via DATA command', async () => {
    await startSmtpServer(TEST_PORT);
    const sock = await smtpSession(TEST_PORT);

    await smtpCommand(sock, 'HELO test', '250');
    await smtpCommand(sock, 'MAIL FROM:<sender@test.com>', '250');
    await smtpCommand(sock, 'RCPT TO:<recipient@test.com>', '250');
    await smtpCommand(sock, 'DATA', '354');

    // Write email headers + body line by line
    await new Promise<void>((r) => sock.write('From: Sender <sender@test.com>\r\n', r));
    await new Promise<void>((r) => sock.write('To: Recipient <recipient@test.com>\r\n', r));
    await new Promise<void>((r) => sock.write('Subject: SMTP Test\r\n', r));
    await new Promise<void>((r) => sock.write('\r\n', r));
    await new Promise<void>((r) => sock.write('Hello from SMTP!\r\n', r));
    await new Promise<void>((r) => sock.write('.\r\n', r));

    await waitResp(sock);
    await smtpQuit(sock);

    await new Promise((r) => setTimeout(r, 100));
    const emails = getAllEmails();
    expect(emails.length).toBeGreaterThanOrEqual(1);
    const captured = emails[0];
    expect(captured.subject).toBe('SMTP Test');
    expect(captured.text).toContain('Hello from SMTP!');
    expect(captured.tags).toContain('smtp-captured');
  });

  it('should capture email with HTML content', async () => {
    await startSmtpServer(TEST_PORT);
    const sock = await smtpSession(TEST_PORT);

    await smtpCommand(sock, 'HELO test', '250');
    await smtpCommand(sock, 'MAIL FROM:<sender@test.com>', '250');
    await smtpCommand(sock, 'RCPT TO:<recipient@test.com>', '250');
    await smtpCommand(sock, 'DATA', '354');

    await new Promise<void>((r) => sock.write('From: Sender <sender@test.com>\r\n', r));
    await new Promise<void>((r) => sock.write('To: Recipient <recipient@test.com>\r\n', r));
    await new Promise<void>((r) => sock.write('Subject: HTML Email\r\n', r));
    await new Promise<void>((r) => sock.write('Content-Type: text/html\r\n', r));
    await new Promise<void>((r) => sock.write('\r\n', r));
    await new Promise<void>((r) => sock.write('<html><body><h1>Hello</h1></body></html>\r\n', r));
    await new Promise<void>((r) => sock.write('.\r\n', r));

    await waitResp(sock);
    await smtpQuit(sock);

    await new Promise((r) => setTimeout(r, 100));
    const emails = getAllEmails();
    const captured = emails.find((e) => e.subject === 'HTML Email');
    expect(captured).toBeDefined();
    expect(captured!.html).toContain('<h1>Hello</h1>');
  });
});
