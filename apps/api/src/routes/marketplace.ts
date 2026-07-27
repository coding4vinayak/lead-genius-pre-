import { Router, Request, Response, NextFunction } from 'express';
import { validate } from '../middleware/validate.js';
import { recipeActivateSchema } from '@leadgenius/shared';
import {
  listTemplates,
  listRecipes,
  activateRecipe,
} from '../services/webhook-marketplace.js';

const router = Router();

router.get('/templates', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string | undefined;
    const templates = await listTemplates(category);
    res.json({ data: templates });
  } catch (err) { next(err); }
});

router.get('/recipes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const category = req.query.category as string | undefined;
    const recipes = await listRecipes(category);
    res.json({ data: recipes });
  } catch (err) { next(err); }
});

router.post('/recipes/:id/activate', validate(recipeActivateSchema), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { config } = req.body as { config: Record<string, unknown> };
    const recipe = await activateRecipe(id, config);
    res.json({ data: recipe });
  } catch (err) { next(err); }
});

export default router;
