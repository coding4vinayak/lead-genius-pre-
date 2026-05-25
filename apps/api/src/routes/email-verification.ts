import { Router, Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { emailVerificationSchema, bulkEmailVerificationSchema } from '@leadgenius/shared';
import { verifyEmail, bulkVerify, getVerificationStatus } from '../services/email-verification.js';

const router = Router();

router.post('/verify', validate(emailVerificationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body as { email: string };
    const result = await verifyEmail(email);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.post('/bulk-verify', validate(bulkEmailVerificationSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { emails } = req.body as { emails: string[] };
    const results = await bulkVerify(emails);
    res.json({ data: results });
  } catch (err) { next(err); }
});

router.get('/status/:email', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.params.email as string;
    const verification = await getVerificationStatus(email);
    if (!verification) throw AppError.notFound('Email verification');
    res.json({ data: verification });
  } catch (err) { next(err); }
});

export default router;
