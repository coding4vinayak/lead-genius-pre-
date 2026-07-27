import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { emailAccountSchema, emailAccountUpdateSchema, accountRotationConfigSchema, paginationSchema } from '@leadgenius/shared';
import {
  createAccount,
  updateAccount,
  deleteAccount,
  getAccount,
  listAccounts,
  testConnection,
  getAccountHealth,
  selectNextAccount,
} from '../services/email-accounts.js';

const router = Router();

router.get('/', validate(paginationSchema, 'query'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, pageSize } = req.query as unknown as { page: number; pageSize: number };
    const { data, total } = await listAccounts(page, pageSize);
    res.json({ data, meta: { total, page, pageSize, totalPages: Math.ceil(total / pageSize) } });
  } catch (err) { next(err); }
});

router.post('/', validate(emailAccountSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await createAccount(req.body);
    res.status(201).json({ data: account });
  } catch (err) { next(err); }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const account = await getAccount(id);
    res.json({ data: account });
  } catch (err) { next(err); }
});

router.put('/:id', validate(emailAccountUpdateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const account = await updateAccount(id, req.body);
    res.json({ data: account });
  } catch (err) { next(err); }
});

router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await deleteAccount(id);
    res.status(204).send();
  } catch (err) { next(err); }
});

router.post('/:id/test-connection', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await testConnection(id);
    res.json({ data: result });
  } catch (err) { next(err); }
});

router.get('/:id/health', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const health = await getAccountHealth(id);
    res.json({ data: health });
  } catch (err) { next(err); }
});

router.post('/rotate', validate(accountRotationConfigSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { strategy } = req.body as { strategy: string };
    const account = await selectNextAccount(strategy);
    if (!account) {
      res.json({ data: null, meta: { message: 'No eligible accounts available' } });
      return;
    }
    res.json({ data: account });
  } catch (err) { next(err); }
});

export default router;
