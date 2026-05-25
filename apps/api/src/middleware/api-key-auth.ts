import { Request, Response, NextFunction } from 'express';
import { validateApiKey } from '../services/api-keys.js';

export interface ApiKeyPayload {
  id: string;
  workspaceId: string;
  plan: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      apiKey?: ApiKeyPayload;
    }
  }
}

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKeyHeader = req.headers['x-api-key'] as string | undefined;

  if (!apiKeyHeader) {
    return next();
  }

  validateApiKey(apiKeyHeader)
    .then((keyRecord) => {
      if (!keyRecord) {
        return res.status(401).json({ error: { code: 401, message: 'Invalid API key' } });
      }

      req.apiKey = {
        id: keyRecord.id,
        workspaceId: keyRecord.workspaceId,
        plan: keyRecord.workspace.plan,
        permissions: keyRecord.permissions,
      };

      next();
    })
    .catch(next);
}
