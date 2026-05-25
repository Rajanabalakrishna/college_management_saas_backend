import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  listResults,
  myResults,
  saveBulkResults,
  saveResult,
} from './result.controller';

const router = Router();

router.use(authenticate);

router.get('/', listResults);
router.get('/me', myResults);
router.post('/', saveResult);
router.post('/bulk', saveBulkResults);

export default router;