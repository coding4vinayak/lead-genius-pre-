import nodemailer from 'nodemailer';
import { logger } from '../lib/logger.js';

export interface TestAccount {
  user: string;
  pass: string;
  smtp: { host: string; port: number; secure: boolean };
  web: string;
}

let etherealAccount: TestAccount | null = null;

export async function createEtherealAccount(): Promise<TestAccount> {
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealAccount = {
      user: testAccount.user,
      pass: testAccount.pass,
      smtp: {
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
      },
      web: 'https://ethereal.email/messages',
    };
    logger.info('Ethereal test account created', { user: testAccount.user });
    return etherealAccount;
  } catch (err: any) {
    logger.error('Failed to create Ethereal account', { error: err.message });
    throw err;
  }
}

export function getEtherealAccount(): TestAccount | null {
  return etherealAccount;
}

export function getEtherealSmtpConfig(): { host: string; port: number; secure: boolean; auth: { user: string; pass: string } } | null {
  if (!etherealAccount) return null;
  return {
    host: etherealAccount.smtp.host,
    port: etherealAccount.smtp.port,
    secure: etherealAccount.smtp.secure,
    auth: { user: etherealAccount.user, pass: etherealAccount.pass },
  };
}

export interface MailtrapConfig {
  host: string;
  port: number;
  auth: { user: string; pass: string };
  inboxId?: number;
}

export function getMailtrapConfig(apiKey: string, inboxId?: number): MailtrapConfig {
  return {
    host: 'sandbox.api.mailtrap.io',
    port: 2525,
    auth: { user: 'api', pass: apiKey },
    inboxId,
  };
}

export async function getMailtrapEmails(apiKey: string, inboxId?: number): Promise<any[]> {
  try {
    const id = inboxId || 1;
    const res = await fetch(`https://mailtrap.io/api/accounts/${id}/inboxes/${id}/messages`, {
      headers: { 'Api-Token': apiKey },
    });
    if (!res.ok) {
      logger.warn(`Mailtrap API returned ${res.status}`);
      return [];
    }
    return res.json();
  } catch (err: any) {
    logger.warn('Failed to fetch Mailtrap emails', { error: err.message });
    return [];
  }
}

export function getMailtrapEmailUrl(inboxId: number, messageId: number): string {
  return `https://mailtrap.io/inboxes/${inboxId}/messages/${messageId}`;
}
